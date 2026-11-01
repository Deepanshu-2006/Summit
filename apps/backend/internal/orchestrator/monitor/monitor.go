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

	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/platformdb"
	corev1 "k8s.io/api/core/v1"
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
	// PublicURLScheme is http or https. Empty defaults to https.
	PublicURLScheme string
	// PublicURLPort is included in public_url. Empty, 80, and 443 are omitted.
	PublicURLPort string
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
		PublicURLScheme:    "https",
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
	provisioner  ServiceExposure
	managedAddon addonRuntime
	addons       AddonLister
	volumes      VolumeSizer
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
	provisioner ServiceExposure,
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
	if strings.TrimSpace(cfg.PublicURLScheme) == "" {
		cfg.PublicURLScheme = "https"
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
			if hasBuildJob(active) {
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
		// Image and addon deployments are inserted at image_ready and have no build job.
		if !hasBuildJob(active) {
			return nil
		}
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
			timeoutSec := build.DefaultTimeoutSeconds
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
		return m.reconcileImageReady(ctx, active)

	case platformdb.DeploymentDeploying:
		return m.reconcileDeploying(ctx, active)

	case platformdb.DeploymentHealthChecking:
		return m.reconcileHealth(ctx, active)
	}

	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
