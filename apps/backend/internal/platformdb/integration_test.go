package platformdb_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/orchestrator"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/testutil"
)

// fx is a fully wired owner: user -> project -> production env -> web service
// with an active GitHub source.
type fx struct {
	pool    *pgxpool.Pool
	store   *platformdb.Store
	user    testutil.User
	project *platformdb.Project
	env     *platformdb.Environment
	service *platformdb.Service
	repo    testutil.GitHubRepository
	source  testutil.ServiceSource
}

func setup(t *testing.T) *fx {
	t.Helper()
	pool := testutil.NewDB(t)
	store := platformdb.New(pool)
	ctx := context.Background()
	user := testutil.SeedUser(t, pool, "", "")
	project, env, err := store.CreateProject(ctx, user.ID, platformdb.CreateProjectParams{Slug: "my-app", Name: "My App"})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	svc, err := store.CreateService(ctx, user.ID, env.ID, "web", "web")
	if err != nil {
		t.Fatalf("CreateService: %v", err)
	}
	inst := testutil.SeedGitHubInstallation(t, pool, user.ID, "octo")
	repo := testutil.SeedGitHubRepository(t, pool, inst.ID, "octo/hello")
	src := testutil.SeedServiceSource(t, pool, svc.ID, repo.ID, "main")
	return &fx{pool: pool, store: store, user: user, project: project, env: env, service: svc, repo: repo, source: src}
}

// deploy creates a fresh deployment through the public API.
func (f *fx) deploy(t *testing.T, key string) *platformdb.CreateDeploymentResult {
	t.Helper()
	res, err := f.store.CreateDeploymentWithOutbox(context.Background(), platformdb.CreateDeploymentParams{
		UserID: f.user.ID, ServiceID: f.service.ID, IdempotencyKey: key,
		TriggeredByUserID: &f.user.ID, CommitSHA: strings.Repeat("a", 40), Branch: "main", Ref: "refs/heads/main",
	})
	if err != nil {
		t.Fatalf("CreateDeploymentWithOutbox: %v", err)
	}
	return res
}

func (f *fx) transition(t *testing.T, id uuid.UUID, from platformdb.DeploymentStatus, to platformdb.DeploymentStatus, opts ...platformdb.TransitionOption) *platformdb.Deployment {
	t.Helper()
	d, err := f.store.TransitionDeployment(context.Background(), id, []platformdb.DeploymentStatus{from}, to, "test "+string(to), opts...)
	if err != nil {
		t.Fatalf("transition %s -> %s: %v", from, to, err)
	}
	return d
}

func count(t *testing.T, pool *pgxpool.Pool, query string, args ...any) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("count %q: %v", query, err)
	}
	return n
}

const goodDigest = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func TestMigrationsApplyFromScratch(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	var labels []string
	rows, err := f.pool.Query(ctx, `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
		WHERE t.typname = 'deployment_status' ORDER BY enumsortorder`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var l string
		_ = rows.Scan(&l)
		labels = append(labels, l)
	}
	rows.Close()
	for _, want := range platformdb.AllDeploymentStatuses {
		found := false
		for _, l := range labels {
			found = found || l == string(want)
		}
		if !found {
			t.Errorf("deployment_status missing %q (have %v)", want, labels)
		}
	}
	for _, tbl := range []string{"deployment_events", "build_job_events", "build_job_logs"} {
		if n := count(t, f.pool, `SELECT count(*) FROM information_schema.tables WHERE table_name = $1 AND table_schema = current_schema()`, tbl); n != 1 {
			t.Errorf("table %s missing", tbl)
		}
		if n := count(t, f.pool, `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND c.relrowsecurity AND n.nspname = current_schema()`, tbl); n != 1 {
			t.Errorf("RLS not enabled on %s", tbl)
		}
	}
	if n := count(t, f.pool, `SELECT count(*) FROM schema_migrations`); n < 4 {
		t.Errorf("expected >= 4 migrations applied, got %d", n)
	}
}

func TestCompositeFKRejectsCrossEnvironmentService(t *testing.T) {
	f := setup(t)
	env2 := testutil.SeedEnvironment(t, f.pool, f.project.ID, "staging", "staging")
	// service lives in f.env, deployment claims env2 of the same project
	_, err := f.pool.Exec(context.Background(), `
		INSERT INTO deployments (project_id, environment_id, service_id, git_commit_sha, git_branch, status, idempotency_key)
		VALUES ($1, $2, $3, 'abc', 'main', 'queued', 'k1')`, f.project.ID, env2.ID, f.service.ID)
	if err == nil {
		t.Fatal("expected composite FK violation, got nil")
	}
}

func TestProjects_SlugConflictAndDefaultEnvironment(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	_, _, err := f.store.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "my-app", Name: "dup"})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("duplicate slug err = %v, want ErrConflict", err)
	}
	// same slug for another user is fine
	other := testutil.SeedUser(t, f.pool, "", "")
	if _, _, err := f.store.CreateProject(ctx, other.ID, platformdb.CreateProjectParams{Slug: "my-app", Name: "theirs"}); err != nil {
		t.Fatalf("other user same slug: %v", err)
	}
	if _, _, err := f.store.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "Bad_Slug", Name: "x"}); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("bad slug err = %v", err)
	}

	envs, err := f.store.ListEnvironments(ctx, f.user.ID, f.project.ID)
	if err != nil || len(envs) != 1 || envs[0].Name != "production" || envs[0].Type != "production" {
		t.Fatalf("default environment wrong: %v %+v", err, envs)
	}
	if f.project.DefaultBranch != "main" {
		t.Errorf("default branch = %q", f.project.DefaultBranch)
	}

	branch := "develop"
	name := "Renamed"
	up, err := f.store.UpdateProject(ctx, f.user.ID, f.project.ID, platformdb.UpdateProjectParams{Name: &name, DefaultBranch: &branch})
	if err != nil || up.Name != "Renamed" || up.DefaultBranch != "develop" {
		t.Fatalf("UpdateProject: %v %+v", err, up)
	}
	got, err := f.store.GetProjectBySlug(ctx, f.user.ID, "my-app")
	if err != nil || got.ID != f.project.ID {
		t.Fatalf("GetProjectBySlug: %v", err)
	}
}

