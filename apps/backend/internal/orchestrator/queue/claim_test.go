package queue

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestClaim_FIFOOrdering(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	now := time.Now().UTC()
	id1 := uuid.New()
	id2 := uuid.New()
	id3 := uuid.New()

	// Seed 3 events with different available_at timestamps
	db.insertOutboxEvent(&EventRecord{
		ID:            id1,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"test":1}`),
		Status:        StatusPending,
		AvailableAt:   now.Add(-10 * time.Minute),
		CreatedAt:     now.Add(-10 * time.Minute),
	})
	db.insertOutboxEvent(&EventRecord{
		ID:            id2,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"test":2}`),
		Status:        StatusPending,
		AvailableAt:   now.Add(-5 * time.Minute),
		CreatedAt:     now.Add(-5 * time.Minute),
	})
	db.insertOutboxEvent(&EventRecord{
		ID:            id3,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{"test":3}`),
		Status:        StatusPending,
		AvailableAt:   now.Add(-1 * time.Minute),
		CreatedAt:     now.Add(-1 * time.Minute),
	})

	// Claim 1: should return id1 (oldest available)
	rec, err := ClaimOne(ctx, db, "worker-1", 30*time.Second)
	if err != nil {
		t.Fatalf("ClaimOne failed: %v", err)
	}
	if rec.ID != id1 {
		t.Fatalf("expected id1 %s, got %s", id1, rec.ID)
	}
	if rec.Status != StatusClaimed {
		t.Errorf("expected status claimed, got %s", rec.Status)
	}
	if rec.LockedBy == nil || *rec.LockedBy != "worker-1" {
		t.Errorf("expected locked_by worker-1, got %v", rec.LockedBy)
	}
	if rec.Attempts != 1 {
		t.Errorf("expected attempts 1, got %d", rec.Attempts)
	}

	// Claim 2: should return id2
	rec2, err := ClaimOne(ctx, db, "worker-1", 30*time.Second)
	if err != nil {
		t.Fatalf("ClaimOne second call failed: %v", err)
	}
	if rec2.ID != id2 {
		t.Fatalf("expected id2 %s, got %s", id2, rec2.ID)
	}

	// Claim remaining batch (limit 5): should return [id3]
	batch, err := Claim(ctx, db, "worker-1", 30*time.Second, 5)
	if err != nil {
		t.Fatalf("Claim batch failed: %v", err)
	}
	if len(batch) != 1 {
		t.Fatalf("expected 1 remaining record, got %d", len(batch))
	}
	if batch[0].ID != id3 {
		t.Fatalf("expected id3, got %s", batch[0].ID)
	}

	// Now queue should be empty
	_, err = ClaimOne(ctx, db, "worker-1", 30*time.Second)
	if !errors.Is(err, ErrNoEvents) {
		t.Fatalf("expected ErrNoEvents, got %v", err)
	}
}

func TestClaim_ExpiredLeaseReclaiming(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	now := time.Now().UTC()
	expiredEventID := uuid.New()
	workerOld := "dead-worker"
	pastLock := now.Add(-10 * time.Second)

	// An event that was claimed by a dead worker whose lease expired
	db.insertOutboxEvent(&EventRecord{
		ID:            expiredEventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		Attempts:      1,
		AvailableAt:   now.Add(-1 * time.Minute),
		LockedUntil:   &pastLock,
		LockedBy:      &workerOld,
	})

	// An active event claimed by active-worker whose lease is still valid (future locked_until)
	activeEventID := uuid.New()
	workerActive := "active-worker"
	futureLock := now.Add(30 * time.Second)
	db.insertOutboxEvent(&EventRecord{
		ID:            activeEventID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusClaimed,
		Attempts:      1,
		AvailableAt:   now.Add(-1 * time.Minute),
		LockedUntil:   &futureLock,
		LockedBy:      &workerActive,
	})

	// New worker attempts to claim
	workerNew := "recovering-worker"
	rec, err := ClaimOne(ctx, db, workerNew, 45*time.Second)
	if err != nil {
		t.Fatalf("ClaimOne failed to reclaim expired lease: %v", err)
	}

	// Must have reclaimed the expired event, NOT the active event!
	if rec.ID != expiredEventID {
		t.Fatalf("expected reclaimed event %s, got %s", expiredEventID, rec.ID)
	}
	if *rec.LockedBy != workerNew {
		t.Errorf("expected locked_by %s, got %s", workerNew, *rec.LockedBy)
	}
	if rec.Attempts != 2 {
		t.Errorf("expected attempts incremented to 2, got %d", rec.Attempts)
	}

	// Next claim should find no eligible events because activeEvent is still validly locked
	_, err = ClaimOne(ctx, db, workerNew, 45*time.Second)
	if !errors.Is(err, ErrNoEvents) {
		t.Fatalf("expected ErrNoEvents for remaining active events, got %v", err)
	}
}

func TestClaim_FutureAvailableAtIgnored(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	now := time.Now().UTC()
	futureID := uuid.New()

	// Event with available_at 5 minutes in the future (scheduled backoff)
	db.insertOutboxEvent(&EventRecord{
		ID:            futureID,
		AggregateType: AggregateTypeDeployment,
		AggregateID:   uuid.New(),
		EventType:     EventTypeDeploymentBuildRequested,
		Payload:       []byte(`{}`),
		Status:        StatusPending,
		AvailableAt:   now.Add(5 * time.Minute),
	})

	_, err := ClaimOne(ctx, db, "worker-1", 30*time.Second)
	if !errors.Is(err, ErrNoEvents) {
		t.Fatalf("expected ErrNoEvents for future available_at event, got %v", err)
	}
}

func TestClaim_ConcurrentWorkersNoCollision(t *testing.T) {
	db := newMockDB()
	ctx := context.Background()

	const numEvents = 20
	const numWorkers = 5

	for i := 0; i < numEvents; i++ {
		db.insertOutboxEvent(&EventRecord{
			ID:            uuid.New(),
			AggregateType: AggregateTypeDeployment,
			AggregateID:   uuid.New(),
			EventType:     EventTypeDeploymentBuildRequested,
			Payload:       []byte(`{}`),
			Status:        StatusPending,
			AvailableAt:   time.Now().UTC().Add(time.Duration(-i) * time.Second),
		})
	}

	var claimedMu sync.Mutex
	claimedMap := make(map[uuid.UUID]string)
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			workerName := uuid.New().String()
			for {
				rec, err := ClaimOne(ctx, db, workerName, 10*time.Second)
				if errors.Is(err, ErrNoEvents) {
					return
				}
				if err != nil {
					t.Errorf("worker %d claim error: %v", workerIndex, err)
					return
				}

				claimedMu.Lock()
				if existingWorker, exists := claimedMap[rec.ID]; exists {
					t.Errorf("RACE CONDITION: event %s claimed by both %s and %s", rec.ID, existingWorker, workerName)
				}
				claimedMap[rec.ID] = workerName
				claimedMu.Unlock()
			}
		}(w)
	}

	wg.Wait()

	if len(claimedMap) != numEvents {
		t.Fatalf("expected all %d events claimed, but claimed %d", numEvents, len(claimedMap))
	}
}

func TestClaimByID(t *testing.T) {
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
		AvailableAt:   time.Now().UTC().Add(-1 * time.Minute),
	})

	rec, err := ClaimByID(ctx, db, eventID, "worker-target", 30*time.Second)
	if err != nil {
		t.Fatalf("ClaimByID failed: %v", err)
	}
	if rec.ID != eventID {
		t.Errorf("expected claimed ID %s, got %s", eventID, rec.ID)
	}

	// Claiming again while actively locked should return ErrLeaseLost
	_, err = ClaimByID(ctx, db, eventID, "another-worker", 30*time.Second)
	if !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("expected ErrLeaseLost, got %v", err)
	}

	// Non-existent ID returns ErrEventNotFound
	_, err = ClaimByID(ctx, db, uuid.New(), "worker-target", 30*time.Second)
	if !errors.Is(err, ErrEventNotFound) {
		t.Fatalf("expected ErrEventNotFound, got %v", err)
	}
}
