package events

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// EventTypeDeploymentBuildRequested is the event_type emitted into outbox_events by the GitHub webhook processor.
const EventTypeDeploymentBuildRequested = "deployment.build.requested"

// AggregateTypeDeployment is the aggregate_type recorded in outbox_events for build requests.
const AggregateTypeDeployment = "deployment"

var (
	// ErrNilPayload indicates that an empty or nil byte buffer was provided.
	ErrNilPayload = errors.New("orchestrator: payload is empty or nil")

	// ErrInvalidJSON indicates that the payload cannot be parsed as JSON.
	ErrInvalidJSON = errors.New("orchestrator: invalid event payload JSON")

	// ErrValidation indicates a missing required field in the event payload.
	ErrValidation = errors.New("orchestrator: event payload validation failed")
)

// OutboxEventRecord represents an outbox_events row as persisted in Postgres.
type OutboxEventRecord struct {
	ID            string          `json:"id"`
	AggregateType string          `json:"aggregate_type"`
	AggregateID   string          `json:"aggregate_id"`
	EventType     string          `json:"event_type"`
	Status        string          `json:"status"`
	Payload       json.RawMessage `json:"payload"`
}

// BuildRequestedPayload represents the typed payload structure emitted into
// outbox_events under event_type "deployment.build.requested" by apps/backend/internal/githubworker/processor.go.
type BuildRequestedPayload struct {
	EventID            string            `json:"event_id"`
	DeploymentID       string            `json:"deployment_id"`
	BuildRunID         string            `json:"build_run_id"`
	ServiceID          string            `json:"service_id"`
	ServiceSourceID    string            `json:"service_source_id"`
	UserID             string            `json:"user_id"`
	ProjectID          string            `json:"project_id"`
	EnvironmentID      string            `json:"environment_id"`
	Repository         RepositoryPayload `json:"repository"`
	Source             SourcePayload     `json:"source"`
	BuildConfiguration json.RawMessage   `json:"build_configuration"`
	Trigger            TriggerPayload    `json:"trigger"`
}

// RepositoryPayload captures repository identification from the event envelope.
type RepositoryPayload struct {
	PlatformRepositoryID string `json:"platform_repository_id"`
	GitHubRepositoryID   int64  `json:"github_repository_id"`
	FullName             string `json:"full_name"`
}

// SourcePayload captures code revision details to build.
type SourcePayload struct {
	Branch         string  `json:"branch"`
	Ref            string  `json:"ref"`
	CommitSHA      string  `json:"commit_sha"`
	RootDirectory  string  `json:"root_directory"`
	DockerfilePath *string `json:"dockerfile_path"`
}

// TriggerPayload captures what triggered this build.
type TriggerPayload struct {
	Type           string `json:"type"`
	WebhookEventID string `json:"webhook_event_id,omitempty"`
}

// DecodeBuildRequestedPayload unmarshals and validates a raw JSON byte slice into a BuildRequestedPayload.
func DecodeBuildRequestedPayload(data []byte) (*BuildRequestedPayload, error) {
	if len(strings.TrimSpace(string(data))) == 0 {
		return nil, ErrNilPayload
	}

	var payload BuildRequestedPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidJSON, err.Error())
	}

	if err := payload.Validate(); err != nil {
		return nil, err
	}

	return &payload, nil
}

// Validate ensures all required event envelope fields and commit coordinates are non-empty.
func (p *BuildRequestedPayload) Validate() error {
	var missing []string

	if strings.TrimSpace(p.EventID) == "" {
		missing = append(missing, "event_id")
	}
	if strings.TrimSpace(p.DeploymentID) == "" {
		missing = append(missing, "deployment_id")
	}
	if strings.TrimSpace(p.BuildRunID) == "" {
		missing = append(missing, "build_run_id")
	}
	if strings.TrimSpace(p.ServiceID) == "" {
		missing = append(missing, "service_id")
	}
	if strings.TrimSpace(p.ServiceSourceID) == "" {
		missing = append(missing, "service_source_id")
	}
	if strings.TrimSpace(p.UserID) == "" {
		missing = append(missing, "user_id")
	}
	if strings.TrimSpace(p.ProjectID) == "" {
		missing = append(missing, "project_id")
	}
	if strings.TrimSpace(p.EnvironmentID) == "" {
		missing = append(missing, "environment_id")
	}

	if strings.TrimSpace(p.Repository.PlatformRepositoryID) == "" {
		missing = append(missing, "repository.platform_repository_id")
	}
	if p.Repository.GitHubRepositoryID <= 0 {
		missing = append(missing, "repository.github_repository_id")
	}
	if strings.TrimSpace(p.Repository.FullName) == "" {
		missing = append(missing, "repository.full_name")
	}

	if strings.TrimSpace(p.Source.Branch) == "" {
		missing = append(missing, "source.branch")
	}
	if strings.TrimSpace(p.Source.CommitSHA) == "" {
		missing = append(missing, "source.commit_sha")
	}

	if strings.TrimSpace(p.Trigger.Type) == "" {
		missing = append(missing, "trigger.type")
	}

	if len(missing) > 0 {
		return fmt.Errorf("%w: missing required fields: %s", ErrValidation, strings.Join(missing, ", "))
	}

	return nil
}
