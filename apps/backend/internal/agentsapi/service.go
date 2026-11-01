package agentsapi

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/platformdb"
)

// Store is the storage dependency required by Service.
type Store interface {
	GetProjectBySlugOrID(ctx context.Context, userID uuid.UUID, slugOrID string) (*platformdb.Project, error)
	CreateAgentWithInitialRevision(ctx context.Context, p platformdb.CreateAgentParams) (*platformdb.CreateAgentResult, error)
	ListAgentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp platformdb.ListParams) (platformdb.Page[platformdb.AgentSummary], error)
	GetAgentForUser(ctx context.Context, userID, agentID uuid.UUID) (*platformdb.AgentDetail, error)
	CreateAgentRevision(ctx context.Context, p platformdb.CreateRevisionParams) (*platformdb.AgentRevision, bool, error)
	ListAgentRevisions(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentRevision, error)
	CreateAgentDeployment(ctx context.Context, p platformdb.CreateAgentDeploymentParams) (*platformdb.AgentDeployment, bool, error)
	GetAgentDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.AgentDeployment, error)
	ListAgentDeploymentsForAgent(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentDeployment, error)
	CreateAgentSession(ctx context.Context, p platformdb.CreateAgentSessionParams) (*platformdb.AgentSession, bool, error)
	GetAgentSessionForUser(ctx context.Context, userID, sessionID uuid.UUID) (*platformdb.AgentSession, error)
	ListAgentSessionsForDeployment(ctx context.Context, userID, deploymentID uuid.UUID) ([]platformdb.AgentSession, error)
}

var _ Store = (*platformdb.Store)(nil)

// Service provides business logic for managed agents.
type Service struct {
	store Store
}

// NewService creates a new agentsapi Service.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// CreateAgent creates a user-owned agent definition and its initial immutable revision.
func (s *Service) CreateAgent(ctx context.Context, userID uuid.UUID, slugOrID, idempotencyKey string, req CreateAgentRequest) (*AgentDetailResponse, bool, error) {
	proj, err := s.store.GetProjectBySlugOrID(ctx, userID, slugOrID)
	if err != nil {
		return nil, false, err
	}

	cfg := CanonicalizeAgentConfig(platformdb.AgentConfig{
		Model:                req.Model,
		Instructions:         req.Instructions,
		Tools:                req.Tools,
		Limits:               req.Limits,
		CredentialReferences: req.CredentialReferences,
	})

	reqHash, err := ComputeCreateAgentHash(req.Name, req.Description, cfg)
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute request hash: %v", platformdb.ErrInvalidArgument, err)
	}

	cfgHash, err := HashValue(cfg)
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute config hash: %v", platformdb.ErrInvalidArgument, err)
	}

	res, err := s.store.CreateAgentWithInitialRevision(ctx, platformdb.CreateAgentParams{
		UserID:         userID,
		ProjectID:      proj.ID,
		Name:           req.Name,
		Description:    req.Description,
		IdempotencyKey: idempotencyKey,
		RequestHash:    reqHash,
		Config:         cfg,
		ConfigHash:     cfgHash,
	})
	if err != nil {
		return nil, false, err
	}

	detail := &AgentDetailResponse{
		AgentResponse: AgentResponse{
			ID:                res.Agent.ID,
			ProjectID:         res.Agent.ProjectID,
			Name:              res.Agent.Name,
			Description:       res.Agent.Description,
			CurrentRevisionID: res.Agent.CurrentRevisionID,
			CreatedAt:         res.Agent.CreatedAt,
			UpdatedAt:         res.Agent.UpdatedAt,
		},
		CurrentRevision: &res.Revision,
	}
	return detail, res.Created, nil
}

// ListAgents lists agent definitions for a project owned by the user.
func (s *Service) ListAgents(ctx context.Context, userID uuid.UUID, slugOrID string, lp platformdb.ListParams) (*AgentListResponse, error) {
	proj, err := s.store.GetProjectBySlugOrID(ctx, userID, slugOrID)
	if err != nil {
		return nil, err
	}

	page, err := s.store.ListAgentsForProject(ctx, userID, proj.ID, lp)
	if err != nil {
		return nil, err
	}

	out := &AgentListResponse{
		Data: make([]AgentSummaryResponse, 0, len(page.Items)),
	}
	for _, it := range page.Items {
		out.Data = append(out.Data, AgentSummaryResponse{
			AgentResponse: AgentResponse{
				ID:                it.ID,
				ProjectID:         it.ProjectID,
				Name:              it.Name,
				Description:       it.Description,
				CurrentRevisionID: it.CurrentRevisionID,
				CreatedAt:         it.CreatedAt,
				UpdatedAt:         it.UpdatedAt,
			},
			CurrentRevisionNumber:  it.CurrentRevisionNumber,
			ActiveDeploymentID:     it.ActiveDeploymentID,
			ActiveDeploymentStatus: it.ActiveDeploymentStatus,
		})
	}
	if page.NextCursor != "" {
		c := page.NextCursor
		out.NextCursor = &c
	}
	return out, nil
}

