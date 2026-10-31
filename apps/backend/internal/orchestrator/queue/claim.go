package queue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Claim acquires up to limit eligible outbox events atomically using PostgreSQL
// FOR UPDATE SKIP LOCKED concurrency semantics.
//
// Eligible events are those in 'pending' status with available_at <= now(),
// or in 'claimed' status with expired leases (locked_until < now()).
func Claim(ctx context.Context, db DBTX, workerID string, leaseDuration time.Duration, limit int) ([]*EventRecord, error) {
	if db == nil {
		return nil, ErrNilDB
	}
	if limit <= 0 {
		return nil, ErrInvalidLimit
	}
	if leaseDuration <= 0 {
		leaseDuration = 30 * time.Second
	}
	intervalStr := formatInterval(leaseDuration)

	claimQuery := `
		WITH next_events AS (
			SELECT id
			FROM outbox_events
			WHERE ((status = 'pending' AND (available_at IS NULL OR available_at <= now()))
			   OR (status = 'claimed' AND locked_until IS NOT NULL AND locked_until < now()))
			  AND attempts < max_retries
			ORDER BY available_at ASC, created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE outbox_events e
		SET status = 'claimed',
		    locked_by = $2,
		    locked_until = now() + $3::interval,
		    attempts = e.attempts + 1,
		    updated_at = now()
		FROM next_events
		WHERE e.id = next_events.id
		RETURNING e.id, e.aggregate_type, e.aggregate_id, e.event_type, e.payload, e.status, e.attempts, e.max_retries, e.available_at, e.locked_until, e.locked_by, e.last_error, e.created_at, e.updated_at, e.published_at, e.processed_at;
	`

	rows, err := db.Query(ctx, claimQuery, limit, workerID, intervalStr)
	if err != nil {
		return nil, fmt.Errorf("queue: claiming outbox events: %w", err)
	}

	records, err := scanEventRecords(rows)
	if err != nil {
		return nil, fmt.Errorf("queue: scanning claimed events: %w", err)
	}

	return records, nil
}

// ClaimOne acquires a single eligible outbox event using FOR UPDATE SKIP LOCKED.
// If no eligible events are found, it returns (nil, ErrNoEvents).
func ClaimOne(ctx context.Context, db DBTX, workerID string, leaseDuration time.Duration) (*EventRecord, error) {
	records, err := Claim(ctx, db, workerID, leaseDuration, 1)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, ErrNoEvents
	}
	return records[0], nil
}

// ClaimByID attempts to claim a specific event by ID if it is eligible (pending or expired lease).
func ClaimByID(ctx context.Context, db DBTX, eventID uuid.UUID, workerID string, leaseDuration time.Duration) (*EventRecord, error) {
	if db == nil {
		return nil, ErrNilDB
	}
	if leaseDuration <= 0 {
		leaseDuration = 30 * time.Second
	}
	intervalStr := formatInterval(leaseDuration)

	query := `
		UPDATE outbox_events
		SET status = 'claimed',
		    locked_by = $2,
		    locked_until = now() + $3::interval,
		    attempts = attempts + 1,
		    updated_at = now()
		WHERE id = $1
		  AND (
		      (status = 'pending' AND (available_at IS NULL OR available_at <= now()))
		   OR (status = 'claimed' AND (locked_until IS NULL OR locked_until < now()))
		  )
		  AND attempts < max_retries
		RETURNING id, aggregate_type, aggregate_id, event_type, payload, status, attempts, max_retries, available_at, locked_until, locked_by, last_error, created_at, updated_at, published_at, processed_at;
	`

	row := db.QueryRow(ctx, query, eventID, workerID, intervalStr)
	rec, err := scanEventRecord(row)
	if errors.Is(err, pgx.ErrNoRows) {
		// Differentiate between nonexistent, already completed, or actively locked by another worker
		var status string
		var lockedUntil *time.Time
		checkErr := db.QueryRow(ctx, "SELECT status, locked_until FROM outbox_events WHERE id = $1", eventID).Scan(&status, &lockedUntil)
		if errors.Is(checkErr, pgx.ErrNoRows) {
			return nil, ErrEventNotFound
		}
		if status == StatusCompleted {
			return nil, ErrAlreadyCompleted
		}
		return nil, ErrLeaseLost
	}
	if err != nil {
		return nil, fmt.Errorf("queue: claiming event %s by id: %w", eventID, err)
	}

	return rec, nil
}

func formatInterval(d time.Duration) string {
	millis := d.Milliseconds()
	if millis <= 0 {
		millis = 1000
	}
	return fmt.Sprintf("%d milliseconds", millis)
}
