package githubrepo

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/summit/backend/internal/githubapp"
)

type Client interface {
	ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error)
}

type Pool interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type QueryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Counts struct {
	Fetched int
	Created int
	Updated int
}

// SyncInstallation fully fetches an installation's repository list before writing,
// then upserts by GitHub's stable repository ID in a transaction.
func SyncInstallation(ctx context.Context, pool Pool, client Client, platformInstallationID uuid.UUID, githubInstallationID int64) (Counts, error) {
	if pool == nil || client == nil {
		return Counts{}, fmt.Errorf("repository sync requires a database pool and GitHub client")
	}

	repositories, err := fetchAll(ctx, client, githubInstallationID)
	if err != nil {
		return Counts{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return Counts{}, fmt.Errorf("beginning repository sync transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	counts := Counts{Fetched: len(repositories)}
	ids := make([]int64, 0, len(repositories))
	for _, repo := range repositories {
		_, created, err := Upsert(ctx, tx, platformInstallationID, repo)
		if err != nil {
			return Counts{}, fmt.Errorf("upserting repository %q: %w", repo.FullName, err)
		}
		if created {
			counts.Created++
		} else {
			counts.Updated++
		}
		ids = append(ids, repo.ID)
	}

	if _, err := tx.Exec(ctx, `UPDATE github_repositories SET removed_at=now(), updated_at=now()
		WHERE installation_id=$1 AND github_repository_id <> ALL($2) AND removed_at IS NULL`, platformInstallationID, ids); err != nil {
		return Counts{}, fmt.Errorf("marking missing repositories removed: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE github_installations SET last_synced_at=now(), updated_at=now() WHERE id=$1`, platformInstallationID); err != nil {
		return Counts{}, fmt.Errorf("updating installation sync timestamp: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Counts{}, fmt.Errorf("committing repository sync: %w", err)
	}
	return counts, nil
}

// Upsert stores a complete GitHub repository record and reports whether it was created.
func Upsert(ctx context.Context, db QueryRower, installationID uuid.UUID, repo githubapp.Repository) (uuid.UUID, bool, error) {
	if repo.ID <= 0 || repo.OwnerLogin == "" || repo.Name == "" || repo.FullName == "" {
		return uuid.Nil, false, fmt.Errorf("incomplete GitHub repository record")
	}
	var id uuid.UUID
	var created bool
	err := db.QueryRow(ctx, `
			INSERT INTO github_repositories (
				installation_id, github_repository_id, owner_login, name, full_name,
				default_branch, private, archived, disabled, html_url, pushed_at, last_synced_at, removed_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),NULL)
			ON CONFLICT (github_repository_id) DO UPDATE SET
				installation_id = EXCLUDED.installation_id,
				owner_login = EXCLUDED.owner_login,
				name = EXCLUDED.name,
				full_name = EXCLUDED.full_name,
				default_branch = EXCLUDED.default_branch,
				private = EXCLUDED.private,
				archived = EXCLUDED.archived,
				disabled = EXCLUDED.disabled,
				html_url = EXCLUDED.html_url,
				pushed_at = EXCLUDED.pushed_at,
				removed_at = NULL,
				last_synced_at = now(),
				updated_at = now()
			RETURNING id, (xmax = 0)
		`, installationID, repo.ID, repo.OwnerLogin, repo.Name, repo.FullName,
		repo.DefaultBranch, repo.Private, repo.Archived, repo.Disabled,
		repo.HTMLURL, repo.PushedAt).Scan(&id, &created)
	return id, created, err
}

func fetchAll(ctx context.Context, client Client, installationID int64) ([]githubapp.Repository, error) {
	const perPage = 100
	const maxPages = 1000
	all := make([]githubapp.Repository, 0)
	seen := make(map[int64]struct{})
	for page := 1; page <= maxPages; page++ {
		result, err := client.ListInstallationRepositories(ctx, installationID, page, perPage)
		if err != nil {
			return nil, fmt.Errorf("listing installation repositories for GitHub installation %d page %d: %w", installationID, page, err)
		}
		for _, repo := range result.Repositories {
			if repo.ID <= 0 || repo.OwnerLogin == "" || repo.Name == "" || repo.FullName == "" {
				return nil, fmt.Errorf("GitHub returned incomplete installation repository data for installation %d", installationID)
			}
			if _, duplicate := seen[repo.ID]; duplicate {
				continue
			}
			seen[repo.ID] = struct{}{}
			all = append(all, repo)
		}
		if !result.HasNext || len(result.Repositories) == 0 {
			break
		}
		if page == maxPages {
			return nil, fmt.Errorf("installation repository pagination exceeded %d pages for installation %d", maxPages, installationID)
		}
	}
	return all, nil
}
