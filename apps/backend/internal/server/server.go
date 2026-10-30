package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/health"
)

// Server wraps the HTTP server and dependencies.
type Server struct {
	cfg        *config.Config
	httpServer *http.Server
	logger     *slog.Logger
	startTime  time.Time
}

// New initializes the HTTP server with standard middleware and routes.
func New(cfg *config.Config, logger *slog.Logger) *Server {
	startTime := time.Now()
	mux := http.NewServeMux()

	healthHandler := health.NewHandler(cfg, startTime)

	// Register canonical OpenAPI health endpoint and standard liveness route
	mux.Handle("GET /api/v1/health", healthHandler)
	mux.Handle("HEAD /api/v1/health", healthHandler)
	mux.Handle("GET /health", healthHandler)
	mux.Handle("HEAD /health", healthHandler)

	handler := withCORS(withLogging(mux, logger))

	httpSrv := &http.Server{
		Addr:              cfg.Address(),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &Server{
		cfg:        cfg,
		httpServer: httpSrv,
		logger:     logger,
		startTime:  startTime,
	}
}

// Start begins listening and serving HTTP traffic.
func (s *Server) Start() error {
	s.logger.Info("starting backend service",
		"address", s.cfg.Address(),
		"environment", s.cfg.Environment,
		"service", s.cfg.ServiceName,
		"version", s.cfg.ServiceVersion,
	)

	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}

// Shutdown gracefully terminates the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down backend service")
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
