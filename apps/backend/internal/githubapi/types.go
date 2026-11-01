package githubapi

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/summit/backend/internal/githubapp"
)

// GitHubClient defines the client interface used by the githubapi package.
// It is satisfied by *githubapp.Client.
type GitHubClient interface {
	GetInstallation(ctx context.Context, installationID int64) (githubapp.Installation, error)
	ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) (githubapp.RepositoryPage, error)
	GetRepository(ctx context.Context, installationID int64, owner, repo string) (githubapp.Repository, error)
	GetCommit(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error)
	CreateInstallationToken(ctx context.Context, installationID int64, repositoryIDs []int64, permissions map[string]string) (githubapp.InstallationToken, error)
	InvalidateInstallationTokens(installationID int64)
}

// Pool defines the database operations required by githubapi.
// Satisfied by *pgxpool.Pool.
type Pool interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
}

// StartInstallationResponse is returned by POST /v1/github/installations.
type StartInstallationResponse struct {
	InstallationURL string `json:"installation_url"`
	StateExpiresAt  string `json:"state_expires_at"`
}

// InstallationAccount models the GitHub account metadata for an installation.
type InstallationAccount struct {
	Login string `json:"login"`
	Type  string `json:"type"`
}

// InstallationSummary models summarized installation metadata in lists.
type InstallationSummary struct {
	ID                   uuid.UUID           `json:"id"`
	GitHubInstallationID int64               `json:"github_installation_id"`
	GitHubAccount        InstallationAccount `json:"github_account"`
	Status               string              `json:"status"`
	RepositorySelection  string              `json:"repository_selection"`
	RepositoryCount      int                 `json:"repository_count"`
	LastSyncedAt         *time.Time          `json:"last_synced_at"`
	InstalledAt          *time.Time          `json:"installed_at"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
}

// ListInstallationsResponse is returned by GET /v1/github/installations.
type ListInstallationsResponse struct {
	Data       []InstallationSummary `json:"data"`
	NextCursor *string               `json:"next_cursor"`
}

// ServiceSummary contains a source-build-capable service owned by the authenticated user.
type ServiceSummary struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	ProjectID       uuid.UUID `json:"project_id"`
	ProjectName     string    `json:"project_name"`
	EnvironmentID   uuid.UUID `json:"environment_id"`
	EnvironmentName string    `json:"environment_name"`
}

type ListServicesResponse struct {
	Data []ServiceSummary `json:"data"`
}

// InstallationDetailResponse is returned by GET /v1/github/installations/{installation_id}.
type InstallationDetailResponse struct {
	ID                   uuid.UUID           `json:"id"`
	GitHubInstallationID int64               `json:"github_installation_id"`
	AccountID            int64               `json:"account_id"`
	GitHubAccount        InstallationAccount `json:"github_account"`
	Status               string              `json:"status"`
	RepositorySelection  string              `json:"repository_selection"`
	Permissions          map[string]string   `json:"permissions"`
	RepositoryCount      int                 `json:"repository_count"`
	SuspendedAt          *time.Time          `json:"suspended_at"`
	SuspendedByGitHub    bool                `json:"suspended_by_github"`
	InstalledAt          *time.Time          `json:"installed_at"`
	LastSyncedAt         *time.Time          `json:"last_synced_at"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
}

// DisconnectInstallationResponse is returned by DELETE /v1/github/installations/{installation_id}.
type DisconnectInstallationResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

// RepositorySummary models a single repository per spec 7.5.
type RepositorySummary struct {
	ID                 uuid.UUID `json:"id"`
	GitHubRepositoryID int64     `json:"github_repository_id"`
	Owner              string    `json:"owner"`
	Name               string    `json:"name"`
	FullName           string    `json:"full_name"`
	DefaultBranch      string    `json:"default_branch"`
	Private            bool      `json:"private"`
	Archived           bool      `json:"archived"`
	HTMLURL            string    `json:"html_url"`
}

// ListRepositoriesResponse is returned by GET /v1/github/installations/{installation_id}/repositories.
type ListRepositoriesResponse struct {
	Data       []RepositorySummary `json:"data"`
	NextCursor *string             `json:"next_cursor"`
}

// SyncResponse is returned by POST /v1/github/installations/{installation_id}/sync.
type SyncResponse struct {
	SyncID             uuid.UUID `json:"sync_id"`
	Status             string    `json:"status"`
	RepositoriesSynced int       `json:"repositories_synced"`
}

// RepositoryRef is an embedded reference to a repository.
type RepositoryRef struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
}

// ServiceSourceResponse is returned by PUT / GET / PATCH /v1/services/{service_id}/source.
type ServiceSourceResponse struct {
	ID                 uuid.UUID      `json:"id"`
	ServiceID          uuid.UUID      `json:"service_id"`
	Repository         RepositoryRef  `json:"repository"`
	Branch             string         `json:"branch"`
	RootDirectory      string         `json:"root_directory"`
	DockerfilePath     *string        `json:"dockerfile_path"`
	BuildConfiguration map[string]any `json:"build_configuration"`
	AutoDeploy         bool           `json:"auto_deploy"`
	SourceStatus       string         `json:"source_status"`
	DisconnectReason   *string        `json:"disconnect_reason,omitempty"`
	LastSeenCommitSHA  *string        `json:"last_seen_commit_sha"`
	LastDeploymentID   *uuid.UUID     `json:"last_deployment_id,omitempty"`
}

// PutServiceSourceRequest is the request payload for PUT /v1/services/{service_id}/source.
type PutServiceSourceRequest struct {
	RepositoryID       uuid.UUID      `json:"repository_id"`
	Branch             string         `json:"branch"`
	RootDirectory      string         `json:"root_directory"`
	DockerfilePath     *string        `json:"dockerfile_path"`
	BuildConfiguration map[string]any `json:"build_configuration"`
	AutoDeploy         *bool          `json:"auto_deploy"`
}

// PatchServiceSourceRequest is the request payload for PATCH /v1/services/{service_id}/source.
type PatchServiceSourceRequest struct {
	Branch             *string        `json:"branch,omitempty"`
	RootDirectory      *string        `json:"root_directory,omitempty"`
	DockerfilePath     *string        `json:"dockerfile_path,omitempty"`
	BuildConfiguration map[string]any `json:"build_configuration,omitempty"`
	AutoDeploy         *bool          `json:"auto_deploy,omitempty"`
}

// DisconnectSourceResponse is returned by DELETE /v1/services/{service_id}/source.
type DisconnectSourceResponse struct {
	ID               uuid.UUID `json:"id"`
	ServiceID        uuid.UUID `json:"service_id"`
	SourceStatus     string    `json:"source_status"`
	DisconnectReason string    `json:"disconnect_reason"`
}

// DeploymentSourceRef models the source reference in a manual deployment request.
type DeploymentSourceRef struct {
	Ref string `json:"ref"`
}

// ManualDeploymentRequest is the request payload for POST /v1/services/{service_id}/deployments.
type ManualDeploymentRequest struct {
	Source DeploymentSourceRef `json:"source"`
	Reason string              `json:"reason"`
}

// ManualDeploymentResponse is returned by POST /v1/services/{service_id}/deployments.
type ManualDeploymentResponse struct {
	ID         uuid.UUID  `json:"id"`
	ServiceID  uuid.UUID  `json:"service_id"`
	Status     string     `json:"status"`
	CommitSHA  string     `json:"commit_sha"`
	BuildJobID *uuid.UUID `json:"build_job_id"`
}
