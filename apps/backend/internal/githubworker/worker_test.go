package githubworker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/testutil"
)

func TestWorker_RunAndProcessAllRemaining(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	org := testutil.SeedOrg(t, pool, "Worker Test Org", "")
	instID := seedInstallation(t, pool, org.ID, 4001, "active")
	repoID := seedRepository(t, pool, instID, 5001, "worker-app", "acme/worker-app")
	proj := testutil.SeedProject(t, pool, org.ID, "Worker Proj", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	svc := testutil.SeedService(t, pool, env.ID, "worker-web", "web")
	seedServiceSource(t, pool, svc.ID, repoID, "main", ".", true, "active")

	// Insert 3 webhook events
	for i := 1; i <= 3; i++ {
		payload := map[string]any{
			"ref":   "refs/heads/main",
			"after": fmt.Sprintf("333333333333333333333333333333333333333%d", i),
			"repository": map[string]any{
				"id":        int64(5001),
				"full_name": "acme/worker-app",
			},
			"installation": map[string]any{"id": int64(4001)},
		}
		raw, _ := json.Marshal(payload)
		insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 4001, 5001, raw)
	}

	// 1. ProcessAllRemaining should process all 3
	count, err := ProcessAllRemaining(context.Background(), pool, ghClient, auditWriter, 10)
	if err != nil {
		t.Fatalf("ProcessAllRemaining failed: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3 events processed, got %d", count)
	}

	// Verify all 3 in DB are processed
	var unprocCount int
	_ = pool.QueryRow(context.Background(), "SELECT count(*) FROM github_webhook_events WHERE processing_status = 'received'").Scan(&unprocCount)
	if unprocCount != 0 {
		t.Errorf("expected 0 received events remaining, got %d", unprocCount)
	}

	// 2. Test Worker.Run graceful cancellation
	worker := NewWorker(pool, ghClient, auditWriter, logger, 50*time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	err = worker.Run(ctx)
	if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
		t.Errorf("unexpected worker error on cancellation: %v", err)
	}
}
