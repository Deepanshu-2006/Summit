package queue

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Complete marks an outbox event as successfully processed (status = 'completed').
// This operation is idempotent: if the event is already marked completed, Complete returns nil.
func Complete(ctx context.Context, db DBTX, eventID uuid.UUID, workerID string) error {
	if db == nil {
		return ErrNilDB
	}

	query := `
		UPDATE outbox_events
		SET status = 'completed',
		    locked_until = NULL,
		    locked_by = NULL,
		    processed_at = now(),
		    updated_at = now()
		WHERE id = $1
		  AND status = 'claimed'
		  AND locked_by = $2
		RETURNING id;
	`

	var completedID uuid.UUID
	err := db.QueryRow(ctx, query, eventID, workerID).Scan(&completedID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Idempotent duplicate check: verify if the event was already marked completed
		var currentStatus string
		checkErr := db.QueryRow(ctx, "SELECT status FROM outbox_events WHERE id = $1", eventID).Scan(&currentStatus)
		if errors.Is(checkErr, pgx.ErrNoRows) {
			return ErrEventNotFound
		}
		if currentStatus == StatusCompleted {
			// Idempotent success
			return nil
		}
		return ErrLeaseLost
	}
	if err != nil {
		return fmt.Errorf("queue: completing outbox event %s: %w", eventID, err)
	}

	return nil
}

// CompleteDeploymentJob atomically completes an outbox event and transitions the associated
// build_jobs record to the specified status using the existing build_jobs status vocabulary.
func CompleteDeploymentJob(
	ctx context.Context,
	db DBTX,
	eventID uuid.UUID,
	workerID string,
	deploymentID uuid.UUID,
	targetBuildJobStatus string,
) error {
	if db == nil {
		return ErrNilDB
	}

	// Validate targetBuildJobStatus against existing vocabulary in 0001_baseline.up.sql
	switch targetBuildJobStatus {
	case BuildJobStatusQueued, BuildJobStatusDispatched, BuildJobStatusRunning,
		BuildJobStatusSucceeded, BuildJobStatusFailed, BuildJobStatusCancelled:
	default:
		return fmt.Errorf("queue: invalid build_jobs status %q", targetBuildJobStatus)
	}

	// Use one PostgreSQL statement so a build_jobs constraint or update failure rolls back
	// the outbox completion too. For a nil deployment ID, the CTE still completes just the event.
	query := `
		WITH completed_event AS (
			UPDATE outbox_events
			SET status = 'completed',
			    locked_until = NULL,
			    locked_by = NULL,
			    processed_at = now(),
			    updated_at = now()
			WHERE id = $1
			  AND status = 'claimed'
			  AND locked_by = $2
			RETURNING id
		), updated_job AS (
			UPDATE build_jobs
			SET status = $3,
			    dispatched_at = CASE WHEN $3 = 'dispatched' THEN COALESCE(dispatched_at, now()) ELSE dispatched_at END,
			    started_at = CASE WHEN $3 = 'running' THEN COALESCE(started_at, now()) ELSE started_at END,
			    completed_at = CASE WHEN $3 IN ('succeeded', 'failed', 'cancelled') THEN COALESCE(completed_at, now()) ELSE completed_at END,
			    updated_at = now()
			WHERE deployment_id = $4
			  AND $4 <> '00000000-0000-0000-0000-000000000000'::uuid
			  AND EXISTS (SELECT 1 FROM completed_event)
			RETURNING id
		)
		SELECT id FROM completed_event;
	`
	var completedID uuid.UUID
	err := db.QueryRow(ctx, query, eventID, workerID, targetBuildJobStatus, deploymentID).Scan(&completedID)
	if errors.Is(err, pgx.ErrNoRows) {
		var status string
		checkErr := db.QueryRow(ctx, "SELECT status FROM outbox_events WHERE id = $1", eventID).Scan(&status)
		if errors.Is(checkErr, pgx.ErrNoRows) {
			return ErrEventNotFound
		}
		if checkErr != nil {
			return fmt.Errorf("queue: checking outbox event %s after completion: %w", eventID, checkErr)
		}
		if status == StatusCompleted {
			return nil
		}
		return ErrLeaseLost
	}
	if err != nil {
		return fmt.Errorf("queue: completing outbox event and updating build_job: %w", err)
	}
	return nil
}
