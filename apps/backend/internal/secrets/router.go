package secrets

import (
	"context"
	"fmt"
	"log/slog"
)

// Router resolves symbolic secret paths to the appropriate provider.
// In production, it routes configured OpenBao paths to the OpenBao provider.
// In development/test, it falls back to the env provider for paths that have
// a direct env variable mapping.
//
// Resolution order (deterministic):
//  1. If a route is registered for the symbolic path and its provider is non-nil,
//     use that provider with the mapped path.
//  2. If the environment allows fallback (development/test) and a fallback route
//     exists, use the fallback provider with the mapped env var name.
//  3. Return ErrSecretNotFound.
type Router struct {
	routes   map[string]route
	fallback bool // true if env fallback is allowed (development/test)
	logger   *slog.Logger
}

type route struct {
	provider Provider
	path     string // The actual path or env var name to pass to the provider
}

// RouterConfig configures the Router.
type RouterConfig struct {
	// OpenBao provider, may be nil in development.
	OpenBao Provider
	// Env provider for fallback in development/test.
	Env Provider
	// AllowEnvFallback enables env fallback (should be true only in development/test).
	AllowEnvFallback bool
	// Logger for route resolution logging.
	Logger *slog.Logger

	// Symbolic paths and their OpenBao paths.
	// These are the OpenBao mount/key paths for each secret.
	GitHubPrivateKeyOpenBaoPath    string
	GitHubWebhookSecretOpenBaoPath string
	WorkerJWTSecretOpenBaoPath     string

	// Direct env var names for fallback.
	GitHubPrivateKeyEnvVar    string
	GitHubWebhookSecretEnvVar string
	WorkerJWTSecretEnvVar     string
}

// Symbolic path constants used by callers to request secrets.
const (
	PathGitHubAppPrivateKey = "github/app-private-key"
	PathGitHubWebhookSecret = "github/webhook-secret"
	PathWorkerJWTSecret     = "worker/jwt-secret"
)

// NewRouter creates a Router with the given configuration.
func NewRouter(cfg RouterConfig) *Router {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	r := &Router{
		routes:   make(map[string]route),
		fallback: cfg.AllowEnvFallback,
		logger:   logger,
	}

	// Register OpenBao routes
	if cfg.OpenBao != nil {
		if cfg.GitHubPrivateKeyOpenBaoPath != "" {
			r.routes[PathGitHubAppPrivateKey] = route{provider: cfg.OpenBao, path: cfg.GitHubPrivateKeyOpenBaoPath}
		}
		if cfg.GitHubWebhookSecretOpenBaoPath != "" {
			r.routes[PathGitHubWebhookSecret] = route{provider: cfg.OpenBao, path: cfg.GitHubWebhookSecretOpenBaoPath}
		}
		if cfg.WorkerJWTSecretOpenBaoPath != "" {
			r.routes[PathWorkerJWTSecret] = route{provider: cfg.OpenBao, path: cfg.WorkerJWTSecretOpenBaoPath}
		}
	}

	// Register env fallback routes (only used if primary route is missing and fallback is allowed)
	if cfg.AllowEnvFallback && cfg.Env != nil {
		if _, exists := r.routes[PathGitHubAppPrivateKey]; !exists {
			envVar := cfg.GitHubPrivateKeyEnvVar
			if envVar == "" {
				envVar = "GITHUB_APP_PRIVATE_KEY"
			}
			r.routes[PathGitHubAppPrivateKey] = route{provider: cfg.Env, path: envVar}
		}
		if _, exists := r.routes[PathGitHubWebhookSecret]; !exists {
			envVar := cfg.GitHubWebhookSecretEnvVar
			if envVar == "" {
				envVar = "GITHUB_WEBHOOK_SECRET"
			}
			r.routes[PathGitHubWebhookSecret] = route{provider: cfg.Env, path: envVar}
		}
		if _, exists := r.routes[PathWorkerJWTSecret]; !exists {
			envVar := cfg.WorkerJWTSecretEnvVar
			if envVar == "" {
				envVar = "WORKER_JWT_SECRET"
			}
			r.routes[PathWorkerJWTSecret] = route{provider: cfg.Env, path: envVar}
		}
	}

	return r
}

// Get resolves the symbolic path and retrieves the secret value.
func (r *Router) Get(ctx context.Context, symbolicPath string) ([]byte, error) {
	rt, ok := r.routes[symbolicPath]
	if !ok {
		return nil, fmt.Errorf("%w: no route configured for symbolic path %q", ErrSecretNotFound, symbolicPath)
	}
	val, err := rt.provider.Get(ctx, rt.path)
	if err != nil {
		return nil, fmt.Errorf("resolving secret %q via path %q: %w", symbolicPath, rt.path, err)
	}
	return val, nil
}
