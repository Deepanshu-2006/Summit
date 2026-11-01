package platformdb

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// DeploymentStatus mirrors the Postgres enum deployment_status.
type DeploymentStatus string

// Deployment lifecycle (docs/mvp_runtime_contracts.md C2):
//
//	queued -> building -> image_ready -> deploying -> health_checking -> running
//
// terminal: failed, cancelled; a running deployment becomes superseded when a
// newer deployment of the same service reaches running.
const (
	DeploymentQueued         DeploymentStatus = "queued"
	DeploymentBuilding       DeploymentStatus = "building"
	DeploymentImageReady     DeploymentStatus = "image_ready"
	DeploymentDeploying      DeploymentStatus = "deploying"
	DeploymentHealthChecking DeploymentStatus = "health_checking"
	DeploymentRunning        DeploymentStatus = "running"
	DeploymentSuperseded     DeploymentStatus = "superseded"
	DeploymentFailed         DeploymentStatus = "failed"
	DeploymentCancelled      DeploymentStatus = "cancelled"

	// Legacy values kept in the enum for compatibility. New code must not write them.
	DeploymentPending DeploymentStatus = "pending"
	DeploymentActive  DeploymentStatus = "active"
)

// AllDeploymentStatuses lists every value of the enum.
var AllDeploymentStatuses = []DeploymentStatus{
	DeploymentPending, DeploymentQueued, DeploymentBuilding, DeploymentImageReady,
	DeploymentDeploying, DeploymentHealthChecking, DeploymentRunning, DeploymentActive,
	DeploymentSuperseded, DeploymentFailed, DeploymentCancelled,
}

// InFlightStatuses are the non-terminal, non-steady states the orchestrator
// drives forward (and the only ones that can be cancelled).
var InFlightStatuses = []DeploymentStatus{
	DeploymentQueued, DeploymentBuilding, DeploymentImageReady,
	DeploymentDeploying, DeploymentHealthChecking,
}

// Valid reports whether s is a known enum value.
func (s DeploymentStatus) Valid() bool {
	for _, v := range AllDeploymentStatuses {
		if v == s {
			return true
		}
	}
	return false
}

// IsTerminal reports whether no further transition is allowed (failed,
// cancelled, superseded).
func (s DeploymentStatus) IsTerminal() bool {
	return s == DeploymentFailed || s == DeploymentCancelled || s == DeploymentSuperseded
}

// IsInFlight reports whether s is queued/building/image_ready/deploying/health_checking.
func (s DeploymentStatus) IsInFlight() bool {
	for _, v := range InFlightStatuses {
		if v == s {
			return true
		}
	}
	return false
}

func statusStrings(in []DeploymentStatus) []string {
	out := make([]string, len(in))
	for i, s := range in {
		out[i] = string(s)
	}
	return out
}

// BuildJobStatus mirrors the CHECK constraint on build_jobs.status.
type BuildJobStatus string

const (
	BuildQueued     BuildJobStatus = "queued"
	BuildDispatched BuildJobStatus = "dispatched"
	BuildRunning    BuildJobStatus = "running"
	BuildSucceeded  BuildJobStatus = "succeeded"
	BuildFailed     BuildJobStatus = "failed"
	BuildCancelled  BuildJobStatus = "cancelled"
)

// IsTerminal reports whether the build job has a final result.
func (s BuildJobStatus) IsTerminal() bool {
	return s == BuildSucceeded || s == BuildFailed || s == BuildCancelled
}

// Service types and environment types accepted by the schema.
const (
	ServiceTypeWeb      = "web"
	ServiceTypeWorker   = "worker"
	ServiceTypeCron     = "cron"
	ServiceTypeImage    = "image"
	ServiceTypePostgres = "postgres"
	ServiceTypeRedis    = "redis"

	EnvTypeProduction = "production"
	EnvTypeStaging    = "staging"
	EnvTypePreview    = "preview"
)

// Event names and aggregate type written to outbox_events.
const (
	OutboxAggregateDeployment         = "deployment"
	OutboxEventDeploymentBuildRequest = "deployment.build.requested"
	OutboxAggregateService            = "service"
	OutboxEventServiceDeleted         = "service.deleted"
)

