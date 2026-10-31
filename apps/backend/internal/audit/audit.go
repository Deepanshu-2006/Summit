package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

// Spec 15.6 action constants
const (
	ActionInstallationInitiated     = "installation.initiated"
	ActionInstallationLinked        = "installation.linked"
	ActionInstallationUpdated       = "installation.updated"
	ActionRepositorySynced          = "repository.synced"
	ActionSourceConnected           = "source.connected"
	ActionSourceUpdated             = "source.updated"
	ActionSourceDisconnected        = "source.disconnected"
	ActionDeploymentManualRequested = "deployment.manual_requested"
	ActionInstallationSuspended     = "installation.suspended"
	ActionInstallationRevoked       = "installation.revoked"
	ActionRepositoryAccessRemoved   = "repository.access_removed"
	ActionDeploymentWebhookCreated  = "deployment.webhook_created"
	ActionWorkerTokenIssued         = "worker_token.issued"
)

// Event models an immutable audit log record.
type Event struct {
	UserID      uuid.UUID
	ActorUserID *uuid.UUID // nil for system, webhook, or worker actions
	Action      string
	EntityType  string
	EntityID    uuid.UUID
	Metadata    map[string]any
	IPAddress   string
	UserAgent   string
	RequestID   string
	CreatedAt   time.Time
}

// Writer persists audit events.
type Writer interface {
	Write(ctx context.Context, event Event) error
}

// DBExecutor represents a database executor.
type DBExecutor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// PgxWriter writes audit events to PostgreSQL via DBExecutor.
type PgxWriter struct {
	db DBExecutor
}

// NewPgxWriter creates a new PgxWriter.
func NewPgxWriter(db DBExecutor) *PgxWriter {
	return &PgxWriter{db: db}
}

// Write persists an audit event after stripping secrets from metadata.
func (w *PgxWriter) Write(ctx context.Context, event Event) error {
	if w.db == nil {
		return fmt.Errorf("nil db executor")
	}

	sanitizedMeta := SanitizeMetadata(event.Metadata)
	metaJSON, err := json.Marshal(sanitizedMeta)
	if err != nil {
		return fmt.Errorf("marshaling audit metadata: %w", err)
	}

	createdAt := event.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}

	// For Postgres INET column, an empty string causes a syntax error; pass nil instead.
	var ipParam any
	if strings.TrimSpace(event.IPAddress) != "" {
		ipParam = strings.TrimSpace(event.IPAddress)
	}

	query := `
		INSERT INTO audit_logs (
			user_id, actor_user_id, action, entity_type, entity_id,
			metadata, ip_address, user_agent, request_id, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err = w.db.Exec(ctx, query,
		event.UserID,
		event.ActorUserID,
		event.Action,
		event.EntityType,
		event.EntityID,
		metaJSON,
		ipParam,
		event.UserAgent,
		event.RequestID,
		createdAt,
	)
	if err != nil {
		return fmt.Errorf("inserting audit log: %w", err)
	}
	return nil
}

// Sensitive key substrings that indicate secrets
var sensitiveKeyPatterns = []string{
	"token",
	"secret",
	"private_key",
	"privatekey",
	"password",
	"credential",
	"authorization",
	"signature",
	"key",
}

// SanitizeMetadata recursively redacts sensitive fields from metadata maps and slices.
func SanitizeMetadata(meta map[string]any) map[string]any {
	if meta == nil {
		return map[string]any{}
	}
	result := make(map[string]any, len(meta))
	for k, v := range meta {
		if isSensitiveKey(k) {
			result[k] = "[REDACTED]"
		} else {
			result[k] = sanitizeValue(v)
		}
	}
	return result
}

func sanitizeValue(v any) any {
	switch val := v.(type) {
	case map[string]any:
		return SanitizeMetadata(val)
	case []any:
		sanitizedSlice := make([]any, len(val))
		for i, item := range val {
			sanitizedSlice[i] = sanitizeValue(item)
		}
		return sanitizedSlice
	default:
		return val
	}
}

func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	for _, pattern := range sensitiveKeyPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}
