// Package cleaner garbage-collects leftovers of ephemeral build resources in
// the build namespace: terminal builder Pods and orphaned per-build Secrets and
// execution-spec ConfigMaps (docs/mvp_runtime_contracts.md C7.4).
//
// The Pruner only ever touches objects carrying the Summit build labels; it
// never deletes unlabeled objects such as the operator-managed ghcr-push Secret.
package cleaner

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// Labels and names mirror internal/orchestrator/build/pod.go (kept local so the
// cleaner has no dependency on the build package; a test asserts they match).
const (
	LabelBuildID   = "summit.dev/build-id"
	LabelAttemptID = "summit.dev/attempt-id"
	LabelComponent = "summit.dev/component"

	ComponentBuilder     = "builder"
	ComponentBuilderSpec = "builder-spec"

	// SecretNamePrefix is the prefix of per-build Secrets (contract C4).
	SecretNamePrefix = "summit-build-"
)

// Default values from the implementation plan section 13.2 / contract C7.
const (
	DefaultNamespace      = "summit-builds"
	DefaultTerminalPodTTL = 30 * time.Minute
	DefaultOrphanTTL      = 15 * time.Minute
	DefaultInterval       = 10 * time.Minute
)

// Config controls the Pruner.
type Config struct {
	// Namespace is the build namespace to sweep.
	Namespace string
	// TerminalPodTTL is how long a Succeeded/Failed builder Pod is kept
	// (measured from container finish time, falling back to creation time).
	TerminalPodTTL time.Duration
	// OrphanTTL is the minimum age of a Secret/ConfigMap before it can be
	// considered orphaned. It must exceed the orchestrator's create-secret ->
	// create-pod window.
	OrphanTTL time.Duration
	// Interval is the period of Run.
	Interval time.Duration
}

// DefaultConfig returns the documented defaults.
func DefaultConfig() Config {
	return Config{
		Namespace:      DefaultNamespace,
		TerminalPodTTL: DefaultTerminalPodTTL,
		OrphanTTL:      DefaultOrphanTTL,
		Interval:       DefaultInterval,
	}
}

// Validate checks the configuration.
func (c Config) Validate() error {
	switch {
	case strings.TrimSpace(c.Namespace) == "":
		return errors.New("cleaner: namespace must not be empty")
	case c.TerminalPodTTL <= 0:
		return errors.New("cleaner: terminal pod TTL must be positive")
	case c.OrphanTTL <= 0:
		return errors.New("cleaner: orphan TTL must be positive")
	case c.Interval <= 0:
		return errors.New("cleaner: interval must be positive")
	}
	return nil
}

// Report summarises one sweep. Slices hold the names of deleted objects.
type Report struct {
	PodsDeleted       []string
	SecretsDeleted    []string
	ConfigMapsDeleted []string
	// Errors counts individual delete/list failures (also returned joined).
	Errors int
}

// Total returns the number of deleted objects.
func (r Report) Total() int {
	return len(r.PodsDeleted) + len(r.SecretsDeleted) + len(r.ConfigMapsDeleted)
}

// Option customises a Pruner.
type Option func(*Pruner)

// WithClock injects a clock (tests).
func WithClock(now func() time.Time) Option {
	return func(p *Pruner) {
		if now != nil {
			p.now = now
		}
	}
}

// Pruner deletes terminal builder Pods and orphaned build Secrets/ConfigMaps.
type Pruner struct {
	client kubernetes.Interface
	logger *slog.Logger
	cfg    Config
	now    func() time.Time
}

