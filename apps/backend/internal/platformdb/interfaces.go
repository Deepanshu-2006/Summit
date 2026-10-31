package platformdb

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// The interfaces below are the seams consumers should depend on so they can be
// faked in unit tests. *Store satisfies all of them.

// Pinger supports readiness probes.
type Pinger interface {
	Ping(ctx context.Context) error
}

// ProjectStore is the API-facing project/environment/service/secret surface.
// Every method is scoped to userID.
type ProjectStore interface {
	CreateProject(ctx context.Context, userID uuid.UUID, p CreateProjectParams) (*Project, *Environment, error)
	ListProjects(ctx context.Context, userID uuid.UUID, lp ListParams) (Page[Project], error)
	GetProjectBySlug(ctx context.Context, userID uuid.UUID, slug string) (*Project, error)
	UpdateProject(ctx context.Context, userID, projectID uuid.UUID, u UpdateProjectParams) (*Project, error)
	SoftDeleteProject(ctx context.Context, userID, projectID uuid.UUID) error
	ListEnvironments(ctx context.Context, userID, projectID uuid.UUID) ([]Environment, error)
	CreateService(ctx context.Context, userID, environmentID uuid.UUID, name, serviceType string) (*Service, error)
	ListServicesByProject(ctx context.Context, userID, projectID uuid.UUID) ([]Service, error)
	GetServiceForUser(ctx context.Context, userID, serviceID uuid.UUID) (*Service, error)
	GetServiceResources(ctx context.Context, userID, serviceID uuid.UUID) (*ServiceResources, error)
	UpsertServiceResources(ctx context.Context, userID, serviceID uuid.UUID, res ServiceResources) (*ServiceResources, error)
	ListSecretReferences(ctx context.Context, userID, environmentID uuid.UUID) ([]SecretReference, error)
	CreateSecretReference(ctx context.Context, userID, environmentID uuid.UUID, in SecretReferenceInput) (*SecretReference, error)
	DeleteSecretReference(ctx context.Context, userID, environmentID, id uuid.UUID) error
}

// DeploymentStore is the API-facing deployment surface. Scoped to userID.
type DeploymentStore interface {
	CreateDeploymentWithOutbox(ctx context.Context, p CreateDeploymentParams) (*CreateDeploymentResult, error)
	GetDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*DeploymentDetail, error)
	ListDeploymentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp ListParams) (Page[Deployment], error)
	RequestCancel(ctx context.Context, userID, deploymentID uuid.UUID) (*Deployment, error)
	ListDeploymentLogsForUser(ctx context.Context, userID, deploymentID uuid.UUID, afterID int64, limit int) ([]BuildLogLine, error)
}

// BuildStore is the build-job surface shared by the API callback receiver
// (RecordBuildStatus, AppendBuildLogs, RecordBuildResult) and the orchestrator
// (GetBuildContext, MarkBuildDispatched, MarkBuildJobTerminal). Not user-scoped:
// callers authenticate with the per-build worker token or are trusted internals.
type BuildStore interface {
	GetBuildJob(ctx context.Context, id uuid.UUID) (*BuildJob, error)
	GetBuildContext(ctx context.Context, buildJobID uuid.UUID) (*BuildContext, error)
	MarkBuildDispatched(ctx context.Context, buildJobID, attemptID uuid.UUID, podName string, timeoutSeconds int) (*BuildJob, error)
	RecordBuildStatus(ctx context.Context, buildJobID uuid.UUID, ev BuildStatusEvent) (applied bool, err error)
	AppendBuildLogs(ctx context.Context, buildJobID uuid.UUID, lines []LogLine) (int, error)
	RecordBuildResult(ctx context.Context, buildJobID uuid.UUID, r BuildResult) (job *BuildJob, applied bool, err error)
	ListBuildLogs(ctx context.Context, buildJobID uuid.UUID, afterID int64, limit int) ([]BuildLogLine, error)
	MarkBuildJobTerminal(ctx context.Context, buildJobID uuid.UUID, status BuildJobStatus, errorMessage string) (job *BuildJob, applied bool, err error)
}

// RolloutStore is the orchestrator's deployment-driving surface (trusted, not user-scoped).
type RolloutStore interface {
	ListActiveDeployments(ctx context.Context, limit int) ([]ActiveDeployment, error)
	GetDeployment(ctx context.Context, id uuid.UUID) (*Deployment, error)
	TransitionDeployment(ctx context.Context, id uuid.UUID, from []DeploymentStatus, to DeploymentStatus, reason string, opts ...TransitionOption) (*Deployment, error)
	PromoteRelease(ctx context.Context, deploymentID uuid.UUID, configSnapshot json.RawMessage) (*PromoteResult, error)
}

var (
	_ Pinger          = (*Store)(nil)
	_ ProjectStore    = (*Store)(nil)
	_ DeploymentStore = (*Store)(nil)
	_ BuildStore      = (*Store)(nil)
	_ RolloutStore    = (*Store)(nil)
)
