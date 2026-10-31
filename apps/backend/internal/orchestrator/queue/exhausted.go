package queue

import (
	"context"
	"fmt"
)

// FailExhausted marks eligible events as failed after a worker has exhausted its
// claim budget and then crashed or lost its lease before recording the error.
// The event and build job transitions happen in one PostgreSQL statement.
func FailExhausted(ctx context.Context, db DBTX) (int64, error) {
	if db == nil {
		return 0, ErrNilDB
	}
	const query = `
		WITH exhausted AS (
			UPDATE outbox_events
			SET status = 'failed',
			    locked_until = NULL,
			    locked_by = NULL,
			    last_error = COALESCE(last_error, 'outbox event exhausted its retry budget'),
			    processed_at = now(),
			    updated_at = now()
			WHERE attempts >= max_retries
			  AND available_at <= now()
			  AND (
			      status = 'pending'
			   OR (status = 'claimed' AND (locked_until IS NULL OR locked_until < now()))
			  )
			RETURNING aggregate_type, aggregate_id, last_error
		), failed_jobs AS (
			UPDATE build_jobs AS job
			SET status = 'failed',
			    error_message = exhausted.last_error,
			    completed_at = COALESCE(job.completed_at, now()),
			    updated_at = now()
			FROM exhausted
			WHERE exhausted.aggregate_type = 'deployment'
			  AND job.deployment_id = exhausted.aggregate_id
			  AND job.status NOT IN ('succeeded', 'failed', 'cancelled')
			RETURNING job.id
		), failed_deployments AS (
			UPDATE deployments AS deployment
			SET status = 'failed',
			    error_message = exhausted.last_error,
			    updated_at = now()
			FROM exhausted
			WHERE exhausted.aggregate_type = 'deployment'
			  AND deployment.id = exhausted.aggregate_id
			  AND deployment.status IN ('pending', 'queued', 'building')
			RETURNING deployment.id
		)
		SELECT COUNT(*) FROM exhausted;
	`
	var count int64
	if err := db.QueryRow(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("queue: failing exhausted outbox events: %w", err)
	}
	return count, nil
}
