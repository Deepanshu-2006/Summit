package queue

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RenewLease extends the locked_until timestamp on a currently claimed event.
// It ensures that only the holding worker can renew the lease.
func RenewLease(ctx context.Context, db DBTX, eventID uuid.UUID, workerID string, extension time.Duration) error {
	if db == nil {
		return ErrNilDB
	}
	if extension <= 0 {
		extension = 30 * time.Second
	}
	intervalStr := formatInterval(extension)

	query := `
		UPDATE outbox_events
		SET locked_until = now() + $1::interval,
		    updated_at = now()
		WHERE id = $2
		  AND status = 'claimed'
		  AND locked_by = $3
		RETURNING id;
	`

	var renewedID uuid.UUID
	err := db.QueryRow(ctx, query, intervalStr, eventID, workerID).Scan(&renewedID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Diagnose reason for renewal failure
		var status string
		var lockedBy *string
		checkErr := db.QueryRow(ctx, "SELECT status, locked_by FROM outbox_events WHERE id = $1", eventID).Scan(&status, &lockedBy)
		if errors.Is(checkErr, pgx.ErrNoRows) {
			return ErrEventNotFound
		}
		if status == StatusCompleted {
			return ErrAlreadyCompleted
		}
		return ErrLeaseLost
	}
	if err != nil {
		return fmt.Errorf("queue: renewing lease for event %s: %w", eventID, err)
	}

	return nil
}

// StartHeartbeat runs a background goroutine that extends the lease at regular intervals.
// If renewal fails (e.g. lease lost or DB error), onLeaseLost is invoked if provided, and the heartbeat terminates.
// The returned stop function cleanly shuts down the heartbeat goroutine and blocks until it exits.
func StartHeartbeat(
	ctx context.Context,
	db DBTX,
	eventID uuid.UUID,
	workerID string,
	interval time.Duration,
	extension time.Duration,
	onLeaseLost func(err error),
) (stop func()) {
	if interval <= 0 {
		interval = 10 * time.Second
	}
	if extension <= 0 {
		extension = 30 * time.Second
	}

	heartbeatCtx, cancel := context.WithCancel(ctx)
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				renewCtx, renewCancel := context.WithTimeout(context.Background(), 5*time.Second)
				err := RenewLease(renewCtx, db, eventID, workerID, extension)
				renewCancel()

				if err != nil {
					// Heartbeat failed (could be lease lost or DB disconnect)
					if onLeaseLost != nil {
						onLeaseLost(err)
					}
					return
				}
			}
		}
	}()

	var once sync.Once
	return func() {
		once.Do(func() {
			cancel()
			wg.Wait()
		})
	}
}

// WithLease executes fn while maintaining an active heartbeat lease on the event.
// If the lease renewal fails or the parent context is canceled, the execution context
// passed to fn is immediately canceled to prevent split-brain processing.
func WithLease(
	ctx context.Context,
	db DBTX,
	eventID uuid.UUID,
	workerID string,
	interval time.Duration,
	extension time.Duration,
	fn func(ctx context.Context) error,
) error {
	jobCtx, jobCancel := context.WithCancel(ctx)
	defer jobCancel()

	stopHeartbeat := StartHeartbeat(ctx, db, eventID, workerID, interval, extension, func(err error) {
		// Cancel work immediately if lease is lost
		jobCancel()
	})
	defer stopHeartbeat()

	return fn(jobCtx)
}
