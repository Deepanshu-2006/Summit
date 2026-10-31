package queue

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCheckAndHandleDuplicate_AlreadyCompletedEvent(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	now := time.Now().UTC()

	record := &EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusCompleted,
		ProcessedAt:   &now,
	}

	result, err := CheckAndHandleDuplicate(ctx, db, record)
	if err != nil {
		t.Fatalf("CheckAndHandleDuplicate failed: %v", err)
	}
	if !result.IsDuplicate {
		t.Fatal("expected duplicate to be true for already completed event")
	}
}

func TestCheckAndHandleDuplicate_ActiveBuildJobReachesIdempotentHandler(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	deploymentID := uuid.New()
	eventID := uuid.New()

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
	})

	// build_jobs is already 'running'
	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: deploymentID,
		Status:       BuildJobStatusRunning,
	})

	record := db.outboxEvents[eventID]
	result, err := CheckAndHandleDuplicate(ctx, db, record)
	if err != nil {
		t.Fatalf("CheckAndHandleDuplicate failed: %v", err)
	}
	if result.IsDuplicate {
		t.Fatal("active build jobs must reach the handler for idempotent pod recovery")
	}

	// The duplicate outbox event must have been drained/marked completed
	ev := db.outboxEvents[eventID]
	if ev.Status != StatusClaimed {
		t.Errorf("expected active event to stay claimed for handler recovery, got %s", ev.Status)
	}
}

func TestCheckAndHandleDuplicate_PriorCompletedOutboxEvent(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	deploymentID := uuid.New()
	buildRunID := uuid.New().String()
	firstEventID := uuid.New()
	dupEventID := uuid.New()
	workerID := "worker-1"
	now := time.Now().UTC()

	// First event for this deployment was completed earlier
	db.insertOutboxEvent(&EventRecord{
		ID:            firstEventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"build_run_id":"` + buildRunID + `"}`),
		Status:        StatusCompleted,
		ProcessedAt:   &now,
	})

	// Replay with the same build_run_id arrived for this deployment.
	db.insertOutboxEvent(&EventRecord{
		ID:            dupEventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"build_run_id":"` + buildRunID + `"}`),
		Status:        StatusClaimed,
		LockedBy:      &workerID,
	})

	record := db.outboxEvents[dupEventID]
	result, err := CheckAndHandleDuplicate(ctx, db, record)
	if err != nil {
		t.Fatalf("CheckAndHandleDuplicate failed: %v", err)
	}
	if !result.IsDuplicate {
		t.Fatal("expected duplicate to be true when prior event for the same build_run_id completed")
	}

	ev := db.outboxEvents[dupEventID]
	if ev.Status != StatusCompleted {
		t.Errorf("expected duplicate event marked completed, got %s", ev.Status)
	}
}

func TestCheckAndHandleDuplicate_FreshQueuedEventNotDuplicate(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	deploymentID := uuid.New()
	eventID := uuid.New()

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
	})

	// build_jobs is in 'queued' status (initial state awaiting orchestrator pickup)
	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: deploymentID,
		Status:       BuildJobStatusQueued,
	})

	record := db.outboxEvents[eventID]
	result, err := CheckAndHandleDuplicate(ctx, db, record)
	if err != nil {
		t.Fatalf("CheckAndHandleDuplicate failed: %v", err)
	}
	if result.IsDuplicate {
		t.Fatalf("fresh queued event should not be flagged as duplicate")
	}

	// Outbox event remains claimed
	ev := db.outboxEvents[eventID]
	if ev.Status != StatusClaimed {
		t.Errorf("expected event status to remain claimed, got %s", ev.Status)
	}
}