func TestProjects_PaginationAndSoftDelete(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	for _, slug := range []string{"p1", "p2", "p3", "p4"} {
		if _, _, err := f.store.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: slug, Name: slug}); err != nil {
			t.Fatal(err)
		}
	}
	// 5 projects total (my-app + p1..p4)
	seen := map[uuid.UUID]bool{}
	cursor := ""
	pages := 0
	for {
		page, err := f.store.ListProjects(ctx, f.user.ID, platformdb.ListParams{Limit: 2, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		pages++
		for _, p := range page.Items {
			if seen[p.ID] {
				t.Fatalf("duplicate project across pages: %s", p.Slug)
			}
			seen[p.ID] = true
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	if len(seen) != 5 || pages != 3 {
		t.Fatalf("saw %d projects over %d pages, want 5 over 3", len(seen), pages)
	}
	if _, err := f.store.ListProjects(ctx, f.user.ID, platformdb.ListParams{Cursor: "garbage"}); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("bad cursor err = %v", err)
	}

	if err := f.store.SoftDeleteProject(ctx, f.user.ID, f.project.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.GetProjectBySlug(ctx, f.user.ID, "my-app"); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("deleted project still visible: %v", err)
	}
	if _, err := f.store.GetServiceForUser(ctx, f.user.ID, f.service.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("service of deleted project still visible: %v", err)
	}
	if _, err := f.store.ListEnvironments(ctx, f.user.ID, f.project.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("envs of deleted project visible: %v", err)
	}
	page, _ := f.store.ListProjects(ctx, f.user.ID, platformdb.ListParams{Limit: 100})
	if len(page.Items) != 4 {
		t.Fatalf("list after delete = %d, want 4", len(page.Items))
	}
	if err := f.store.SoftDeleteProject(ctx, f.user.ID, f.project.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("second delete err = %v", err)
	}
}

func TestServices_CreateListResources(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	if _, err := f.store.CreateService(ctx, f.user.ID, f.env.ID, "web", "web"); !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("dup service err = %v", err)
	}
	if _, err := f.store.CreateService(ctx, f.user.ID, f.env.ID, "x", "database"); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("bad type err = %v", err)
	}
	w, err := f.store.CreateService(ctx, f.user.ID, f.env.ID, "worker", "worker")
	if err != nil || w.EnvironmentName != "production" || w.ProjectID != f.project.ID {
		t.Fatalf("CreateService: %v %+v", err, w)
	}
	list, err := f.store.ListServicesByProject(ctx, f.user.ID, f.project.ID)
	if err != nil || len(list) != 2 {
		t.Fatalf("ListServicesByProject: %v len=%d", err, len(list))
	}

	res, err := f.store.GetServiceResources(ctx, f.user.ID, w.ID)
	if err != nil || res.Port != 8080 || res.CPULimitMillicores != 500 || res.MemoryLimitMB != 512 {
		t.Fatalf("default resources: %v %+v", err, res)
	}
	res.Port = 3000
	res.MaxReplicas = 2
	up, err := f.store.UpsertServiceResources(ctx, f.user.ID, w.ID, *res)
	if err != nil || up.Port != 3000 || up.MaxReplicas != 2 {
		t.Fatalf("Upsert: %v %+v", err, up)
	}
	res.Port = 0
	if _, err := f.store.UpsertServiceResources(ctx, f.user.ID, w.ID, *res); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("invalid resources err = %v", err)
	}
}

func TestCrossUserIsolation(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	dep := f.deploy(t, "iso-1")
	mallory := testutil.SeedUser(t, f.pool, "", "")
	m := mallory.ID

	check := func(name string, err error) {
		t.Helper()
		if !errors.Is(err, platformdb.ErrNotFound) {
			t.Errorf("%s: err = %v, want ErrNotFound", name, err)
		}
	}
	_, err := f.store.GetProjectBySlug(ctx, m, "my-app")
	check("GetProjectBySlug", err)
	name := "pwned"
	_, err = f.store.UpdateProject(ctx, m, f.project.ID, platformdb.UpdateProjectParams{Name: &name})
	check("UpdateProject", err)
	check("SoftDeleteProject", f.store.SoftDeleteProject(ctx, m, f.project.ID))
	_, err = f.store.ListEnvironments(ctx, m, f.project.ID)
	check("ListEnvironments", err)
	_, err = f.store.CreateService(ctx, m, f.env.ID, "evil", "web")
	check("CreateService", err)
	_, err = f.store.ListServicesByProject(ctx, m, f.project.ID)
	check("ListServicesByProject", err)
	_, err = f.store.GetServiceForUser(ctx, m, f.service.ID)
	check("GetServiceForUser", err)
	_, err = f.store.GetServiceResources(ctx, m, f.service.ID)
	check("GetServiceResources", err)
	_, err = f.store.UpsertServiceResources(ctx, m, f.service.ID, platformdb.ServiceResources{CPURequestMillicores: 1, CPULimitMillicores: 1, MemoryRequestMB: 1, MemoryLimitMB: 1, MinReplicas: 0, MaxReplicas: 1, Port: 80})
	check("UpsertServiceResources", err)
	_, err = f.store.CreateDeploymentWithOutbox(ctx, platformdb.CreateDeploymentParams{UserID: m, ServiceID: f.service.ID, CommitSHA: "abc", Branch: "main"})
	check("CreateDeploymentWithOutbox", err)
	_, err = f.store.GetDeploymentForUser(ctx, m, dep.Deployment.ID)
	check("GetDeploymentForUser", err)
	_, err = f.store.ListDeploymentsForProject(ctx, m, f.project.ID, platformdb.ListParams{})
	check("ListDeploymentsForProject", err)
	_, err = f.store.RequestCancel(ctx, m, dep.Deployment.ID)
	check("RequestCancel", err)
	_, err = f.store.ListDeploymentLogsForUser(ctx, m, dep.Deployment.ID, 0, 10)
	check("ListDeploymentLogsForUser", err)
	_, err = f.store.ListSecretReferences(ctx, m, f.env.ID)
	check("ListSecretReferences", err)
	_, err = f.store.CreateSecretReference(ctx, m, f.env.ID, platformdb.SecretReferenceInput{KeyName: "K", Provider: "openbao", VaultPath: "a/b"})
	check("CreateSecretReference", err)

	// Nothing leaked into the list for the owner's projects.
	page, err := f.store.ListProjects(ctx, m, platformdb.ListParams{})
	if err != nil || len(page.Items) != 0 {
		t.Fatalf("mallory lists %d projects (%v)", len(page.Items), err)
	}
	// And the owner is unaffected.
	if p, err := f.store.GetProjectBySlug(ctx, f.user.ID, "my-app"); err != nil || p.Name != "My App" {
		t.Fatalf("owner project changed: %v %+v", err, p)
	}
	if got := count(t, f.pool, `SELECT count(*) FROM deployments WHERE project_id = $1`, f.project.ID); got != 1 {
		t.Fatalf("deployment count = %d, want 1", got)
	}
}

