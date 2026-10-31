package queue

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// Handler processes a claimed outbox event.
type Handler func(ctx context.Context, record *EventRecord) error

// Queue coordinates durable outbox event consumption, safe claiming with SKIP LOCKED,
// lease management, completion, retries, and duplicate handling.
type Queue struct {
	db                DBTX
	workerID          string
	leaseDuration     time.Duration
	heartbeatInterval time.Duration
	pollInterval      time.Duration
	backoffStrategy   BackoffStrategy
	logger            *slog.Logger
}

// Option configures a Queue instance.
type Option func(*Queue)

// WithWorkerID sets a custom worker ID string (default: generated orchestrator-worker-<uuid>).
func WithWorkerID(id string) Option {
	return func(q *Queue) {
		if id != "" {
			q.workerID = id
		}
	}
}

// WithLeaseDuration sets the duration of the initial claim and extension leases.
func WithLeaseDuration(d time.Duration) Option {
	return func(q *Queue) {
		if d > 0 {
			q.leaseDuration = d
		}
	}
}

// WithHeartbeatInterval sets the interval between periodic lease renewal pulses.
func WithHeartbeatInterval(d time.Duration) Option {
	return func(q *Queue) {
		if d > 0 {
			q.heartbeatInterval = d
		}
	}
}

// WithPollInterval sets the delay between polling cycles when no work is available.
func WithPollInterval(d time.Duration) Option {
	return func(q *Queue) {
		if d > 0 {
			q.pollInterval = d
		}
	}
}

// WithBackoffStrategy specifies the backoff function used when retrying failed jobs.
func WithBackoffStrategy(strategy BackoffStrategy) Option {
	return func(q *Queue) {
		if strategy != nil {
			q.backoffStrategy = strategy
		}
	}
}

// WithLogger sets the structured logger for queue events.
func WithLogger(logger *slog.Logger) Option {
	return func(q *Queue) {
		if logger != nil {
			q.logger = logger
		}
	}
}

// New creates a new Queue coordinator backed by PostgreSQL.
func New(db DBTX, opts ...Option) *Queue {
	q := &Queue{
		db:                db,
		workerID:          fmt.Sprintf("orchestrator-worker-%s", uuid.New().String()),
		leaseDuration:     30 * time.Second,
		heartbeatInterval: 10 * time.Second,
		pollInterval:      1 * time.Second,
		backoffStrategy:   DefaultExponentialBackoff,
		logger:            slog.Default(),
	}

	for _, opt := range opts {
		opt(q)
	}

	return q
}

// WorkerID returns the unique worker identifier used for claims and leases.
func (q *Queue) WorkerID() string {
	return q.workerID
}

// LeaseDuration returns the active lease duration.
func (q *Queue) LeaseDuration() time.Duration {
	return q.leaseDuration
}

// HeartbeatInterval returns the active heartbeat interval.
func (q *Queue) HeartbeatInterval() time.Duration {
	return q.heartbeatInterval
}

// Claim acquires up to limit eligible outbox events atomically using FOR UPDATE SKIP LOCKED.
func (q *Queue) Claim(ctx context.Context, limit int) ([]*EventRecord, error) {
	return Claim(ctx, q.db, q.workerID, q.leaseDuration, limit)
}

// ClaimOne acquires a single eligible event using FOR UPDATE SKIP LOCKED.
// Returns (nil, ErrNoEvents) if the queue is currently empty.
func (q *Queue) ClaimOne(ctx context.Context) (*EventRecord, error) {
	return ClaimOne(ctx, q.db, q.workerID, q.leaseDuration)
}

// RenewLease extends the active lease for a claimed event.
func (q *Queue) RenewLease(ctx context.Context, eventID uuid.UUID, extension time.Duration) error {
	if extension <= 0 {
		extension = q.leaseDuration
	}
	return RenewLease(ctx, q.db, eventID, q.workerID, extension)
}

// StartHeartbeat initiates a background heartbeat goroutine to extend the lease until stop is called.
func (q *Queue) StartHeartbeat(ctx context.Context, eventID uuid.UUID, onLeaseLost func(error)) func() {
	return StartHeartbeat(ctx, q.db, eventID, q.workerID, q.heartbeatInterval, q.leaseDuration, onLeaseLost)
}

// Complete marks an outbox event as completed idempotently.
func (q *Queue) Complete(ctx context.Context, eventID uuid.UUID) error {
	return Complete(ctx, q.db, eventID, q.workerID)
}

// RecordError records a failure, returning to pending with backoff if attempts < max_retries,
// or marking failed if attempts >= max_retries.
func (q *Queue) RecordError(ctx context.Context, eventID uuid.UUID, procErr error) (bool, error) {
	return RecordError(ctx, q.db, eventID, q.workerID, procErr, q.backoffStrategy)
}