// New constructs a Pruner. A nil logger uses slog.Default().
func New(client kubernetes.Interface, logger *slog.Logger, cfg Config, opts ...Option) (*Pruner, error) {
	if client == nil {
		return nil, errors.New("cleaner: kubernetes client is required")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if logger == nil {
		logger = slog.Default()
	}
	p := &Pruner{client: client, logger: logger, cfg: cfg, now: time.Now}
	for _, o := range opts {
		o(p)
	}
	return p, nil
}

// Run sweeps immediately and then every Interval until ctx is cancelled.
// Sweep errors are logged and never stop the loop. Returns ctx.Err().
func (p *Pruner) Run(ctx context.Context) error {
	ticker := time.NewTicker(p.cfg.Interval)
	defer ticker.Stop()
	for {
		report, err := p.RunOnce(ctx)
		if err != nil {
			p.logger.Warn("build cleanup sweep finished with errors", "error", err, "errors", report.Errors)
		}
		if report.Total() > 0 {
			p.logger.Info("build cleanup sweep",
				"namespace", p.cfg.Namespace,
				"pods_deleted", len(report.PodsDeleted),
				"secrets_deleted", len(report.SecretsDeleted),
				"configmaps_deleted", len(report.ConfigMapsDeleted))
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// RunOnce performs a single sweep: terminal pods first, then orphaned
// Secrets and ConfigMaps (using the pod set remaining after the pod pass).
func (p *Pruner) RunOnce(ctx context.Context) (Report, error) {
	var (
		report Report
		errs   []error
	)
	ns := p.cfg.Namespace
	now := p.now()

	// Pods: every pod carrying the build-id label, regardless of component.
	podList, err := p.client.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{LabelSelector: LabelBuildID})
	if err != nil {
		report.Errors++
		return report, fmt.Errorf("cleaner: list pods: %w", err)
	}

	liveBuilds := map[string]struct{}{}
	liveAttempts := map[string]struct{}{}
	track := func(pod *corev1.Pod) {
		liveBuilds[pod.Labels[LabelBuildID]] = struct{}{}
		if a := pod.Labels[LabelAttemptID]; a != "" {
			liveAttempts[a] = struct{}{}
		}
	}

	for i := range podList.Items {
		pod := &podList.Items[i]
		if pod.Labels[LabelComponent] != ComponentBuilder || !isTerminalPhase(pod.Status.Phase) ||
			now.Sub(podFinishedAt(pod)) < p.cfg.TerminalPodTTL {
			track(pod)
			continue
		}
		if err := p.deletePod(ctx, pod); err != nil {
			report.Errors++
			errs = append(errs, err)
			track(pod)
			continue
		}
		report.PodsDeleted = append(report.PodsDeleted, pod.Name)
		p.logger.Info("deleted terminal build pod", "pod", pod.Name, "phase", string(pod.Status.Phase))
	}

	// Secrets.
	secrets, err := p.client.CoreV1().Secrets(ns).List(ctx, metav1.ListOptions{LabelSelector: LabelBuildID})
	if err != nil {
		report.Errors++
		errs = append(errs, fmt.Errorf("cleaner: list secrets: %w", err))
	} else {
		for i := range secrets.Items {
			s := &secrets.Items[i]
			if !strings.HasPrefix(s.Name, SecretNamePrefix) || s.Labels[LabelBuildID] == "" {
				continue
			}
			if !p.orphaned(s.ObjectMeta, now, liveBuilds, nil) {
				continue
			}
			err := p.client.CoreV1().Secrets(ns).Delete(ctx, s.Name, deleteOptions(s.UID))
			if err != nil && !apierrors.IsNotFound(err) {
				report.Errors++
				errs = append(errs, fmt.Errorf("cleaner: delete secret %q: %w", s.Name, err))
				continue
			}
			report.SecretsDeleted = append(report.SecretsDeleted, s.Name)
			p.logger.Info("deleted orphaned build secret", "secret", s.Name)
		}
	}

	// ConfigMaps (execution specs only).
	cms, err := p.client.CoreV1().ConfigMaps(ns).List(ctx, metav1.ListOptions{
		LabelSelector: LabelComponent + "=" + ComponentBuilderSpec,
	})
	if err != nil {
		report.Errors++
		errs = append(errs, fmt.Errorf("cleaner: list configmaps: %w", err))
	} else {
		for i := range cms.Items {
			cm := &cms.Items[i]
			if cm.Labels[LabelBuildID] == "" {
				continue
			}
			if !p.orphaned(cm.ObjectMeta, now, liveBuilds, liveAttempts) {
				continue
			}
			err := p.client.CoreV1().ConfigMaps(ns).Delete(ctx, cm.Name, deleteOptions(cm.UID))
			if err != nil && !apierrors.IsNotFound(err) {
				report.Errors++
				errs = append(errs, fmt.Errorf("cleaner: delete configmap %q: %w", cm.Name, err))
				continue
			}
			report.ConfigMapsDeleted = append(report.ConfigMapsDeleted, cm.Name)
			p.logger.Info("deleted orphaned build configmap", "configmap", cm.Name)
		}
	}

	return report, errors.Join(errs...)
}

// orphaned reports whether the object is old enough and has no live pod.
// When attempts is non-nil and the object has an attempt label, matching is by
// attempt; otherwise by build id.
func (p *Pruner) orphaned(meta metav1.ObjectMeta, now time.Time, builds, attempts map[string]struct{}) bool {
	if meta.DeletionTimestamp != nil {
		return false
	}
	if now.Sub(meta.CreationTimestamp.Time) < p.cfg.OrphanTTL {
		return false
	}
	if attempts != nil {
		if a := meta.Labels[LabelAttemptID]; a != "" {
			_, live := attempts[a]
			return !live
		}
	}
	_, live := builds[meta.Labels[LabelBuildID]]
	return !live
}

func (p *Pruner) deletePod(ctx context.Context, pod *corev1.Pod) error {
	err := p.client.CoreV1().Pods(p.cfg.Namespace).Delete(ctx, pod.Name, deleteOptions(pod.UID))
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("cleaner: delete pod %q: %w", pod.Name, err)
	}
	return nil
}

// deleteOptions guards against deleting a same-named object that was
// recreated after listing.
func deleteOptions(uid types.UID) metav1.DeleteOptions {
	if uid == "" {
		return metav1.DeleteOptions{}
	}
	return metav1.DeleteOptions{Preconditions: &metav1.Preconditions{UID: &uid}}
}

func isTerminalPhase(phase corev1.PodPhase) bool {
	return phase == corev1.PodSucceeded || phase == corev1.PodFailed
}

// podFinishedAt returns the latest container finish time, falling back to the
// pod creation time when no container reports termination.
func podFinishedAt(pod *corev1.Pod) time.Time {
	finished := pod.CreationTimestamp.Time
	var latest time.Time
	for _, group := range [][]corev1.ContainerStatus{pod.Status.InitContainerStatuses, pod.Status.ContainerStatuses} {
		for _, cs := range group {
			if t := cs.State.Terminated; t != nil && t.FinishedAt.Time.After(latest) {
				latest = t.FinishedAt.Time
			}
		}
	}
	if latest.After(finished) {
		return latest
	}
	return finished
}
