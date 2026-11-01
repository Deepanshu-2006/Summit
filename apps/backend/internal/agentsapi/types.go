package agentsapi

import (
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/platformdb"
)

// CreateAgentRequest represents the body of POST /api/v1/projects/{slug}/agents.
type CreateAgentRequest struct {
	Name                 string                            `json:"name"`
	Description          *string                           `json:"description,omitempty"`
	Model                string                            `json:"model"`
	Instructions         string                            `json:"instructions"`
	Tools                []string                          `json:"tools,omitempty"`
	Limits               map[string]any                    `json:"limits,omitempty"`
	CredentialReferences []platformdb.CredentialRefSummary `json:"credential_references,omitempty"`
}

// CreateRevisionRequest represents the body of POST /api/v1/agents/{agent_id}/revisions.
type CreateRevisionRequest struct {
	Model                string                            `json:"model"`
	Instructions         string                            `json:"instructions"`
	Tools                []string                          `json:"tools,omitempty"`
	Limits               map[string]any                    `json:"limits,omitempty"`
	CredentialReferences []platformdb.CredentialRefSummary `json:"credential_references,omitempty"`
}

// CreateDeploymentRequest represents the body of POST /api/v1/agents/{agent_id}/deployments.
type CreateDeploymentRequest struct {
	EnvironmentID   uuid.UUID `json:"environment_id"`
	AgentRevisionID uuid.UUID `json:"agent_revision_id"`
	RuntimeVersion  *string   `json:"runtime_version,omitempty"`
}

// CreateSessionRequest represents the body of POST /api/v1/agent-deployments/{deployment_id}/sessions.
type CreateSessionRequest struct{}

// AgentResponse is the public representation of an agent definition.
type AgentResponse struct {
	ID                uuid.UUID  `json:"id"`
	ProjectID         uuid.UUID  `json:"project_id"`
	Name              string     `json:"name"`
	Description       *string    `json:"description,omitempty"`
	CurrentRevisionID *uuid.UUID `json:"current_revision_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// AgentSummaryResponse is used when listing agents.
type AgentSummaryResponse struct {
	AgentResponse
	CurrentRevisionNumber  *int                              `json:"current_revision_number,omitempty"`
	ActiveDeploymentID     *uuid.UUID                        `json:"active_deployment_id,omitempty"`
	ActiveDeploymentStatus *platformdb.AgentDeploymentStatus `json:"active_deployment_status,omitempty"`
}

// AgentListResponse is returned by GET /api/v1/projects/{slug}/agents.
type AgentListResponse struct {
	Data       []AgentSummaryResponse `json:"data"`
	NextCursor *string                `json:"next_cursor,omitempty"`
}

// AgentDetailResponse is returned by GET /api/v1/agents/{agent_id} and POST /api/v1/projects/{slug}/agents.
type AgentDetailResponse struct {
	AgentResponse
	CurrentRevision  *platformdb.AgentRevision   `json:"current_revision,omitempty"`
	ActiveDeployment *platformdb.AgentDeployment `json:"active_deployment,omitempty"`
}

// RevisionListResponse is returned by GET /api/v1/agents/{agent_id}/revisions.
type RevisionListResponse struct {
	Data []platformdb.AgentRevision `json:"data"`
}

// DeploymentListResponse is returned by GET /api/v1/agents/{agent_id}/deployments.
type DeploymentListResponse struct {
	Data []platformdb.AgentDeployment `json:"data"`
}

// SessionListResponse is returned by GET /api/v1/agent-deployments/{deployment_id}/sessions.
type SessionListResponse struct {
	Data []platformdb.AgentSession `json:"data"`
}