func TestCreateDeploymentWithOutbox_IdempotentAndPayload(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	first := f.deploy(t, "idem-key")
	if !first.Created {
		t.Fatal("first call should have Created=true")
	}
	if first.Deployment.Status != platformdb.DeploymentQueued || first.BuildJob.Status != platformdb.BuildQueued {
		t.Fatalf("initial statuses: %s / %s", first.Deployment.Status, first.BuildJob.Status)
	}
	second := f.deploy(t, "idem-key")
	if second.Created || second.Deployment.ID != first.Deployment.ID || second.BuildJob.ID != first.BuildJob.ID {
		t.Fatalf("second call not idempotent: %+v", second)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1`, first.Deployment.ID); n != 1 {
		t.Fatalf("outbox rows = %d, want 1", n)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM deployments WHERE project_id = $1`, f.project.ID); n != 1 {
		t.Fatalf("deployments = %d, want 1", n)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM build_jobs WHERE deployment_id = $1`, first.Deployment.ID); n != 1 {
		t.Fatalf("build jobs = %d, want 1", n)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM deployment_events WHERE deployment_id = $1 AND from_status IS NULL AND to_status = 'queued'`, first.Deployment.ID); n != 1 {
		t.Fatalf("creation events = %d, want 1", n)
	}

	// Outbox row shape.
	var aggType, evType, status string
	var raw []byte
	if err := f.pool.QueryRow(ctx, `SELECT aggregate_type, event_type, status::text, payload FROM outbox_events WHERE aggregate_id = $1`,
		first.Deployment.ID).Scan(&aggType, &evType, &status, &raw); err != nil {
		t.Fatal(err)
	}
	if aggType != "deployment" || evType != "deployment.build.requested" || status != "pending" {
		t.Fatalf("outbox row = %s %s %s", aggType, evType, status)
	}

	// Decodes with the orchestrator's decoder.
	p, err := orchestrator.DecodeBuildRequestedPayload(raw)
	if err != nil {
		t.Fatalf("DecodeBuildRequestedPayload: %v", err)
	}
	if p.DeploymentID != first.Deployment.ID.String() || p.BuildRunID != first.BuildJob.ID.String() ||
		p.ServiceID != f.service.ID.String() || p.ServiceSourceID != f.source.ID.String() ||
		p.UserID != f.user.ID.String() || p.ProjectID != f.project.ID.String() || p.EnvironmentID != f.env.ID.String() ||
		p.Repository.PlatformRepositoryID != f.repo.ID.String() || p.Repository.GitHubRepositoryID != f.repo.GitHubRepositoryID ||
		p.Repository.FullName != "octo/hello" || p.Source.Branch != "main" || p.Source.Ref != "refs/heads/main" ||
		p.Source.CommitSHA != strings.Repeat("a", 40) || p.Source.RootDirectory != "." || p.Source.DockerfilePath != nil ||
		p.Trigger.Type != "manual" {
		t.Fatalf("decoded payload mismatch: %+v", p)
	}

	// Reusing the key for a different service is a conflict.
	svc2, err := f.store.CreateService(ctx, f.user.ID, f.env.ID, "api", "web")
	if err != nil {
		t.Fatal(err)
	}
	inst := testutil.SeedGitHubInstallation(t, f.pool, f.user.ID, "octo2")
	repo2 := testutil.SeedGitHubRepository(t, f.pool, inst.ID, "")
	testutil.SeedServiceSource(t, f.pool, svc2.ID, repo2.ID, "main")
	_, err = f.store.CreateDeploymentWithOutbox(ctx, platformdb.CreateDeploymentParams{
		UserID: f.user.ID, ServiceID: svc2.ID, IdempotencyKey: "idem-key", CommitSHA: "abc", Branch: "main"})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("key reuse across services err = %v, want ErrConflict", err)
	}

	// Source tracking updated.
	var lastDep uuid.UUID
	var lastSHA string
	if err := f.pool.QueryRow(ctx, `SELECT last_deployment_id, last_seen_commit_sha FROM service_sources WHERE id = $1`, f.source.ID).Scan(&lastDep, &lastSHA); err != nil {
		t.Fatal(err)
	}
	if lastDep != first.Deployment.ID || lastSHA != strings.Repeat("a", 40) {
		t.Fatalf("service source tracking: %s %s", lastDep, lastSHA)
	}
}

func TestCreateDeployment_ConcurrentSameKey(t *testing.T) {
	f := setup(t)
	var wg sync.WaitGroup
	ids := make([]uuid.UUID, 8)
	created := make([]bool, 8)
	for i := range ids {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := f.store.CreateDeploymentWithOutbox(context.Background(), platformdb.CreateDeploymentParams{
				UserID: f.user.ID, ServiceID: f.service.ID, IdempotencyKey: "race", CommitSHA: "abc123", Branch: "main"})
			if err != nil {
				t.Errorf("call %d: %v", i, err)
				return
			}
			ids[i], created[i] = res.Deployment.ID, res.Created
		}()
	}
	wg.Wait()
	n := 0
	for i := range ids {
		if created[i] {
			n++
		}
		if ids[i] != ids[0] {
			t.Errorf("divergent deployment ids: %v", ids)
		}
	}
	if n != 1 {
		t.Errorf("Created=true count = %d, want 1", n)
	}
	if got := count(t, f.pool, `SELECT count(*) FROM outbox_events`); got != 1 {
		t.Errorf("outbox rows = %d, want 1", got)
	}
}

