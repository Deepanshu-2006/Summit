package queue

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestComplete_Success(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-1"
	lockUntil := time.Now().UTC().Add(30 * time.Second)

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		LockedBy:      &workerID,
		LockedUntil:   &lockUntil,
	})

	err := Complete(ctx, db, eventID, workerID)
	if err != nil {
		t.Fatalf("Complete failed: %v", err)
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusCompleted {
		t.Errorf("expected status completed, got %s", ev.Status)
	}
	if ev.LockedBy != nil {
		t.Errorf("expected locked_by cleared, got %v", ev.LockedBy)
	}
	if ev.LockedUntil != nil {
		t.Errorf("expected locked_until cleared, got %v", ev.LockedUntil)
	}
	if ev.ProcessedAt == nil {
		t.Errorf("expected processed_at recorded")
	}
}

func TestComplete_IdempotentDuplicate(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-1"
	now := time.Now().UTC()

	// An event that was ALREADY completed previously
	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusCompleted,
		ProcessedAt:   &now,
	})

	// Calling Complete on an already completed event must be idempotent and succeed (return nil)
	err := Complete(ctx, db, eventID, workerID)
	if err != nil {
		t.Fatalf("Complete should be idempotent and return nil, got: %v", err)
	}
}

func TestCompleteDeploymentJob_DispatchedAndSucceeded(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	deploymentID := uuid.New()
	eventID := uuid.New()
	workerID := "worker-1"
	lockUntil := time.Now().UTC().Add(30 * time.Second)

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		LockedBy:      &workerID,
		LockedUntil:   &lockUntil,
	})

	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: deploymentID,
		Status:       BuildJobStatusQueued,
	})

	// Complete outbox event and transition build_jobs to 'dispatched'
	err := CompleteDeploymentJob(ctx, db, eventID, workerID, deploymentID, BuildJobStatusDispatched)
	if err != nil {
		t.Fatalf("CompleteDeploymentJob failed: %v", err)
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusCompleted {
		t.Errorf("expected outbox event status completed, got %s", ev.Status)
	}

	job := db.buildJobs[jobID]
	if job.Status != BuildJobStatusDispatched {
		t.Errorf("expected build_jobs status dispatched, got %s", job.Status)
	}
	if job.DispatchedAt == nil {
		t.Errorf("expected dispatched_at timestamp set")
	}

	// Invalid status must be rejected
	err = CompleteDeploymentJob(ctx, db, eventID, workerID, deploymentID, "invalid_status")
	if err == nil {
		t.Fatal("expected error for invalid build_jobs status, got nil")
	}
}
