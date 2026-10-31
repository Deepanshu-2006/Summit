package githubworker

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/githubwebhook"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/secrets"
)

// WebhookHandler handles inbound GitHub webhook HTTP deliveries.
// It performs raw-body HMAC-SHA256 verification, deduplication against
// persisted delivery IDs, event normalization, and durable ingestion into github_webhook_events.
type WebhookHandler struct {
	pool         *pgxpool.Pool
	secrets      secrets.Provider
	maxBodyBytes int64
	logger       *slog.Logger
}

// NewWebhookHandler constructs a new WebhookHandler.
func NewWebhookHandler(pool *pgxpool.Pool, secProvider secrets.Provider, maxBodyBytes int64, logger *slog.Logger) *WebhookHandler {
	if logger == nil {
		logger = slog.Default()
	}
	if maxBodyBytes <= 0 {
		maxBodyBytes = githubwebhook.MaxBodyBytesDefault
	}
	return &WebhookHandler{
		pool:         pool,
		secrets:      secProvider,
		maxBodyBytes: maxBodyBytes,
		logger:       logger,
	}
}

func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.WriteError(w, r, http.StatusMethodNotAllowed, httpx.CodeBadRequest, "method not allowed")
		return
	}

	// 1. Extract and validate required headers
	headers, err := githubwebhook.ParseHeaders(r.Header)
	if err != nil {
		if errors.Is(err, githubwebhook.ErrMissingSignature) ||
			errors.Is(err, githubwebhook.ErrInvalidSignaturePrefix) ||
			errors.Is(err, githubwebhook.ErrMalformedSignature) {
			httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeGitHubWebhookSignatureInvalid, err.Error())
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, err.Error())
		return
	}

	// 2. Read raw request body with strictly enforced size bounds
	body, err := githubwebhook.ReadBody(r, h.maxBodyBytes)
	if err != nil {
		if errors.Is(err, githubwebhook.ErrBodyTooLarge) {
			httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, httpx.CodeBadRequest, "webhook payload exceeds maximum permitted size")
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "failed to read webhook body")
		return
	}

	// 3. Resolve webhook signing secret from provider
	if h.secrets == nil {
		h.logger.Error("webhook secret provider is nil")
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "webhook secrets not configured")
		return
	}

	secret, err := h.secrets.Get(r.Context(), secrets.PathGitHubWebhookSecret)
	if err != nil {
		h.logger.Error("failed to retrieve webhook secret", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "webhook secret not configured")
		return
	}

	// 4. Verify HMAC-SHA256 signature using constant-time comparison
	if err := githubwebhook.VerifySignature(secret, body, headers.Signature); err != nil {
		h.logger.Warn("invalid webhook signature",
			"delivery_id", headers.DeliveryID,
			"event", headers.EventType,
			"error", err,
		)
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeGitHubWebhookSignatureInvalid, "invalid webhook signature")
		return
	}

	// Database is required for durable ingestion
	if h.pool == nil {
		h.logger.Error("database pool is nil in webhook handler")
		httpx.WriteError(w, r, http.StatusServiceUnavailable, httpx.CodeInternalError, "database unavailable")
		return
	}

	// 5. Deduplication check: check if delivery ID has already been recorded
	var existingID uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		"SELECT id FROM github_webhook_events WHERE github_delivery_id = $1",
		headers.DeliveryID,
	).Scan(&existingID)
	if err == nil {
		// Delivery already recorded; return 200 without reprocessing per spec 8.2
		h.logger.Info("duplicate webhook delivery received; skipping ingestion",
			"delivery_id", headers.DeliveryID,
			"event_id", existingID,
		)
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"status":      "ok",
			"delivery_id": headers.DeliveryID,
			"duplicate":   true,
		})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		h.logger.Error("failed checking existing webhook delivery", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "database error")
		return
	}

	// 6. Normalize event payload
	ev, normErr := githubwebhook.Normalize(headers.EventType, "", body)
	if normErr != nil && !githubwebhook.IsUnsupported(normErr) {
		h.logger.Warn("failed to normalize webhook event", "error", normErr)
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "malformed webhook payload")
		return
	}

	processingStatus := "received"
	if normErr != nil && githubwebhook.IsUnsupported(normErr) {
		processingStatus = "ignored"
	}

	var action *string
	var installationID *int64
	var repositoryID *int64

	if ev != nil {
		if ev.Action != "" {
			action = &ev.Action
		}
		if ev.InstallationID != 0 {
			installationID = &ev.InstallationID
		}
		if ev.RepositoryID != 0 {
			repositoryID = &ev.RepositoryID
		}
	}

	payloadSHA := githubwebhook.PayloadSHA256(body)

	// 7. Persist event to github_webhook_events
	query := `
		INSERT INTO github_webhook_events (
			github_delivery_id,
			event_type,
			action,
			github_installation_id,
			github_repository_id,
			payload,
			payload_sha256,
			processing_status,
			received_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (github_delivery_id) DO NOTHING
		RETURNING id
	`

	var eventID uuid.UUID
	err = h.pool.QueryRow(r.Context(), query,
		headers.DeliveryID,
		headers.EventType,
		action,
		installationID,
		repositoryID,
		body,
		payloadSHA,
		processingStatus,
	).Scan(&eventID)

	if errors.Is(err, pgx.ErrNoRows) {
		// Concurrent duplicate insert race handled by ON CONFLICT DO NOTHING
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"status":      "ok",
			"delivery_id": headers.DeliveryID,
			"duplicate":   true,
		})
		return
	} else if err != nil {
		h.logger.Error("failed to insert webhook event", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to persist webhook event")
		return
	}

	h.logger.Info("webhook event durably ingested",
		"event_id", eventID,
		"delivery_id", headers.DeliveryID,
		"event_type", headers.EventType,
		"status", processingStatus,
	)

	// 8. Return HTTP 202 promptly
	httpx.WriteJSON(w, http.StatusAccepted, map[string]any{
		"status":      processingStatus,
		"delivery_id": headers.DeliveryID,
		"event_id":    eventID.String(),
	})
}