func TestCreateDeployment_SourceStates(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	p := platformdb.CreateDeploymentParams{UserID: f.user.ID, ServiceID: f.service.ID, CommitSHA: "abc", Branch: "main"}

	if _, err := f.pool.Exec(ctx, `UPDATE service_sources SET source_status = 'disconnected' WHERE id = $1`, f.source.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.CreateDeploymentWithOutbox(ctx, p); !errors.Is(err, platformdb.ErrSourceInactive) {
		t.Fatalf("disconnected source err = %v", err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE service_sources SET source_status = 'active' WHERE id = $1`, f.source.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE github_installations SET status = 'suspended' WHERE id = (SELECT installation_id FROM github_repositories WHERE id = $1)`, f.repo.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.CreateDeploymentWithOutbox(ctx, p); !errors.Is(err, platformdb.ErrSourceInactive) {
		t.Fatalf("suspended installation err = %v", err)
	}
	// service without a source
	bare, _ := f.store.CreateService(ctx, f.user.ID, f.env.ID, "bare", "web")
	p.ServiceID = bare.ID
	if _, err := f.store.CreateDeploymentWithOutbox(ctx, p); !errors.Is(err, platformdb.ErrSourceNotConfigured) {
		t.Fatalf("no-source err = %v", err)
	}
	if got := count(t, f.pool, `SELECT count(*) FROM outbox_events`); got != 0 {
		t.Fatalf("failed creates left %d outbox rows", got)
	}
}

// The GitHub worker and manual-deploy code build their outbox payload from a
// map; the typed builder must produce an identical document (modulo event_id).
func TestBuildRequestedPayload_MatchesWorkerShape(t *testing.T) {
	dep, job, svc, src, usr, prj, env, repo, hook := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	dockerfile := "Dockerfile.prod"
	cfg := json.RawMessage(`{"build_command":"make"}`)

	workerMap := func(trigger map[string]any, df *string) map[string]any {
		return map[string]any{
			"event_id": "x", "deployment_id": dep.String(), "build_run_id": job.String(), "service_id": svc.String(),
			"service_source_id": src.String(), "user_id": usr.String(), "project_id": prj.String(), "environment_id": env.String(),
			"repository":          map[string]any{"platform_repository_id": repo.String(), "github_repository_id": int64(42), "full_name": "octo/hello"},
			"source":              map[string]any{"branch": "main", "ref": "refs/heads/main", "commit_sha": "deadbeef", "root_directory": "apps/web", "dockerfile_path": df},
			"build_configuration": cfg,
			"trigger":             trigger,
		}
	}
	normalize := func(b []byte) map[string]any {
		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			t.Fatal(err)
		}
		m["event_id"] = "x"
		return m
	}
	in := platformdb.BuildRequestedInput{
		DeploymentID: dep, BuildRunID: job, ServiceID: svc, ServiceSourceID: src, UserID: usr, ProjectID: prj, EnvironmentID: env,
		PlatformRepositoryID: repo, GitHubRepositoryID: 42, RepoFullName: "octo/hello", Branch: "main", Ref: "refs/heads/main",
		CommitSHA: "deadbeef", RootDirectory: "apps/web", DockerfilePath: &dockerfile, BuildConfiguration: cfg,
	}

	// github_push shape
	in.TriggerType, in.WebhookEventID = "github_push", &hook
	got, err := platformdb.NewBuildRequestedPayload(in)
	if err != nil {
		t.Fatal(err)
	}
	wantBytes, _ := json.Marshal(workerMap(map[string]any{"type": "github_push", "webhook_event_id": hook.String()}, &dockerfile))
	if !reflect.DeepEqual(normalize(got), normalize(wantBytes)) {
		t.Fatalf("push payload differs:\n got  %s\n want %s", got, wantBytes)
	}
	if _, err := orchestrator.DecodeBuildRequestedPayload(got); err != nil {
		t.Fatalf("push payload does not decode: %v", err)
	}

	// manual shape, null dockerfile path, default build configuration
	in.TriggerType, in.WebhookEventID, in.DockerfilePath, in.BuildConfiguration = "manual", nil, nil, nil
	got, err = platformdb.NewBuildRequestedPayload(in)
	if err != nil {
		t.Fatal(err)
	}
	cfg = json.RawMessage(`{}`)
	wantBytes, _ = json.Marshal(workerMap(map[string]any{"type": "manual"}, nil))
	if !reflect.DeepEqual(normalize(got), normalize(wantBytes)) {
		t.Fatalf("manual payload differs:\n got  %s\n want %s", got, wantBytes)
	}
	decoded, err := orchestrator.DecodeBuildRequestedPayload(got)
	if err != nil || decoded.Source.DockerfilePath != nil {
		t.Fatalf("manual payload decode: %v %+v", err, decoded)
	}
}

func TestTransitionDeployment_CASAndEvents(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	dep := f.deploy(t, "t1").Deployment
	id := dep.ID
	if dep.StartedAt != nil || dep.FinishedAt != nil {
		t.Fatal("new deployment should have no started/finished")
	}

	d := f.transition(t, id, platformdb.DeploymentQueued, platformdb.DeploymentBuilding)
	if d.StartedAt == nil || d.FinishedAt != nil || d.Status != platformdb.DeploymentBuilding {
		t.Fatalf("after building: %+v", d)
	}
	startedAt := *d.StartedAt

	// Wrong expected state: invalid transition, nothing changes, no event.
	_, err := f.store.TransitionDeployment(ctx, id, []platformdb.DeploymentStatus{platformdb.DeploymentQueued}, platformdb.DeploymentBuilding, "dup")
	if !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("stale CAS err = %v, want ErrInvalidTransition", err)
	}
	if _, err := f.store.TransitionDeployment(ctx, uuid.New(), []platformdb.DeploymentStatus{platformdb.DeploymentQueued}, platformdb.DeploymentBuilding, ""); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown id err = %v, want ErrNotFound", err)
	}
	if _, err := f.store.TransitionDeployment(ctx, id, nil, platformdb.DeploymentBuilding, ""); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("empty from err = %v", err)
	}
	if _, err := f.store.TransitionDeployment(ctx, id, []platformdb.DeploymentStatus{platformdb.DeploymentFailed}, platformdb.DeploymentBuilding, ""); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("terminal from err = %v", err)
	}
	if _, err := f.store.TransitionDeployment(ctx, id, []platformdb.DeploymentStatus{"bogus"}, platformdb.DeploymentBuilding, ""); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("unknown from err = %v", err)
	}

	ref := "ghcr.io/octo/summit-app-x@" + goodDigest
	d = f.transition(t, id, platformdb.DeploymentBuilding, platformdb.DeploymentImageReady, platformdb.WithImageRef(ref))
	if d.ImageRef == nil || *d.ImageRef != ref {
		t.Fatalf("image ref not stored: %+v", d.ImageRef)
	}
	f.transition(t, id, platformdb.DeploymentImageReady, platformdb.DeploymentDeploying)
	f.transition(t, id, platformdb.DeploymentDeploying, platformdb.DeploymentHealthChecking)
	d = f.transition(t, id, platformdb.DeploymentHealthChecking, platformdb.DeploymentRunning,
		platformdb.WithPublicURL("https://web-my-app.apps.example.com"), platformdb.WithStatusReason("healthy"))
	if d.PublicURL == nil || *d.PublicURL != "https://web-my-app.apps.example.com" || d.StatusReason == nil || *d.StatusReason != "healthy" {
		t.Fatalf("running fields: %+v", d)
	}
	if d.ImageRef == nil || *d.ImageRef != ref {
		t.Fatal("image_ref lost on later transition")
	}
	if !d.StartedAt.Equal(startedAt) || d.FinishedAt != nil {
		t.Fatalf("started/finished wrong at running: %+v", d)
	}
	d = f.transition(t, id, platformdb.DeploymentRunning, platformdb.DeploymentFailed, platformdb.WithErrorMessage("crash loop"))
	if d.FinishedAt == nil || d.ErrorMessage == nil || *d.ErrorMessage != "crash loop" {
		t.Fatalf("failed fields: %+v", d)
	}
	// terminal is final
	if _, err := f.store.TransitionDeployment(ctx, id, []platformdb.DeploymentStatus{platformdb.DeploymentRunning}, platformdb.DeploymentDeploying, ""); !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("out of terminal err = %v", err)
	}

	detail, err := f.store.GetDeploymentForUser(ctx, f.user.ID, id)
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]string{{"", "queued"}, {"queued", "building"}, {"building", "image_ready"}, {"image_ready", "deploying"},
		{"deploying", "health_checking"}, {"health_checking", "running"}, {"running", "failed"}}
	if len(detail.Events) != len(want) {
		t.Fatalf("events = %d, want %d", len(detail.Events), len(want))
	}
	for i, ev := range detail.Events {
		from := ""
		if ev.FromStatus != nil {
			from = string(*ev.FromStatus)
		}
		if from != want[i][0] || string(ev.ToStatus) != want[i][1] {
			t.Errorf("event %d = %s -> %s, want %s -> %s", i, from, ev.ToStatus, want[i][0], want[i][1])
		}
	}
	if detail.BuildJob == nil || detail.BuildJob.DeploymentID != id {
		t.Fatalf("detail build job: %+v", detail.BuildJob)
	}
}

