package platformdb

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AgentDeploymentStatus represents the lifecycle of an agent deployment.
type AgentDeploymentStatus string

const (
	AgentDeploymentProvisioning AgentDeploymentStatus = "provisioning"
	AgentDeploymentActive       AgentDeploymentStatus = "active"
	AgentDeploymentDraining     AgentDeploymentStatus = "draining"
	AgentDeploymentReadOnly     AgentDeploymentStatus = "read_only"
	AgentDeploymentFailed       AgentDeploymentStatus = "failed"
	AgentDeploymentTerminated   AgentDeploymentStatus = "terminated"
)

// Valid reports whether s is a known agent deployment status.
func (s AgentDeploymentStatus) Valid() bool {
	switch s {
	case AgentDeploymentProvisioning, AgentDeploymentActive, AgentDeploymentDraining,
		AgentDeploymentReadOnly, AgentDeploymentFailed, AgentDeploymentTerminated:
		return true
	default:
		return false
	}
}

// AgentSessionStatus represents the lifecycle of an agent session.
type AgentSessionStatus string

const (
	AgentSessionProvisioning AgentSessionStatus = "provisioning"
	AgentSessionActive       AgentSessionStatus = "active"
	AgentSessionReadOnly     AgentSessionStatus = "read_only"
	AgentSessionPurgePending AgentSessionStatus = "purge_pending"
	AgentSessionPurged       AgentSessionStatus = "purged"
	AgentSessionFailed       AgentSessionStatus = "failed"
)

// Valid reports whether s is a known agent session status.
func (s AgentSessionStatus) Valid() bool {
	switch s {
	case AgentSessionProvisioning, AgentSessionActive, AgentSessionReadOnly,
		AgentSessionPurgePending, AgentSessionPurged, AgentSessionFailed:
		return true
	default:
		return false
	}
}

// Managed agent outbox constants
const (
	OutboxAggregateAgentDeployment      = "agent_deployment"
	OutboxAggregateAgentSession         = "agent_session"
	OutboxEventAgentDeploymentProvision = "agent.deployment.provision.requested"
	OutboxEventAgentSessionEnsure       = "agent.session.ensure.requested"
)

// Agent represents an agent definition owned by a user via a project.
type Agent struct {
	ID                uuid.UUID  `json:"id"`
	ProjectID         uuid.UUID  `json:"project_id"`
	UserID            uuid.UUID  `json:"-"`
	Name              string     `json:"name"`
	Description       *string    `json:"description,omitempty"`
	CurrentRevisionID *uuid.UUID `json:"current_revision_id,omitempty"`
	IdempotencyKey    string     `json:"-"`
	RequestHash       string     `json:"-"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"-"`
}

// CredentialRefSummary describes an authorized project/environment secret reference.
// Secret values are NEVER stored or represented here.
type CredentialRefSummary struct {
	Name              string    `json:"name"`
	SecretReferenceID uuid.UUID `json:"secret_reference_id"`
	Purpose           string    `json:"purpose,omitempty"`
}

// AgentConfig represents immutable agent configuration.
// Plaintext secrets and prompts are strictly forbidden.
type AgentConfig struct {
	Model                string                 `json:"model"`
	Instructions         string                 `json:"instructions"`
	Tools                []string               `json:"tools,omitempty"`
	Limits               map[string]any         `json:"limits,omitempty"`
	CredentialReferences []CredentialRefSummary `json:"credential_references,omitempty"`
}

// AgentRevision represents an immutable version of an agent's configuration.
type AgentRevision struct {
	ID              uuid.UUID   `json:"id"`
	AgentID         uuid.UUID   `json:"agent_id"`
	RevisionNumber  int         `json:"revision_number"`
	Config          AgentConfig `json:"config"`
	ConfigHash      string      `json:"config_hash"`
	IdempotencyKey  string      `json:"-"`
	RequestHash     string      `json:"-"`
	CreatedByUserID uuid.UUID   `json:"-"`
	CreatedAt       time.Time   `json:"created_at"`
}

// AgentDeployment represents an environment-specific activation of an agent pinned to a revision.
type AgentDeployment struct {
	ID                     uuid.UUID             `json:"id"`
	AgentID                uuid.UUID             `json:"agent_id"`
	AgentRevisionID        uuid.UUID             `json:"agent_revision_id"`
	ProjectID              uuid.UUID             `json:"project_id"`
	EnvironmentID          uuid.UUID             `json:"environment_id"`
	DeploymentNumber       int                   `json:"deployment_number"`
	IdempotencyKey         string                `json:"-"`
	RequestHash            string                `json:"-"`
	SupersedesDeploymentID *uuid.UUID            `json:"supersedes_deployment_id,omitempty"`
	RuntimeVersion         string                `json:"runtime_version"`
	Status                 AgentDeploymentStatus `json:"status"`
	StatusReason           *string               `json:"status_reason,omitempty"`
	DeleteRequestedAt      *time.Time            `json:"-"`
	PurgeAfter             *time.Time            `json:"-"`
	CreatedAt              time.Time             `json:"created_at"`
	UpdatedAt              time.Time             `json:"updated_at"`
}

