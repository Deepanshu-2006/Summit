package githubapi_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/githubapi"
	"github.com/summit/backend/internal/githubapp"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/installstate"
	"github.com/summit/backend/internal/testutil"
)

type mockGitHubClient struct {
	getInstallationFunc         func(ctx context.Context, installationID int64) (githubapp.Installation, error)
	listInstallationReposFunc   func(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error)
	getRepositoryFunc           func(ctx context.Context, installationID int64, owner, repo string) (githubapp.Repository, error)
	getCommitFunc               func(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error)
	createInstallationTokenFunc func(ctx context.Context, installationID int64, repositoryIDs []int64, permissions map[string]string) (githubapp.InstallationToken, error)
}

func (m *mockGitHubClient) GetInstallation(ctx context.Context, installationID int64) (githubapp.Installation, error) {
	if m.getInstallationFunc != nil {
		return m.getInstallationFunc(ctx, installationID)
	}
	return githubapp.Installation{
		ID:           installationID,
		AccountID:    999,
		AccountLogin: "test-org",
		AccountType:  "Organization",
		Permissions:  map[string]string{"contents": "read", "metadata": "read"},
	}, nil
}

func (m *mockGitHubClient) ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error) {
	if m.listInstallationReposFunc != nil {
		return m.listInstallationReposFunc(ctx, installationID, page, perPage)
	}
	return githubapp.RepositoryPage{
		Repositories: []githubapp.Repository{
			{
				ID:            101,
				OwnerLogin:    "test-org",
				Name:          "repo-1",
				FullName:      "test-org/repo-1",
				DefaultBranch: "main",
				Private:       true,
				HTMLURL:       "https://github.com/test-org/repo-1",
			},
			{
				ID:            102,
				OwnerLogin:    "test-org",
				Name:          "repo-2",
				FullName:      "test-org/repo-2",
				DefaultBranch: "main",
				Private:       false,
				HTMLURL:       "https://github.com/test-org/repo-2",
			},
		},
		TotalCount: 2,
		Page:       page,
		PerPage:    perPage,
		HasNext:    false,
	}, nil
}

func (m *mockGitHubClient) GetRepository(ctx context.Context, installationID int64, owner, repo string) (githubapp.Repository, error) {
	if m.getRepositoryFunc != nil {
		return m.getRepositoryFunc(ctx, installationID, owner, repo)
	}
	return githubapp.Repository{
		ID:            101,
		OwnerLogin:    owner,
		Name:          repo,
		FullName:      owner + "/" + repo,
		DefaultBranch: "main",
	}, nil
}

func (m *mockGitHubClient) GetCommit(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error) {
	if m.getCommitFunc != nil {
		return m.getCommitFunc(ctx, installationID, owner, repo, ref)
	}
	return githubapp.Commit{
		SHA: "0123456789abcdef0123456789abcdef01234567",
		Ref: ref,
	}, nil
}

func (m *mockGitHubClient) CreateInstallationToken(ctx context.Context, installationID int64, repositoryIDs []int64, permissions map[string]string) (githubapp.InstallationToken, error) {
	if m.createInstallationTokenFunc != nil {
		return m.createInstallationTokenFunc(ctx, installationID, repositoryIDs, permissions)
	}
	return githubapp.InstallationToken{
		Token:     "ghs_dummytoken123",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}, nil
}

func (m *mockGitHubClient) InvalidateInstallationTokens(installationID int64) {}

func setupTestService(t *testing.T, pool *pgxpool.Pool, ghClient githubapi.GitHubClient) *githubapi.Service {
	cfg := &config.Config{
		GitHubAppSlug:           "test-summit-app",
		GitHubStateTTL:          10 * time.Minute,
		PlatformFrontendBaseURL: "http://localhost:3000",
	}
	return githubapi.NewService(githubapi.Config{
		Pool:     pool,
		GHClient: ghClient,
		AppCfg:   cfg,
		Audit:    audit.NewPgxWriter(pool),
	})
}

func TestStartInstallation(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org := testutil.SeedOrg(t, pool, "Test Org", "test-org")
	user := testutil.SeedUser(t, pool, "admin@example.com", "Admin User")

	res, err := svc.StartInstallation(context.Background(), org.ID, user.ID, "127.0.0.1", "test-agent", "req-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.InstallationURL == "" {
		t.Fatal("expected non-empty InstallationURL")
	}
	if res.StateExpiresAt == "" {
		t.Fatal("expected non-empty StateExpiresAt")
	}

	// Verify state row exists in database
	var stateCount int
	err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM github_installation_states WHERE organization_id = $1 AND user_id = $2", org.ID, user.ID).Scan(&stateCount)
	if err != nil || stateCount != 1 {
		t.Fatalf("expected 1 state record in db, got %d (err: %v)", stateCount, err)
	}
}

