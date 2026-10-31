package githubworker

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/githubapp"
	"github.com/summit/backend/internal/githubwebhook"
	"github.com/summit/backend/internal/testutil"
)

type mockGitHubClient struct {
	mu            sync.Mutex
	mintedTokens  []string
	createdTokens map[int64]githubapp.InstallationToken
	mintErr       error
}

func newMockGitHubClient() *mockGitHubClient {
	return &mockGitHubClient{
		createdTokens: make(map[int64]githubapp.InstallationToken),
	}
}

func (m *mockGitHubClient) GetInstallation(_ context.Context, id int64) (githubapp.Installation, error) {
	return githubapp.Installation{ID: id, AccountLogin: "test-account"}, nil
}

func (m *mockGitHubClient) CreateInstallationToken(_ context.Context, installationID int64, _ []int64, _ map[string]string) (githubapp.InstallationToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.mintErr != nil {
		return githubapp.InstallationToken{}, m.mintErr
	}
	tok, ok := m.createdTokens[installationID]
	if !ok {
		tok = githubapp.InstallationToken{
			Token:     fmt.Sprintf("ghs_mock_token_for_inst_%d", installationID),
			ExpiresAt: time.Now().Add(1 * time.Hour).UTC(),
		}
	}
	m.mintedTokens = append(m.mintedTokens, tok.Token)
	return tok, nil
}

func (m *mockGitHubClient) ListInstallationRepositories(_ context.Context, _ int64, _, _ int) (githubapp.RepositoryPage, error) {
	return githubapp.RepositoryPage{}, nil
}

func (m *mockGitHubClient) GetRepository(_ context.Context, _ int64, owner, repo string) (githubapp.Repository, error) {
	return githubapp.Repository{OwnerLogin: owner, Name: repo, FullName: owner + "/" + repo}, nil
}

func (m *mockGitHubClient) GetCommit(_ context.Context, _ int64, _, _, ref string) (githubapp.Commit, error) {
	return githubapp.Commit{SHA: "abc1234567890", Ref: ref}, nil
}

func (m *mockGitHubClient) InvalidateInstallationTokens(_ int64) {}

type mockAuditWriter struct {
	mu     sync.Mutex
	events []audit.Event
}

func (m *mockAuditWriter) Write(_ context.Context, event audit.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, event)
	return nil
}

func (m *mockAuditWriter) Events() []audit.Event {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := make([]audit.Event, len(m.events))
	copy(cp, m.events)
	return cp
}

// Seed helpers for test database

func seedInstallation(t *testing.T, pool *pgxpool.Pool, orgID uuid.UUID, githubInstID int64, status string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, $2, $3, $4, 'Organization', $5)
		RETURNING id;
	`, orgID, githubInstID, githubInstID+1000, fmt.Sprintf("acme-corp-%d", githubInstID), status).Scan(&id)
	if err != nil {
		t.Fatalf("seeding installation: %v", err)
	}
	return id
}

func seedRepository(t *testing.T, pool *pgxpool.Pool, instID uuid.UUID, githubRepoID int64, name, fullName string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, default_branch, private, html_url
		) VALUES ($1, $2, 'acme-corp', $3, $4, 'main', false, $5)
		RETURNING id;
	`, instID, githubRepoID, name, fullName, fmt.Sprintf("https://github.com/%s", fullName)).Scan(&id)
	if err != nil {
		t.Fatalf("seeding repository: %v", err)
	}
	return id
}

func seedServiceSource(t *testing.T, pool *pgxpool.Pool, serviceID, repoID uuid.UUID, branch, rootDir string, autoDeploy bool, status string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO service_sources (
			service_id, repository_id, branch, root_directory, auto_deploy, source_status
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id;
	`, serviceID, repoID, branch, rootDir, autoDeploy, status).Scan(&id)
	if err != nil {
		t.Fatalf("seeding service source: %v", err)
	}
	return id
}

func insertWebhookEvent(t *testing.T, pool *pgxpool.Pool, deliveryID, eventType, action string, instID, repoID int64, payload []byte) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	payloadSHA := githubwebhook.PayloadSHA256(payload)
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_webhook_events (
			github_delivery_id, event_type, action, github_installation_id, github_repository_id, payload, payload_sha256, processing_status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'received')
		RETURNING id;
	`, deliveryID, eventType, action, instID, repoID, payload, payloadSHA).Scan(&id)
	if err != nil {
		t.Fatalf("inserting webhook event: %v", err)
	}
	return id
}