// AgentSession represents an independent conversation session within a deployment.
type AgentSession struct {
	ID                uuid.UUID          `json:"id"`
	DeploymentID      uuid.UUID          `json:"deployment_id"`
	PiConversationID  *string            `json:"pi_conversation_id,omitempty"`
	ActorKeyVersion   string             `json:"actor_key_version"`
	IdempotencyKey    string             `json:"-"`
	RequestHash       string             `json:"-"`
	Status            AgentSessionStatus `json:"status"`
	StatusReason      *string            `json:"status_reason,omitempty"`
	CreatedByUserID   uuid.UUID          `json:"-"`
	LastActivityAt    time.Time          `json:"last_activity_at"`
	DeleteRequestedAt *time.Time         `json:"-"`
	PurgeAfter        *time.Time         `json:"-"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
}

// AgentSummary contains top-level info for listing agents.
type AgentSummary struct {
	Agent
	CurrentRevisionNumber  *int                   `json:"current_revision_number,omitempty"`
	ActiveDeploymentID     *uuid.UUID             `json:"active_deployment_id,omitempty"`
	ActiveDeploymentStatus *AgentDeploymentStatus `json:"active_deployment_status,omitempty"`
}

// AgentDetail contains complete agent details including current revision and active deployment.
type AgentDetail struct {
	Agent
	CurrentRevision  *AgentRevision   `json:"current_revision,omitempty"`
	ActiveDeployment *AgentDeployment `json:"active_deployment,omitempty"`
}

// CreateAgentParams is the input to CreateAgentWithInitialRevision.
type CreateAgentParams struct {
	UserID         uuid.UUID
	ProjectID      uuid.UUID
	Name           string
	Description    *string
	IdempotencyKey string
	RequestHash    string
	Config         AgentConfig
	ConfigHash     string
}

// CreateAgentResult is the result of CreateAgentWithInitialRevision.
type CreateAgentResult struct {
	Agent    Agent
	Revision AgentRevision
	Created  bool
}

// CreateRevisionParams is the input to CreateRevision.
type CreateRevisionParams struct {
	UserID         uuid.UUID
	AgentID        uuid.UUID
	IdempotencyKey string
	RequestHash    string
	Config         AgentConfig
	ConfigHash     string
}

// CreateDeploymentParams is the input to CreateDeployment.
type CreateAgentDeploymentParams struct {
	UserID          uuid.UUID
	AgentID         uuid.UUID
	EnvironmentID   uuid.UUID
	AgentRevisionID uuid.UUID
	RuntimeVersion  string
	IdempotencyKey  string
	RequestHash     string
}

// CreateSessionParams is the input to CreateSession.
type CreateAgentSessionParams struct {
	UserID         uuid.UUID
	DeploymentID   uuid.UUID
	IdempotencyKey string
	RequestHash    string
}

// AgentDeploymentProvisionPayload is the outbox event payload for agent.deployment.provision.requested.
type AgentDeploymentProvisionPayload struct {
	AgentID         uuid.UUID             `json:"agent_id"`
	DeploymentID    uuid.UUID             `json:"deployment_id"`
	ProjectID       uuid.UUID             `json:"project_id"`
	EnvironmentID   uuid.UUID             `json:"environment_id"`
	AgentRevisionID uuid.UUID             `json:"agent_revision_id"`
	RuntimeVersion  string                `json:"runtime_version"`
	Status          AgentDeploymentStatus `json:"status"`
}

// AgentSessionEnsurePayload is the outbox event payload for agent.session.ensure.requested.
type AgentSessionEnsurePayload struct {
	ProjectID        uuid.UUID          `json:"project_id"`
	DeploymentID     uuid.UUID          `json:"deployment_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	ActorKey         []string           `json:"actor_key"`
	PiConversationID *string            `json:"pi_conversation_id,omitempty"`
	Status           AgentSessionStatus `json:"status"`
}

// NewAgentDeploymentProvisionPayload marshals the deployment payload.
func NewAgentDeploymentProvisionPayload(p AgentDeploymentProvisionPayload) (json.RawMessage, error) {
	return json.Marshal(p)
}

// NewAgentSessionEnsurePayload marshals the session payload.
func NewAgentSessionEnsurePayload(p AgentSessionEnsurePayload) (json.RawMessage, error) {
	return json.Marshal(p)
}