func TestTransitionDeployment_ConcurrentCASSingleWinner(t *testing.T) {
	f := setup(t)
	id := f.deploy(t, "cas").Deployment.ID
	var wg sync.WaitGroup
	var mu sync.Mutex
	wins, losses := 0, 0
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := f.store.TransitionDeployment(context.Background(), id,
				[]platformdb.DeploymentStatus{platformdb.DeploymentQueued}, platformdb.DeploymentBuilding, "race")
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				wins++
			case errors.Is(err, platformdb.ErrInvalidTransition):
				losses++
			default:
				t.Errorf("unexpected err: %v", err)
			}
		}()
	}
	wg.Wait()
	if wins != 1 || losses != 9 {
		t.Fatalf("wins=%d losses=%d, want 1/9", wins, losses)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM deployment_events WHERE deployment_id = $1 AND to_status = 'building'`, id); n != 1 {
		t.Fatalf("building events = %d, want 1", n)
	}
}

func TestRequestCancel(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	id := f.deploy(t, "c1").Deployment.ID

	d, err := f.store.RequestCancel(ctx, f.user.ID, id)
	if err != nil || d.CancelRequestedAt == nil || d.Status != platformdb.DeploymentQueued {
		t.Fatalf("RequestCancel: %v %+v", err, d)
	}
	first := *d.CancelRequestedAt
	d2, err := f.store.RequestCancel(ctx, f.user.ID, id)
	if err != nil || !d2.CancelRequestedAt.Equal(first) {
		t.Fatalf("repeat RequestCancel not idempotent: %v", err)
	}

	f.transition(t, id, platformdb.DeploymentQueued, platformdb.DeploymentCancelled)
	if _, err := f.store.RequestCancel(ctx, f.user.ID, id); !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("cancel terminal err = %v", err)
	}
	// running deployments cannot be cancelled either
	id2 := f.deploy(t, "c2").Deployment.ID
	f.transition(t, id2, platformdb.DeploymentQueued, platformdb.DeploymentBuilding)
	f.transition(t, id2, platformdb.DeploymentBuilding, platformdb.DeploymentRunning)
	if _, err := f.store.RequestCancel(ctx, f.user.ID, id2); !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("cancel running err = %v", err)
	}
	if _, err := f.store.RequestCancel(ctx, f.user.ID, uuid.New()); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("cancel unknown err = %v", err)
	}
}

func TestListDeploymentsForProject_Pagination(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	for i := range 5 {
		f.deploy(t, "p"+string(rune('a'+i)))
	}
	var all []uuid.UUID
	cursor := ""
	for {
		page, err := f.store.ListDeploymentsForProject(ctx, f.user.ID, f.project.ID, platformdb.ListParams{Limit: 2, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, d := range page.Items {
			all = append(all, d.ID)
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	uniq := map[uuid.UUID]bool{}
	for _, id := range all {
		uniq[id] = true
	}
	if len(all) != 5 || len(uniq) != 5 {
		t.Fatalf("paged %d deployments (%d unique), want 5", len(all), len(uniq))
	}
}

func TestBuildStatus_IdempotentOnSequence(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	job := f.deploy(t, "bs").BuildJob.ID
	now := time.Now().UTC()

	applied, err := f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 1, Stage: "source_checkout", Status: "running", Message: "cloning", ReportedAt: now})
	if err != nil || !applied {
		t.Fatalf("first status: %v applied=%v", err, applied)
	}
	b, _ := f.store.GetBuildJob(ctx, job)
	if b.Status != platformdb.BuildRunning || b.StartedAt == nil || b.LastHeartbeatAt == nil || b.CurrentStage == nil || *b.CurrentStage != "source_checkout" {
		t.Fatalf("job after first status: %+v", b)
	}
	// replay with a different payload must not change anything
	applied, err = f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 1, Stage: "image_build", Status: "running", ReportedAt: now})
	if err != nil || applied {
		t.Fatalf("replay: %v applied=%v", err, applied)
	}
	b, _ = f.store.GetBuildJob(ctx, job)
	if *b.CurrentStage != "source_checkout" {
		t.Fatalf("replay changed stage to %q", *b.CurrentStage)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM build_job_events WHERE build_job_id = $1`, job); n != 1 {
		t.Fatalf("events = %d, want 1", n)
	}
	// heartbeat refreshes liveness but keeps the stage
	hb0 := *b.LastHeartbeatAt
	time.Sleep(5 * time.Millisecond)
	if applied, err = f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 2, Stage: platformdb.HeartbeatStage, Status: "running"}); err != nil || !applied {
		t.Fatalf("heartbeat: %v %v", err, applied)
	}
	b, _ = f.store.GetBuildJob(ctx, job)
	if *b.CurrentStage != "source_checkout" || !b.LastHeartbeatAt.After(hb0) {
		t.Fatalf("heartbeat handling wrong: stage=%q hb=%v prev=%v", *b.CurrentStage, b.LastHeartbeatAt, hb0)
	}
	// after a terminal result, late status is stored but does not touch the job
	if _, _, err := f.store.RecordBuildResult(ctx, job, platformdb.BuildResult{Status: platformdb.BuildFailed, ErrorMessage: "boom"}); err != nil {
		t.Fatal(err)
	}
	if applied, err = f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 3, Stage: "finalizing", Status: "running"}); err != nil || !applied {
		t.Fatalf("late status: %v %v", err, applied)
	}
	b, _ = f.store.GetBuildJob(ctx, job)
	if b.Status != platformdb.BuildFailed || *b.CurrentStage != "source_checkout" {
		t.Fatalf("late status modified terminal job: %+v", b)
	}
	if _, err := f.store.RecordBuildStatus(ctx, uuid.New(), platformdb.BuildStatusEvent{Sequence: 1, Stage: "a", Status: "b"}); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown job err = %v", err)
	}
	if _, err := f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 9, Stage: "", Status: "b"}); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("empty stage err = %v", err)
	}
}

