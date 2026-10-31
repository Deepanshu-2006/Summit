// Package monitor polls in-flight deployments and drives them across the lifecycle:
// building -> image_ready -> deploying -> health_checking -> running (contract C2, C7.2).
// It also detects build failures, unexpected pod terminations, timeouts, and user cancellations.
package monitor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/platformdb"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// Config controls deployment monitor polling intervals and defaults.
type Config struct {
	Interval           time.Duration
	BatchSize          int
	WorkloadPullSecret string
	AppsDomain         string
	BuildTimeoutBuffer time.Duration
	RolloutTimeout     time.Duration
}

// DefaultConfig returns documented defaults for the deployment monitor.
func DefaultConfig() Config {
	return Config{
		Interval:           3 * time.Second,
		BatchSize:          100,
		WorkloadPullSecret: "ghcr-pull",
		AppsDomain:         "localtest.me",
		BuildTimeoutBuffer: 30 * time.Second,
		RolloutTimeout:     10 * time.Minute,
	}
}

// Option configures a Monitor.
type Option func(*Monitor)

// WithClock injects a custom time function for deterministic testing.
func WithClock(now func() time.Time) Option {
	return func(m *Monitor) {
		if now != nil {
			m.now = now
		}
	}
}

// Monitor drives in-flight deployment state transitions by watching database status,
// ephemeral build pods, and Kubernetes workload readiness.
type Monitor struct {
	rolloutStore platformdb.RolloutStore
	buildStore   platformdb.BuildStore
	kubeClient   kubernetes.Interface
	dynClient    dynamic.Interface
	adapter      build.LifecycleAdapter
	provisioner  *addons.TenantProvisioner
	cfg          Config
	logger       *slog.Logger
	now          func() time.Time
}

