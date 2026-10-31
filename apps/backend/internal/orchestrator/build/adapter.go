package build

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"reflect"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
)

var (
	// ErrPodNotFound is returned when a requested build pod cannot be located in the cluster.
	ErrPodNotFound = errors.New("builder pod not found")
)

// LifecycleAdapter defines the complete scheduling and lifecycle boundary for ephemeral builder pods.
type LifecycleAdapter interface {
	// CreateBuildPod creates the execution spec ConfigMap and ephemeral build Pod in the cluster.
	CreateBuildPod(ctx context.Context, spec BuildExecutionSpec) (*corev1.Pod, error)

	// GetBuildPod retrieves the Pod by attempt ID or build ID.
	GetBuildPod(ctx context.Context, buildID, attemptID string) (*corev1.Pod, error)

	// GetBuildPodStatus retrieves the extracted status summary for the attempt.
	GetBuildPodStatus(ctx context.Context, buildID, attemptID string) (*BuildPodStatus, error)

	// WatchBuildPod streams pod transition events until terminal phase or cancellation.
	WatchBuildPod(ctx context.Context, buildID, attemptID string) (<-chan PodStatusEvent, error)

	// DeleteBuildPod initiates deletion of the builder Pod.
	DeleteBuildPod(ctx context.Context, buildID, attemptID string) error

	// CleanupBuild deletes both the builder Pod and its associated ConfigMap.
	CleanupBuild(ctx context.Context, buildID, attemptID string) error
}

// Adapter implements LifecycleAdapter against the Kubernetes API.
type Adapter struct {
	client         kubernetes.Interface
	cfg            Config
	secretResolver SecretResolver
	logger         *slog.Logger
}

// NewAdapter creates a new LifecycleAdapter with injectable client and secret resolver.
func NewAdapter(client kubernetes.Interface, cfg Config, secretResolver SecretResolver, logger *slog.Logger) *Adapter {
	if logger == nil {
		logger = slog.Default()
	}
	if secretResolver == nil {
		secretResolver = NewDefaultSecretResolver()
	}

	return &Adapter{
		client:         client,
		cfg:            cfg,
		secretResolver: secretResolver,
		logger:         logger,
	}
}

// CreateBuildPod generates and persists the build pod and supporting execution spec configmap.
func (a *Adapter) CreateBuildPod(ctx context.Context, spec BuildExecutionSpec) (*corev1.Pod, error) {
	if err := spec.Validate(); err != nil {
		return nil, fmt.Errorf("invalid execution spec: %w", err)
	}

	// Resolve secret references to read-only mounts without fetching secret values
	secretMounts, err := a.secretResolver.ResolveSecretMounts(ctx, a.cfg.Namespace, spec.Credentials, spec.Reporting)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve secret mounts: %w", err)
	}

	pod, cm, err := BuildPodManifest(spec, a.cfg, secretMounts)
	if err != nil {
		return nil, fmt.Errorf("failed to build pod manifest: %w", err)
	}

	a.logger.Info("creating builder execution spec configmap",
		"namespace", a.cfg.Namespace,
		"configmap", cm.Name,
		"build_id", spec.Build.ID,
		"attempt_id", spec.Build.AttemptID,
	)

	// Create ConfigMap containing read-only execution.json
	createdCM, err := a.client.CoreV1().ConfigMaps(a.cfg.Namespace).Create(ctx, cm, metav1.CreateOptions{})
	createdConfigMap := err == nil
	if apierrors.IsAlreadyExists(err) {
		createdCM, err = a.client.CoreV1().ConfigMaps(a.cfg.Namespace).Get(ctx, cm.Name, metav1.GetOptions{})
		if err == nil && !reflect.DeepEqual(createdCM.Data, cm.Data) {
			return nil, fmt.Errorf("build execution configmap %q already exists with different content", cm.Name)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create or reuse build execution configmap: %w", err)
	}

	a.logger.Info("scheduling ephemeral builder pod in gvisor sandbox",
		"namespace", a.cfg.Namespace,
		"pod", pod.Name,
		"image", a.cfg.BuilderImage,
		"runtime_class", a.cfg.RuntimeClassName,
		"build_id", spec.Build.ID,
		"attempt_id", spec.Build.AttemptID,
	)

	// Create Pod
	createdPod, err := a.client.CoreV1().Pods(a.cfg.Namespace).Create(ctx, pod, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		createdPod, err = a.client.CoreV1().Pods(a.cfg.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
		if err == nil && (createdPod.Labels[LabelBuildID] != spec.Build.ID || createdPod.Labels[LabelAttemptID] != spec.Build.AttemptID) {
			return nil, fmt.Errorf("builder pod %q already exists for a different build attempt", pod.Name)
		}
		if err == nil {
			return createdPod, nil
		}
	}
	if err != nil {
		// Rollback ConfigMap on pod creation failure
		a.logger.Error("failed to create builder pod; rolling back configmap",
			"error", err,
			"configmap", createdCM.Name,
		)
		if createdConfigMap {
			_ = a.client.CoreV1().ConfigMaps(a.cfg.Namespace).Delete(context.Background(), createdCM.Name, metav1.DeleteOptions{})
		}
		return nil, fmt.Errorf("failed to create builder pod: %w", err)
	}

	return createdPod, nil
}

// GetBuildPod retrieves the build pod by attemptID or fallback buildID search.
func (a *Adapter) GetBuildPod(ctx context.Context, buildID, attemptID string) (*corev1.Pod, error) {
	if attemptID != "" {
		podName := BuildPodName(attemptID)
		pod, err := a.client.CoreV1().Pods(a.cfg.Namespace).Get(ctx, podName, metav1.GetOptions{})
		if err == nil {
			return pod, nil
		}
		if !apierrors.IsNotFound(err) {
			return nil, fmt.Errorf("failed to get pod %q: %w", podName, err)
		}
	}

	// Fallback to querying by labels
	selector := ""
	if attemptID != "" {
		selector = fmt.Sprintf("%s=%s", LabelAttemptID, attemptID)
	} else if buildID != "" {
		selector = fmt.Sprintf("%s=%s", LabelBuildID, buildID)
	} else {
		return nil, fmt.Errorf("%w: buildID or attemptID required", ErrPodNotFound)
	}

	list, err := a.client.CoreV1().Pods(a.cfg.Namespace).List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods with selector %q: %w", selector, err)
	}

	if len(list.Items) == 0 {
		return nil, fmt.Errorf("%w: selector %q", ErrPodNotFound, selector)
	}

	return &list.Items[0], nil
}