func TestBuildResult_IdempotentAndConflicts(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	job := f.deploy(t, "br").BuildJob.ID

	// validation
	for name, r := range map[string]platformdb.BuildResult{
		"no digest":    {Status: platformdb.BuildSucceeded, ImageRepository: "ghcr.io/o/r"},
		"short digest": {Status: platformdb.BuildSucceeded, ImageRepository: "ghcr.io/o/r", Digest: "sha256:abc"},
		"upper digest": {Status: platformdb.BuildSucceeded, ImageRepository: "ghcr.io/o/r", Digest: "sha256:" + strings.Repeat("A", 64)},
		"no repo":      {Status: platformdb.BuildSucceeded, Digest: goodDigest},
		"bad status":   {Status: platformdb.BuildRunning},
	} {
		if _, _, err := f.store.RecordBuildResult(ctx, job, r); !errors.Is(err, platformdb.ErrInvalidArgument) {
			t.Errorf("%s: err = %v, want ErrInvalidArgument", name, err)
		}
	}
	if b, _ := f.store.GetBuildJob(ctx, job); b.Status.IsTerminal() {
		t.Fatal("validation failures must not change the job")
	}

	ok := platformdb.BuildResult{Status: platformdb.BuildSucceeded, ImageRepository: "ghcr.io/octo/summit-app-x", ImageTag: "sha-aaaa", Digest: goodDigest}
	b, applied, err := f.store.RecordBuildResult(ctx, job, ok)
	if err != nil || !applied || b.Status != platformdb.BuildSucceeded || b.CompletedAt == nil {
		t.Fatalf("first result: %v applied=%v %+v", err, applied, b)
	}
	if got := b.ImageRef(); got != "ghcr.io/octo/summit-app-x@"+goodDigest {
		t.Fatalf("ImageRef = %q", got)
	}
	completed := *b.CompletedAt

	b, applied, err = f.store.RecordBuildResult(ctx, job, ok)
	if err != nil || applied || !b.CompletedAt.Equal(completed) {
		t.Fatalf("replay: %v applied=%v", err, applied)
	}

	other := ok
	other.Digest = "sha256:" + strings.Repeat("f", 64)
	if _, _, err := f.store.RecordBuildResult(ctx, job, other); !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("different digest err = %v, want ErrConflict", err)
	}
	if _, _, err := f.store.RecordBuildResult(ctx, job, platformdb.BuildResult{Status: platformdb.BuildFailed, ErrorMessage: "x"}); !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("succeeded -> failed err = %v, want ErrConflict", err)
	}
	b, _ = f.store.GetBuildJob(ctx, job)
	if b.ImageDigest == nil || *b.ImageDigest != goodDigest || b.Status != platformdb.BuildSucceeded {
		t.Fatalf("conflicting result mutated job: %+v", b)
	}

	// failed twice is idempotent; the first error message sticks
	job2 := f.deploy(t, "br2").BuildJob.ID
	if _, applied, err := f.store.RecordBuildResult(ctx, job2, platformdb.BuildResult{Status: platformdb.BuildFailed, ErrorMessage: "first"}); err != nil || !applied {
		t.Fatalf("failed result: %v %v", err, applied)
	}
	b, applied, err = f.store.RecordBuildResult(ctx, job2, platformdb.BuildResult{Status: platformdb.BuildFailed, ErrorMessage: "second"})
	if err != nil || applied || *b.ErrorMessage != "first" {
		t.Fatalf("failed replay: %v applied=%v msg=%v", err, applied, b.ErrorMessage)
	}
	if _, _, err := f.store.RecordBuildResult(ctx, uuid.New(), ok); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown job err = %v", err)
	}
}

func TestMarkBuildJobTerminalAndDispatched(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	job := f.deploy(t, "md").BuildJob.ID
	attempt := job

	if _, err := f.store.MarkBuildDispatched(ctx, job, attempt, "", 600); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("empty pod err = %v", err)
	}
	b, err := f.store.MarkBuildDispatched(ctx, job, attempt, "summit-build-"+job.String(), 900)
	if err != nil || b.Status != platformdb.BuildDispatched || b.DispatchedAt == nil || *b.TimeoutSeconds != 900 ||
		b.AttemptID == nil || *b.AttemptID != attempt || *b.PodName != "summit-build-"+job.String() {
		t.Fatalf("MarkBuildDispatched: %v %+v", err, b)
	}
	// redelivery while dispatched is fine
	if _, err := f.store.MarkBuildDispatched(ctx, job, attempt, "summit-build-"+job.String(), 900); err != nil {
		t.Fatalf("redispatch: %v", err)
	}
	if _, err := f.store.RecordBuildStatus(ctx, job, platformdb.BuildStatusEvent{Sequence: 1, Stage: "initializing", Status: "running"}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.MarkBuildDispatched(ctx, job, attempt, "p", 900); !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("dispatch running job err = %v", err)
	}
	if _, err := f.store.MarkBuildDispatched(ctx, uuid.New(), attempt, "p", 900); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("dispatch unknown err = %v", err)
	}

	b, applied, err := f.store.MarkBuildJobTerminal(ctx, job, platformdb.BuildFailed, "pod died without result")
	if err != nil || !applied || b.Status != platformdb.BuildFailed || *b.ErrorMessage != "pod died without result" {
		t.Fatalf("MarkBuildJobTerminal: %v applied=%v %+v", err, applied, b)
	}
	b, applied, err = f.store.MarkBuildJobTerminal(ctx, job, platformdb.BuildCancelled, "late")
	if err != nil || applied || b.Status != platformdb.BuildFailed {
		t.Fatalf("second terminal: %v applied=%v %+v", err, applied, b)
	}
	// builder result arriving later with the same status is a harmless replay; a success conflicts
	if _, applied, err := f.store.RecordBuildResult(ctx, job, platformdb.BuildResult{Status: platformdb.BuildFailed}); err != nil || applied {
		t.Fatalf("same-status replay after orchestrator close: %v %v", err, applied)
	}
	if _, _, err := f.store.RecordBuildResult(ctx, job, platformdb.BuildResult{Status: platformdb.BuildSucceeded, ImageRepository: "r", Digest: goodDigest}); !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("success after orchestrator failure err = %v", err)
	}
	if _, _, err := f.store.MarkBuildJobTerminal(ctx, job, platformdb.BuildSucceeded, ""); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("terminal succeeded err = %v", err)
	}
	if _, _, err := f.store.MarkBuildJobTerminal(ctx, uuid.New(), platformdb.BuildFailed, ""); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("terminal unknown err = %v", err)
	}
}

func TestBuildLogs(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	res := f.deploy(t, "logs")
	job := res.BuildJob.ID

	lines := []platformdb.LogLine{
		{Sequence: 1, Stream: "stdout", Level: "info", Stage: "image_build", Message: "step 1"},
		{Sequence: 2, Stream: "STDERR", Level: "WARN", Message: "warning"},
		{Sequence: 3, Stream: "weird", Level: "weird", Message: strings.Repeat("x", platformdb.MaxLogMessageBytes*2)},
		{Sequence: 4, Message: "nul\x00byte"},
	}
	n, err := f.store.AppendBuildLogs(ctx, job, lines)
	if err != nil || n != 4 {
		t.Fatalf("AppendBuildLogs: %v n=%d", err, n)
	}
	got, err := f.store.ListBuildLogs(ctx, job, 0, 100)
	if err != nil || len(got) != 4 {
		t.Fatalf("ListBuildLogs: %v len=%d", err, len(got))
	}
	for i := 1; i < len(got); i++ {
		if got[i].ID <= got[i-1].ID {
			t.Fatalf("logs not in insertion order: %+v", got)
		}
	}
	if got[0].Stage == nil || *got[0].Stage != "image_build" || got[1].Stream != "stderr" || got[1].Level != "warn" || got[1].Stage != nil {
		t.Fatalf("normalisation wrong: %+v %+v", got[0], got[1])
	}
	if got[2].Stream != "stdout" || got[2].Level != "info" || len(got[2].Message) > platformdb.MaxLogMessageBytes || !strings.HasSuffix(got[2].Message, "[truncated]") {
		t.Fatalf("long line not capped: len=%d", len(got[2].Message))
	}
	if got[3].Message != "nulbyte" {
		t.Fatalf("NUL not stripped: %q", got[3].Message)
	}
	// tailing
	next, err := f.store.ListBuildLogs(ctx, job, got[1].ID, 1)
	if err != nil || len(next) != 1 || next[0].ID != got[2].ID {
		t.Fatalf("tail page wrong: %v %+v", err, next)
	}
	// user-scoped by deployment
	ul, err := f.store.ListDeploymentLogsForUser(ctx, f.user.ID, res.Deployment.ID, 0, 2)
	if err != nil || len(ul) != 2 {
		t.Fatalf("ListDeploymentLogsForUser: %v len=%d", err, len(ul))
	}
	// limits and unknown job
	if _, err := f.store.AppendBuildLogs(ctx, job, make([]platformdb.LogLine, platformdb.MaxLogBatchLines+1)); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("oversize batch err = %v", err)
	}
	if _, err := f.store.AppendBuildLogs(ctx, uuid.New(), lines[:1]); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown job err = %v", err)
	}
	if n, err := f.store.AppendBuildLogs(ctx, job, nil); err != nil || n != 0 {
		t.Fatalf("empty batch: %v %d", err, n)
	}
}

