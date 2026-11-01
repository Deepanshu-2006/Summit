package agentsapi_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/agentsapi"
	"github.com/summit/backend/internal/platformdb"
)

type mockStore struct {
	getProjectBySlugOrIDFn           func(ctx context.Context, userID uuid.UUID, slugOrID string) (*platformdb.Project, error)
	createAgentWithInitialRevisionFn func(ctx context.Context, p platformdb.CreateAgentParams) (*platformdb.CreateAgentResult, error)
	listAgentsForProjectFn           func(ctx context.Context, userID, projectID uuid.UUID, lp platformdb.ListParams) (platformdb.Page[platformdb.AgentSummary], error)
	getAgentForUserFn                func(ctx context.Context, userID, agentID uuid.UUID) (*platformdb.AgentDetail, error)
	createAgentRevisionFn            func(ctx context.Context, p platformdb.CreateRevisionParams) (*platformdb.AgentRevision, bool, error)
	listAgentRevisionsFn             func(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentRevision, error)
	createAgentDeploymentFn          func(ctx context.Context, p platformdb.CreateAgentDeploymentParams) (*platformdb.AgentDeployment, bool, error)
	getAgentDeploymentForUserFn      func(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.AgentDeployment, error)
	listAgentDeploymentsForAgentFn   func(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentDeployment, error)
	createAgentSessionFn             func(ctx context.Context, p platformdb.CreateAgentSessionParams) (*platformdb.AgentSession, bool, error)
	getAgentSessionForUserFn         func(ctx context.Context, userID, sessionID uuid.UUID) (*platformdb.AgentSession, error)
	listAgentSessionsForDeploymentFn func(ctx context.Context, userID, deploymentID uuid.UUID) ([]platformdb.AgentSession, error)
}

func (m *mockStore) GetProjectBySlugOrID(ctx context.Context, userID uuid.UUID, slugOrID string) (*platformdb.Project, error) {
	if m.getProjectBySlugOrIDFn != nil {
		return m.getProjectBySlugOrIDFn(ctx, userID, slugOrID)
	}
	return nil, platformdb.ErrNotFound
}

func (m *mockStore) CreateAgentWithInitialRevision(ctx context.Context, p platformdb.CreateAgentParams) (*platformdb.CreateAgentResult, error) {
	if m.createAgentWithInitialRevisionFn != nil {
		return m.createAgentWithInitialRevisionFn(ctx, p)
	}
	return nil, errors.New("not implemented")
}

func (m *mockStore) ListAgentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp platformdb.ListParams) (platformdb.Page[platformdb.AgentSummary], error) {
	if m.listAgentsForProjectFn != nil {
		return m.listAgentsForProjectFn(ctx, userID, projectID, lp)
	}
	return platformdb.Page[platformdb.AgentSummary]{}, nil
}

func (m *mockStore) GetAgentForUser(ctx context.Context, userID, agentID uuid.UUID) (*platformdb.AgentDetail, error) {
	if m.getAgentForUserFn != nil {
		return m.getAgentForUserFn(ctx, userID, agentID)
	}
	return nil, platformdb.ErrNotFound
}

func (m *mockStore) CreateAgentRevision(ctx context.Context, p platformdb.CreateRevisionParams) (*platformdb.AgentRevision, bool, error) {
	if m.createAgentRevisionFn != nil {
		return m.createAgentRevisionFn(ctx, p)
	}
	return nil, false, errors.New("not implemented")
}

func (m *mockStore) ListAgentRevisions(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentRevision, error) {
	if m.listAgentRevisionsFn != nil {
		return m.listAgentRevisionsFn(ctx, userID, agentID)
	}
	return nil, nil
}

func (m *mockStore) CreateAgentDeployment(ctx context.Context, p platformdb.CreateAgentDeploymentParams) (*platformdb.AgentDeployment, bool, error) {
	if m.createAgentDeploymentFn != nil {
		return m.createAgentDeploymentFn(ctx, p)
	}
	return nil, false, errors.New("not implemented")
}

func (m *mockStore) GetAgentDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.AgentDeployment, error) {
	if m.getAgentDeploymentForUserFn != nil {
		return m.getAgentDeploymentForUserFn(ctx, userID, deploymentID)
	}
	return nil, platformdb.ErrNotFound
}

func (m *mockStore) ListAgentDeploymentsForAgent(ctx context.Context, userID, agentID uuid.UUID) ([]platformdb.AgentDeployment, error) {
	if m.listAgentDeploymentsForAgentFn != nil {
		return m.listAgentDeploymentsForAgentFn(ctx, userID, agentID)
	}
	return nil, nil
}

