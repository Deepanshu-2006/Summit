package testutil

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Additional seed structures for GitHub integration, deployments, builds,
// outbox events and secret references. These complement the helpers in db.go.

type GitHubInstallation struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	GitHubInstallationID int64
	AccountLogin         string
	Status               string
}

type GitHubRepository struct {
	ID                 uuid.UUID
	InstallationID     uuid.UUID
	GitHubRepositoryID int64
	OwnerLogin         string
	Name               string
	FullName           string
}

type ServiceSource struct {
	ID           uuid.UUID
	ServiceID    uuid.UUID
	RepositoryID uuid.UUID
	Branch       string
}

type Deployment struct {
	ID             uuid.UUID
	ProjectID      uuid.UUID
	EnvironmentID  uuid.UUID
	ServiceID      uuid.UUID
	Status         string
	CommitSHA      string
	IdempotencyKey string
}

type BuildJob struct {
	ID           uuid.UUID
	DeploymentID uuid.UUID
	Status       string
}

type OutboxEvent struct {
	ID            uuid.UUID
	AggregateType string
	AggregateID   uuid.UUID
	EventType     string
}

type SecretReference struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	ProjectID     uuid.UUID
	EnvironmentID uuid.UUID
	KeyName       string
}

func randomInt63() int64 { return rand.Int64N(1<<62) + 1 }

// SeedGitHubInstallation inserts an active GitHub App installation for a user.
// An empty accountLogin generates one.
func SeedGitHubInstallation(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID, accountLogin string) GitHubInstallation {
	t.Helper()
	if accountLogin == "" {
		accountLogin = "acct-" + uuid.NewString()[:8]
	}
	inst := GitHubInstallation{UserID: userID, GitHubInstallationID: randomInt63(), AccountLogin: accountLogin, Status: "active"}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (user_id, github_installation_id, account_id, account_login, account_type, status)
		VALUES ($1, $2, $3, $4, 'User', 'active') RETURNING id`,
		userID, inst.GitHubInstallationID, randomInt63(), accountLogin).Scan(&inst.ID)
	if err != nil {
		t.Fatalf("seeding github installation: %v", err)
	}
	return inst
}

// SeedGitHubRepository inserts a repository under an installation. fullName
// is "owner/name"; empty generates "<installation login>/repo-xxxx".
func SeedGitHubRepository(t *testing.T, pool *pgxpool.Pool, installationID uuid.UUID, fullName string) GitHubRepository {
	t.Helper()
	if fullName == "" {
		var login string
		if err := pool.QueryRow(context.Background(),
			`SELECT account_login FROM github_installations WHERE id = $1`, installationID).Scan(&login); err != nil {
			t.Fatalf("looking up installation login: %v", err)
		}
		fullName = login + "/repo-" + uuid.NewString()[:8]
	}
	owner, name, ok := strings.Cut(fullName, "/")
	if !ok || owner == "" || name == "" {
		t.Fatalf("SeedGitHubRepository: fullName %q must be owner/name", fullName)
	}
	repo := GitHubRepository{InstallationID: installationID, GitHubRepositoryID: randomInt63(), OwnerLogin: owner, Name: name, FullName: fullName}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (installation_id, github_repository_id, owner_login, name, full_name, default_branch, private)
		VALUES ($1, $2, $3, $4, $5, 'main', FALSE) RETURNING id`,
		installationID, repo.GitHubRepositoryID, owner, name, fullName).Scan(&repo.ID)
	if err != nil {
		t.Fatalf("seeding github repository: %v", err)
	}
	return repo
}

// SeedServiceSource connects a service to a repository branch (active, auto-deploy).
func SeedServiceSource(t *testing.T, pool *pgxpool.Pool, serviceID, repositoryID uuid.UUID, branch string) ServiceSource {
	t.Helper()
	if branch == "" {
		branch = "main"
	}
	ss := ServiceSource{ServiceID: serviceID, RepositoryID: repositoryID, Branch: branch}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO service_sources (service_id, repository_id, branch) VALUES ($1, $2, $3) RETURNING id`,
		serviceID, repositoryID, branch).Scan(&ss.ID)
	if err != nil {
		t.Fatalf("seeding service source: %v", err)
	}
	return ss
}

// SeedDeployment inserts a deployment with the given status ("" = queued).
// The environment must belong to the project and the service to the environment.
func SeedDeployment(t *testing.T, pool *pgxpool.Pool, projectID, envID, serviceID uuid.UUID, status string) Deployment {
	t.Helper()
	if status == "" {
		status = "queued"
	}
	d := Deployment{
		ProjectID: projectID, EnvironmentID: envID, ServiceID: serviceID, Status: status,
		CommitSHA:      strings.ReplaceAll(uuid.NewString(), "-", "") + "00000000",
		IdempotencyKey: "seed-" + uuid.NewString(),
	}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO deployments (project_id, environment_id, service_id, git_commit_sha, git_branch, status, idempotency_key)
		VALUES ($1, $2, $3, $4, 'main', $5::text::deployment_status, $6) RETURNING id`,
		projectID, envID, serviceID, d.CommitSHA, status, d.IdempotencyKey).Scan(&d.ID)
	if err != nil {
		t.Fatalf("seeding deployment: %v", err)
	}
	return d
}

// SeedBuildJob inserts a build job for a deployment with the given status ("" = queued).
func SeedBuildJob(t *testing.T, pool *pgxpool.Pool, deploymentID uuid.UUID, status string) BuildJob {
	t.Helper()
	if status == "" {
		status = "queued"
	}
	b := BuildJob{DeploymentID: deploymentID, Status: status}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO build_jobs (deployment_id, status) VALUES ($1, $2) RETURNING id`,
		deploymentID, status).Scan(&b.ID)
	if err != nil {
		t.Fatalf("seeding build job: %v", err)
	}
	return b
}

// SeedOutboxEvent inserts a pending outbox event. A nil payload becomes {}.
func SeedOutboxEvent(t *testing.T, pool *pgxpool.Pool, aggregateType string, aggregateID uuid.UUID, eventType string, payload any) OutboxEvent {
	t.Helper()
	if aggregateType == "" {
		aggregateType = "deployment"
	}
	if eventType == "" {
		eventType = "deployment.build.requested"
	}
	if payload == nil {
		payload = map[string]any{}
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshaling outbox payload: %v", err)
	}
	ev := OutboxEvent{AggregateType: aggregateType, AggregateID: aggregateID, EventType: eventType}
	err = pool.QueryRow(context.Background(), `
		INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
		aggregateType, aggregateID, eventType, raw).Scan(&ev.ID)
	if err != nil {
		t.Fatalf("seeding outbox event: %v", err)
	}
	return ev
}

// SeedSecretReference inserts a secret pointer (provider openbao, a generated
// vault path). It never stores a value.
func SeedSecretReference(t *testing.T, pool *pgxpool.Pool, userID, projectID, envID uuid.UUID, keyName string) SecretReference {
	t.Helper()
	if keyName == "" {
		keyName = "SECRET_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	}
	ref := SecretReference{UserID: userID, ProjectID: projectID, EnvironmentID: envID, KeyName: keyName}
	err := pool.QueryRow(context.Background(), `
		INSERT INTO secret_references (user_id, project_id, environment_id, key_name, provider, provider_vault_path)
		VALUES ($1, $2, $3, $4, 'openbao', $5) RETURNING id`,
		userID, projectID, envID, keyName, fmt.Sprintf("secret/data/%s/%s", projectID, keyName)).Scan(&ref.ID)
	if err != nil {
		t.Fatalf("seeding secret reference: %v", err)
	}
	return ref
}