func TestHandleCallback_Success(t *testing.T) {
	pool := testutil.NewDB(t)
	mockGH := &mockGitHubClient{}
	svc := setupTestService(t, pool, mockGH)

	org := testutil.SeedOrg(t, pool, "Callback Org", "callback-org")
	user := testutil.SeedUser(t, pool, "user@example.com", "User")

	// Generate and persist state
	rawState, stateHash, err := installstate.Generate()
	if err != nil {
		t.Fatalf("generating state: %v", err)
	}
	_, err = pool.Exec(context.Background(),
		"INSERT INTO github_installation_states (id, state_hash, user_id, organization_id, expires_at) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
		stateHash, user.ID, org.ID, time.Now().Add(10*time.Minute),
	)
	if err != nil {
		t.Fatalf("inserting state: %v", err)
	}

	// Invoke callback
	redirectURL, err := svc.HandleCallback(context.Background(), "12345", rawState, "install", "127.0.0.1", "test-agent", "req-cb")
	if err != nil {
		t.Fatalf("unexpected callback error: %v", err)
	}

	if redirectURL == "" {
		t.Fatal("expected non-empty redirect URL")
	}
	if !containsStr(redirectURL, "status=success") {
		t.Fatalf("expected status=success in redirect URL, got %s", redirectURL)
	}

	// Verify state is consumed
	var consumedAt *time.Time
	err = pool.QueryRow(context.Background(), "SELECT consumed_at FROM github_installation_states WHERE state_hash = $1", stateHash).Scan(&consumedAt)
	if err != nil || consumedAt == nil {
		t.Fatalf("expected state to be consumed, got %v (err: %v)", consumedAt, err)
	}

	// Verify installation row created
	var instCount int
	err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM github_installations WHERE organization_id = $1 AND github_installation_id = 12345", org.ID).Scan(&instCount)
	if err != nil || instCount != 1 {
		t.Fatalf("expected 1 installation record, got %d (err: %v)", instCount, err)
	}

	// Verify repositories synced
	var repoCount int
	err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM github_repositories WHERE owner_login = 'test-org'").Scan(&repoCount)
	if err != nil || repoCount != 2 {
		t.Fatalf("expected 2 repositories synced, got %d (err: %v)", repoCount, err)
	}
}

func TestHandleCallback_InvalidState(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	redirectURL, err := svc.HandleCallback(context.Background(), "12345", "invalid-unknown-state", "install", "127.0.0.1", "test-agent", "req-cb")
	if err != nil {
		t.Fatalf("unexpected callback error: %v", err)
	}

	if !containsStr(redirectURL, "status=error") || !containsStr(redirectURL, httpx.CodeGitHubInstallationStateInvalid) {
		t.Fatalf("expected error redirect with %s, got %s", httpx.CodeGitHubInstallationStateInvalid, redirectURL)
	}
}

func TestHandleCallback_ExpiredState(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org := testutil.SeedOrg(t, pool, "Expired Org", "expired-org")
	user := testutil.SeedUser(t, pool, "expired@example.com", "Expired User")

	rawState, stateHash, _ := installstate.Generate()
	_, _ = pool.Exec(context.Background(),
		"INSERT INTO github_installation_states (id, state_hash, user_id, organization_id, expires_at) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
		stateHash, user.ID, org.ID, time.Now().Add(-5*time.Minute), // expired in past
	)

	redirectURL, _ := svc.HandleCallback(context.Background(), "12345", rawState, "install", "127.0.0.1", "test-agent", "req-exp")
	if !containsStr(redirectURL, "status=error") || !containsStr(redirectURL, httpx.CodeGitHubInstallationStateExpired) {
		t.Fatalf("expected error redirect with %s, got %s", httpx.CodeGitHubInstallationStateExpired, redirectURL)
	}
}

