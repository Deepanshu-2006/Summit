package orchestrator

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/cluster"
	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/cluster/managed"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/db"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/orchestrator/cleaner"
	"github.com/summit/backend/internal/orchestrator/monitor"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/platformdb"
	"golang.org/x/sync/errgroup"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// App is the Summit orchestrator service. It coordinates outbox polling,
// ephemeral build pod lifecycle, deployment state machine transitions,
// SummitService workload reconciliation, and build resource cleanup.
type App struct {
	cfg           Config
	logger        *slog.Logger
	clusterClient cluster.Client
	kubeClient    kubernetes.Interface
	dynClient     dynamic.Interface
	dbPool        *pgxpool.Pool
	ownedPool     bool
	store         *platformdb.Store

	queueWorker  *queue.Queue
	queueHandler queue.Handler
	monitor      *monitor.Monitor
	workloadCtrl *workloads.Controller
	pruner       *cleaner.Pruner
	provisioner  *addons.TenantProvisioner
	adapter      build.LifecycleAdapter
}

// Dependencies encapsulates injectable dependencies for orchestrator initialization.
type Dependencies struct {
	Config        Config
	Logger        *slog.Logger
	ClusterClient cluster.Client
	KubeClient    kubernetes.Interface
	DynamicClient dynamic.Interface
	DBPool        *pgxpool.Pool
	Store         *platformdb.Store

	QueueWorker  *queue.Queue
	QueueHandler queue.Handler
	Monitor      *monitor.Monitor
	WorkloadCtrl *workloads.Controller
	Pruner       *cleaner.Pruner
	Provisioner  *addons.TenantProvisioner
	Adapter      build.LifecycleAdapter
}

