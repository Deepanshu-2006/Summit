package queue

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestRecordError_RetriesWithBackoff(t *testing.T) {
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
		Attempts:      2,
		MaxRetries:    5,
		LockedBy:      &workerID,
		LockedUntil:   &lockUntil,
	})

	testErr := errors.New("transient infrastructure network glitch")
	isTerminal, err := RecordError(ctx, db, eventID, workerID, testErr, DefaultExponentialBackoff)
	if err != nil {
		t.Fatalf("RecordError failed: %v", err)
	}
	if isTerminal {
		t.Fatalf("expected non-terminal retry for attempt 2 of 5")
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusPending {
		t.Errorf("expected status returned to pending, got %s", ev.Status)
	}
	if ev.LockedBy != nil {
		t.Errorf("expected locked_by cleared, got %v", ev.LockedBy)
	}
	if ev.LockedUntil != nil {
		t.Errorf("expected locked_until cleared, got %v", ev.LockedUntil)
	}
	if ev.LastError == nil || *ev.LastError != testErr.Error() {
		t.Errorf("expected last_error recorded, got %v", ev.LastError)
	}

	// Attempt 2 backoff is initialBackoff * 2^(2-1) = 5s * 2 = 10s
	expectedDelay := 10 * time.Second
	minExpectedAvailableAt := time.Now().UTC().Add(expectedDelay - 2*time.Second)
	if ev.AvailableAt.Before(minExpectedAvailableAt) {
		t.Errorf("expected available_at backoff >= %v, got %v", minExpectedAvailableAt, ev.AvailableAt)
	}
}

func TestRecordError_TerminalFailureOnMaxRetries(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	deploymentID := uuid.New()
	eventID := uuid.New()
	workerID := "worker-1"
	lockUntil := time.Now().UTC().Add(30 * time.Second)

	// Attempts already reached max_retries (5 of 5)
	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   deploymentID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		Attempts:      5,
		MaxRetries:    5,
		LockedBy:      &workerID,
		LockedUntil:   &lockUntil,
	})

	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: deploymentID,
		Status:       BuildJobStatusQueued,
	})

	terminalErr := errors.New("irrecoverable build error")
	isTerminal, err := RecordError(ctx, db, eventID, workerID, terminalErr, DefaultExponentialBackoff)
	if err != nil {
		t.Fatalf("RecordError failed: %v", err)
	}
	if !isTerminal {
		t.Fatalf("expected terminal failure when attempts >= max_retries")
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusFailed {
		t.Errorf("expected outbox status failed, got %s", ev.Status)
	}
	if ev.LastError == nil || *ev.LastError != terminalErr.Error() {
		t.Errorf("expected last_error %q, got %v", terminalErr.Error(), ev.LastError)
	}
	if ev.ProcessedAt == nil {
		t.Errorf("expected processed_at recorded")
	}

	// Associated build_jobs must be transitioned to failed as well
	job := db.buildJobs[jobID]
	if job.Status != BuildJobStatusFailed {
		t.Errorf("expected build_jobs status failed, got %s", job.Status)
	}
	if job.ErrorMessage == nil || *job.ErrorMessage != terminalErr.Error() {
		t.Errorf("expected build_jobs error_message set, got %v", job.ErrorMessage)
	}
}

func TestFailTerminal_DirectTerminalFailure(t *testing.T) {
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
		Attempts:      1,
		MaxRetries:    5,
	})

	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: deploymentID,
		Status:       BuildJobStatusQueued,
	})

	poisonPillErr := errors.New("poison pill payload")
	err := FailTerminal(ctx, db, eventID, workerID, poisonPillErr)
	if err != nil {
		t.Fatalf("FailTerminal failed: %v", err)
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusFailed {
		t.Errorf("expected outbox status failed, got %s", ev.Status)
	}

	job := db.buildJobs[jobID]
	if job.Status != BuildJobStatusFailed {
		t.Errorf("expected build_jobs status failed, got %s", job.Status)
	}
}

func TestExponentialBackoffCalculations(t *testing.T) {
	tests := []struct {
		attempts int
		expected time.Duration
	}{
		{attempts: 0, expected: 5 * time.Second},
		{attempts: 1, expected: 5 * time.Second},
		{attempts: 2, expected: 10 * time.Second},
		{attempts: 3, expected: 20 * time.Second},
		{attempts: 4, expected: 40 * time.Second},
		{attempts: 5, expected: 80 * time.Second},
		{attempts: 6, expected: 160 * time.Second},
		{attempts: 7, expected: 300 * time.Second}, // capped at 5 minutes
		{attempts: 50, expected: 300 * time.Second},
	}

	for _, tc := range tests {
		actual := DefaultExponentialBackoff(tc.attempts)
		if actual != tc.expected {
			t.Errorf("attempt %d: expected %v, got %v", tc.attempts, tc.expected, actual)
		}
	}
}