func TestHandleCallback_AlreadyLinkedToDifferentOrg(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org1 := testutil.SeedOrg(t, pool, "Org 1", "org-1")
	org2 := testutil.SeedOrg(t, pool, "Org 2", "org-2")
	user := testutil.SeedUser(t, pool, "user@example.com", "User")

	// Seed installation already under org1
	_, err := pool.Exec(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 99999, 111, 'conflict-acc', 'Organization', 'active')
	`, org1.ID)
	if err != nil {
		t.Fatalf("seeding org1 installation: %v", err)
	}

	// State belongs to org2
	rawState, stateHash, _ := installstate.Generate()
	_, _ = pool.Exec(context.Background(),
		"INSERT INTO github_installation_states (id, state_hash, user_id, organization_id, expires_at) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
		stateHash, user.ID, org2.ID, time.Now().Add(10*time.Minute),
	)

	redirectURL, _ := svc.HandleCallback(context.Background(), "99999", rawState, "install", "127.0.0.1", "test-agent", "req-conflict")
	if !containsStr(redirectURL, "status=error") || !containsStr(redirectURL, httpx.CodeGitHubInstallationAlreadyLinked) {
		t.Fatalf("expected conflict redirect with %s, got %s", httpx.CodeGitHubInstallationAlreadyLinked, redirectURL)
	}
}

func TestListAndGetInstallations(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org := testutil.SeedOrg(t, pool, "List Org", "list-org")

	// Seed installation
	var instID uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status, repository_selection
		) VALUES ($1, 77777, 555, 'acme-inc', 'Organization', 'active', 'all')
		RETURNING id
	`, org.ID).Scan(&instID)
	if err != nil {
		t.Fatalf("inserting installation: %v", err)
	}

	// List installations
	listRes, err := svc.ListInstallations(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("unexpected list error: %v", err)
	}
	if len(listRes.Data) != 1 {
		t.Fatalf("expected 1 installation, got %d", len(listRes.Data))
	}
	if listRes.Data[0].GitHubAccount.Login != "acme-inc" {
		t.Fatalf("expected login acme-inc, got %s", listRes.Data[0].GitHubAccount.Login)
	}

	// Get installation detail by UUID
	getRes, err := svc.GetInstallation(context.Background(), org.ID, instID.String())
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}
	if getRes.GitHubInstallationID != 77777 {
		t.Fatalf("expected gh id 77777, got %d", getRes.GitHubInstallationID)
	}

	// Get installation detail by numeric GitHub ID
	getResByNum, err := svc.GetInstallation(context.Background(), org.ID, "77777")
	if err != nil {
		t.Fatalf("unexpected get by numeric ID error: %v", err)
	}
	if getResByNum.ID != instID {
		t.Fatalf("expected matching UUID, got %v vs %v", getResByNum.ID, instID)
	}
}

func TestDisconnectInstallation(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org := testutil.SeedOrg(t, pool, "Disc Org", "disc-org")
	user := testutil.SeedUser(t, pool, "admin@example.com", "Admin")
	proj := testutil.SeedProject(t, pool, org.ID, "Proj", "proj")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	service := testutil.SeedService(t, pool, env.ID, "web-app", "web")

	// Create installation
	var instID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 88888, 444, 'disc-acc', 'Organization', 'active')
		RETURNING id
	`, org.ID).Scan(&instID)

	// Create repository
	var repoID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, private
		) VALUES ($1, 501, 'disc-acc', 'repo-x', 'disc-acc/repo-x', true)
		RETURNING id
	`, instID).Scan(&repoID)

	// Create service source
	_, err := pool.Exec(context.Background(), `
		INSERT INTO service_sources (
			service_id, repository_id, branch, source_status
		) VALUES ($1, $2, 'main', 'active')
	`, service.ID, repoID)
	if err != nil {
		t.Fatalf("creating service source: %v", err)
	}

	// Disconnect installation
	discRes, err := svc.DisconnectInstallation(context.Background(), org.ID, instID.String(), user.ID, "127.0.0.1", "test-agent", "req-disc")
	if err != nil {
		t.Fatalf("unexpected disconnect error: %v", err)
	}
	if discRes.Status != "disconnected" {
		t.Fatalf("expected status disconnected, got %s", discRes.Status)
	}

	// Verify installation status in DB
	var instStatus string
	_ = pool.QueryRow(context.Background(), "SELECT status FROM github_installations WHERE id = $1", instID).Scan(&instStatus)
	if instStatus != "disconnected" {
		t.Fatalf("expected installation status disconnected, got %s", instStatus)
	}

	// Verify dependent service source is disconnected with installation_disconnected
	var srcStatus, discReason string
	_ = pool.QueryRow(context.Background(), "SELECT source_status, disconnect_reason FROM service_sources WHERE service_id = $1", service.ID).Scan(&srcStatus, &discReason)
	if srcStatus != "disconnected" || discReason != "installation_disconnected" {
		t.Fatalf("expected source status disconnected with installation_disconnected, got status=%s reason=%s", srcStatus, discReason)
	}
}

