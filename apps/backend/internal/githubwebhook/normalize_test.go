package githubwebhook

import (
	"errors"
	"testing"
	"time"
)

func TestNormalize_Push(t *testing.T) {
	t.Run("push to branch with commits and installation", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/feature/x",
			"before": "0123456789abcdef0123456789abcdef01234567",
			"after": "fedcba9876543210fedcba9876543210fedcba98",
			"created": false,
			"deleted": false,
			"forced": false,
			"head_commit": {
				"id": "fedcba9876543210fedcba9876543210fedcba98"
			},
			"commits": [
				{"id": "fedcba9876543210fedcba9876543210fedcba98"}
			],
			"repository": {
				"id": 123456789,
				"name": "my-service",
				"full_name": "acme/my-service",
				"owner": {
					"login": "acme"
				},
				"default_branch": "main",
				"html_url": "https://github.com/acme/my-service",
				"private": true,
				"archived": false,
				"disabled": false,
				"pushed_at": 1700000000
			},
			"installation": {
				"id": 98765
			},
			"sender": {
				"id": 555,
				"login": "octocat",
				"type": "User",
				"avatar_url": "https://github.com/images/octocat.png",
				"html_url": "https://github.com/octocat"
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ev.Kind != KindPush {
			t.Errorf("expected KindPush, got %s", ev.Kind)
		}
		if ev.EventType != "push" {
			t.Errorf("expected event_type push, got %s", ev.EventType)
		}
		if ev.InstallationID != 98765 {
			t.Errorf("expected installation ID 98765, got %d", ev.InstallationID)
		}
		if ev.RepositoryID != 123456789 {
			t.Errorf("expected repository ID 123456789, got %d", ev.RepositoryID)
		}

		p := ev.Push
		if p == nil {
			t.Fatal("expected push details to be non-nil")
		}
		if p.Ref != "refs/heads/feature/x" {
			t.Errorf("expected ref 'refs/heads/feature/x', got %s", p.Ref)
		}
		if p.Branch != "feature/x" {
			t.Errorf("expected branch 'feature/x', got %s", p.Branch)
		}
		if p.HeadCommitSHA != "fedcba9876543210fedcba9876543210fedcba98" {
			t.Errorf("expected head commit SHA, got %s", p.HeadCommitSHA)
		}
		if p.CommitCount != 1 {
			t.Errorf("expected 1 commit, got %d", p.CommitCount)
		}
		if p.Repository.OwnerLogin != "acme" {
			t.Errorf("expected owner acme, got %s", p.Repository.OwnerLogin)
		}
		if p.Repository.PushedAt == nil || p.Repository.PushedAt.Unix() != 1700000000 {
			t.Errorf("expected pushed_at timestamp 1700000000, got %v", p.Repository.PushedAt)
		}
	})

	t.Run("push to tag leaves Branch empty and sets KindPush", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/tags/v1.0.0",
			"before": "0000000000000000000000000000000000000000",
			"after": "1111111111111111111111111111111111111111",
			"created": true,
			"deleted": false,
			"forced": false,
			"repository": {
				"id": 42,
				"name": "tag-repo",
				"full_name": "acme/tag-repo"
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ev.Kind != KindPush {
			t.Errorf("expected KindPush for tag ref, got %s", ev.Kind)
		}
		if ev.Push.Branch != "" {
			t.Errorf("expected empty branch for tag ref, got %q", ev.Push.Branch)
		}
		if !ev.Push.Created {
			t.Errorf("expected created to be true")
		}
	})

	t.Run("push deleted branch preserves deleted flag and extracts branch", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/obsolete-branch",
			"before": "abcdef0123456789abcdef0123456789abcdef01",
			"after": "0000000000000000000000000000000000000000",
			"deleted": true,
			"created": false,
			"forced": false,
			"head_commit": null,
			"repository": {
				"id": 77,
				"name": "my-app",
				"full_name": "acme/my-app"
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !ev.Push.Deleted {
			t.Errorf("expected deleted to be true")
		}
		if ev.Push.Branch != "obsolete-branch" {
			t.Errorf("expected branch 'obsolete-branch', got %q", ev.Push.Branch)
		}
		if !IsZeroSHA(ev.Push.After) {
			t.Errorf("expected After to be zero SHA: %q", ev.Push.After)
		}
		if ev.Push.HeadCommitSHA != "0000000000000000000000000000000000000000" {
			t.Errorf("expected HeadCommitSHA fallback to after when head_commit is null, got %q", ev.Push.HeadCommitSHA)
		}
	})

	t.Run("push forced update", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"before": "1111111111111111111111111111111111111111",
			"after": "2222222222222222222222222222222222222222",
			"forced": true,
			"repository": {"id": 10, "name": "f", "full_name": "o/f"}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !ev.Push.Forced {
			t.Errorf("expected forced to be true")
		}
	})

	t.Run("push with ISO8601 pushed_at timestamp and string owner", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"after": "3333333333333333333333333333333333333333",
			"repository": {
				"id": 99,
				"name": "iso-repo",
				"full_name": "corp/iso-repo",
				"owner": "corp",
				"pushed_at": "2026-10-31T01:30:00Z"
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Push.Repository.OwnerLogin != "corp" {
			t.Errorf("expected OwnerLogin corp, got %s", ev.Push.Repository.OwnerLogin)
		}
		expectedTime, _ := time.Parse(time.RFC3339, "2026-10-31T01:30:00Z")
		if ev.Push.Repository.PushedAt == nil || !ev.Push.Repository.PushedAt.Equal(expectedTime) {
			t.Errorf("expected %v, got %v", expectedTime, ev.Push.Repository.PushedAt)
		}
	})
}

