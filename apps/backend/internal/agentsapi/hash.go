package agentsapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/platformdb"
)

// CanonicalizeAgentConfig trims strings and sorts tools and credential references.
// Secrets must NEVER be placed in AgentConfig.
func CanonicalizeAgentConfig(cfg platformdb.AgentConfig) platformdb.AgentConfig {
	out := platformdb.AgentConfig{
		Model:        strings.TrimSpace(cfg.Model),
		Instructions: strings.TrimSpace(cfg.Instructions),
		Limits:       cfg.Limits,
	}
	if len(cfg.Tools) > 0 {
		tools := make([]string, len(cfg.Tools))
		for i, t := range cfg.Tools {
			tools[i] = strings.TrimSpace(t)
		}
		sort.Strings(tools)
		out.Tools = tools
	}
	if len(cfg.CredentialReferences) > 0 {
		creds := make([]platformdb.CredentialRefSummary, len(cfg.CredentialReferences))
		copy(creds, cfg.CredentialReferences)
		sort.Slice(creds, func(i, j int) bool {
			if creds[i].Name == creds[j].Name {
				return creds[i].SecretReferenceID.String() < creds[j].SecretReferenceID.String()
			}
			return creds[i].Name < creds[j].Name
		})
		out.CredentialReferences = creds
	}
	return out
}

func HashValue(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), nil
}

type canonicalCreateAgentPayload struct {
	Name        string                 `json:"name"`
	Description *string                `json:"description,omitempty"`
	Config      platformdb.AgentConfig `json:"config"`
}

func ComputeCreateAgentHash(name string, description *string, cfg platformdb.AgentConfig) (string, error) {
	name = strings.TrimSpace(name)
	var desc *string
	if description != nil {
		d := strings.TrimSpace(*description)
		desc = &d
	}
	return HashValue(canonicalCreateAgentPayload{
		Name:        name,
		Description: desc,
		Config:      CanonicalizeAgentConfig(cfg),
	})
}

type canonicalCreateRevisionPayload struct {
	Config platformdb.AgentConfig `json:"config"`
}

func ComputeCreateRevisionHash(cfg platformdb.AgentConfig) (string, error) {
	return HashValue(canonicalCreateRevisionPayload{
		Config: CanonicalizeAgentConfig(cfg),
	})
}

type canonicalCreateDeploymentPayload struct {
	EnvironmentID   uuid.UUID `json:"environment_id"`
	AgentRevisionID uuid.UUID `json:"agent_revision_id"`
	RuntimeVersion  string    `json:"runtime_version"`
}

func ComputeCreateDeploymentHash(envID, revID uuid.UUID, runtimeVersion string) (string, error) {
	if runtimeVersion == "" {
		runtimeVersion = "v1"
	}
	return HashValue(canonicalCreateDeploymentPayload{
		EnvironmentID:   envID,
		AgentRevisionID: revID,
		RuntimeVersion:  runtimeVersion,
	})
}

func ComputeCreateSessionHash() (string, error) {
	return HashValue(struct{}{})
}
