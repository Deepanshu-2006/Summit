package githubrepo

import (
	"context"
	"errors"
	"testing"

	"github.com/summit/backend/internal/githubapp"
)

type fakeClient struct {
	pages  map[int]githubapp.RepositoryPage
	errors map[int]error
	calls  []int
}

func (c *fakeClient) ListInstallationRepositories(_ context.Context, _ int64, page, _ int) (githubapp.RepositoryPage, error) {
	c.calls = append(c.calls, page)
	if err := c.errors[page]; err != nil {
		return githubapp.RepositoryPage{}, err
	}
	return c.pages[page], nil
}

func TestFetchAllFollowsPagesAndDeduplicatesRepositoryIDs(t *testing.T) {
	shared := githubapp.Repository{ID: 17, OwnerLogin: "summit", Name: "app", FullName: "summit/app"}
	client := &fakeClient{pages: map[int]githubapp.RepositoryPage{
		1: {Repositories: []githubapp.Repository{shared}, HasNext: true},
		2: {Repositories: []githubapp.Repository{shared, {ID: 18, OwnerLogin: "summit", Name: "docs", FullName: "summit/docs"}}},
	}}

	repositories, err := fetchAll(context.Background(), client, 100)
	if err != nil {
		t.Fatalf("fetchAll returned error: %v", err)
	}
	if len(client.calls) != 2 || client.calls[0] != 1 || client.calls[1] != 2 {
		t.Fatalf("expected pages 1 and 2 to be fetched, got %v", client.calls)
	}
	if len(repositories) != 2 || repositories[0].ID != 17 || repositories[1].ID != 18 {
		t.Fatalf("expected two unique installation repositories, got %#v", repositories)
	}
}

func TestFetchAllDoesNotReturnPartialResultsAfterPageFailure(t *testing.T) {
	client := &fakeClient{
		pages: map[int]githubapp.RepositoryPage{
			1: {Repositories: []githubapp.Repository{{ID: 17, OwnerLogin: "summit", Name: "app", FullName: "summit/app"}}, HasNext: true},
		},
		errors: map[int]error{2: errors.New("GitHub unavailable")},
	}

	repositories, err := fetchAll(context.Background(), client, 100)
	if err == nil {
		t.Fatal("expected page failure")
	}
	if repositories != nil {
		t.Fatalf("expected no partial repository result after page failure, got %#v", repositories)
	}
}

func TestFetchAllRejectsIncompleteRepository(t *testing.T) {
	client := &fakeClient{pages: map[int]githubapp.RepositoryPage{
		1: {Repositories: []githubapp.Repository{{ID: 17, Name: "app", FullName: "summit/app"}}},
	}}

	if _, err := fetchAll(context.Background(), client, 100); err == nil {
		t.Fatal("expected incomplete repository data to be rejected")
	}
}