func TestNormalize_Installation(t *testing.T) {
	t.Run("installation created", func(t *testing.T) {
		payload := []byte(`{
			"action": "created",
			"installation": {
				"id": 1234,
				"account": {
					"id": 5678,
					"login": "summit-cloud",
					"type": "Organization"
				},
				"repository_selection": "all",
				"permissions": {
					"contents": "read",
					"metadata": "read",
					"pull_requests": "write"
				},
				"suspended_at": null
			},
			"repositories": [
				{
					"id": 1001,
					"name": "core-api",
					"full_name": "summit-cloud/core-api",
					"private": true
				}
			]
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ev.Kind != KindInstallation {
			t.Errorf("expected KindInstallation, got %s", ev.Kind)
		}
		if ev.Action != "created" {
			t.Errorf("expected action created, got %s", ev.Action)
		}
		if ev.InstallationID != 1234 {
			t.Errorf("expected installation_id 1234, got %d", ev.InstallationID)
		}

		inst := ev.Installation
		if inst == nil {
			t.Fatal("expected InstallationChange to be non-nil")
		}
		if inst.AccountID != 5678 || inst.AccountLogin != "summit-cloud" || inst.AccountType != "Organization" {
			t.Errorf("account details mismatch: %+v", inst)
		}
		if inst.RepositorySelection != "all" {
			t.Errorf("expected repository_selection all, got %s", inst.RepositorySelection)
		}
		if inst.Permissions["contents"] != "read" {
			t.Errorf("expected contents read permission")
		}
		if len(inst.Repositories) != 1 || inst.Repositories[0].ID != 1001 {
			t.Errorf("expected 1 repo with ID 1001, got %+v", inst.Repositories)
		}
		if inst.SuspendedAt != nil {
			t.Errorf("expected suspended_at to be nil")
		}
	})

	t.Run("installation deleted", func(t *testing.T) {
		payload := []byte(`{
			"action": "deleted",
			"installation": {
				"id": 1234,
				"account": {
					"id": 5678,
					"login": "summit-cloud",
					"type": "Organization"
				}
			}
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "deleted" {
			t.Errorf("expected action deleted, got %s", ev.Action)
		}
		if ev.Installation.Action != "deleted" {
			t.Errorf("expected installation change action deleted")
		}
	})

	t.Run("installation suspend with timestamp", func(t *testing.T) {
		payload := []byte(`{
			"action": "suspend",
			"installation": {
				"id": 1234,
				"account": { "id": 5678, "login": "summit-cloud" },
				"suspended_at": "2026-10-30T15:04:05Z"
			}
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "suspend" {
			t.Errorf("expected action suspend, got %s", ev.Action)
		}
		if ev.Installation.SuspendedAt == nil {
			t.Fatal("expected suspended_at to be non-nil")
		}
		expected, _ := time.Parse(time.RFC3339, "2026-10-30T15:04:05Z")
		if !ev.Installation.SuspendedAt.Equal(expected) {
			t.Errorf("expected suspended_at %v, got %v", expected, ev.Installation.SuspendedAt)
		}
	})

	t.Run("installation unsuspend", func(t *testing.T) {
		payload := []byte(`{
			"action": "unsuspend",
			"installation": {
				"id": 1234,
				"suspended_at": null
			}
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "unsuspend" {
			t.Errorf("expected action unsuspend, got %s", ev.Action)
		}
		if ev.Installation.SuspendedAt != nil {
			t.Errorf("expected suspended_at to be nil after unsuspend")
		}
	})

	t.Run("installation new_permissions_accepted", func(t *testing.T) {
		payload := []byte(`{
			"action": "new_permissions_accepted",
			"installation": {
				"id": 1234,
				"permissions": {
					"administration": "read",
					"contents": "write"
				}
			}
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "new_permissions_accepted" {
			t.Errorf("expected action new_permissions_accepted, got %s", ev.Action)
		}
		if ev.Installation.Permissions["administration"] != "read" {
			t.Errorf("expected administration: read")
		}
	})

	t.Run("installation fallback to actionHint when payload action is empty", func(t *testing.T) {
		payload := []byte(`{
			"installation": { "id": 1234 }
		}`)

		ev, err := Normalize("installation", "created", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "created" {
			t.Errorf("expected action created from hint, got %s", ev.Action)
		}
	})

	t.Run("installation prefers payload action over actionHint", func(t *testing.T) {
		payload := []byte(`{
			"action": "suspend",
			"installation": { "id": 1234 }
		}`)

		ev, err := Normalize("installation", "created", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "suspend" {
			t.Errorf("expected action suspend from payload over hint, got %s", ev.Action)
		}
	})

	t.Run("installation missing action produces ErrMissingAction", func(t *testing.T) {
		payload := []byte(`{
			"installation": { "id": 1234 }
		}`)

		_, err := Normalize("installation", "", payload)
		if !errors.Is(err, ErrMissingAction) {
			t.Errorf("expected ErrMissingAction, got %v", err)
		}
	})
}

func TestNormalize_InstallationRepositories(t *testing.T) {
	t.Run("repositories added and removed", func(t *testing.T) {
		payload := []byte(`{
			"action": "added",
			"installation": {
				"id": 4321
			},
			"repository_selection": "selected",
			"repositories_added": [
				{
					"id": 2001,
					"name": "new-repo",
					"full_name": "acme/new-repo",
					"private": false
				}
			],
			"repositories_removed": [
				{
					"id": 3001,
					"name": "old-repo",
					"full_name": "acme/old-repo",
					"private": true
				}
			]
		}`)

		ev, err := Normalize("installation_repositories", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ev.Kind != KindInstallationRepositories {
			t.Errorf("expected KindInstallationRepositories, got %s", ev.Kind)
		}
		if ev.Action != "added" {
			t.Errorf("expected action added, got %s", ev.Action)
		}
		if ev.InstallationID != 4321 {
			t.Errorf("expected installation ID 4321, got %d", ev.InstallationID)
		}

		repos := ev.Repositories
		if repos == nil {
			t.Fatal("expected RepositoriesChange to be non-nil")
		}
		if len(repos.Added) != 1 || repos.Added[0].ID != 2001 {
			t.Errorf("unexpected added repositories: %+v", repos.Added)
		}
		if len(repos.Removed) != 1 || repos.Removed[0].ID != 3001 {
			t.Errorf("unexpected removed repositories: %+v", repos.Removed)
		}
	})

	t.Run("installation_repositories removed action", func(t *testing.T) {
		payload := []byte(`{
			"action": "removed",
			"installation": { "id": 4321 },
			"repositories_removed": [{"id": 5001, "name": "r", "full_name": "a/r"}]
		}`)

		ev, err := Normalize("installation_repositories", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Action != "removed" {
			t.Errorf("expected action removed, got %s", ev.Action)
		}
		if len(ev.Repositories.Removed) != 1 {
			t.Errorf("expected 1 removed repository, got %d", len(ev.Repositories.Removed))
		}
	})

	t.Run("installation_repositories missing action produces ErrMissingAction", func(t *testing.T) {
		payload := []byte(`{
			"installation": { "id": 4321 }
		}`)

		_, err := Normalize("installation_repositories", "", payload)
		if !errors.Is(err, ErrMissingAction) {
			t.Errorf("expected ErrMissingAction, got %v", err)
		}
	})
}

func TestNormalize_UnsupportedEvent(t *testing.T) {
	payload := []byte(`{
		"action": "opened",
		"issue": { "number": 1 }
	}`)

	ev, err := Normalize("issues", "opened", payload)
	if err == nil {
		t.Fatal("expected error for unsupported event, got nil")
	}

	if !IsUnsupported(err) {
		t.Errorf("expected IsUnsupported to be true, got error: %v", err)
	}

	var unsup *UnsupportedError
	if !errors.As(err, &unsup) {
		t.Fatalf("expected errors.As UnsupportedError, got %v", err)
	}
	if unsup.EventType != "issues" {
		t.Errorf("expected event type issues, got %s", unsup.EventType)
	}

	if ev == nil || ev.Kind != KindUnsupported {
		t.Errorf("expected event with KindUnsupported, got %+v", ev)
	}
}

func TestNormalize_Robustness(t *testing.T) {
	t.Run("malformed JSON", func(t *testing.T) {
		malformed := []byte(`{not-json}`)
		_, err := Normalize("push", "", malformed)
		if !errors.Is(err, ErrMalformedJSON) {
			t.Errorf("expected ErrMalformedJSON, got %v", err)
		}

		_, err = Normalize("push", "", []byte(""))
		if !errors.Is(err, ErrMalformedJSON) {
			t.Errorf("expected ErrMalformedJSON for empty slice, got %v", err)
		}
	})

	t.Run("push with missing installation and missing repository never panics", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"after": "1234567890abcdef1234567890abcdef12345678"
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.InstallationID != 0 {
			t.Errorf("expected 0 installation ID, got %d", ev.InstallationID)
		}
		if ev.RepositoryID != 0 {
			t.Errorf("expected 0 repository ID, got %d", ev.RepositoryID)
		}
	})

	t.Run("installation with missing installation object never panics", func(t *testing.T) {
		payload := []byte(`{
			"action": "created"
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.InstallationID != 0 {
			t.Errorf("expected 0 installation ID, got %d", ev.InstallationID)
		}
	})

	t.Run("unknown extra fields are tolerated", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"after": "1234567890abcdef1234567890abcdef12345678",
			"unexpected_future_field_9000": {"nested": [1, 2, 3]},
			"extra_string": "hello"
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Push.Branch != "main" {
			t.Errorf("expected branch main, got %s", ev.Push.Branch)
		}
	})

	t.Run("numeric IDs as int64 large numbers", func(t *testing.T) {
		// Test numbers exceeding standard 32-bit int
		payload := []byte(`{
			"action": "created",
			"installation": {
				"id": 922337203685477580,
				"account": { "id": 822337203685477580 }
			}
		}`)

		ev, err := Normalize("installation", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.InstallationID != 922337203685477580 {
			t.Errorf("expected int64 ID 922337203685477580, got %d", ev.InstallationID)
		}
		if ev.Installation.AccountID != 822337203685477580 {
			t.Errorf("expected int64 AccountID 822337203685477580, got %d", ev.Installation.AccountID)
		}
	})

	t.Run("repository owner name fallback and millisecond pushed_at", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"after": "1234567890abcdef1234567890abcdef12345678",
			"repository": {
				"id": 55,
				"name": "edge-repo",
				"full_name": "named-org/edge-repo",
				"owner": {
					"name": "named-org"
				},
				"pushed_at": 1700000000000
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Push.Repository.OwnerLogin != "named-org" {
			t.Errorf("expected OwnerLogin 'named-org', got %s", ev.Push.Repository.OwnerLogin)
		}
		if ev.Push.Repository.PushedAt == nil || ev.Push.Repository.PushedAt.Unix() != 1700000000 {
			t.Errorf("expected millisecond timestamp to convert to unix 1700000000, got %v", ev.Push.Repository.PushedAt)
		}
	})

	t.Run("repository owner deduced from full_name when owner is missing", func(t *testing.T) {
		payload := []byte(`{
			"ref": "refs/heads/main",
			"after": "1234567890abcdef1234567890abcdef12345678",
			"repository": {
				"id": 66,
				"name": "solo-repo",
				"full_name": "deduced-owner/solo-repo"
			}
		}`)

		ev, err := Normalize("push", "", payload)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Push.Repository.OwnerLogin != "deduced-owner" {
			t.Errorf("expected OwnerLogin 'deduced-owner', got %s", ev.Push.Repository.OwnerLogin)
		}
	})
}