// GetBuildPodStatus retrieves the summarized state of the build pod.
func (a *Adapter) GetBuildPodStatus(ctx context.Context, buildID, attemptID string) (*BuildPodStatus, error) {
	pod, err := a.GetBuildPod(ctx, buildID, attemptID)
	if err != nil {
		return nil, err
	}

	status := ExtractPodStatus(pod)
	return &status, nil
}

// WatchBuildPod streams pod transition events until terminal phase, deletion, or context cancellation.
func (a *Adapter) WatchBuildPod(ctx context.Context, buildID, attemptID string) (<-chan PodStatusEvent, error) {
	selector := ""
	if attemptID != "" {
		selector = fmt.Sprintf("%s=%s", LabelAttemptID, attemptID)
	} else if buildID != "" {
		selector = fmt.Sprintf("%s=%s", LabelBuildID, buildID)
	} else {
		return nil, fmt.Errorf("attemptID or buildID must be specified for watch")
	}

	watcher, err := a.client.CoreV1().Pods(a.cfg.Namespace).Watch(ctx, metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to establish watch for selector %q: %w", selector, err)
	}

	events := make(chan PodStatusEvent, 32)

	go func() {
		defer watcher.Stop()
		defer close(events)

		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-watcher.ResultChan():
				if !ok {
					return
				}

				pod, isPod := event.Object.(*corev1.Pod)
				if !isPod {
					if event.Type == watch.Error {
						select {
						case events <- PodStatusEvent{
							Type:  event.Type,
							Error: fmt.Errorf("received watch error: %v", event.Object),
						}:
						case <-ctx.Done():
						}
					}
					continue
				}

				st := ExtractPodStatus(pod)
				ev := PodStatusEvent{
					Type:       event.Type,
					Pod:        pod,
					Phase:      pod.Status.Phase,
					Ready:      st.Ready,
					ExitCode:   st.ExitCode,
					Reason:     st.Reason,
					Message:    st.Message,
					StartedAt:  st.StartedAt,
					FinishedAt: st.FinishedAt,
				}

				select {
				case events <- ev:
				case <-ctx.Done():
					return
				}

				// Terminate watch upon terminal state or pod deletion
				if event.Type == watch.Deleted || st.IsTerminal() {
					return
				}
			}
		}
	}()

	return events, nil
}

// DeleteBuildPod deletes the ephemeral builder pod from the cluster.
func (a *Adapter) DeleteBuildPod(ctx context.Context, buildID, attemptID string) error {
	podName := BuildPodName(attemptID)
	propagation := metav1.DeletePropagationBackground
	err := a.client.CoreV1().Pods(a.cfg.Namespace).Delete(ctx, podName, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete pod %q: %w", podName, err)
	}
	return nil
}

// CleanupBuild removes both the builder pod and the execution spec configmap.
func (a *Adapter) CleanupBuild(ctx context.Context, buildID, attemptID string) error {
	var errs []error

	if err := a.DeleteBuildPod(ctx, buildID, attemptID); err != nil {
		errs = append(errs, err)
	}

	cmName := BuildConfigMapName(attemptID)
	err := a.client.CoreV1().ConfigMaps(a.cfg.Namespace).Delete(ctx, cmName, metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("failed to delete configmap %q: %w", cmName, err))
	}

	return errors.Join(errs...)
}
