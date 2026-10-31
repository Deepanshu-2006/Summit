package queue

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestQueue_ProcessNext_Success(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	depID := uuid.New()
	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   depID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"deployment_id":"` + depID.String() + `"}`),
		Status:        StatusPending,
		AvailableAt:   time.Now().UTC().Add(-1 * time.Minute),
	})

	jobID := uuid.New()
	db.insertBuildJob(&mockBuildJob{
		ID:           jobID,
		DeploymentID: depID,
		Status:       BuildJobStatusQueued,
	})

	q := New(db,
		WithWorkerID("test-worker-1"),
		WithLeaseDuration(10*time.Second),
		WithHeartbeatInterval(1*time.Second),
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)

	var handlerCalled atomic.Bool
	processed, err := q.ProcessNext(ctx, func(hCtx context.Context, record *EventRecord) error {
		handlerCalled.Store(true)
		if record.ID != eventID {
			t.Errorf("expected record %s, got %s", eventID, record.ID)
		}
		return nil
	})

	if err != nil {
		t.Fatalf("ProcessNext failed: %v", err)
	}
	if !processed {
		t.Fatal("expected processed = true")
	}
	if !handlerCalled.Load() {
		t.Fatal("expected handler to be invoked")
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusCompleted {
		t.Errorf("expected outbox event status completed, got %s", ev.Status)
	}
	if ev.ProcessedAt == nil {
		t.Errorf("expected processed_at recorded")
	}
}

func TestQueue_ProcessNext_EmptyQueue(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	q := New(db, WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))))

	processed, err := q.ProcessNext(ctx, func(hCtx context.Context, record *EventRecord) error {
		t.Fatal("handler should not be called when queue is empty")
		return nil
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if processed {
		t.Fatal("expected processed = false on empty queue")
	}
}

func TestQueue_ProcessNext_HandlerErrorTriggersRetry(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusPending,
		Attempts:      0,
		MaxRetries:    3,
		AvailableAt:   time.Now().UTC().Add(-1 * time.Minute),
	})

	q := New(db,
		WithWorkerID("test-worker-err"),
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)

	handlerErr := errors.New("temporary cluster error")
	processed, err := q.ProcessNext(ctx, func(hCtx context.Context, record *EventRecord) error {
		return handlerErr
	})

	if !errors.Is(err, handlerErr) {
		t.Fatalf("expected handler error returned, got %v", err)
	}
	if !processed {
		t.Fatal("expected processed = true (event was handled)")
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusPending {
		t.Errorf("expected status returned to pending for retry, got %s", ev.Status)
	}
	if ev.Attempts != 1 {
		t.Errorf("expected attempt count 1, got %d", ev.Attempts)
	}
	if ev.LastError == nil || *ev.LastError != handlerErr.Error() {
		t.Errorf("expected last_error recorded, got %v", ev.LastError)
	}
}

func TestQueue_ProcessNext_DeduplicatesWithoutHandler(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	depID := uuid.New()
	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   depID,
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusPending,
		AvailableAt:   time.Now().UTC().Add(-1 * time.Minute),
	})

	// A terminal build_job exists for this deployment, so this replay can be drained.
	db.insertBuildJob(&mockBuildJob{
		ID:           uuid.New(),
		DeploymentID: depID,
		Status:       BuildJobStatusSucceeded,
	})

	q := New(db, WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))))

	var handlerInvoked atomic.Bool
	processed, err := q.ProcessNext(ctx, func(hCtx context.Context, record *EventRecord) error {
		handlerInvoked.Store(true)
		return nil
	})

	if err != nil {
		t.Fatalf("unexpected error on deduplicated event: %v", err)
	}
	if !processed {
		t.Fatal("expected processed = true")
	}
	if handlerInvoked.Load() {
		t.Fatal("handler should NOT be invoked for duplicate event")
	}

	ev := db.outboxEvents[eventID]
	if ev.Status != StatusCompleted {
		t.Errorf("expected duplicate event to be drained to completed, got %s", ev.Status)
	}
}

func TestQueue_Run_StopsOnContextCancel(t *testing.T) {
	db := newMockDB()
	q := New(db,
		WithPollInterval(20*time.Millisecond),
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := q.Run(ctx, func(hCtx context.Context, record *EventRecord) error {
		return nil
	})

	if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context error on worker loop termination, got %v", err)
	}
}
