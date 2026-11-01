package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/db"
	"github.com/summit/backend/internal/githubapi"
	"github.com/summit/backend/internal/githubapp"
	"github.com/summit/backend/internal/githubworker"
	"github.com/summit/backend/internal/secrets"
	"github.com/summit/backend/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	config.LoadDevelopmentEnv(logger)

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		if !cfg.IsDevelopment() {
			logger.Error("configuration validation failed", "error", err)
			os.Exit(1)
		}
		logger.Warn("configuration validation notice (development mode)", "warning", err)
	}

	// Connect to database only if DATABASE_URL is explicitly set.
	// We do NOT auto-migrate on startup; migrations are run via the migrate tool.
	var pool *pgxpool.Pool
	if cfg.DatabaseURL != "" {
		dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
		var err error
		pool, err = db.Open(dbCtx, cfg.DatabaseURL)
		dbCancel()
		if err != nil {
			logger.Error("failed to connect to database", "error", err)
			os.Exit(1)
		}
		defer pool.Close()
		logger.Info("connected to platform database")
	} else {
		logger.Info("DATABASE_URL is not set; running in database-less mode (health only)")
	}

	// Initialize secrets provider / router
	var openBaoProvider secrets.Provider
	if cfg.OpenBaoAddr != "" {
		ob, err := secrets.NewOpenBaoProvider(cfg.OpenBaoAddr, cfg.OpenBaoToken, cfg.OpenBaoAuthRole)
		if err != nil {
			logger.Warn("failed to initialize OpenBao provider", "error", err)
		} else {
			openBaoProvider = ob
		}
	}

	secretsRouter := secrets.NewRouter(secrets.RouterConfig{
		OpenBao:                        openBaoProvider,
		Env:                            secrets.NewEnvProvider(),
		AllowEnvFallback:               cfg.IsDevelopment(),
		Logger:                         logger,
		GitHubPrivateKeyOpenBaoPath:    cfg.GitHubAppPrivateKeyOpenBaoPath,
		GitHubWebhookSecretOpenBaoPath: cfg.GitHubWebhookSecretOpenBaoPath,
		WorkerJWTSecretOpenBaoPath:     cfg.WorkerJWTSecretOpenBaoPath,
		GitHubPrivateKeyEnvVar:         "GITHUB_APP_PRIVATE_KEY",
		GitHubWebhookSecretEnvVar:      "GITHUB_WEBHOOK_SECRET",
		WorkerJWTSecretEnvVar:          "WORKER_JWT_SECRET",
	})

	// Initialize Supabase Auth verifier
	var verifier auth.Verifier
	if cfg.SupabaseJWKSURL != "" || cfg.SupabaseJWTSecret != "" {
		verifier = auth.NewSupabaseVerifier(auth.VerifierConfig{
			JWKSURL:     cfg.SupabaseJWKSURL,
			Issuer:      cfg.SupabaseJWTIssuer,
			Audience:    cfg.SupabaseJWTAudience,
			HS256Secret: cfg.SupabaseJWTSecret,
		})
	} else {
		logger.Warn("Supabase auth not configured (SUPABASE_JWKS_URL and SUPABASE_JWT_SECRET empty)")
	}

	// Initialize GitHub App client if configured
	var ghClient githubapi.GitHubClient
	if cfg.GitHubAppID == 0 || cfg.GitHubAppSlug == "" {
		logger.Warn("GitHub App integration not configured; GitHub features will be disabled")
	} else {
		pkCtx, pkCancel := context.WithTimeout(context.Background(), 5*time.Second)
		pkPEM, err := secretsRouter.Get(pkCtx, secrets.PathGitHubAppPrivateKey)
		pkCancel()
		if err != nil {
			logger.Warn("failed to load GitHub App private key; GitHub API client will be disabled", "error", err)
		} else {
			client, err := githubapp.New(githubapp.Config{
				AppID:         cfg.GitHubAppID,
				PrivateKeyPEM: pkPEM,
				BaseURL:       cfg.GitHubAPIBaseURL,
				APIVersion:    cfg.GitHubAPIVersion,
				Logger:        logger,
			})
			if err != nil {
				logger.Warn("failed to initialize GitHub App client", "error", err)
			} else {
				ghClient = client
				logger.Info("initialized GitHub App client", "app_id", cfg.GitHubAppID, "slug", cfg.GitHubAppSlug)
			}
		}
	}

	srv := server.New(server.Dependencies{
		Config:   cfg,
		Logger:   logger,
		Pool:     pool,
		Verifier: verifier,
		Secrets:  secretsRouter,
		GHClient: ghClient,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Start background webhook worker if database pool is available
	var workerCancel context.CancelFunc
	if pool != nil {
		var workerCtx context.Context
		workerCtx, workerCancel = context.WithCancel(context.Background())
		worker := githubworker.NewWorker(pool, ghClient, audit.NewPgxWriter(pool), logger, 2*time.Second)
		go func() {
			if err := worker.Run(workerCtx); err != nil && !errors.Is(err, context.Canceled) {
				logger.Error("github webhook worker stopped with error", "error", err)
			}
		}()
	}

	serverErr := make(chan error, 1)
	go func() {
		if err := srv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		logger.Error("server failed to start", "error", err)
		os.Exit(1)
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if workerCancel != nil {
		workerCancel()
	}

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}

	logger.Info("backend service stopped gracefully")
}