// GetAgent returns the agent definition and active deployment summary.
func (s *Service) GetAgent(ctx context.Context, userID, agentID uuid.UUID) (*AgentDetailResponse, error) {
	detail, err := s.store.GetAgentForUser(ctx, userID, agentID)
	if err != nil {
		return nil, err
	}

	return &AgentDetailResponse{
		AgentResponse: AgentResponse{
			ID:                detail.ID,
			ProjectID:         detail.ProjectID,
			Name:              detail.Name,
			Description:       detail.Description,
			CurrentRevisionID: detail.CurrentRevisionID,
			CreatedAt:         detail.CreatedAt,
			UpdatedAt:         detail.UpdatedAt,
		},
		CurrentRevision:  detail.CurrentRevision,
		ActiveDeployment: detail.ActiveDeployment,
	}, nil
}

// CreateRevision creates a new immutable revision for an existing agent.
func (s *Service) CreateRevision(ctx context.Context, userID, agentID uuid.UUID, idempotencyKey string, req CreateRevisionRequest) (*platformdb.AgentRevision, bool, error) {
	cfg := CanonicalizeAgentConfig(platformdb.AgentConfig{
		Model:                req.Model,
		Instructions:         req.Instructions,
		Tools:                req.Tools,
		Limits:               req.Limits,
		CredentialReferences: req.CredentialReferences,
	})

	reqHash, err := ComputeCreateRevisionHash(cfg)
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute request hash: %v", platformdb.ErrInvalidArgument, err)
	}

	cfgHash, err := HashValue(cfg)
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute config hash: %v", platformdb.ErrInvalidArgument, err)
	}

	return s.store.CreateAgentRevision(ctx, platformdb.CreateRevisionParams{
		UserID:         userID,
		AgentID:        agentID,
		IdempotencyKey: idempotencyKey,
		RequestHash:    reqHash,
		Config:         cfg,
		ConfigHash:     cfgHash,
	})
}

// ListRevisions returns all revisions for an agent.
func (s *Service) ListRevisions(ctx context.Context, userID, agentID uuid.UUID) (*RevisionListResponse, error) {
	revs, err := s.store.ListAgentRevisions(ctx, userID, agentID)
	if err != nil {
		return nil, err
	}
	if revs == nil {
		revs = []platformdb.AgentRevision{}
	}
	return &RevisionListResponse{Data: revs}, nil
}

// CreateDeployment creates a new deployment pinned to a revision and environment.
func (s *Service) CreateDeployment(ctx context.Context, userID, agentID uuid.UUID, idempotencyKey string, req CreateDeploymentRequest) (*platformdb.AgentDeployment, bool, error) {
	runtimeVer := "v1"
	if req.RuntimeVersion != nil && strings.TrimSpace(*req.RuntimeVersion) != "" {
		runtimeVer = strings.TrimSpace(*req.RuntimeVersion)
	}

	reqHash, err := ComputeCreateDeploymentHash(req.EnvironmentID, req.AgentRevisionID, runtimeVer)
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute request hash: %v", platformdb.ErrInvalidArgument, err)
	}

	return s.store.CreateAgentDeployment(ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          userID,
		AgentID:         agentID,
		EnvironmentID:   req.EnvironmentID,
		AgentRevisionID: req.AgentRevisionID,
		RuntimeVersion:  runtimeVer,
		IdempotencyKey:  idempotencyKey,
		RequestHash:     reqHash,
	})
}

// GetDeployment returns deployment details.
func (s *Service) GetDeployment(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.AgentDeployment, error) {
	return s.store.GetAgentDeploymentForUser(ctx, userID, deploymentID)
}

// ListDeployments lists deployments for an agent owned by the user.
func (s *Service) ListDeployments(ctx context.Context, userID, agentID uuid.UUID) (*DeploymentListResponse, error) {
	deps, err := s.store.ListAgentDeploymentsForAgent(ctx, userID, agentID)
	if err != nil {
		return nil, err
	}
	if deps == nil {
		deps = []platformdb.AgentDeployment{}
	}
	return &DeploymentListResponse{Data: deps}, nil
}

// CreateSession creates an independent session within a deployment.
func (s *Service) CreateSession(ctx context.Context, userID, deploymentID uuid.UUID, idempotencyKey string, req CreateSessionRequest) (*platformdb.AgentSession, bool, error) {
	reqHash, err := ComputeCreateSessionHash()
	if err != nil {
		return nil, false, fmt.Errorf("%w: failed to compute request hash: %v", platformdb.ErrInvalidArgument, err)
	}

	return s.store.CreateAgentSession(ctx, platformdb.CreateAgentSessionParams{
		UserID:         userID,
		DeploymentID:   deploymentID,
		IdempotencyKey: idempotencyKey,
		RequestHash:    reqHash,
	})
}

// GetSession returns session metadata.
func (s *Service) GetSession(ctx context.Context, userID, sessionID uuid.UUID) (*platformdb.AgentSession, error) {
	return s.store.GetAgentSessionForUser(ctx, userID, sessionID)
}

// ListSessions lists all sessions in a deployment.
func (s *Service) ListSessions(ctx context.Context, userID, deploymentID uuid.UUID) (*SessionListResponse, error) {
	sess, err := s.store.ListAgentSessionsForDeployment(ctx, userID, deploymentID)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		sess = []platformdb.AgentSession{}
	}
	return &SessionListResponse{Data: sess}, nil
}
