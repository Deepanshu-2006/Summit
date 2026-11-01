package platformdb

import (
	"encoding/json"

	"github.com/google/uuid"
)

// BuildRequestedEvent is the JSON payload of the outbox event
// "deployment.build.requested". It is the exact shape emitted by the GitHub
// worker (internal/githubworker) and decoded by
// orchestrator.DecodeBuildRequestedPayload.
type BuildRequestedEvent struct {
	EventID            string                   `json:"event_id"`
	DeploymentID       string                   `json:"deployment_id"`
	BuildRunID         string                   `json:"build_run_id"`
	ServiceID          string                   `json:"service_id"`
	ServiceSourceID    string                   `json:"service_source_id"`
	UserID             string                   `json:"user_id"`
	ProjectID          string                   `json:"project_id"`
	EnvironmentID      string                   `json:"environment_id"`
	Repository         BuildRequestedRepository `json:"repository"`
	Source             BuildRequestedSource     `json:"source"`
	BuildConfiguration json.RawMessage          `json:"build_configuration"`
	Trigger            BuildRequestedTrigger    `json:"trigger"`
}

// BuildRequestedRepository identifies the source repository.
type BuildRequestedRepository struct {
	PlatformRepositoryID string `json:"platform_repository_id"`
	GitHubRepositoryID   int64  `json:"github_repository_id"`
	FullName             string `json:"full_name"`
}

// BuildRequestedSource is the exact revision to build.
type BuildRequestedSource struct {
	Branch         string  `json:"branch"`
	Ref            string  `json:"ref"`
	CommitSHA      string  `json:"commit_sha"`
	RootDirectory  string  `json:"root_directory"`
	DockerfilePath *string `json:"dockerfile_path"`
}

// BuildRequestedTrigger records what caused the build.
type BuildRequestedTrigger struct {
	Type           string `json:"type"`
	WebhookEventID string `json:"webhook_event_id,omitempty"` // only for github_push
}

// BuildRequestedInput carries the values for NewBuildRequestedPayload.
type BuildRequestedInput struct {
	EventID              uuid.UUID // generated when uuid.Nil
	DeploymentID         uuid.UUID
	BuildRunID           uuid.UUID // build_jobs.id
	ServiceID            uuid.UUID
	ServiceSourceID      uuid.UUID
	UserID               uuid.UUID
	ProjectID            uuid.UUID
	EnvironmentID        uuid.UUID
	PlatformRepositoryID uuid.UUID
	GitHubRepositoryID   int64
	RepoFullName         string
	Branch               string
	Ref                  string
	CommitSHA            string
	RootDirectory        string
	DockerfilePath       *string
	BuildConfiguration   json.RawMessage // defaults to {}
	TriggerType          string          // "manual" | "github_push"
	WebhookEventID       *uuid.UUID      // github_push only
}

// NewBuildRequestedEvent assembles the typed event.
func NewBuildRequestedEvent(in BuildRequestedInput) BuildRequestedEvent {
	if in.EventID == uuid.Nil {
		in.EventID = uuid.New()
	}
	cfg := in.BuildConfiguration
	if len(cfg) == 0 || string(cfg) == "null" {
		cfg = json.RawMessage(`{}`)
	}
	ev := BuildRequestedEvent{
		EventID:         in.EventID.String(),
		DeploymentID:    in.DeploymentID.String(),
		BuildRunID:      in.BuildRunID.String(),
		ServiceID:       in.ServiceID.String(),
		ServiceSourceID: in.ServiceSourceID.String(),
		UserID:          in.UserID.String(),
		ProjectID:       in.ProjectID.String(),
		EnvironmentID:   in.EnvironmentID.String(),
		Repository: BuildRequestedRepository{
			PlatformRepositoryID: in.PlatformRepositoryID.String(),
			GitHubRepositoryID:   in.GitHubRepositoryID,
			FullName:             in.RepoFullName,
		},
		Source: BuildRequestedSource{
			Branch:         in.Branch,
			Ref:            in.Ref,
			CommitSHA:      in.CommitSHA,
			RootDirectory:  in.RootDirectory,
			DockerfilePath: in.DockerfilePath,
		},
		BuildConfiguration: cfg,
		Trigger:            BuildRequestedTrigger{Type: in.TriggerType},
	}
	if in.WebhookEventID != nil {
		ev.Trigger.WebhookEventID = in.WebhookEventID.String()
	}
	return ev
}

// NewBuildRequestedPayload returns the JSON bytes to store in
// outbox_events.payload for event_type "deployment.build.requested".
func NewBuildRequestedPayload(in BuildRequestedInput) ([]byte, error) {
	return json.Marshal(NewBuildRequestedEvent(in))
}

// ServiceDeletedEvent is the outbox payload for event_type "service.deleted"
// and aggregate_type "service". event_id is generated for the payload and is
// not the outbox_events.id (same as deployment.build.requested).
type ServiceDeletedEvent struct {
	EventID         string `json:"event_id"`
	ServiceID       string `json:"service_id"`
	ServiceName     string `json:"service_name"`
	ServiceType     string `json:"service_type"`
	UserID          string `json:"user_id"`
	ProjectID       string `json:"project_id"`
	ProjectSlug     string `json:"project_slug"`
	EnvironmentID   string `json:"environment_id"`
	EnvironmentName string `json:"environment_name"`
}