func TestSyncInstallation(t *testing.T) {
	pool := testutil.NewDB(t)
	mockGH := &mockGitHubClient{
		listInstallationReposFunc: func(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error) {
			return githubapp.RepositoryPage{
				Repositories: []githubapp.Repository{
					{
						ID:            201,
						OwnerLogin:    "synced-org",
						Name:          "new-repo",
						FullName:      "synced-org/new-repo",
						DefaultBranch: "main",
						Private:       true,
					},
				},
				TotalCount: 1,
				Page:       1,
				PerPage:    perPage,
				HasNext:    false,
			}, nil
		},
	}
	svc := setupTestService(t, pool, mockGH)

	org := testutil.SeedOrg(t, pool, "Sync Org", "sync-org")
	user := testutil.SeedUser(t, pool, "admin@example.com", "Admin")

	var instID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 66666, 333, 'synced-org', 'Organization', 'active')
		RETURNING id
	`, org.ID).Scan(&instID)

	// Pre-seed an old repo that won't be returned by sync
	_, _ = pool.Exec(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, private
		) VALUES ($1, 199, 'synced-org', 'old-repo', 'synced-org/old-repo', true)
	`, instID)

	syncRes, err := svc.SyncInstallation(context.Background(), org.ID, instID.String(), user.ID, "127.0.0.1", "test-agent", "req-sync")
	if err != nil {
		t.Fatalf("unexpected sync error: %v", err)
	}
	if syncRes.Status != "completed" || syncRes.RepositoriesSynced != 1 {
		t.Fatalf("unexpected sync response: %+v", syncRes)
	}

	// Verify old repo was marked removed
	var removedAt *time.Time
	_ = pool.QueryRow(context.Background(), "SELECT removed_at FROM github_repositories WHERE github_repository_id = 199").Scan(&removedAt)
	if removedAt == nil {
		t.Fatal("expected old repo to have removed_at set")
	}

	// Verify new repo exists and removed_at is null
	var newRemovedAt *time.Time
	_ = pool.QueryRow(context.Background(), "SELECT removed_at FROM github_repositories WHERE github_repository_id = 201").Scan(&newRemovedAt)
	if newRemovedAt != nil {
		t.Fatal("expected new repo to have nil removed_at")
	}
}

func TestServiceSource_CRUD(t *testing.T) {
	pool := testutil.NewDB(t)
	svc := setupTestService(t, pool, &mockGitHubClient{})

	org := testutil.SeedOrg(t, pool, "Source Org", "source-org")
	user := testutil.SeedUser(t, pool, "admin@example.com", "Admin")
	proj := testutil.SeedProject(t, pool, org.ID, "Proj", "proj")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	service := testutil.SeedService(t, pool, env.ID, "api-srv", "web")

	// Create installation & repo
	var instID, repoID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 55555, 222, 'source-acc', 'Organization', 'active')
		RETURNING id
	`, org.ID).Scan(&instID)

	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, default_branch, private
		) VALUES ($1, 301, 'source-acc', 'api-repo', 'source-acc/api-repo', 'main', true)
		RETURNING id
	`, instID).Scan(&repoID)

	// 1. PUT service source
	putRes, err := svc.PutServiceSource(context.Background(), service.ID, user.ID, githubapi.PutServiceSourceRequest{
		RepositoryID:       repoID,
		Branch:             "main",
		RootDirectory:      "apps/api",
		BuildConfiguration: map[string]any{"node_version": "20"},
	}, "127.0.0.1", "test-agent", "req-put")
	if err != nil {
		t.Fatalf("unexpected put source error: %v", err)
	}
	if putRes.RootDirectory != "apps/api" || putRes.Branch != "main" {
		t.Fatalf("unexpected put source response: %+v", putRes)
	}

	// 2. GET service source
	getRes, err := svc.GetServiceSource(context.Background(), service.ID)
	if err != nil {
		t.Fatalf("unexpected get source error: %v", err)
	}
	if getRes.Repository.FullName != "source-acc/api-repo" {
		t.Fatalf("expected full name source-acc/api-repo, got %s", getRes.Repository.FullName)
	}

	// 3. PATCH service source
	newBranch := "staging"
	patchRes, err := svc.PatchServiceSource(context.Background(), service.ID, user.ID, githubapi.PatchServiceSourceRequest{
		Branch: &newBranch,
	}, "127.0.0.1", "test-agent", "req-patch")
	if err != nil {
		t.Fatalf("unexpected patch source error: %v", err)
	}
	if patchRes.Branch != "staging" {
		t.Fatalf("expected branch staging, got %s", patchRes.Branch)
	}

	// 4. DELETE service source
	delRes, err := svc.DisconnectServiceSource(context.Background(), service.ID, user.ID, "127.0.0.1", "test-agent", "req-del")
	if err != nil {
		t.Fatalf("unexpected delete source error: %v", err)
	}
	if delRes.SourceStatus != "disconnected" || delRes.DisconnectReason != "user_disconnected" {
		t.Fatalf("expected disconnected / user_disconnected, got %+v", delRes)
	}
}