// New creates an instance of the orchestrator application.
func New(deps Dependencies) (*App, error) {
	if strings.TrimSpace(deps.Config.BuildNamespace) == "" {
		deps.Config.BuildNamespace = "summit-builds"
	}

	if err := deps.Config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid orchestrator config: %w", err)
	}

	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}

	// 1. Cluster reachability inspection client
	clusterClient := deps.ClusterClient
	if clusterClient == nil {
		client, err := cluster.NewClient(deps.Config.Cluster)
		if err != nil {
			if deps.Config.IsDevelopment() || deps.ClusterClient != nil {
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

	// 2. Database connection pool & platformdb store
	dbPool := deps.DBPool
	ownedPool := false
	store := deps.Store
	if dbPool == nil && strings.TrimSpace(deps.Config.DatabaseURL) != "" {
		poolCtx, poolCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer poolCancel()
		pool, err := db.Open(poolCtx, deps.Config.DatabaseURL)
		if err != nil {
			if deps.Config.IsDevelopment() {
				logger.Warn("database connection failed; continuing in degraded development mode", "error", err)
			} else {
				return nil, fmt.Errorf("failed to connect to platform database: %w", err)
			}
		} else {
			dbPool = pool
			ownedPool = true
		}
	}
	if store == nil && dbPool != nil {
		store = platformdb.New(dbPool)
	}

	// 3. Kubernetes typed and dynamic API clients
	kubeClient := deps.KubeClient
	if kubeClient == nil && deps.Config.Cluster.Target != "" {
		kc, err := cluster.NewKubernetesClient(deps.Config.Cluster)
		if err != nil {
			if deps.Config.IsDevelopment() || deps.ClusterClient != nil {
				logger.Warn("kubernetes client initialization failed; continuing in degraded mode", "error", err)
			} else {
				return nil, fmt.Errorf("failed to initialize kubernetes clientset: %w", err)
			}
		} else {
			kubeClient = kc
		}
	}

	dynClient := deps.DynamicClient
	if dynClient == nil && deps.Config.Cluster.Target != "" {
		dc, err := cluster.NewDynamicClient(deps.Config.Cluster)
		if err != nil {
			if deps.Config.IsDevelopment() || deps.ClusterClient != nil {
				logger.Warn("dynamic client initialization failed; continuing in degraded mode", "error", err)
			} else {
				return nil, fmt.Errorf("failed to initialize dynamic kubernetes client: %w", err)
			}
		} else {
			dynClient = dc
		}
	}

	// 4. Build Pod lifecycle adapter
	adapter := deps.Adapter
	if adapter == nil && kubeClient != nil {
		buildCfg := build.DefaultConfig()
		if deps.Config.BuildNamespace != "" {
			buildCfg.Namespace = deps.Config.BuildNamespace
		}
		if deps.Config.BuilderImage != "" {
			buildCfg.BuilderImage = deps.Config.BuilderImage
		}
		if deps.Config.BuilderRuntimeClass != "" {
			buildCfg.RuntimeClassName = deps.Config.BuilderRuntimeClass
		}
		adapter = build.NewAdapter(kubeClient, buildCfg, build.NewDefaultSecretResolver(), logger)
	}

	// 5. Tenant add-on provisioner (behind contract C8 feature flags)
	provisioner := deps.Provisioner
	if provisioner == nil && deps.Config.Cluster.Target != cluster.TargetMock {
		restCfg, err := cluster.RESTConfig(deps.Config.Cluster)
		if err == nil && restCfg != nil {
			applier, err := addons.NewApplierFromConfig(restCfg)
			if err == nil && applier != nil {
				addonCfg := addons.DefaultConfig()
				addonCfg.AppsDomain = deps.Config.AppsDomain
				addonCfg.EnableTenantQuotas = deps.Config.EnableTenantQuotas
				addonCfg.EnableNetworkPolicy = deps.Config.EnableNetworkPolicy
				addonCfg.NetworkPolicyMode = deps.Config.NetworkPolicyMode
				addonCfg.EnableIngress = deps.Config.EnableIngress
				addonCfg.EnableESO = deps.Config.EnableESO
				addonCfg.Network.BuildNamespace = deps.Config.BuildNamespace
				provisioner, _ = addons.NewTenantProvisioner(addonCfg, applier, logger)
			}
		}
	}

	// 6. Outbox Queue Worker (Loop 1)
	queueWorker := deps.QueueWorker
	if queueWorker == nil && dbPool != nil {
		queueWorker = queue.New(
			dbPool,
			queue.WithPollInterval(deps.Config.OutboxPollInterval),
			queue.WithLogger(logger),
		)
	}

	// 7. Deployment Monitor (Loop 2)
	monitorInst := deps.Monitor
	if monitorInst == nil && store != nil {
		mCfg := monitor.DefaultConfig()
		mCfg.Interval = deps.Config.MonitorPollInterval
		mCfg.AppsDomain = deps.Config.AppsDomain
		mCfg.WorkloadPullSecret = deps.Config.WorkloadPullSecret
		mCfg.PublicURLScheme = deps.Config.PublicURLScheme
		mCfg.PublicURLPort = deps.Config.PublicURLPort
		monitorOpts := []monitor.Option{monitor.WithAddonLister(storeAddonLister{store: store})}
		if kubeClient != nil {
			monitorOpts = append(monitorOpts, monitor.WithManagedAddon(managed.NewProvisioner(kubeClient, pinnedCatalog{})))
		}
		var err error
		monitorInst, err = monitor.New(
			store,
			store,
			kubeClient,
			dynClient,
			adapter,
			provisioner,
			mCfg,
			logger,
			monitorOpts...,
		)
		if err != nil {
			logger.Warn("unable to initialize deployment monitor", "error", err)
		}
	}

	// 8. SummitService Controller (Loop 3)
	workloadCtrl := deps.WorkloadCtrl
	if workloadCtrl == nil && kubeClient != nil && dynClient != nil {
		reconciler := workloads.NewReconciler(
			kubeClient,
			workloads.WithStatusClient(dynClient),
			workloads.WithDefaultPullSecret(deps.Config.WorkloadPullSecret),
		)
		var err error
		workloadCtrl, err = workloads.NewController(
			dynClient,
			reconciler,
			deps.Config.ReconcilerInterval,
			logger,
		)
		if err != nil {
			logger.Warn("unable to initialize workload controller", "error", err)
		}
	}

	// 9. Build cleaner pruner (Loop 4)
	prunerInst := deps.Pruner
	if prunerInst == nil && kubeClient != nil {
		cCfg := cleaner.DefaultConfig()
		if deps.Config.BuildNamespace != "" {
			cCfg.Namespace = deps.Config.BuildNamespace
		}
		if deps.Config.PrunerInterval > 0 {
			cCfg.Interval = deps.Config.PrunerInterval
		}
		var err error
		prunerInst, err = cleaner.New(kubeClient, logger, cCfg)
		if err != nil {
			logger.Warn("unable to initialize cleaner pruner", "error", err)
		}
	}

	return &App{
		cfg:           deps.Config,
		logger:        logger,
		clusterClient: clusterClient,
		kubeClient:    kubeClient,
		dynClient:     dynClient,
		dbPool:        dbPool,
		ownedPool:     ownedPool,
		store:         store,
		queueWorker:   queueWorker,
		queueHandler:  deps.QueueHandler,
		monitor:       monitorInst,
		workloadCtrl:  workloadCtrl,
		pruner:        prunerInst,
		provisioner:   provisioner,
		adapter:       adapter,
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

// KubeClient returns the kubernetes clientset.
func (a *App) KubeClient() kubernetes.Interface {
	return a.kubeClient
}

// DynamicClient returns the dynamic kubernetes client.
func (a *App) DynamicClient() dynamic.Interface {
	return a.dynClient
}

// DBPool returns the platform database connection pool.
func (a *App) DBPool() *pgxpool.Pool {
	return a.dbPool
}

// Store returns the platformdb store.
func (a *App) Store() *platformdb.Store {
	return a.store
}

// Adapter returns the builder lifecycle adapter.
func (a *App) Adapter() build.LifecycleAdapter {
	return a.adapter
}

// Close releases resources owned by the application.
func (a *App) Close() {
	if a.ownedPool && a.dbPool != nil {
		a.dbPool.Close()
	}
}

// Run starts the orchestrator service: validates cluster reachability, then launches
// all configured runtime loops (queue worker, deployment monitor, workload controller,
// and cleaner pruner) concurrently until context cancellation.
func (a *App) Run(ctx context.Context) error {
	defer a.Close()

	a.logger.Info("starting summit orchestrator",
		"environment", a.cfg.Environment,
		"cluster_target", a.cfg.Cluster.Target,
		"build_namespace", a.cfg.BuildNamespace,
		"builder_image", a.cfg.BuilderImage,
		"apps_domain", a.cfg.AppsDomain,
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

	g, gCtx := errgroup.WithContext(ctx)

	// Loop 1: Outbox queue worker
	if a.queueWorker != nil && a.queueHandler != nil {
		g.Go(func() error {
			if err := a.queueWorker.Run(gCtx, a.queueHandler); err != nil && !errors.Is(err, context.Canceled) {
				a.logger.Error("outbox queue worker terminated with error", "error", err)
				return fmt.Errorf("outbox queue worker: %w", err)
			}
			return nil
		})
	}

	// Loop 2: Deployment monitor
	if a.monitor != nil {
		g.Go(func() error {
			if err := a.monitor.Run(gCtx); err != nil && !errors.Is(err, context.Canceled) {
				a.logger.Error("deployment monitor terminated with error", "error", err)
				return fmt.Errorf("deployment monitor: %w", err)
			}
			return nil
		})
	}

	// Loop 3: SummitService workload controller
	if a.workloadCtrl != nil {
		g.Go(func() error {
			if err := a.workloadCtrl.Run(gCtx); err != nil && !errors.Is(err, context.Canceled) {
				a.logger.Error("workload controller terminated with error", "error", err)
				return fmt.Errorf("workload controller: %w", err)
			}
			return nil
		})
	}

	// Loop 4: Cleaner pruner
	if a.pruner != nil {
		g.Go(func() error {
			if err := a.pruner.Run(gCtx); err != nil && !errors.Is(err, context.Canceled) {
				a.logger.Error("cleaner pruner terminated with error", "error", err)
				return fmt.Errorf("cleaner pruner: %w", err)
			}
			return nil
		})
	}

	// If no background loops are active (e.g. degraded development skeleton mode), wait on ctx.Done
	if a.queueWorker == nil && a.monitor == nil && a.workloadCtrl == nil && a.pruner == nil {
		select {
		case <-ctx.Done():
			a.logger.Info("summit orchestrator received shutdown signal; stopping gracefully")
			return nil
		}
	}

	return g.Wait()
}
