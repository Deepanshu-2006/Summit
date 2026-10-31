package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/summit/backend/internal/cluster"
)

// App is the Summit orchestrator service skeleton.
// In Phase 0, it establishes configuration, lifecycle signals, read-only cluster API reachability,
// and event decoding foundations without executing outbox leasing loops, Kubernetes mutations,
// or builder pod workloads.
type App struct {
	cfg           Config
	logger        *slog.Logger
	clusterClient cluster.Client
}

// Dependencies encapsulates injectable dependencies for orchestrator initialization.
type Dependencies struct {
	Config        Config
	Logger        *slog.Logger
	ClusterClient cluster.Client
}

// New creates an instance of the orchestrator application skeleton.
// If ClusterClient is nil, an attempt will be made to construct a default client from cfg.Cluster.
func New(deps Dependencies) (*App, error) {
	if err := deps.Config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid orchestrator config: %w", err)
	}

	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}

	clusterClient := deps.ClusterClient
	if clusterClient == nil {
		client, err := cluster.NewClient(deps.Config.Cluster)
		if err != nil {
			// In development mode, allow proceeding with a mock/degraded client if kubeconfig is absent
			if deps.Config.IsDevelopment() {
				logger.Warn("unable to initialize kubernetes client from environment; falling back to degraded mock client",
					"error", err,
					"target", deps.Config.Cluster.Target,
				)
				clusterClient = &cluster.MockClient{
					TargetType: deps.Config.Cluster.Target,
					ProbeErr:   err,
				}
			} else {
				return nil, fmt.Errorf("failed to initialize cluster client: %w", err)
			}
		} else {
			clusterClient = client
		}
	}

	return &App{
		cfg:           deps.Config,
		logger:        logger,
		clusterClient: clusterClient,
	}, nil
}

// Config returns a copy of the active orchestrator configuration.
func (a *App) Config() Config {
	return a.cfg
}

// ClusterClient returns the cluster inspection client.
func (a *App) ClusterClient() cluster.Client {
	return a.clusterClient
}

// Run starts the orchestrator application skeleton, performs an initial read-only
// cluster reachability probe, and awaits context termination.
//
// In Phase 0, no background outbox consumer, Kubernetes client mutations,
// gVisor isolation setup, or builder executions are initiated.
func (a *App) Run(ctx context.Context) error {
	a.logger.Info("starting summit orchestrator skeleton (phase 0 foundations)",
		"environment", a.cfg.Environment,
		"cluster_target", a.cfg.Cluster.Target,
		"probe_timeout", a.cfg.Cluster.ProbeTimeout,
	)

	// Perform read-only API reachability probe
	probeTimeout := a.cfg.Cluster.ProbeTimeout
	if probeTimeout <= 0 {
		probeTimeout = 5 * time.Second
	}

	probeCtx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	versionInfo, err := a.clusterClient.ProbeReachability(probeCtx)
	if err != nil {
		if a.cfg.IsDevelopment() {
			a.logger.Warn("cluster reachability probe failed; continuing in degraded development mode",
				"error", err,
				"target", a.clusterClient.Target(),
			)
		} else {
			return fmt.Errorf("initial cluster reachability check failed: %w", err)
		}
	} else {
		a.logger.Info("kubernetes cluster reachability verified (read-only)",
			"git_version", versionInfo.GitVersion,
			"major", versionInfo.Major,
			"minor", versionInfo.Minor,
			"platform", versionInfo.Platform,
			"target", a.clusterClient.Target(),
		)
	}

	// In Phase 0, the orchestrator skeleton waits for a termination signal.
	// Outbox polling and cluster mutations are deferred to subsequent phases.
	select {
	case <-ctx.Done():
		a.logger.Info("summit orchestrator received shutdown signal; stopping gracefully")
		return nil
	}
}
