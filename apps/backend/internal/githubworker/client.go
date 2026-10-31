package githubworker

import (
	"context"

	"github.com/summit/backend/internal/githubapp"
)

// GitHubClient defines the subset of GitHub App client operations required by the
// webhook event processor and credential broker.
// The *githubapp.Client implementation satisfies this interface.
type GitHubClient interface {
	GetInstallation(ctx context.Context, installationID int64) (githubapp.Installation, error)
	CreateInstallationToken(ctx context.Context, installationID int64, repositoryIDs []int64, permissions map[string]string) (githubapp.InstallationToken, error)
	ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error)
	GetRepository(ctx context.Context, installationID int64, owner, repo string) (githubapp.Repository, error)
	GetCommit(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error)
	InvalidateInstallationTokens(installationID int64)
}
