package projectsapi

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/platformdb"
)

// slugStore fakes only CreateProject; any other call panics via the nil embedded Store.
type slugStore struct {
	Store
	taken map[string]bool
	tried []string
}

func (s *slugStore) CreateProject(_ context.Context, userID uuid.UUID, p platformdb.CreateProjectParams) (*platformdb.Project, *platformdb.Environment, error) {
	s.tried = append(s.tried, p.Slug)
	if s.taken[p.Slug] {
		return nil, nil, platformdb.ErrConflict
	}
	return &platformdb.Project{ID: uuid.New(), UserID: userID, Slug: p.Slug, Name: p.Name, DefaultBranch: "main"}, nil, nil
}

func TestCreateProjectDerivedSlugRetriesOnConflict(t *testing.T) {
	st := &slugStore{taken: map[string]bool{"my-app": true, "my-app-2": true}}
	got, err := NewService(st).CreateProject(context.Background(), uuid.New(), CreateProjectRequest{Name: "My App"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Slug != "my-app-3" {
		t.Fatalf("slug = %q, want my-app-3 (tried %v)", got.Slug, st.tried)
	}
	if got.ServicesCount != 0 || got.LatestDeployment != nil {
		t.Fatalf("new project summary should be empty: %+v", got)
	}
}

func TestCreateProjectDerivedSlugRetriesAreBounded(t *testing.T) {
	st := &slugStore{taken: map[string]bool{}}
	st.taken["x"] = true
	for i := 2; i <= 50; i++ {
		st.taken[slugWithSuffix("x", i)] = true
	}
	_, err := NewService(st).CreateProject(context.Background(), uuid.New(), CreateProjectRequest{Name: "x"})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("want ErrConflict, got %v", err)
	}
	if len(st.tried) != maxDerivedSlugAttempts {
		t.Fatalf("tried %d slugs, want %d", len(st.tried), maxDerivedSlugAttempts)
	}
}

func TestCreateProjectExplicitSlugConflictIsNotRetried(t *testing.T) {
	st := &slugStore{taken: map[string]bool{"mine": true}}
	slug := "mine"
	_, err := NewService(st).CreateProject(context.Background(), uuid.New(), CreateProjectRequest{Name: "Whatever", Slug: &slug})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("want ErrConflict, got %v", err)
	}
	if len(st.tried) != 1 {
		t.Fatalf("explicit slug retried: %v", st.tried)
	}
}

func TestCreateProjectValidation(t *testing.T) {
	svc := NewService(&slugStore{})
	for _, name := range []string{"", "   "} {
		if _, err := svc.CreateProject(context.Background(), uuid.New(), CreateProjectRequest{Name: name}); !errors.Is(err, platformdb.ErrInvalidArgument) {
			t.Errorf("name %q: want ErrInvalidArgument, got %v", name, err)
		}
	}
}

func TestCreateServiceRejectsBadType(t *testing.T) {
	_, err := NewService(&slugStore{}).CreateService(context.Background(), uuid.New(), uuid.New(), CreateServiceRequest{Name: "api", Type: "cron"})
	if !errors.Is(err, platformdb.ErrInvalidArgument) {
		t.Fatalf("want ErrInvalidArgument for cron, got %v", err)
	}
}