// New creates a new Deployment Monitor.
func New(
	rolloutStore platformdb.RolloutStore,
	buildStore platformdb.BuildStore,
	kubeClient kubernetes.Interface,
	dynClient dynamic.Interface,
	adapter build.LifecycleAdapter,
	provisioner *addons.TenantProvisioner,
	cfg Config,
	logger *slog.Logger,
	opts ...Option,
) (*Monitor, error) {
	if rolloutStore == nil {
		return nil, errors.New("monitor: rolloutStore is required")
	}
	if logger == nil {
		logger = slog.Default()
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 3 * time.Second
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}
	if cfg.BuildTimeoutBuffer <= 0 {
		cfg.BuildTimeoutBuffer = 30 * time.Second
	}
	if cfg.RolloutTimeout <= 0 {
		cfg.RolloutTimeout = 10 * time.Minute
	}

	m := &Monitor{
		rolloutStore: rolloutStore,
		buildStore:   buildStore,
		kubeClient:   kubeClient,
		dynClient:    dynClient,
		adapter:      adapter,
		provisioner:  provisioner,
		cfg:          cfg,
		logger:       logger,
		now:          time.Now,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m, nil
}

// Step runs one polling pass over active deployments.
func (m *Monitor) Step(ctx context.Context) (int, error) {
	deployments, err := m.rolloutStore.ListActiveDeployments(ctx, m.cfg.BatchSize)
	if err != nil {
		return 0, fmt.Errorf("monitor: list active deployments: %w", err)
	}

	var errs []error
	processed := 0

	for i := range deployments {
		active := &deployments[i]
		if err := m.reconcileDeployment(ctx, active); err != nil {
			errs = append(errs, fmt.Errorf("deployment %s: %w", active.Deployment.ID, err))
		} else {
			processed++
		}
	}

	return processed, errors.Join(errs...)
}

// Run continuously polls until context cancellation.
func (m *Monitor) Run(ctx context.Context) error {
	m.logger.Info("starting deployment monitor loop",
		"interval", m.cfg.Interval,
		"batch_size", m.cfg.BatchSize,
	)

	ticker := time.NewTicker(m.cfg.Interval)
	defer ticker.Stop()

	for {
		if _, err := m.Step(ctx); err != nil && ctx.Err() == nil {
			m.logger.Warn("deployment monitor step encountered errors", "error", err)
		}

		select {
		case <-ctx.Done():
			m.logger.Info("stopping deployment monitor loop")
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (m *Monitor) reconcileDeployment(ctx context.Context, active *platformdb.ActiveDeployment) error {
	// 1. User cancellation check
	if active.Deployment.CancelRequestedAt != nil {
		if !active.Deployment.Status.IsTerminal() {
			attemptID := ""
			if active.BuildJob.AttemptID != nil {
				attemptID = active.BuildJob.AttemptID.String()
			}
			if m.adapter != nil && attemptID != "" {
				_ = m.adapter.DeleteBuildPod(ctx, active.BuildJob.ID.String(), attemptID)
			}
			if m.buildStore != nil {
				_, _, _ = m.buildStore.MarkBuildJobTerminal(ctx, active.BuildJob.ID, platformdb.BuildCancelled, "deployment cancelled by user")
			}
			_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{active.Deployment.Status}, platformdb.DeploymentCancelled, "deployment cancelled by user")
			return err
		}
		return nil
	}

	switch active.Deployment.Status {
	case platformdb.DeploymentQueued:
		// Transition queued -> building if build pod is dispatched or running
		if active.BuildJob.Status == platformdb.BuildDispatched || active.BuildJob.Status == platformdb.BuildRunning {
			_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentQueued}, platformdb.DeploymentBuilding, "build pod dispatched")
			return err
		}
		return nil

	case platformdb.DeploymentBuilding:
		// Check build result persisted on build_jobs
		switch active.BuildJob.Status {
		case platformdb.BuildSucceeded:
			repo := deref(active.BuildJob.ImageRepository)
			digest := deref(active.BuildJob.ImageDigest)
			if repo != "" && digest != "" {
				imageRef := fmt.Sprintf("%s@%s", repo, digest)
				_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentBuilding}, platformdb.DeploymentImageReady, "build succeeded with immutable digest", platformdb.WithImageRef(imageRef))
				return err
			}
			m.logger.Warn("build succeeded but image repository or digest is missing", "build_job_id", active.BuildJob.ID)
			return nil

		case platformdb.BuildFailed:
			errMsg := deref(active.BuildJob.ErrorMessage)
			if errMsg == "" {
				errMsg = "build execution failed"
			}
			_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentBuilding}, platformdb.DeploymentFailed, errMsg, platformdb.WithErrorMessage(errMsg))
			return err

		case platformdb.BuildCancelled:
			_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentBuilding}, platformdb.DeploymentCancelled, "build execution cancelled")
			return err

		default:
			// In-flight: check timeout
			timeoutSec := 600
			if active.BuildJob.TimeoutSeconds != nil && *active.BuildJob.TimeoutSeconds >= 10 {
				timeoutSec = *active.BuildJob.TimeoutSeconds
			}
			startTime := active.BuildJob.CreatedAt
			if active.BuildJob.DispatchedAt != nil {
				startTime = *active.BuildJob.DispatchedAt
			}
			if m.now().Sub(startTime) > time.Duration(timeoutSec)*time.Second+m.cfg.BuildTimeoutBuffer {
				attemptID := ""
				if active.BuildJob.AttemptID != nil {
					attemptID = active.BuildJob.AttemptID.String()
				}
				if m.adapter != nil && attemptID != "" {
					_ = m.adapter.DeleteBuildPod(ctx, active.BuildJob.ID.String(), attemptID)
				}
				msg := fmt.Sprintf("build execution timed out after %d seconds", timeoutSec)
				if m.buildStore != nil {
					_, _, _ = m.buildStore.MarkBuildJobTerminal(ctx, active.BuildJob.ID, platformdb.BuildFailed, msg)
				}
				_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentBuilding}, platformdb.DeploymentFailed, msg, platformdb.WithErrorMessage(msg))
				return err
			}

			// In-flight: check unexpected pod termination
			if m.adapter != nil && active.BuildJob.AttemptID != nil {
				podStatus, err := m.adapter.GetBuildPodStatus(ctx, active.BuildJob.ID.String(), active.BuildJob.AttemptID.String())
				if err == nil && podStatus != nil && podStatus.IsTerminal() && podStatus.Phase == corev1.PodFailed {
					msg := fmt.Sprintf("builder pod failed unexpectedly: exit_code=%v reason=%s", podStatus.ExitCode, podStatus.Reason)
					if podStatus.Message != "" {
						msg += ": " + podStatus.Message
					}
					if m.buildStore != nil {
						_, _, _ = m.buildStore.MarkBuildJobTerminal(ctx, active.BuildJob.ID, platformdb.BuildFailed, msg)
					}
					_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentBuilding}, platformdb.DeploymentFailed, msg, platformdb.WithErrorMessage(msg))
					return err
				}
			}
			return nil
		}

	case platformdb.DeploymentImageReady:
		// Deploy immutable digest to SummitService
		imageRef := deref(active.Deployment.ImageRef)
		if imageRef == "" && active.BuildJob.ImageRepository != nil && active.BuildJob.ImageDigest != nil {
			imageRef = fmt.Sprintf("%s@%s", *active.BuildJob.ImageRepository, *active.BuildJob.ImageDigest)
		}
		if imageRef == "" {
			return fmt.Errorf("deployment %s has no image reference", active.Deployment.ID)
		}

		serviceName := fmt.Sprintf("svc-%s", active.ServiceID.String())
		namespace := fmt.Sprintf("tenant-%s", active.UserID.String())
		port := int32(active.Resources.Port)
		if port <= 0 {
			port = workloads.DefaultPort
		}
		replicas := int32(active.Resources.MinReplicas)
		if replicas <= 0 {
			replicas = workloads.DefaultReplicas
		}

		pullSecret := m.cfg.WorkloadPullSecret
		if strings.TrimSpace(pullSecret) == "" {
			pullSecret = workloads.DefaultPullSecretName
		}

		cpuReq := resource.MustParse(fmt.Sprintf("%dm", active.Resources.CPURequestMillicores))
		cpuLim := resource.MustParse(fmt.Sprintf("%dm", active.Resources.CPULimitMillicores))
		memReq := resource.MustParse(fmt.Sprintf("%dMi", active.Resources.MemoryRequestMB))
		memLim := resource.MustParse(fmt.Sprintf("%dMi", active.Resources.MemoryLimitMB))

		summitSvc := &workloads.SummitService{
			TypeMeta: metav1.TypeMeta{
				APIVersion: workloads.SchemeGroupVersion.String(),
				Kind:       workloads.KindSummitService,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      serviceName,
				Namespace: namespace,
			},
			Spec: workloads.SummitServiceSpec{
				Image:          imageRef,
				Replicas:       &replicas,
				Port:           port,
				PullSecretName: pullSecret,
				TenantID:       active.UserID.String(),
				ProjectID:      active.ProjectID.String(),
				ServiceID:      active.ServiceID.String(),
				ReleaseID:      active.Deployment.ID.String(),
				Resources: corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    cpuReq,
						corev1.ResourceMemory: memReq,
					},
					Limits: corev1.ResourceList{
						corev1.ResourceCPU:    cpuLim,
						corev1.ResourceMemory: memLim,
					},
				},
			},
		}
		summitSvc.SetDefaults()

		if m.dynClient != nil {
			gvr := workloads.SchemeGroupVersion.WithResource("summitservices")
			unstrMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(summitSvc)
			if err != nil {
				return fmt.Errorf("converting SummitService: %w", err)
			}
			unstr := &unstructured.Unstructured{Object: unstrMap}
			unstr.SetLabels(summitSvc.SafeLabels())

			existing, err := m.dynClient.Resource(gvr).Namespace(namespace).Get(ctx, serviceName, metav1.GetOptions{})
			if apierrors.IsNotFound(err) {
				_, err = m.dynClient.Resource(gvr).Namespace(namespace).Create(ctx, unstr, metav1.CreateOptions{})
			} else if err == nil {
				existing.Object["spec"] = unstr.Object["spec"]
				existing.SetLabels(summitSvc.SafeLabels())
				_, err = m.dynClient.Resource(gvr).Namespace(namespace).Update(ctx, existing, metav1.UpdateOptions{})
			}
			if err != nil {
				return fmt.Errorf("applying SummitService resource: %w", err)
			}
		}

		var publicURL string
		if m.provisioner != nil {
			_, _ = m.provisioner.EnsureTenant(ctx, active.UserID.String())
			expRes, err := m.provisioner.EnsureServiceExposure(ctx, addons.ExposureParams{
				UserID:      active.UserID.String(),
				ProjectID:   active.ProjectID.String(),
				ProjectSlug: active.ProjectSlug,
				ServiceID:   active.ServiceID.String(),
				ServiceName: serviceName,
				Port:        port,
				Environment: active.EnvironmentName,
			})
			if err == nil && expRes.Host != "" {
				publicURL = fmt.Sprintf("https://%s", expRes.Host)
			}
		}

		opts := []platformdb.TransitionOption{platformdb.WithImageRef(imageRef)}
		if publicURL != "" {
			opts = append(opts, platformdb.WithPublicURL(publicURL))
		}
		_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentImageReady}, platformdb.DeploymentDeploying, "SummitService applied", opts...)
		return err

	case platformdb.DeploymentDeploying:
		serviceName := fmt.Sprintf("svc-%s", active.ServiceID.String())
		namespace := fmt.Sprintf("tenant-%s", active.UserID.String())
		if m.kubeClient != nil {
			dep, err := m.kubeClient.AppsV1().Deployments(namespace).Get(ctx, serviceName, metav1.GetOptions{})
			if err == nil && dep != nil {
				_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentDeploying}, platformdb.DeploymentHealthChecking, "workload deployment created; awaiting readiness")
				return err
			}
		}
		return nil

	case platformdb.DeploymentHealthChecking:
		serviceName := fmt.Sprintf("svc-%s", active.ServiceID.String())
		namespace := fmt.Sprintf("tenant-%s", active.UserID.String())
		if m.kubeClient != nil {
			dep, err := m.kubeClient.AppsV1().Deployments(namespace).Get(ctx, serviceName, metav1.GetOptions{})
			if err == nil && dep != nil {
				replicas := int32(1)
				if dep.Spec.Replicas != nil {
					replicas = *dep.Spec.Replicas
				}
				if dep.Status.AvailableReplicas >= replicas && dep.Status.UpdatedReplicas >= replicas {
					_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentHealthChecking}, platformdb.DeploymentRunning, "workload healthy and available")
					if err != nil {
						return err
					}
					promRes, promErr := m.rolloutStore.PromoteRelease(ctx, active.Deployment.ID, nil)
					if promErr != nil {
						m.logger.Warn("failed to promote release after reaching running", "deployment_id", active.Deployment.ID, "error", promErr)
					} else {
						m.logger.Info("promoted active release", "deployment_id", active.Deployment.ID, "release_number", promRes.Release.ReleaseNumber, "superseded", len(promRes.SupersededDeploymentIDs))
					}
					return nil
				}
				if active.Deployment.StartedAt != nil && m.now().Sub(*active.Deployment.StartedAt) > m.cfg.RolloutTimeout {
					msg := "deployment timed out awaiting available replicas"
					_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentHealthChecking}, platformdb.DeploymentFailed, msg, platformdb.WithErrorMessage(msg))
					return err
				}
			}
		}
		return nil
	}

	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