func TestGetBuildContext(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, `UPDATE service_sources SET root_directory = 'apps/web', dockerfile_path = 'Dockerfile.prod',
		build_configuration = '{"build_command":"make"}' WHERE id = $1`, f.source.ID); err != nil {
		t.Fatal(err)
	}
	port := 3000
	res, _ := f.store.GetServiceResources(ctx, f.user.ID, f.service.ID)
	res.Port = port
	if _, err := f.store.UpsertServiceResources(ctx, f.user.ID, f.service.ID, *res); err != nil {
		t.Fatal(err)
	}
	r := f.deploy(t, "bc")
	bc, err := f.store.GetBuildContext(ctx, r.BuildJob.ID)
	if err != nil {
		t.Fatalf("GetBuildContext: %v", err)
	}
	if bc.UserID != f.user.ID || bc.ProjectID != f.project.ID || bc.ProjectSlug != "my-app" ||
		bc.EnvironmentID != f.env.ID || bc.EnvironmentName != "production" ||
		bc.ServiceID != f.service.ID || bc.ServiceName != "web" || bc.ServiceType != "web" ||
		bc.ServiceSourceID != f.source.ID || bc.RepositoryID != f.repo.ID || bc.GitHubRepositoryID != f.repo.GitHubRepositoryID ||
		bc.RepoFullName != "octo/hello" || bc.RepoOwnerLogin != "octo" || bc.RepoName != "hello" ||
		bc.CloneURL != "https://github.com/octo/hello.git" ||
		bc.CommitSHA != strings.Repeat("a", 40) || bc.Branch != "main" || bc.Ref != "refs/heads/main" ||
		bc.RootDirectory != "apps/web" || bc.DockerfilePath == nil || *bc.DockerfilePath != "Dockerfile.prod" ||
		bc.InstallationStatus != "active" || bc.SourceStatus != "active" ||
		bc.BuildJobStatus != platformdb.BuildQueued || bc.DeploymentID != r.Deployment.ID || bc.DeploymentStatus != platformdb.DeploymentQueued ||
		bc.Resources.Port != port || bc.Resources.MemoryLimitMB != 512 {
		t.Fatalf("GetBuildContext mismatch: %+v", bc)
	}
	var cfg map[string]string
	if err := json.Unmarshal(bc.BuildConfiguration, &cfg); err != nil || cfg["build_command"] != "make" {
		t.Fatalf("build configuration: %s (%v)", bc.BuildConfiguration, err)
	}
	if bc.GitHubInstallationID == 0 {
		t.Error("GitHubInstallationID not populated")
	}
	if _, err := f.store.GetBuildContext(ctx, uuid.New()); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown job err = %v", err)
	}
}

func TestListActiveDeployments(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	queued := f.deploy(t, "a1").Deployment.ID
	building := f.deploy(t, "a2").Deployment.ID
	f.transition(t, building, platformdb.DeploymentQueued, platformdb.DeploymentBuilding)
	healthy := f.deploy(t, "a3").Deployment.ID
	f.transition(t, healthy, platformdb.DeploymentQueued, platformdb.DeploymentBuilding)
	f.transition(t, healthy, platformdb.DeploymentBuilding, platformdb.DeploymentRunning)
	failed := f.deploy(t, "a4").Deployment.ID
	f.transition(t, failed, platformdb.DeploymentQueued, platformdb.DeploymentFailed)
	if _, err := f.store.RequestCancel(ctx, f.user.ID, building); err != nil {
		t.Fatal(err)
	}

	active, err := f.store.ListActiveDeployments(ctx, 0)
	if err != nil {
		t.Fatalf("ListActiveDeployments: %v", err)
	}
	if len(active) != 2 || active[0].Deployment.ID != queued || active[1].Deployment.ID != building {
		ids := []uuid.UUID{}
		for _, a := range active {
			ids = append(ids, a.Deployment.ID)
		}
		t.Fatalf("active = %v, want [%s %s]", ids, queued, building)
	}
	a := active[1]
	if a.Deployment.CancelRequestedAt == nil || a.Deployment.Status != platformdb.DeploymentBuilding ||
		a.BuildJob.DeploymentID != building || a.UserID != f.user.ID || a.ProjectSlug != "my-app" ||
		a.EnvironmentName != "production" || a.ServiceName != "web" || a.ServiceID != f.service.ID ||
		a.RepoOwnerLogin != "octo" || a.RepoFullName != "octo/hello" || a.Resources.Port != 8080 {
		t.Fatalf("active row incomplete: %+v", a)
	}
	if limited, _ := f.store.ListActiveDeployments(ctx, 1); len(limited) != 1 {
		t.Fatalf("limit not honoured: %d", len(limited))
	}
}

