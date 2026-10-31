package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/githubapi"
	"github.com/summit/backend/internal/githubworker"
	"github.com/summit/backend/internal/health"
	"github.com/summit/backend/internal/secrets"
)

// Dependencies holds the shared runtime dependencies injected into the Server.
type Dependencies struct {
	Config   *config.Config
	Logger   *slog.Logger
	Pool     *pgxpool.Pool
	Verifier auth.Verifier
	Secrets  secrets.Provider
	GHClient githubapi.GitHubClient
}

// Server wraps the HTTP server and its runtime dependencies.
type Server struct {
	deps       Dependencies
	httpServer *http.Server
	startTime  time.Time
	syncCancel context.CancelFunc
	githubSvc  *githubapi.Service
}

// New initializes the HTTP server with route registration performed prior to Start.
func New(deps Dependencies) *Server {
	startTime := time.Now()
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	if deps.Config == nil {
		deps.Config = config.Load()
	}

	mux := http.NewServeMux()

	// Register canonical OpenAPI health endpoint and standard liveness route
	healthHandler := health.NewHandler(deps.Config, startTime)
	mux.Handle("GET /api/v1/health", healthHandler)
	mux.Handle("HEAD /api/v1/health", healthHandler)
	mux.Handle("GET /health", healthHandler)
	mux.Handle("HEAD /health", healthHandler)
	// Keep the endpoint registered even when the database is unavailable so the
	// profile-sync client receives a clear 503 instead of a misleading 404.
	mux.Handle("POST /v1/auth/profile", auth.ProfileSyncHandler(deps.Verifier, deps.Pool))

	var ghSvc *githubapi.Service
	if deps.Pool != nil {
		ghSvc = githubapi.NewService(githubapi.Config{
			Pool:     deps.Pool,
			GHClient: deps.GHClient,
			AppCfg:   deps.Config,
			Logger:   deps.Logger,
		})
		ghHandler := githubapi.NewHandler(ghSvc, deps.Verifier, deps.Pool)
		ghHandler.RegisterRoutes(mux)

		githubworker.RegisterRoutes(mux, githubworker.Dependencies{
			Config:   deps.Config,
			Pool:     deps.Pool,
			Secrets:  deps.Secrets,
			GHClient: deps.GHClient,
			Logger:   deps.Logger,
		})
	}

	handler := withCORS(withLogging(mux, deps.Logger))

	httpSrv := &http.Server{
		Addr:              deps.Config.Address(),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &Server{
		deps:       deps,
		httpServer: httpSrv,
		startTime:  startTime,
		githubSvc:  ghSvc,
	}
}

// Start begins listening and serving HTTP traffic.
func (s *Server) Start() error {
	s.deps.Logger.Info("starting backend service",
		"address", s.deps.Config.Address(),
		"environment", s.deps.Config.Environment,
		"service", s.deps.Config.ServiceName,
		"version", s.deps.Config.ServiceVersion,
	)
	if s.githubSvc != nil && s.deps.GHClient != nil {
		syncCtx, cancel := context.WithCancel(context.Background())
		s.syncCancel = cancel
		go func() {
			if _, err := s.githubSvc.SyncAllUserRepositories(syncCtx); err != nil {
				s.deps.Logger.ErrorContext(syncCtx, "all-user GitHub repository sync failed", "error", err)
			}
		}()
	}

	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}

// Shutdown gracefully terminates the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	s.deps.Logger.Info("shutting down backend service")
	if s.syncCancel != nil {
		s.syncCancel()
	}
	return s.httpServer.Shutdown(ctx)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withLogging(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Debug("http request handled",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
			"duration", time.Since(start).String(),
		)
	})
}
