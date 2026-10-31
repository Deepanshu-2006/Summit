package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CheckAndHandleDuplicate inspects the event and database state for duplicate or already-processed
// work. If a duplicate is detected, it idempotently reconciles the event (e.g. marking it completed)
// without re-executing downstream operations.
//
// Duplicate detection criteria:
//  1. The event itself has already been marked 'completed'.
//  2. For deployment build requests, the associated build_jobs row is terminal.
//     A dispatched/running job is allowed through so the handler can idempotently
//     find or resume its existing builder Pod after a worker crash.
//  3. Another outbox event for the same aggregate and build_run_id has completed.
func CheckAndHandleDuplicate(ctx context.Context, db DBTX, record *EventRecord) (*DuplicateCheckResult, error) {
	if db == nil {
		return nil, ErrNilDB
	}
	if record == nil {
		return nil, errors.New("queue: event record is nil")
	}

	// 1. Check if the event itself is already completed
	if record.Status == StatusCompleted {
		return &DuplicateCheckResult{
			IsDuplicate:    true,
			Reason:         "outbox event already marked completed",
			ExistingStatus: record.Status,
		}, nil
	}

	// Resolve deployment ID from record.AggregateID or payload
	deploymentID := record.AggregateID
	if deploymentID == uuid.Nil && len(record.Payload) > 0 {
		var raw map[string]any
		if err := json.Unmarshal(record.Payload, &raw); err == nil {
			if depStr, ok := raw["deployment_id"].(string); ok {
				deploymentID, _ = uuid.Parse(depStr)
			}
		}
	}

	// 2. If this is a deployment build request, check the state of build_jobs
	if (record.AggregateType == AggregateTypeDeployment || record.EventType == EventTypeDeploymentBuildRequested) && deploymentID != uuid.Nil {
		var jobID uuid.UUID
		var jobStatus string
		jobQuery := `
			SELECT id, status
			FROM build_jobs
			WHERE deployment_id = $1
			LIMIT 1;
		`
		err := db.QueryRow(ctx, jobQuery, deploymentID).Scan(&jobID, &jobStatus)
		if err == nil {
			// Only terminal build state proves the request no longer needs work. Active
			// states must reach the handler so Pod creation can be retried idempotently.
			switch jobStatus {
			case BuildJobStatusSucceeded, BuildJobStatusCancelled, BuildJobStatusFailed:
				if err := completeDuplicate(ctx, db, record); err != nil {
					return nil, err
				}

				return &DuplicateCheckResult{
					IsDuplicate:    true,
					Reason:         fmt.Sprintf("build_job %s already in terminal status %q", jobID, jobStatus),
					ExistingStatus: jobStatus,
					BuildJobID:     jobID,
				}, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("queue: querying build_jobs for duplicate check: %w", err)
		}
	}

	// 3. Check whether an event for this exact build_run_id already completed.
	if record.AggregateType != "" && record.AggregateID != uuid.Nil {
		buildRunID := buildRunIDFromPayload(record.Payload)
		if buildRunID == "" {
			return &DuplicateCheckResult{IsDuplicate: false}, nil
		}
		var priorCompletedID uuid.UUID
		query := `
			SELECT id
			FROM outbox_events
			WHERE aggregate_type = $1
			  AND aggregate_id = $2
			  AND event_type = $3
			  AND payload->>'build_run_id' = $4
			  AND id != $5
			  AND status = 'completed'
			LIMIT 1;
		`
		err := db.QueryRow(ctx, query, record.AggregateType, record.AggregateID, record.EventType, buildRunID, record.ID).Scan(&priorCompletedID)
		if err == nil {
			// The same build_run_id already completed: drain this replay only while
			// this worker still owns the claim.
			if err := completeDuplicate(ctx, db, record); err != nil {
				return nil, err
			}

			return &DuplicateCheckResult{
				IsDuplicate:    true,
				Reason:         fmt.Sprintf("prior outbox event %s for aggregate already completed", priorCompletedID),
				ExistingStatus: StatusCompleted,
			}, nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("queue: checking prior completed outbox events: %w", err)
		}
	}

	return &DuplicateCheckResult{
		IsDuplicate: false,
	}, nil
}

func completeDuplicate(ctx context.Context, db DBTX, record *EventRecord) error {
	if record.LockedBy == nil || *record.LockedBy == "" {
		return ErrLeaseLost
	}
	const query = `
		UPDATE outbox_events
		SET status = 'completed', locked_until = NULL, locked_by = NULL,
		    processed_at = now(), updated_at = now()
		WHERE id = $1 AND status = 'claimed' AND locked_by = $2;
	`
	tag, err := db.Exec(ctx, query, record.ID, *record.LockedBy)
	if err != nil {
		return fmt.Errorf("queue: completing duplicate event %s: %w", record.ID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrLeaseLost
	}
	return nil
}

func buildRunIDFromPayload(payload []byte) string {
	var event struct {
		BuildRunID string `json:"build_run_id"`
	}
	if len(payload) == 0 || json.Unmarshal(payload, &event) != nil {
		return ""
	}
	return event.BuildRunID
}
