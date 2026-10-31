package orchestrator

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
//
// NOTE: This represents the raw outbox event notification from the GitHub worker.
// It is NOT a builder execution spec. See MissingEnrichmentInputs for the fields
// that must be retrieved or resolved by the orchestrator before constructing
// a builder.protocol.BuildExecutionSpec.
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

// SourcePayload captures Git source revision parameters from the event envelope.
type SourcePayload struct {
	Branch         string  `json:"branch"`
	Ref            string  `json:"ref"`
	CommitSHA      string  `json:"commit_sha"`
	RootDirectory  string  `json:"root_directory"`
	DockerfilePath *string `json:"dockerfile_path"`
}

// TriggerPayload captures what caused the build request.
type TriggerPayload struct {
	Type           string `json:"type"`
	WebhookEventID string `json:"webhook_event_id"`
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

// Validate checks that all mandatory identifiers and source fields are present.
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
	if strings.TrimSpace(p.Source.Ref) == "" {
		missing = append(missing, "source.ref")
	}
	if strings.TrimSpace(p.Source.CommitSHA) == "" {
		missing = append(missing, "source.commit_sha")
	}
	if strings.TrimSpace(p.Trigger.Type) == "" {
		missing = append(missing, "trigger.type")
	}

	if len(missing) > 0 {
		return fmt.Errorf("%w: missing required fields [%s]", ErrValidation, strings.Join(missing, ", "))
	}

	return nil
}

// MissingEnrichmentField defines a specification requirement in builder.protocol.BuildExecutionSpec
// that is NOT provided by deployment.build.requested and must be resolved by the orchestrator.
type MissingEnrichmentField struct {
	Category    string `json:"category"`
	Field       string `json:"field"`
	Description string `json:"description"`
}

// MissingEnrichmentInputs documents the concrete gap between the observed outbox event
// (BuildRequestedPayload) and Priyanshu's builder execution specification (BuildExecutionSpec).
//
// The orchestrator must enrich the event with the following components before scheduling a build pod:
// 1. Build Metadata: Attempt ID, attempt counter, and correlation ID for idempotency and status streaming.
// 2. Source Credentials & Clone URL: Authenticated clone URL and credential ref (GitHub App installation token or deploy key via OpenBao).
// 3. Output Coordinates & Credentials: Destination OCI registry, repository, tag, platforms, and push credential references.
// 4. Resource Boundaries: CPU millicores, Memory MiB, and Ephemeral Storage MiB based on tenant/service tiers.
// 5. Execution Timeout: Per-service or platform build timeout in seconds.
// 6. Callback Reporting: Ingestion endpoint URL and token reference for build logs and status updates.
// 7. Resolved Build Instructions: Detection/selection of builder type (dockerfile, nixpacks, buildpack), install/build/start commands, and decrypted environment variables with secrets injected.
func MissingEnrichmentInputs() []MissingEnrichmentField {
	return []MissingEnrichmentField{
		{
			Category:    "BuildMetadata",
			Field:       "build.attempt_id",
			Description: "Unique UUID for the specific build attempt (outbox only provides build_run_id).",
		},
		{
			Category:    "BuildMetadata",
			Field:       "build.attempt_number",
			Description: "1-indexed attempt number for retry tracking.",
		},
		{
			Category:    "BuildMetadata",
			Field:       "build.correlation_id",
			Description: "Tracing/correlation identifier propagated across logs and metrics.",
		},
		{
			Category:    "SourceSpec",
			Field:       "source.clone_url",
			Description: "Git clone URL with authentication token or SSH reference (outbox only provides repo full_name).",
		},
		{
			Category:    "CredentialsSpec",
			Field:       "credentials.source_credential_ref",
			Description: "OpenBao/Vault or installation token reference for cloning the private repository.",
		},
		{
			Category:    "CredentialsSpec",
			Field:       "credentials.registry_credential_ref",
			Description: "Secret reference for authenticating against the target OCI container registry.",
		},
		{
			Category:    "OutputSpec",
			Field:       "output.registry",
			Description: "Target OCI container registry host (e.g. registry.summit.internal or registry.digitalocean.com).",
		},
		{
			Category:    "OutputSpec",
			Field:       "output.repository",
			Description: "Target image repository path (e.g. summit/project-uuid/service-uuid).",
		},
		{
			Category:    "OutputSpec",
			Field:       "output.tag",
			Description: "Target image tag (e.g. commit-sha or deployment-id).",
		},
		{
			Category:    "OutputSpec",
			Field:       "output.platforms",
			Description: "Target architectures (e.g. [\"linux/amd64\"]).",
		},
		{
			Category:    "ResourceLimits",
			Field:       "resources.cpu_millicores",
			Description: "Allocated CPU quota for the builder pod.",
		},
		{
			Category:    "ResourceLimits",
			Field:       "resources.memory_mib",
			Description: "Allocated Memory quota for the builder pod.",
		},
		{
			Category:    "ResourceLimits",
			Field:       "resources.ephemeral_storage_mib",
			Description: "Allocated scratch disk quota for Docker/BuildKit layers.",
		},
		{
			Category:    "TimeoutSeconds",
			Field:       "timeout_seconds",
			Description: "Maximum allowed duration for the build execution.",
		},
		{
			Category:    "ReportingSpec",
			Field:       "reporting.endpoint",
			Description: "Control-plane HTTP or gRPC callback URL for log streaming and status heartbeats.",
		},
		{
			Category:    "ReportingSpec",
			Field:       "reporting.token_ref",
			Description: "Signed worker JWT or token reference authenticating log and status callbacks.",
		},
		{
			Category:    "BuildConfig",
			Field:       "build_config.env_vars",
			Description: "Resolved and decrypted environment variables from project/environment secrets.",
		},
	}
}