// FailTerminal marks an event as permanently failed immediately.
func (q *Queue) FailTerminal(ctx context.Context, eventID uuid.UUID, fatalErr error) error {
	return FailTerminal(ctx, q.db, eventID, q.workerID, fatalErr)
}

// CheckAndHandleDuplicate determines if an event was already processed or duplicate.
func (q *Queue) CheckAndHandleDuplicate(ctx context.Context, record *EventRecord) (*DuplicateCheckResult, error) {
	return CheckAndHandleDuplicate(ctx, q.db, record)
}

// ProcessNext claims and processes a single event with complete lifecycle protection:
// 1. Safe claim via FOR UPDATE SKIP LOCKED.
// 2. Idempotent duplicate detection.
// 3. Automatic lease heartbeat with early cancellation on lease loss.
// 4. Successful completion or retried error recording.
//
// Returns (true, nil) if an event was claimed and successfully processed or deduplicated,
// (false, nil) if no eligible events were available,
// or (true, err) if processing encountered an error.
func (q *Queue) ProcessNext(ctx context.Context, handler Handler) (bool, error) {
	if failed, err := FailExhausted(ctx, q.db); err != nil {
		return false, err
	} else if failed > 0 {
		q.logger.Warn("marked outbox events failed after exhausting retry budget", "count", failed)
	}

	record, err := q.ClaimOne(ctx)
	if errors.Is(err, ErrNoEvents) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("queue: claiming next event: %w", err)
	}

	q.logger.Debug("claimed outbox event",
		"event_id", record.ID,
		"event_type", record.EventType,
		"aggregate_type", record.AggregateType,
		"aggregate_id", record.AggregateID,
		"attempt", record.Attempts,
	)

	// Idempotent duplicate check
	dupResult, dupErr := q.CheckAndHandleDuplicate(ctx, record)
	if dupErr != nil {
		q.logger.Warn("error checking duplicate; deferring event to avoid duplicate side effects", "event_id", record.ID, "error", dupErr)
		_, retryErr := q.RecordError(ctx, record.ID, dupErr)
		if retryErr != nil {
			return true, errors.Join(dupErr, retryErr)
		}
		return true, dupErr
	} else if dupResult != nil && dupResult.IsDuplicate {
		q.logger.Info("ignoring duplicate outbox event",
			"event_id", record.ID,
			"reason", dupResult.Reason,
			"existing_status", dupResult.ExistingStatus,
		)
		return true, nil
	}

	// Execute handler under active lease heartbeat
	var procErr error
	leaseErr := WithLease(ctx, q.db, record.ID, q.workerID, q.heartbeatInterval, q.leaseDuration, func(execCtx context.Context) error {
		procErr = handler(execCtx, record)
		return procErr
	})

	if procErr != nil {
		q.logger.Error("handler failed processing outbox event",
			"event_id", record.ID,
			"attempt", record.Attempts,
			"error", procErr,
		)
		isTerminal, recErr := q.RecordError(ctx, record.ID, procErr)
		if recErr != nil {
			q.logger.Error("failed recording error state for event", "event_id", record.ID, "error", recErr)
		} else if isTerminal {
			q.logger.Warn("outbox event exhausted all retries; moved to terminal failed", "event_id", record.ID)
		}
		return true, procErr
	}

	if leaseErr != nil && !errors.Is(leaseErr, procErr) {
		q.logger.Warn("lease management warning during execution", "event_id", record.ID, "error", leaseErr)
	}

	// Mark completed
	if compErr := q.Complete(ctx, record.ID); compErr != nil {
		q.logger.Error("failed marking outbox event completed", "event_id", record.ID, "error", compErr)
		return true, compErr
	}

	q.logger.Debug("successfully completed outbox event", "event_id", record.ID)
	return true, nil
}

// Run executes the continuous queue processing loop until ctx is canceled.
func (q *Queue) Run(ctx context.Context, handler Handler) error {
	q.logger.Info("starting orchestrator queue worker",
		"worker_id", q.workerID,
		"lease_duration", q.leaseDuration,
		"poll_interval", q.pollInterval,
	)

	ticker := time.NewTicker(q.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			q.logger.Info("stopping orchestrator queue worker", "worker_id", q.workerID)
			return ctx.Err()
		default:
		}

		processed, err := q.ProcessNext(ctx, handler)
		if err != nil {
			q.logger.Error("error during outbox processing cycle", "error", err)
		}

		if processed {
			// Work was processed; drain immediate backlog without sleeping
			continue
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