// Trigger types written to deployments.trigger_type.
const (
	TriggerManual     = "manual"
	TriggerGitHubPush = "github_push"
)

// Project is a personal-user-owned project.
type Project struct {
	ID               uuid.UUID
	UserID           uuid.UUID
	Slug             string
	Name             string
	GitRepositoryURL *string
	DefaultBranch    string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Environment belongs to a project.
type Environment struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	Name        string
	Type        string // production | staging | preview
	IsEphemeral bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Service is a workload (web, worker, cron) inside an environment.
type Service struct {
	ID              uuid.UUID
	EnvironmentID   uuid.UUID
	EnvironmentName string
	ProjectID       uuid.UUID
	Name            string
	Type            string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// ServiceResources is the compute spec for a service.
type ServiceResources struct {
	ServiceID            uuid.UUID
	CPURequestMillicores int
	CPULimitMillicores   int
	MemoryRequestMB      int
	MemoryLimitMB        int
	MinReplicas          int
	MaxReplicas          int
	Port                 int
	UpdatedAt            time.Time
}

// Deployment is a deployments row.
type Deployment struct {
	ID                uuid.UUID
	ProjectID         uuid.UUID
	EnvironmentID     uuid.UUID
	ServiceID         *uuid.UUID
	ServiceSourceID   *uuid.UUID
	CommitSHA         string
	Branch            string
	Ref               *string
	Status            DeploymentStatus
	TriggerType       string
	TriggerEventID    *uuid.UUID
	TriggeredByUserID *uuid.UUID
	IdempotencyKey    string
	ErrorMessage      *string
	StatusReason      *string
	ImageRef          *string // <repo>@sha256:<digest>
	PublicURL         *string
	CancelRequestedAt *time.Time
	StartedAt         *time.Time
	FinishedAt        *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// DeploymentEvent is one row of the append-only transition history.
type DeploymentEvent struct {
	ID           int64
	DeploymentID uuid.UUID
	FromStatus   *DeploymentStatus // nil for the creation event
	ToStatus     DeploymentStatus
	Reason       *string
	CreatedAt    time.Time
}

// BuildJob is a build_jobs row (the durable build request and its result).
type BuildJob struct {
	ID              uuid.UUID
	DeploymentID    uuid.UUID
	ServiceSourceID *uuid.UUID
	RepositoryID    *uuid.UUID
	CommitSHA       *string
	Ref             *string
	Status          BuildJobStatus
	BuilderType     string
	AttemptID       *uuid.UUID
	PodName         *string
	ImageRepository *string
	ImageTag        *string
	ImageDigest     *string // oci_image_digest, "sha256:<64 hex>"
	CurrentStage    *string
	ErrorMessage    *string
	TimeoutSeconds  *int
	RequestedAt     time.Time
	DispatchedAt    *time.Time
	StartedAt       *time.Time
	CompletedAt     *time.Time
	LastHeartbeatAt *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// ImageRef returns "<repository>@<digest>" when the build job has a pushed
// image, or "" otherwise.
func (b *BuildJob) ImageRef() string {
	if b == nil || b.ImageRepository == nil || b.ImageDigest == nil {
		return ""
	}
	return *b.ImageRepository + "@" + *b.ImageDigest
}

// DeploymentDetail is the API view of one deployment.
type DeploymentDetail struct {
	Deployment Deployment
	BuildJob   *BuildJob
	Events     []DeploymentEvent // oldest first
}

// Release is a releases row.
type Release struct {
	ID             uuid.UUID
	EnvironmentID  uuid.UUID
	DeploymentID   uuid.UUID
	ReleaseNumber  int
	ConfigSnapshot json.RawMessage
	IsActive       bool
	CreatedAt      time.Time
}

// SecretReference is a pointer to an externally stored secret. It never holds a value.
type SecretReference struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	ProjectID     uuid.UUID
	EnvironmentID uuid.UUID
	KeyName       string
	Provider      string // openbao | aws_secrets_manager | kubernetes_secret
	VaultPath     string
	VersionID     *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