func TestProcessor_EmptyQueue(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	processed, err := ProcessNextEvent(context.Background(), pool, ghClient, auditWriter)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if processed {
		t.Errorf("expected processed=false when queue is empty")
	}
}

func TestProcessor_ProcessEventNotFound(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	randomID := uuid.New()
	err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, randomID)
	if err != ErrEventNotFound {
		t.Errorf("expected ErrEventNotFound, got %v", err)
	}
}

func TestProcessor_Push_IgnoredConditions(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	org := testutil.SeedOrg(t, pool, "Test Org", "")
	instID := seedInstallation(t, pool, org.ID, 1001, "active")
	repoID := seedRepository(t, pool, instID, 2001, "app", "acme/app")
	proj := testutil.SeedProject(t, pool, org.ID, "Proj", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	svc := testutil.SeedService(t, pool, env.ID, "web", "web")
	seedServiceSource(t, pool, svc.ID, repoID, "main", ".", true, "active")

	t.Run("ignore deleted branch", func(t *testing.T) {
		payload := map[string]any{
			"ref":     "refs/heads/feature-old",
			"deleted": true,
			"after":   "0000000000000000000000000000000000000000",
			"repository": map[string]any{
				"id":        int64(2001),
				"full_name": "acme/app",
			},
			"installation": map[string]any{"id": int64(1001)},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 1001, 2001, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var status, errMsg string
		_ = pool.QueryRow(context.Background(), "SELECT processing_status, coalesce(error_message, '') FROM github_webhook_events WHERE id = $1", evID).Scan(&status, &errMsg)
		if status != "ignored" || errMsg != "deleted_branch" {
			t.Errorf("expected status=ignored reason=deleted_branch, got status=%s reason=%s", status, errMsg)
		}
	})

	t.Run("ignore non-branch ref (tag)", func(t *testing.T) {
		payload := map[string]any{
			"ref":   "refs/tags/v1.0.0",
			"after": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"repository": map[string]any{
				"id":        int64(2001),
				"full_name": "acme/app",
			},
			"installation": map[string]any{"id": int64(1001)},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 1001, 2001, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var status, errMsg string
		_ = pool.QueryRow(context.Background(), "SELECT processing_status, coalesce(error_message, '') FROM github_webhook_events WHERE id = $1", evID).Scan(&status, &errMsg)
		if status != "ignored" || errMsg != "non_branch_ref" {
			t.Errorf("expected status=ignored reason=non_branch_ref, got status=%s reason=%s", status, errMsg)
		}
	})

	t.Run("ignore zero commit SHA", func(t *testing.T) {
		payload := map[string]any{
			"ref":   "refs/heads/main",
			"after": "0000000000000000000000000000000000000000",
			"repository": map[string]any{
				"id":        int64(2001),
				"full_name": "acme/app",
			},
			"installation": map[string]any{"id": int64(1001)},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 1001, 2001, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var status, errMsg string
		_ = pool.QueryRow(context.Background(), "SELECT processing_status, coalesce(error_message, '') FROM github_webhook_events WHERE id = $1", evID).Scan(&status, &errMsg)
		if status != "ignored" || errMsg != "zero_commit_sha" {
			t.Errorf("expected status=ignored reason=zero_commit_sha, got status=%s reason=%s", status, errMsg)
		}
	})

	t.Run("ignore push when installation is suspended", func(t *testing.T) {
		suspInstID := seedInstallation(t, pool, org.ID, 1002, "suspended")
		suspRepoID := seedRepository(t, pool, suspInstID, 2002, "susp-app", "acme/susp-app")
		suspSvc := testutil.SeedService(t, pool, env.ID, "susp-web", "web")
		seedServiceSource(t, pool, suspSvc.ID, suspRepoID, "main", ".", true, "active")

		payload := map[string]any{
			"ref":   "refs/heads/main",
			"after": "1111111111111111111111111111111111111111",
			"repository": map[string]any{
				"id":        int64(2002),
				"full_name": "acme/susp-app",
			},
			"installation": map[string]any{"id": int64(1002)},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 1002, 2002, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var status string
		_ = pool.QueryRow(context.Background(), "SELECT processing_status FROM github_webhook_events WHERE id = $1", evID).Scan(&status)
		if status != "ignored" {
			t.Errorf("expected status=ignored for suspended installation, got %s", status)
		}
	})
}

func TestProcessor_Push_CreatesDeploymentAndOutbox(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	org := testutil.SeedOrg(t, pool, "Acme Corp", "")
	instID := seedInstallation(t, pool, org.ID, 5001, "active")
	repoID := seedRepository(t, pool, instID, 6001, "api-service", "acme/api-service")
	proj := testutil.SeedProject(t, pool, org.ID, "Main Project", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "production", "production")
	svc := testutil.SeedService(t, pool, env.ID, "api", "web")
	sourceID := seedServiceSource(t, pool, svc.ID, repoID, "main", "./backend", true, "active")

	deliveryID := uuid.New().String()
	commitSHA := "abcdef1234567890abcdef1234567890abcdef12"

	payload := map[string]any{
		"ref":    "refs/heads/main",
		"before": "0000000000000000000000000000000000000000",
		"after":  commitSHA,
		"repository": map[string]any{
			"id":        int64(6001),
			"name":      "api-service",
			"full_name": "acme/api-service",
		},
		"installation": map[string]any{
			"id": int64(5001),
		},
	}
	rawPayload, _ := json.Marshal(payload)
	evID := insertWebhookEvent(t, pool, deliveryID, "push", "", 5001, 6001, rawPayload)

	// Process event
	processed, err := ProcessNextEvent(context.Background(), pool, ghClient, auditWriter)
	if err != nil {
		t.Fatalf("ProcessNextEvent failed: %v", err)
	}
	if !processed {
		t.Fatalf("expected event to be processed")
	}

	// 1. Verify github_webhook_events record is processed
	var evStatus string
	var processedAt *time.Time
	err = pool.QueryRow(context.Background(), `
		SELECT processing_status, processed_at
		FROM github_webhook_events
		WHERE id = $1;
	`, evID).Scan(&evStatus, &processedAt)
	if err != nil {
		t.Fatalf("querying event: %v", err)
	}
	if evStatus != "processed" || processedAt == nil {
		t.Errorf("expected event status=processed with non-nil processed_at, got status=%s, processed_at=%v", evStatus, processedAt)
	}

	// 2. Verify deployment record
	var depID uuid.UUID
	var depStatus string
	var depCommit string
	var depBranch string
	var depTriggerType string
	var depTriggerEventID uuid.UUID
	var depIdempotencyKey string
	var depSnapshotRaw []byte
	err = pool.QueryRow(context.Background(), `
		SELECT id, status, git_commit_sha, git_branch, trigger_type, trigger_event_id, idempotency_key, source_snapshot
		FROM deployments
		WHERE service_id = $1;
	`, svc.ID).Scan(&depID, &depStatus, &depCommit, &depBranch, &depTriggerType, &depTriggerEventID, &depIdempotencyKey, &depSnapshotRaw)
	if err != nil {
		t.Fatalf("querying deployment: %v", err)
	}

	if depStatus != "queued" {
		t.Errorf("expected deployment status=queued, got %s", depStatus)
	}
	if depCommit != commitSHA {
		t.Errorf("expected commit %s, got %s", commitSHA, depCommit)
	}
	if depBranch != "main" {
		t.Errorf("expected branch main, got %s", depBranch)
	}
	if depTriggerType != "github_push" {
		t.Errorf("expected trigger_type=github_push, got %s", depTriggerType)
	}
	if depTriggerEventID != evID {
		t.Errorf("expected trigger_event_id=%s, got %s", evID, depTriggerEventID)
	}
	expectedIdempKey := fmt.Sprintf("gh-push:%s:%s", deliveryID, svc.ID)
	if depIdempotencyKey != expectedIdempKey {
		t.Errorf("expected idempotency_key=%s, got %s", expectedIdempKey, depIdempotencyKey)
	}

	// 3. Verify build_jobs record (durable build request)
	var buildID uuid.UUID
	var buildStatus string
	var buildCommit string
	var buildRef string
	var builderType string
	err = pool.QueryRow(context.Background(), `
		SELECT id, status, commit_sha, ref, builder_type
		FROM build_jobs
		WHERE deployment_id = $1;
	`, depID).Scan(&buildID, &buildStatus, &buildCommit, &buildRef, &builderType)
	if err != nil {
		t.Fatalf("querying build_job: %v", err)
	}
	if buildStatus != "queued" {
		t.Errorf("expected build status=queued, got %s", buildStatus)
	}
	if buildCommit != commitSHA {
		t.Errorf("expected build commit=%s, got %s", commitSHA, buildCommit)
	}
	if buildRef != "refs/heads/main" {
		t.Errorf("expected build ref=refs/heads/main, got %s", buildRef)
	}
	if builderType != "gvisor_rootless_buildkit" {
		t.Errorf("expected builder_type=gvisor_rootless_buildkit, got %s", builderType)
	}

	// 4. Verify outbox_events record
	var outboxID uuid.UUID
	var outboxAggType string
	var outboxAggID uuid.UUID
	var outboxEvType string
	var outboxStatus string
	var outboxPayloadRaw []byte
	err = pool.QueryRow(context.Background(), `
		SELECT id, aggregate_type, aggregate_id, event_type, status, payload
		FROM outbox_events
		WHERE aggregate_id = $1;
	`, depID).Scan(&outboxID, &outboxAggType, &outboxAggID, &outboxEvType, &outboxStatus, &outboxPayloadRaw)
	if err != nil {
		t.Fatalf("querying outbox_events: %v", err)
	}
	if outboxAggType != "deployment" || outboxEvType != "deployment.build.requested" || outboxStatus != "pending" {
		t.Errorf("unexpected outbox event: type=%s, aggType=%s, status=%s", outboxEvType, outboxAggType, outboxStatus)
	}

	var outboxPayload map[string]any
	if err := json.Unmarshal(outboxPayloadRaw, &outboxPayload); err != nil {
		t.Fatalf("unmarshaling outbox payload: %v", err)
	}
	if outboxPayload["deployment_id"] != depID.String() {
		t.Errorf("expected deployment_id=%s in outbox, got %v", depID, outboxPayload["deployment_id"])
	}
	if outboxPayload["build_run_id"] != buildID.String() {
		t.Errorf("expected build_run_id=%s in outbox, got %v", buildID, outboxPayload["build_run_id"])
	}

	// 5. Verify service_sources was updated
	var lastSeenCommit string
	var lastDepID uuid.UUID
	err = pool.QueryRow(context.Background(), `
		SELECT last_seen_commit_sha, last_deployment_id
		FROM service_sources
		WHERE id = $1;
	`, sourceID).Scan(&lastSeenCommit, &lastDepID)
	if err != nil {
		t.Fatalf("querying service source: %v", err)
	}
	if lastSeenCommit != commitSHA {
		t.Errorf("expected last_seen_commit_sha=%s, got %s", commitSHA, lastSeenCommit)
	}
	if lastDepID != depID {
		t.Errorf("expected last_deployment_id=%s, got %s", depID, lastDepID)
	}

	// 6. Verify audit log was recorded
	events := auditWriter.Events()
	foundAudit := false
	for _, a := range events {
		if a.Action == audit.ActionDeploymentWebhookCreated && a.EntityID == depID {
			foundAudit = true
			if a.OrganizationID != org.ID {
				t.Errorf("expected audit orgID=%s, got %s", org.ID, a.OrganizationID)
			}
			break
		}
	}
	if !foundAudit {
		t.Errorf("expected ActionDeploymentWebhookCreated audit event to be recorded")
	}

	// 7. Verify Idempotency: Processing a duplicate event for the same delivery & service does NOT create a duplicate deployment
	_, err = pool.Exec(context.Background(), "UPDATE github_webhook_events SET processing_status = 'received', locked_until = NULL WHERE id = $1", evID)
	if err != nil {
		t.Fatalf("resetting event status: %v", err)
	}
	err = ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
	if err != nil {
		t.Fatalf("re-processing event: %v", err)
	}

	var depCount int
	err = pool.QueryRow(context.Background(), "SELECT count(*) FROM deployments WHERE service_id = $1", svc.ID).Scan(&depCount)
	if err != nil {
		t.Fatalf("counting deployments: %v", err)
	}
	if depCount != 1 {
		t.Errorf("idempotency violation: expected exactly 1 deployment, found %d", depCount)
	}
}

func TestProcessor_Push_MultipleServicesOnSameRepo(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	org := testutil.SeedOrg(t, pool, "Mono Org", "")
	instID := seedInstallation(t, pool, org.ID, 7001, "active")
	repoID := seedRepository(t, pool, instID, 8001, "monorepo", "acme/monorepo")
	proj := testutil.SeedProject(t, pool, org.ID, "Monorepo Project", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "staging", "staging")

	svc1 := testutil.SeedService(t, pool, env.ID, "web", "web")
	seedServiceSource(t, pool, svc1.ID, repoID, "main", "./apps/web", true, "active")

	svc2 := testutil.SeedService(t, pool, env.ID, "api", "web")
	seedServiceSource(t, pool, svc2.ID, repoID, "main", "./apps/api", true, "active")

	payload := map[string]any{
		"ref":   "refs/heads/main",
		"after": "2222222222222222222222222222222222222222",
		"repository": map[string]any{
			"id":        int64(8001),
			"full_name": "acme/monorepo",
		},
		"installation": map[string]any{"id": int64(7001)},
	}
	raw, _ := json.Marshal(payload)
	evID := insertWebhookEvent(t, pool, uuid.New().String(), "push", "", 7001, 8001, raw)

	err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
	if err != nil {
		t.Fatalf("processing monorepo push: %v", err)
	}

	var depCount int
	err = pool.QueryRow(context.Background(), "SELECT count(*) FROM deployments WHERE trigger_event_id = $1", evID).Scan(&depCount)
	if err != nil {
		t.Fatalf("counting deployments: %v", err)
	}
	if depCount != 2 {
		t.Errorf("expected 2 deployments (1 per service), got %d", depCount)
	}
}

func TestProcessor_InstallationLifecycle(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	org := testutil.SeedOrg(t, pool, "Inst Org", "")
	instID := seedInstallation(t, pool, org.ID, 9001, "active")
	repoID := seedRepository(t, pool, instID, 9501, "service-app", "acme/service-app")
	proj := testutil.SeedProject(t, pool, org.ID, "Inst Proj", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	svc := testutil.SeedService(t, pool, env.ID, "service-app", "web")
	seedServiceSource(t, pool, svc.ID, repoID, "main", ".", true, "active")

	t.Run("suspend event marks installation suspended and sources blocked", func(t *testing.T) {
		payload := map[string]any{
			"action": "suspend",
			"installation": map[string]any{
				"id": int64(9001),
			},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "installation", "suspend", 9001, 0, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("processing suspend event: %v", err)
		}

		var instStatus string
		var suspendedByGithub bool
		_ = pool.QueryRow(context.Background(), "SELECT status, suspended_by_github FROM github_installations WHERE id = $1", instID).Scan(&instStatus, &suspendedByGithub)
		if instStatus != "suspended" || !suspendedByGithub {
			t.Errorf("expected status=suspended suspended_by_github=true, got status=%s, flag=%v", instStatus, suspendedByGithub)
		}

		var srcStatus, discReason string
		_ = pool.QueryRow(context.Background(), "SELECT source_status, coalesce(disconnect_reason, '') FROM service_sources WHERE service_id = $1", svc.ID).Scan(&srcStatus, &discReason)
		if srcStatus != "blocked" || discReason != "github_app_suspended" {
			t.Errorf("expected service source blocked with github_app_suspended, got status=%s reason=%s", srcStatus, discReason)
		}
	})

	t.Run("unsuspend event restores installation to active", func(t *testing.T) {
		payload := map[string]any{
			"action": "unsuspend",
			"installation": map[string]any{
				"id": int64(9001),
			},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "installation", "unsuspend", 9001, 0, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("processing unsuspend event: %v", err)
		}

		var instStatus string
		var suspendedByGithub bool
		_ = pool.QueryRow(context.Background(), "SELECT status, suspended_by_github FROM github_installations WHERE id = $1", instID).Scan(&instStatus, &suspendedByGithub)
		if instStatus != "active" || suspendedByGithub {
			t.Errorf("expected status=active suspended_by_github=false, got status=%s flag=%v", instStatus, suspendedByGithub)
		}
	})

	t.Run("deleted event marks installation revoked and sources disconnected", func(t *testing.T) {
		payload := map[string]any{
			"action": "deleted",
			"installation": map[string]any{
				"id": int64(9001),
			},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "installation", "deleted", 9001, 0, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("processing deleted event: %v", err)
		}

		var instStatus string
		_ = pool.QueryRow(context.Background(), "SELECT status FROM github_installations WHERE id = $1", instID).Scan(&instStatus)
		if instStatus != "revoked" {
			t.Errorf("expected status=revoked, got %s", instStatus)
		}

		var srcStatus, discReason string
		_ = pool.QueryRow(context.Background(), "SELECT source_status, coalesce(disconnect_reason, '') FROM service_sources WHERE service_id = $1", svc.ID).Scan(&srcStatus, &discReason)
		if srcStatus != "disconnected" || discReason != "github_app_uninstalled" {
			t.Errorf("expected service source disconnected with github_app_uninstalled, got status=%s reason=%s", srcStatus, discReason)
		}
	})
}

func TestProcessor_InstallationRepositories(t *testing.T) {
	pool := testutil.NewDB(t)
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}

	org := testutil.SeedOrg(t, pool, "Repos Org", "")
	instID := seedInstallation(t, pool, org.ID, 3333, "active")

	t.Run("added repositories upserts records into github_repositories", func(t *testing.T) {
		payload := map[string]any{
			"action": "added",
			"installation": map[string]any{
				"id": int64(3333),
			},
			"repositories_added": []map[string]any{
				{
					"id":             int64(44441),
					"name":           "frontend",
					"full_name":      "acme/frontend",
					"default_branch": "main",
					"private":        true,
					"html_url":       "https://github.com/acme/frontend",
				},
				{
					"id":             int64(44442),
					"name":           "backend",
					"full_name":      "acme/backend",
					"default_branch": "main",
					"private":        false,
					"html_url":       "https://github.com/acme/backend",
				},
			},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "installation_repositories", "added", 3333, 0, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("processing added repos: %v", err)
		}

		var repoCount int
		_ = pool.QueryRow(context.Background(), "SELECT count(*) FROM github_repositories WHERE installation_id = $1 AND removed_at IS NULL", instID).Scan(&repoCount)
		if repoCount != 2 {
			t.Errorf("expected 2 active repositories upserted, got %d", repoCount)
		}
	})

	t.Run("removed repositories marks removed_at and blocks matching sources", func(t *testing.T) {
		var repoUUID uuid.UUID
		_ = pool.QueryRow(context.Background(), "SELECT id FROM github_repositories WHERE github_repository_id = 44441").Scan(&repoUUID)

		proj := testutil.SeedProject(t, pool, org.ID, "Frontend Proj", "")
		env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
		svc := testutil.SeedService(t, pool, env.ID, "frontend-svc", "web")
		seedServiceSource(t, pool, svc.ID, repoUUID, "main", ".", true, "active")

		payload := map[string]any{
			"action": "removed",
			"installation": map[string]any{
				"id": int64(3333),
			},
			"repositories_removed": []map[string]any{
				{
					"id":        int64(44441),
					"full_name": "acme/frontend",
				},
			},
		}
		raw, _ := json.Marshal(payload)
		evID := insertWebhookEvent(t, pool, uuid.New().String(), "installation_repositories", "removed", 3333, 0, raw)

		err := ProcessEvent(context.Background(), pool, ghClient, auditWriter, evID)
		if err != nil {
			t.Fatalf("processing removed repos: %v", err)
		}

		var removedAt *time.Time
		_ = pool.QueryRow(context.Background(), "SELECT removed_at FROM github_repositories WHERE id = $1", repoUUID).Scan(&removedAt)
		if removedAt == nil {
			t.Errorf("expected removed_at to be set on repository")
		}

		var srcStatus, discReason string
		_ = pool.QueryRow(context.Background(), "SELECT source_status, coalesce(disconnect_reason, '') FROM service_sources WHERE service_id = $1", svc.ID).Scan(&srcStatus, &discReason)
		if srcStatus != "blocked" || discReason != "github_repository_removed" {
			t.Errorf("expected source blocked with github_repository_removed, got status=%s reason=%s", srcStatus, discReason)
		}
	})
}
