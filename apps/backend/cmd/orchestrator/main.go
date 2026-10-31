package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"k8s.io/client-go/kubernetes"

	"github.com/summit/backend/internal/cluster"
	"github.com/summit/backend/internal/db"
	"github.com/summit/backend/internal/orchestrator"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/orchestrator/worker"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/workertoken"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, logger); err != nil {
		logger.Error("orchestrator terminated with error", "error", err)
		os.Exit(1)
	}

	logger.Info("summit orchestrator stopped gracefully")
}

func run(ctx context.Context, logger *slog.Logger) error {
	cfg := orchestrator.LoadConfig()
	if err := cfg.Validate(); err != nil {
		return err
	}

	if !cfg.IsDevelopment() {
		if strings.TrimSpace(cfg.DatabaseURL) == "" {
			return fmt.Errorf("DATABASE_URL is required in non-development environment")
		}
		if len(cfg.WorkerJWTSecret) < workertoken.MinSecretLength {
			return fmt.Errorf("WORKER_JWT_SECRET must be at least %d bytes in non-development environment", workertoken.MinSecretLength)
		}
	}

	// 1. Platform Database Connection Pool
	var dbPool *pgxpool.Pool
	var store *platformdb.Store
	if strings.TrimSpace(cfg.DatabaseURL) != "" {
		poolCtx, poolCancel := context.WithTimeout(ctx, 10*time.Second)
		defer poolCancel()
		pool, err := db.Open(poolCtx, cfg.DatabaseURL)
		if err != nil {
			if !cfg.IsDevelopment() {
				return fmt.Errorf("failed to connect to platform database: %w", err)
			}
			logger.Warn("database connection failed; continuing in degraded mode", "error", err)
		} else {
			dbPool = pool
			defer dbPool.Close()
			store = platformdb.New(dbPool)
		}
	}

	// 2. Kubernetes Typed & Dynamic Clients
	var kubeClient kubernetes.Interface
	if cfg.Cluster.Target != "" {
		kc, err := cluster.NewKubernetesClient(cfg.Cluster)
		if err != nil {
			if !cfg.IsDevelopment() {
				return fmt.Errorf("failed to initialize kubernetes client: %w", err)
			}
			logger.Warn("kubernetes client initialization failed; continuing in degraded mode", "error", err)
		} else {
			kubeClient = kc
		}
	}

	// 3. Ephemeral Builder Adapter & Worker Resolver
	var adapter build.LifecycleAdapter
	var queueHandler queue.Handler
	if kubeClient != nil {
		buildCfg := build.DefaultConfig()
		if cfg.BuildNamespace != "" {
			buildCfg.Namespace = cfg.BuildNamespace
		}
		if cfg.BuilderImage != "" {
			buildCfg.BuilderImage = cfg.BuilderImage
		}
		if cfg.BuilderRuntimeClass != "" {
			buildCfg.RuntimeClassName = cfg.BuilderRuntimeClass
		}
		adapter = build.NewAdapter(kubeClient, buildCfg, build.NewDefaultSecretResolver(), logger)

		if dbPool != nil && store != nil {
			resolverCfg := worker.ResolverConfig{
				WorkerJWTSecret: []byte(cfg.WorkerJWTSecret),
				APIInternalURL:  cfg.APIInternalURL,
				BuildNamespace:  cfg.BuildNamespace,
				GHCRPushSecret:  cfg.GHCRPushSecret,
			}
			resolver := worker.NewProductionResolver(store, kubeClient, resolverCfg, logger)
			buildHandler := &worker.BuildHandler{
				DB:          dbPool,
				Adapter:     adapter,
				Resolver:    resolver,
				Deployments: store,
			}
			queueHandler = buildHandler.Handle
		}
	}

	// 4. Construct Orchestrator App
	deps := orchestrator.Dependencies{
		Config:       cfg,
		Logger:       logger,
		KubeClient:   kubeClient,
		DBPool:       dbPool,
		Store:        store,
		QueueHandler: queueHandler,
		Adapter:      adapter,
	}

	app, err := orchestrator.New(deps)
	if err != nil {
		return err
	}

	if err := app.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}

	return nil
}