func TestManualDeployment_SuccessAndIdempotency(t *testing.T) {
	pool := testutil.NewDB(t)
	mockGH := &mockGitHubClient{
		getCommitFunc: func(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error) {
			return githubapp.Commit{
				SHA: "1111222233334444555566667777888899990000",
				Ref: ref,
			}, nil
		},
	}
	svc := setupTestService(t, pool, mockGH)

	org := testutil.SeedOrg(t, pool, "Deploy Org", "deploy-org")
	user := testutil.SeedUser(t, pool, "deployer@example.com", "Deployer")
	proj := testutil.SeedProject(t, pool, org.ID, "Deploy Project", "deploy-project")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "production", "production")
	service := testutil.SeedService(t, pool, env.ID, "deploy-svc", "web")

	// Create installation & repository
	var instID, repoID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			organization_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 44444, 111, 'deploy-acc', 'Organization', 'active')
		RETURNING id
	`, org.ID).Scan(&instID)

	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, default_branch, private
		) VALUES ($1, 401, 'deploy-acc', 'deploy-repo', 'deploy-acc/deploy-repo', 'main', true)
		RETURNING id
	`, instID).Scan(&repoID)

	// Connect source
	_, err := svc.PutServiceSource(context.Background(), service.ID, user.ID, githubapi.PutServiceSourceRequest{
		RepositoryID: repoID,
		Branch:       "main",
	}, "127.0.0.1", "test-agent", "req-put")
	if err != nil {
		t.Fatalf("connecting source: %v", err)
	}

	idempKey := "deploy-key-12345"

	// Trigger manual deployment
	depRes, err := svc.CreateManualDeployment(context.Background(), service.ID, user.ID, idempKey, githubapi.ManualDeploymentRequest{
		Source: githubapi.DeploymentSourceRef{Ref: "refs/heads/main"},
		Reason: "manual testing",
	}, "127.0.0.1", "test-agent", "req-dep")
	if err != nil {
		t.Fatalf("unexpected manual deployment error: %v", err)
	}

	if depRes.Status != "queued" {
		t.Fatalf("expected status queued, got %s", depRes.Status)
	}
	if depRes.CommitSHA != "1111222233334444555566667777888899990000" {
		t.Fatalf("unexpected commit sha: %s", depRes.CommitSHA)
	}

	// Verify build_job was created
	var buildJobCount int
	_ = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM build_jobs WHERE deployment_id = $1 AND status = 'queued'", depRes.ID).Scan(&buildJobCount)
	if buildJobCount != 1 {
		t.Fatalf("expected 1 queued build_job, got %d", buildJobCount)
	}

	// Verify outbox_event was created
	var outboxCount int
	_ = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'deployment.build.requested'", depRes.ID).Scan(&outboxCount)
	if outboxCount != 1 {
		t.Fatalf("expected 1 outbox_event, got %d", outboxCount)
	}

	// Idempotency test: repeating with same idempotency key returns existing deployment
	depRes2, err := svc.CreateManualDeployment(context.Background(), service.ID, user.ID, idempKey, githubapi.ManualDeploymentRequest{
		Source: githubapi.DeploymentSourceRef{Ref: "refs/heads/main"},
		Reason: "manual testing retry",
	}, "127.0.0.1", "test-agent", "req-dep-retry")
	if err != nil {
		t.Fatalf("unexpected retry error: %v", err)
	}
	if depRes2.ID != depRes.ID {
		t.Fatalf("expected matching deployment ID on replay, got %v vs %v", depRes2.ID, depRes.ID)
	}
}

func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && fmt.Sprintf("%v", s) != "" && (s == substr || len(s) > 0 && (substr == "" || (len(s) >= len(substr) && (findSubstring(s, substr)))))
}

func findSubstring(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (s[:len(sub)] == sub || findSubstring(s[1:], sub)))
}