func TestPromoteRelease_Supersedes(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	run := func(key string) uuid.UUID {
		id := f.deploy(t, key).Deployment.ID
		f.transition(t, id, platformdb.DeploymentQueued, platformdb.DeploymentBuilding)
		f.transition(t, id, platformdb.DeploymentBuilding, platformdb.DeploymentRunning)
		return id
	}
	// not running yet -> invalid
	pending := f.deploy(t, "pre").Deployment.ID
	if _, err := f.store.PromoteRelease(ctx, pending, nil); !errors.Is(err, platformdb.ErrInvalidTransition) {
		t.Fatalf("promote non-running err = %v", err)
	}
	if _, err := f.store.PromoteRelease(ctx, uuid.New(), nil); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("promote unknown err = %v", err)
	}
	if _, err := f.store.PromoteRelease(ctx, pending, json.RawMessage(`{bad`)); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("promote bad json err = %v", err)
	}

	d1 := run("r1")
	r1, err := f.store.PromoteRelease(ctx, d1, json.RawMessage(`{"image":"one"}`))
	if err != nil || !r1.Created || r1.Release.ReleaseNumber != 1 || !r1.Release.IsActive || len(r1.SupersededDeploymentIDs) != 0 {
		t.Fatalf("first promote: %v %+v", err, r1)
	}
	if string(r1.Release.ConfigSnapshot) == "" {
		t.Fatal("config snapshot empty")
	}
	// replay
	again, err := f.store.PromoteRelease(ctx, d1, json.RawMessage(`{"image":"other"}`))
	if err != nil || again.Created || again.Release.ID != r1.Release.ID {
		t.Fatalf("replay promote: %v %+v", err, again)
	}

	d2 := run("r2")
	r2, err := f.store.PromoteRelease(ctx, d2, json.RawMessage(`{"image":"two"}`))
	if err != nil || r2.Release.ReleaseNumber != 2 || !r2.Release.IsActive {
		t.Fatalf("second promote: %v %+v", err, r2)
	}
	if len(r2.SupersededDeploymentIDs) != 1 || r2.SupersededDeploymentIDs[0] != d1 {
		t.Fatalf("superseded = %v, want [%s]", r2.SupersededDeploymentIDs, d1)
	}

	old, _ := f.store.GetDeploymentForUser(ctx, f.user.ID, d1)
	if old.Deployment.Status != platformdb.DeploymentSuperseded || old.Deployment.FinishedAt == nil {
		t.Fatalf("old deployment: %+v", old.Deployment)
	}
	last := old.Events[len(old.Events)-1]
	if last.FromStatus == nil || *last.FromStatus != platformdb.DeploymentRunning || last.ToStatus != platformdb.DeploymentSuperseded {
		t.Fatalf("supersede event: %+v", last)
	}
	cur, _ := f.store.GetDeploymentForUser(ctx, f.user.ID, d2)
	if cur.Deployment.Status != platformdb.DeploymentRunning {
		t.Fatalf("new deployment status = %s", cur.Deployment.Status)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM releases WHERE environment_id = $1 AND is_active`, f.env.ID); n != 1 {
		t.Fatalf("active releases = %d, want 1", n)
	}
	var activeDep uuid.UUID
	if err := f.pool.QueryRow(ctx, `SELECT deployment_id FROM releases WHERE environment_id = $1 AND is_active`, f.env.ID).Scan(&activeDep); err != nil || activeDep != d2 {
		t.Fatalf("active release deployment = %s (%v), want %s", activeDep, err, d2)
	}

	// A different service in the same environment keeps its own active release and running deployment.
	other, _ := f.store.CreateService(ctx, f.user.ID, f.env.ID, "api", "web")
	otherDep := testutil.SeedDeployment(t, f.pool, f.project.ID, f.env.ID, other.ID, "running")
	testutil.SeedBuildJob(t, f.pool, otherDep.ID, "succeeded")
	r3, err := f.store.PromoteRelease(ctx, otherDep.ID, nil)
	if err != nil || r3.Release.ReleaseNumber != 3 || len(r3.SupersededDeploymentIDs) != 0 {
		t.Fatalf("other service promote: %v %+v", err, r3)
	}
	if n := count(t, f.pool, `SELECT count(*) FROM releases WHERE environment_id = $1 AND is_active`, f.env.ID); n != 2 {
		t.Fatalf("active releases = %d, want 2 (one per service)", n)
	}
}

func TestSecretReferences(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	in := platformdb.SecretReferenceInput{KeyName: "DATABASE_URL", Provider: platformdb.SecretProviderOpenBao, VaultPath: "secret/data/my-app/db"}
	ref, err := f.store.CreateSecretReference(ctx, f.user.ID, f.env.ID, in)
	if err != nil || ref.ProjectID != f.project.ID || ref.EnvironmentID != f.env.ID || ref.UserID != f.user.ID {
		t.Fatalf("CreateSecretReference: %v %+v", err, ref)
	}
	if _, err := f.store.CreateSecretReference(ctx, f.user.ID, f.env.ID, in); !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("dup key err = %v", err)
	}
	in2 := platformdb.SecretReferenceInput{KeyName: "TOKEN", Provider: platformdb.SecretProviderOpenBao, VaultPath: "ghp_abcdefghijklmnopqrstuvwxyz0123456789"}
	if _, err := f.store.CreateSecretReference(ctx, f.user.ID, f.env.ID, in2); !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("value-like path err = %v", err)
	}
	list, err := f.store.ListSecretReferences(ctx, f.user.ID, f.env.ID)
	if err != nil || len(list) != 1 || list[0].KeyName != "DATABASE_URL" {
		t.Fatalf("list: %v %+v", err, list)
	}
	mallory := testutil.SeedUser(t, f.pool, "", "")
	if err := f.store.DeleteSecretReference(ctx, mallory.ID, f.env.ID, ref.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("cross-user delete err = %v", err)
	}
	if err := f.store.DeleteSecretReference(ctx, f.user.ID, f.env.ID, ref.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.store.DeleteSecretReference(ctx, f.user.ID, f.env.ID, ref.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("second delete err = %v", err)
	}
	seeded := testutil.SeedSecretReference(t, f.pool, f.user.ID, f.project.ID, f.env.ID, "")
	if list, _ := f.store.ListSecretReferences(ctx, f.user.ID, f.env.ID); len(list) != 1 || list[0].ID != seeded.ID {
		t.Fatalf("seeded ref not listed: %+v", list)
	}
}

func TestWithTxRollbackAndPing(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	if err := f.store.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}
	sentinel := errors.New("boom")
	err := f.store.WithTx(ctx, func(tx *platformdb.Store) error {
		if _, _, err := tx.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "rolled-back", Name: "x"}); err != nil {
			return err
		}
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("WithTx err = %v", err)
	}
	if _, err := f.store.GetProjectBySlug(ctx, f.user.ID, "rolled-back"); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("rolled back project visible: %v", err)
	}
	// commit path, with nested WithTx (savepoint) rollback
	err = f.store.WithTx(ctx, func(tx *platformdb.Store) error {
		if _, _, err := tx.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "kept", Name: "x"}); err != nil {
			return err
		}
		_ = tx.WithTx(ctx, func(inner *platformdb.Store) error {
			if _, _, err := inner.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "inner", Name: "x"}); err != nil {
				return err
			}
			return sentinel
		})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.GetProjectBySlug(ctx, f.user.ID, "kept"); err != nil {
		t.Fatalf("committed project missing: %v", err)
	}
	if _, err := f.store.GetProjectBySlug(ctx, f.user.ID, "inner"); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("nested rollback leaked: %v", err)
	}
}

func TestSeedFixtures(t *testing.T) {
	f := setup(t)
	dep := testutil.SeedDeployment(t, f.pool, f.project.ID, f.env.ID, f.service.ID, "")
	job := testutil.SeedBuildJob(t, f.pool, dep.ID, "")
	ev := testutil.SeedOutboxEvent(t, f.pool, "", dep.ID, "", map[string]any{"k": "v"})
	if dep.Status != "queued" || job.Status != "queued" || ev.EventType != "deployment.build.requested" {
		t.Fatalf("fixture defaults: %+v %+v %+v", dep, job, ev)
	}
}