func (m *mockStore) CreateAgentSession(ctx context.Context, p platformdb.CreateAgentSessionParams) (*platformdb.AgentSession, bool, error) {
	if m.createAgentSessionFn != nil {
		return m.createAgentSessionFn(ctx, p)
	}
	return nil, false, errors.New("not implemented")
}

func (m *mockStore) GetAgentSessionForUser(ctx context.Context, userID, sessionID uuid.UUID) (*platformdb.AgentSession, error) {
	if m.getAgentSessionForUserFn != nil {
		return m.getAgentSessionForUserFn(ctx, userID, sessionID)
	}
	return nil, platformdb.ErrNotFound
}

func (m *mockStore) ListAgentSessionsForDeployment(ctx context.Context, userID, deploymentID uuid.UUID) ([]platformdb.AgentSession, error) {
	if m.listAgentSessionsForDeploymentFn != nil {
		return m.listAgentSessionsForDeploymentFn(ctx, userID, deploymentID)
	}
	return nil, nil
}

func TestCanonicalHashing(t *testing.T) {
	cfg1 := platformdb.AgentConfig{
		Model:        "gpt-4o",
		Instructions: "do tasks",
		Tools:        []string{"search", "read_file"},
	}
	cfg2 := platformdb.AgentConfig{
		Model:        "gpt-4o",
		Instructions: "do tasks",
		Tools:        []string{"read_file", "search"},
	}

	h1, err := agentsapi.ComputeCreateAgentHash("MyAgent", nil, cfg1)
	if err != nil {
		t.Fatalf("hash1 failed: %v", err)
	}
	h2, err := agentsapi.ComputeCreateAgentHash("MyAgent", nil, cfg2)
	if err != nil {
		t.Fatalf("hash2 failed: %v", err)
	}

	if h1 != h2 {
		t.Errorf("expected canonical hashes to match regardless of tool order; got %s != %s", h1, h2)
	}
}

func TestService_CreateAgentAndRevisions(t *testing.T) {
	uID := uuid.New()
	pID := uuid.New()
	aID := uuid.New()
	rID := uuid.New()

	mock := &mockStore{
		getProjectBySlugOrIDFn: func(ctx context.Context, userID uuid.UUID, slugOrID string) (*platformdb.Project, error) {
			return &platformdb.Project{ID: pID, UserID: uID, Slug: "my-proj"}, nil
		},
		createAgentWithInitialRevisionFn: func(ctx context.Context, p platformdb.CreateAgentParams) (*platformdb.CreateAgentResult, error) {
			return &platformdb.CreateAgentResult{
				Agent: platformdb.Agent{
					ID:                aID,
					ProjectID:         p.ProjectID,
					UserID:            p.UserID,
					Name:              p.Name,
					CurrentRevisionID: &rID,
					CreatedAt:         time.Now(),
					UpdatedAt:         time.Now(),
				},
				Revision: platformdb.AgentRevision{
					ID:             rID,
					AgentID:        aID,
					RevisionNumber: 1,
					Config:         p.Config,
					CreatedAt:      time.Now(),
				},
				Created: true,
			}, nil
		},
		createAgentRevisionFn: func(ctx context.Context, p platformdb.CreateRevisionParams) (*platformdb.AgentRevision, bool, error) {
			return &platformdb.AgentRevision{
				ID:             uuid.New(),
				AgentID:        p.AgentID,
				RevisionNumber: 2,
				Config:         p.Config,
				CreatedAt:      time.Now(),
			}, true, nil
		},
	}

	svc := agentsapi.NewService(mock)
	res, created, err := svc.CreateAgent(context.Background(), uID, "my-proj", "idemp-1", agentsapi.CreateAgentRequest{
		Name:         "CodeBot",
		Model:        "gpt-4o",
		Instructions: "Write code",
	})
	if err != nil {
		t.Fatalf("CreateAgent failed: %v", err)
	}
	if !created {
		t.Fatal("expected created=true")
	}
	if res.ID != aID {
		t.Errorf("expected agent ID %s, got %s", aID, res.ID)
	}

	rev, created, err := svc.CreateRevision(context.Background(), uID, aID, "idemp-2", agentsapi.CreateRevisionRequest{
		Model:        "gpt-4o-mini",
		Instructions: "Write better code",
	})
	if err != nil {
		t.Fatalf("CreateRevision failed: %v", err)
	}
	if !created || rev.RevisionNumber != 2 {
		t.Errorf("expected revision 2 created, got %+v", rev)
	}
}
