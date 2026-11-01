package platformdb_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/testutil"
)

func TestGetProjectForUser(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	other := testutil.SeedUser(t, f.pool, "", "")

	got, err := f.store.GetProjectForUser(ctx, f.user.ID, f.project.ID)
	if err != nil || got.ID != f.project.ID || got.Slug != "my-app" {
		t.Fatalf("GetProjectForUser = %+v, %v", got, err)
	}
	if _, err := f.store.GetProjectForUser(ctx, other.ID, f.project.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("foreign user: want ErrNotFound, got %v", err)
	}
	if _, err := f.store.GetProjectForUser(ctx, f.user.ID, uuid.New()); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("unknown id: want ErrNotFound, got %v", err)
	}
	if err := f.store.SoftDeleteProject(ctx, f.user.ID, f.project.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.GetProjectForUser(ctx, f.user.ID, f.project.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("deleted project: want ErrNotFound, got %v", err)
	}
}

func TestBatchedSummaryQueries(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	other := testutil.SeedUser(t, f.pool, "", "")

	// Second service without deployments or source.
	svc2, err := f.store.CreateService(ctx, f.user.ID, f.env.ID, "worker", "worker")
	if err != nil {
		t.Fatal(err)
	}
	// A second, empty project.
	p2, _, err := f.store.CreateProject(ctx, f.user.ID, platformdb.CreateProjectParams{Slug: "empty", Name: "Empty"})
	if err != nil {
		t.Fatal(err)
	}

	first := f.deploy(t, "k1")
	time.Sleep(5 * time.Millisecond)
	second := f.deploy(t, "k2")

	pids := []uuid.UUID{f.project.ID, p2.ID}
	counts, err := f.store.CountServicesByProject(ctx, f.user.ID, pids)
	if err != nil {
		t.Fatal(err)
	}
	if counts[f.project.ID] != 2 || counts[p2.ID] != 0 {
		t.Fatalf("counts = %v, want {project:2, empty:0/absent}", counts)
	}

	latest, err := f.store.LatestDeploymentsByProject(ctx, f.user.ID, pids)
	if err != nil {
		t.Fatal(err)
	}
	if len(latest) != 1 || latest[f.project.ID].ID != second.Deployment.ID {
		t.Fatalf("latest by project = %v, want only %s -> %s (not %s)", latest, f.project.ID, second.Deployment.ID, first.Deployment.ID)
	}

	svcIDs := []uuid.UUID{f.service.ID, svc2.ID}
	byService, err := f.store.LatestDeploymentsByService(ctx, f.user.ID, svcIDs)
	if err != nil {
		t.Fatal(err)
	}
	if len(byService) != 1 || byService[f.service.ID].ID != second.Deployment.ID {
		t.Fatalf("latest by service = %v", byService)
	}

	sources, err := f.store.ServiceSourcesByService(ctx, f.user.ID, svcIDs)
	if err != nil {
		t.Fatal(err)
	}
	src, ok := sources[f.service.ID]
	if !ok || len(sources) != 1 || src.RepositoryFullName != "octo/hello" || src.Branch != "main" ||
		src.RootDirectory != "." || src.SourceStatus != "active" || !src.AutoDeploy {
		t.Fatalf("sources = %+v", sources)
	}

	// Tenant isolation: another user sees nothing for the same ids.
	if m, _ := f.store.CountServicesByProject(ctx, other.ID, pids); len(m) != 0 {
		t.Fatalf("foreign counts leaked: %v", m)
	}
	if m, _ := f.store.LatestDeploymentsByProject(ctx, other.ID, pids); len(m) != 0 {
		t.Fatalf("foreign latest-by-project leaked: %v", m)
	}
	if m, _ := f.store.LatestDeploymentsByService(ctx, other.ID, svcIDs); len(m) != 0 {
		t.Fatalf("foreign latest-by-service leaked: %v", m)
	}
	if m, _ := f.store.ServiceSourcesByService(ctx, other.ID, svcIDs); len(m) != 0 {
		t.Fatalf("foreign sources leaked: %v", m)
	}

	// Empty input is a no-op, not an error.
	if m, err := f.store.CountServicesByProject(ctx, f.user.ID, nil); err != nil || len(m) != 0 {
		t.Fatalf("empty input: %v, %v", m, err)
	}
}
