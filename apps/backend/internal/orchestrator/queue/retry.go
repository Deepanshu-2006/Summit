package queue

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RecordError records a processing failure for an outbox event.
//
// If attempts >= max_retries, the event is marked as terminal 'failed',
// its last_error is recorded, and if it represents a deployment, any associated
// build_jobs record is transitioned to 'failed'.
//
// If attempts < max_retries, the event is returned to 'pending' status with available_at
// scheduled according to the supplied backoffStrategy.
func RecordError(
	ctx context.Context,
	db DBTX,
	eventID uuid.UUID,
	workerID string,
	procErr error,
	backoffStrategy BackoffStrategy,
) (isTerminal bool, err error) {
	if db == nil {
		return false, ErrNilDB
	}
	if procErr == nil {
		procErr = errors.New("unknown error")
	}
	if backoffStrategy == nil {
		backoffStrategy = DefaultExponentialBackoff
	}

	// 1. Fetch current attempt count and max_retries
	var attempts, maxRetries int
	var aggType string
	var aggID uuid.UUID
	fetchQuery := `
		SELECT attempts, max_retries, aggregate_type, aggregate_id
		FROM outbox_events
		WHERE id = $1;
	`
	err = db.QueryRow(ctx, fetchQuery, eventID).Scan(&attempts, &maxRetries, &aggType, &aggID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrEventNotFound
	}
	if err != nil {
		return false, fmt.Errorf("queue: fetching outbox event %s for error recording: %w", eventID, err)
	}

	errMsg := procErr.Error()

	// 2. Check if attempts have reached or exceeded max_retries
	if attempts >= maxRetries {
		// Terminal failure
		failQuery := `
			WITH failed_event AS (
				UPDATE outbox_events
				SET status = 'failed', locked_until = NULL, locked_by = NULL,
				    last_error = $2, processed_at = now(), updated_at = now()
				WHERE id = $1 AND status = 'claimed' AND locked_by = $3
				RETURNING aggregate_type, aggregate_id
			), failed_job AS (
				UPDATE build_jobs
				SET status = 'failed', error_message = $2, completed_at = now(), updated_at = now()
				FROM failed_event
				WHERE failed_event.aggregate_type = 'deployment'
				  AND build_jobs.deployment_id = failed_event.aggregate_id
				  AND build_jobs.status NOT IN ('succeeded', 'failed', 'cancelled')
				RETURNING deployment_id
			), failed_deployment AS (
				UPDATE deployments
				SET status = 'failed', error_message = $2, updated_at = now()
				FROM failed_event
				WHERE failed_event.aggregate_type = 'deployment'
				  AND deployments.id = failed_event.aggregate_id
				  AND deployments.status IN ('pending', 'queued', 'building')
				RETURNING deployments.id
			)
			SELECT aggregate_id FROM failed_event;
		`
		var failedID uuid.UUID
		execErr := db.QueryRow(ctx, failQuery, eventID, errMsg, workerID).Scan(&failedID)
		if errors.Is(execErr, pgx.ErrNoRows) {
			return false, ErrLeaseLost
		}
		if execErr != nil {
			return true, fmt.Errorf("queue: marking outbox event %s and deployment failed: %w", eventID, execErr)
		}

		return true, nil
	}

	// 3. Re-queue for retry with backoff
	backoffDuration := backoffStrategy(attempts)
	intervalStr := formatInterval(backoffDuration)

	retryQuery := `
		UPDATE outbox_events
		SET status = 'pending',
		    locked_until = NULL,
		    locked_by = NULL,
		    last_error = $2,
		    available_at = now() + $3::interval,
		    updated_at = now()
		WHERE id = $1
		  AND status = 'claimed'
		  AND locked_by = $4;
	`
	tag, execErr := db.Exec(ctx, retryQuery, eventID, errMsg, intervalStr, workerID)
	if execErr != nil {
		return false, fmt.Errorf("queue: scheduling retry for outbox event %s: %w", eventID, execErr)
	}
	if tag.RowsAffected() == 0 {
		return false, ErrLeaseLost
	}

	return false, nil
}

// FailTerminal marks an event as failed immediately without scheduling retries.
// Used for unrecoverable errors like invalid schema payloads or poison pills.
func FailTerminal(ctx context.Context, db DBTX, eventID uuid.UUID, workerID string, fatalErr error) error {
	if db == nil {
		return ErrNilDB
	}
	if fatalErr == nil {
		fatalErr = errors.New("unrecoverable fatal error")
	}

	var aggType string
	var aggID uuid.UUID
	err := db.QueryRow(ctx, "SELECT aggregate_type, aggregate_id FROM outbox_events WHERE id = $1", eventID).Scan(&aggType, &aggID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrEventNotFound
	}
	if err != nil {
		return fmt.Errorf("queue: querying outbox event %s for terminal fail: %w", eventID, err)
	}

	failQuery := `
		WITH failed_event AS (
			UPDATE outbox_events
			SET status = 'failed', locked_until = NULL, locked_by = NULL,
			    last_error = $2, processed_at = now(), updated_at = now()
			WHERE id = $1 AND status = 'claimed' AND locked_by = $3
			RETURNING aggregate_type, aggregate_id
		), failed_job AS (
			UPDATE build_jobs
			SET status = 'failed', error_message = $2, completed_at = now(), updated_at = now()
			FROM failed_event
			WHERE failed_event.aggregate_type = 'deployment'
			  AND build_jobs.deployment_id = failed_event.aggregate_id
			  AND build_jobs.status NOT IN ('succeeded', 'failed', 'cancelled')
			RETURNING deployment_id
		), failed_deployment AS (
			UPDATE deployments
			SET status = 'failed', error_message = $2, updated_at = now()
			FROM failed_event
			WHERE failed_event.aggregate_type = 'deployment'
			  AND deployments.id = failed_event.aggregate_id
			  AND deployments.status IN ('pending', 'queued', 'building')
			RETURNING deployments.id
		)
		SELECT aggregate_id FROM failed_event;
	`
	var failedID uuid.UUID
	err = db.QueryRow(ctx, failQuery, eventID, fatalErr.Error(), workerID).Scan(&failedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrLeaseLost
	}
	if err != nil {
		return fmt.Errorf("queue: marking outbox event %s and deployment failed: %w", eventID, err)
	}

	return nil
}
