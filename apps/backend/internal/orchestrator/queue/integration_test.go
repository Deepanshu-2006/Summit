package queue_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/testutil"
)

func TestIntegration_OutboxQueueLifecycle(t *testing.T) {
	pool := testutil.NewDB(t)
	if pool == nil {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
		return
	}

	ctx := context.Background()

	// Seed user, project, environment, deployment, and build_job
	owner := testutil.SeedUser(t, pool, "", "Queue Owner")
	proj := testutil.SeedProject(t, pool, owner.ID, "Queue Proj", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")

	deploymentID := uuid.New()
	_, err := pool.Exec(ctx, `
		INSERT INTO deployments (id, project_id, environment_id, git_commit_sha, git_branch, idempotency_key, status)
		VALUES ($1, $2, $3, 'abcdef1234567890abcdef1234567890abcdef12', 'main', $4, 'pending');
	`, deploymentID, proj.ID, env.ID, "idemp-"+uuid.New().String())
	if err != nil {
		t.Fatalf("seeding deployment: %v", err)
	}

	buildJobID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO build_jobs (id, deployment_id, status)
		VALUES ($1, $2, 'queued');
	`, buildJobID, deploymentID)
	if err != nil {
		t.Fatalf("seeding build_jobs: %v", err)
	}

	// Insert outbox event
	eventID := uuid.New()
	payload := map[string]any{
		"event_id":      uuid.New().String(),
		"deployment_id": deploymentID.String(),
		"build_run_id":  buildJobID.String(),
	}
	payloadBytes, _ := json.Marshal(payload)

	_, err = pool.Exec(ctx, `
		INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, available_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', now());
	`, eventID, queue.AggregateTypeDeployment, deploymentID, queue.EventTypeDeploymentBuildRequested, payloadBytes)
	if err != nil {
		t.Fatalf("inserting outbox event: %v", err)
	}

	workerID := fmt.Sprintf("worker-test-%s", uuid.New().String())
	q := queue.New(pool,
		queue.WithWorkerID(workerID),
		queue.WithLeaseDuration(15*time.Second),
		queue.WithHeartbeatInterval(2*time.Second),
	)

	// 1. Claim event
	rec, err := q.ClaimOne(ctx)
	if err != nil {
		t.Fatalf("failed claiming event: %v", err)
	}
	if rec.ID != eventID {
		t.Fatalf("expected claimed event %s, got %s", eventID, rec.ID)
	}
	if rec.Status != queue.StatusClaimed {
		t.Errorf("expected status claimed, got %s", rec.Status)
	}

	// 2. Renew lease
	err = q.RenewLease(ctx, eventID, 30*time.Second)
	if err != nil {
		t.Fatalf("failed renewing lease: %v", err)
	}

	// 3. Complete event
	err = q.Complete(ctx, eventID)
	if err != nil {
		t.Fatalf("failed completing event: %v", err)
	}

	// 4. Verify idempotent completion
	err = q.Complete(ctx, eventID)
	if err != nil {
		t.Fatalf("idempotent completion failed: %v", err)
	}

	// 5. Verify database state
	var finalStatus string
	_ = pool.QueryRow(ctx, "SELECT status FROM outbox_events WHERE id = $1", eventID).Scan(&finalStatus)
	if finalStatus != queue.StatusCompleted {
		t.Errorf("expected final status completed, got %s", finalStatus)
	}
}
