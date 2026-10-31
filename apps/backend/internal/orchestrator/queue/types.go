package queue

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Outbox status vocabulary strictly aligned with PostgreSQL enum outbox_status in 0001_baseline.up.sql.
const (
	StatusPending   = "pending"
	StatusClaimed   = "claimed"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
)

// BuildJob status vocabulary strictly aligned with CHECK constraint on build_jobs table in 0001_baseline.up.sql.
const (
	BuildJobStatusQueued     = "queued"
	BuildJobStatusDispatched = "dispatched"
	BuildJobStatusRunning    = "running"
	BuildJobStatusSucceeded  = "succeeded"
	BuildJobStatusFailed     = "failed"
	BuildJobStatusCancelled  = "cancelled"
)

// Supported aggregate types and event types emitted to outbox_events.
const (
	AggregateTypeDeployment           = "deployment"
	EventTypeDeploymentBuildRequested = "deployment.build.requested"
)

// Common queue errors.
var (
	ErrNoEvents           = errors.New("queue: no eligible events available")
	ErrEventNotFound      = errors.New("queue: outbox event not found")
	ErrLeaseLost          = errors.New("queue: lease lost or expired")
	ErrAlreadyCompleted   = errors.New("queue: outbox event is already completed")
	ErrMaxRetriesExceeded = errors.New("queue: max retries exceeded")
	ErrDuplicateIgnored   = errors.New("queue: duplicate event ignored")
	ErrNilDB              = errors.New("queue: db instance is nil")
	ErrInvalidLimit       = errors.New("queue: claim limit must be positive")
)

// EventRecord represents a strongly-typed outbox_events row.
type EventRecord struct {
	ID            uuid.UUID       `json:"id"`
	AggregateType string          `json:"aggregate_type"`
	AggregateID   uuid.UUID       `json:"aggregate_id"`
	EventType     string          `json:"event_type"`
	Payload       json.RawMessage `json:"payload"`
	Status        string          `json:"status"`
	Attempts      int             `json:"attempts"`
	MaxRetries    int             `json:"max_retries"`
	AvailableAt   time.Time       `json:"available_at"`
	LockedUntil   *time.Time      `json:"locked_until,omitempty"`
	LockedBy      *string         `json:"locked_by,omitempty"`
	LastError     *string         `json:"last_error,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	PublishedAt   *time.Time      `json:"published_at,omitempty"`
	ProcessedAt   *time.Time      `json:"processed_at,omitempty"`
}

// IsExpired reports whether the record's lease has expired according to the reference time.
func (e *EventRecord) IsExpired(now time.Time) bool {
	if e.LockedUntil == nil {
		return true
	}
	return e.LockedUntil.Before(now)
}

// DuplicateCheckResult details the outcome of an idempotency duplicate check.
type DuplicateCheckResult struct {
	IsDuplicate    bool      `json:"is_duplicate"`
	Reason         string    `json:"reason"`
	ExistingStatus string    `json:"existing_status,omitempty"`
	BuildJobID     uuid.UUID `json:"build_job_id,omitempty"`
}
