package githubworker

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/secrets"
)

// Dependencies holds the shared runtime dependencies required to register
// githubworker HTTP endpoints.
type Dependencies struct {
	Config      *config.Config
	Pool        *pgxpool.Pool
	Secrets     secrets.Provider
	GHClient    GitHubClient
	AuditWriter audit.Writer
	Logger      *slog.Logger
}

// RegisterRoutes mounts the webhook endpoint and credential broker endpoint onto mux.
func RegisterRoutes(mux *http.ServeMux, deps Dependencies) {
	if mux == nil {
		return
	}

	maxBodyBytes := int64(0)
	if deps.Config != nil {
		maxBodyBytes = deps.Config.GitHubWebhookMaxBodyBytes
	}

	whHandler := NewWebhookHandler(deps.Pool, deps.Secrets, maxBodyBytes, deps.Logger)
	// Spec 8.1 route
	mux.Handle("POST /v1/webhooks/github", whHandler)

	brokerHandler := NewBrokerHandler(deps.Pool, deps.GHClient, deps.Secrets, deps.AuditWriter, deps.Logger)
	// Spec 10 route
	mux.Handle("POST /internal/v1/build-requests/{build_request_id}/source-token", brokerHandler)
}
