package queue

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestRenewLease_Success(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-alpha"
	now := time.Now().UTC()
	lockUntil := now.Add(10 * time.Second)

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		LockedBy:      &workerID,
		LockedUntil:   &lockUntil,
		Attempts:      1,
	})

	// Renew lease for 60 seconds
	err := RenewLease(ctx, db, eventID, workerID, 60*time.Second)
	if err != nil {
		t.Fatalf("RenewLease failed: %v", err)
	}

	ev := db.outboxEvents[eventID]
	if ev.LockedUntil == nil || !ev.LockedUntil.After(now.Add(50*time.Second)) {
		t.Errorf("expected locked_until extended by ~60s, got %v", ev.LockedUntil)
	}
}

func TestRenewLease_WrongWorkerFails(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	ownerWorker := "worker-alpha"
	intruderWorker := "worker-beta"
	lockUntil := time.Now().UTC().Add(30 * time.Second)

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		LockedBy:      &ownerWorker,
		LockedUntil:   &lockUntil,
	})

	err := RenewLease(ctx, db, eventID, intruderWorker, 60*time.Second)
	if !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("expected ErrLeaseLost when renewed by wrong worker, got %v", err)
	}
}

func TestRenewLease_CompletedEventFails(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-alpha"

	db.insertOutboxEvent(&EventRecord{
		ID:            eventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusCompleted,
	})

	err := RenewLease(ctx, db, eventID, workerID, 60*time.Second)
	if !errors.Is(err, ErrAlreadyCompleted) {
		t.Fatalf("expected ErrAlreadyCompleted, got %v", err)
	}
}

func TestStartHeartbeat_ExtendsLease(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-hb"
	now := time.Now().UTC()
	lockUntil := now.Add(500 * time.Millisecond)

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

	var leaseLost atomic.Bool
	stop := StartHeartbeat(ctx, db, eventID, workerID, 50*time.Millisecond, 2*time.Second, func(err error) {
		leaseLost.Store(true)
	})

	// Wait for 2 heartbeat pulses
	time.Sleep(120 * time.Millisecond)
	stop()

	if leaseLost.Load() {
		t.Fatal("lease lost callback unexpectedly triggered")
	}

	ev := db.outboxEvents[eventID]
	if ev.LockedUntil == nil || !ev.LockedUntil.After(now.Add(1*time.Second)) {
		t.Errorf("heartbeat failed to extend lease, locked_until: %v", ev.LockedUntil)
	}
}

func TestWithLease_ContextCanceledOnLeaseLost(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	eventID := uuid.New()
	workerID := "worker-holder"
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

	doneCh := make(chan struct{})
	var contextCanceled atomic.Bool

	go func() {
		_ = WithLease(ctx, db, eventID, workerID, 20*time.Millisecond, 100*time.Millisecond, func(execCtx context.Context) error {
			// Simulate long-running work
			select {
			case <-execCtx.Done():
				contextCanceled.Store(true)
				close(doneCh)
				return execCtx.Err()
			case <-time.After(2 * time.Second):
				close(doneCh)
				return nil
			}
		})
	}()

	// Simulate external event: another worker or admin steals or completes the lease
	time.Sleep(50 * time.Millisecond)
	db.mu.Lock()
	otherWorker := "intruder"
	db.outboxEvents[eventID].LockedBy = &otherWorker
	db.mu.Unlock()

	select {
	case <-doneCh:
		if !contextCanceled.Load() {
			t.Fatal("expected execution context to be canceled when lease was lost")
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for lease loss cancellation")
	}
}
