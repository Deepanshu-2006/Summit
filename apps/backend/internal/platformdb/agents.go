package platformdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const agentCols = `a.id, a.project_id, a.user_id, a.name, a.description, a.current_revision_id,
	a.idempotency_key, a.request_hash, a.created_at, a.updated_at, a.deleted_at`

func scanAgent(row pgx.Row) (*Agent, error) {
	var a Agent
	if err := row.Scan(&a.ID, &a.ProjectID, &a.UserID, &a.Name, &a.Description, &a.CurrentRevisionID,
		&a.IdempotencyKey, &a.RequestHash, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt); err != nil {
		return nil, err
	}
	return &a, nil
}

const revisionCols = `r.id, r.agent_id, r.revision_number, r.config, r.config_hash,
	r.idempotency_key, r.request_hash, r.created_by_user_id, r.created_at`

func scanRevision(row pgx.Row) (*AgentRevision, error) {
	var r AgentRevision
	var cfgBytes []byte
	if err := row.Scan(&r.ID, &r.AgentID, &r.RevisionNumber, &cfgBytes, &r.ConfigHash,
		&r.IdempotencyKey, &r.RequestHash, &r.CreatedByUserID, &r.CreatedAt); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(cfgBytes, &r.Config); err != nil {
		return nil, fmt.Errorf("platformdb: unmarshal revision config: %w", err)
	}
	return &r, nil
}

const agentDeploymentCols = `d.id, d.agent_id, d.agent_revision_id, d.project_id, d.environment_id,
	d.deployment_number, d.idempotency_key, d.request_hash, d.supersedes_deployment_id,
	d.runtime_version, d.status, d.status_reason, d.delete_requested_at, d.purge_after,
	d.created_at, d.updated_at`

func scanAgentDeployment(row pgx.Row) (*AgentDeployment, error) {
	var d AgentDeployment
	if err := row.Scan(&d.ID, &d.AgentID, &d.AgentRevisionID, &d.ProjectID, &d.EnvironmentID,
		&d.DeploymentNumber, &d.IdempotencyKey, &d.RequestHash, &d.SupersedesDeploymentID,
		&d.RuntimeVersion, &d.Status, &d.StatusReason, &d.DeleteRequestedAt, &d.PurgeAfter,
		&d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	return &d, nil
}

const agentSessionCols = `s.id, s.deployment_id, s.pi_conversation_id, s.actor_key_version,
	s.idempotency_key, s.request_hash, s.status, s.status_reason, s.created_by_user_id,
	s.last_activity_at, s.delete_requested_at, s.purge_after, s.created_at, s.updated_at`

func scanAgentSession(row pgx.Row) (*AgentSession, error) {
	var s AgentSession
	if err := row.Scan(&s.ID, &s.DeploymentID, &s.PiConversationID, &s.ActorKeyVersion,
		&s.IdempotencyKey, &s.RequestHash, &s.Status, &s.StatusReason, &s.CreatedByUserID,
		&s.LastActivityAt, &s.DeleteRequestedAt, &s.PurgeAfter, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

// GetProjectBySlugOrID resolves a project by UUID or slug, enforcing user ownership.
func (s *Store) GetProjectBySlugOrID(ctx context.Context, userID uuid.UUID, slugOrID string) (*Project, error) {
	slugOrID = strings.TrimSpace(slugOrID)
	if slugOrID == "" {
		return nil, invalidArg("project identifier is required")
	}
	if id, err := uuid.Parse(slugOrID); err == nil {
		p, err := s.GetProjectForUser(ctx, userID, id)
		if err == nil {
			return p, nil
		}
	}
	return s.GetProjectBySlug(ctx, userID, slugOrID)
}

// CreateAgentWithInitialRevision atomically creates an agent and its initial immutable revision.
// Keyed by (project_id, IdempotencyKey):
// - Same key + same hash: returns existing resource with Created=false.
// - Same key + different hash: returns ErrConflict.
func (s *Store) CreateAgentWithInitialRevision(ctx context.Context, p CreateAgentParams) (*CreateAgentResult, error) {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" || len(p.Name) > 255 {
		return nil, invalidArg("agent name must be 1-255 characters")
	}
	if strings.TrimSpace(p.Config.Model) == "" {
		return nil, invalidArg("model is required")
	}
	p.IdempotencyKey = strings.TrimSpace(p.IdempotencyKey)
	if p.IdempotencyKey == "" || len(p.IdempotencyKey) > 128 {
		return nil, invalidArg("idempotency key is required (max 128 chars)")
	}
	if p.RequestHash == "" {
		return nil, invalidArg("request hash is required")
	}

	cfgBytes, err := json.Marshal(p.Config)
	if err != nil {
		return nil, fmt.Errorf("platformdb: marshal agent config: %w", err)
	}

	var res *CreateAgentResult
	err = s.WithTx(ctx, func(tx *Store) error {
		// 1. Verify project ownership
		var projID uuid.UUID
		err := tx.db.QueryRow(ctx, `
			SELECT id FROM projects
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
			FOR UPDATE`,
			p.ProjectID, p.UserID).Scan(&projID)
		if err != nil {
			return notFoundIfNoRows(err)
		}

		// 2. Check for existing agent by (project_id, idempotency_key)
		existing, err := scanAgent(tx.db.QueryRow(ctx, `
			SELECT `+agentCols+` FROM agents a
			WHERE a.project_id = $1 AND a.idempotency_key = $2 AND a.deleted_at IS NULL`,
			p.ProjectID, p.IdempotencyKey))
		if err == nil {
			if existing.RequestHash != p.RequestHash {
				return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
			}
			var rev *AgentRevision
			if existing.CurrentRevisionID != nil {
				rev, err = scanRevision(tx.db.QueryRow(ctx, `
					SELECT `+revisionCols+` FROM agent_revisions r
					WHERE r.id = $1`, *existing.CurrentRevisionID))
				if err != nil {
					return fmt.Errorf("platformdb: fetch current revision for existing agent: %w", err)
				}
			}
			if rev == nil {
				return errors.New("platformdb: existing agent has no current revision")
			}
			res = &CreateAgentResult{Agent: *existing, Revision: *rev, Created: false}
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("platformdb: check existing agent: %w", err)
		}

		// 3. Insert agent (current_revision_id NULL initially)
		var agent *Agent
		agent, err = scanAgent(tx.db.QueryRow(ctx, `
			INSERT INTO agents AS a (project_id, user_id, name, description, idempotency_key, request_hash)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING `+agentCols,
			p.ProjectID, p.UserID, p.Name, p.Description, p.IdempotencyKey, p.RequestHash))
		if err != nil {
			if isUniqueViolation(err) {
				// Check if it's the idempotency key race
				if ex, ferr := scanAgent(tx.db.QueryRow(ctx, `
					SELECT `+agentCols+` FROM agents a
					WHERE a.project_id = $1 AND a.idempotency_key = $2 AND a.deleted_at IS NULL`,
					p.ProjectID, p.IdempotencyKey)); ferr == nil {
					if ex.RequestHash != p.RequestHash {
						return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
					}
					var rev *AgentRevision
					if ex.CurrentRevisionID != nil {
						rev, ferr = scanRevision(tx.db.QueryRow(ctx, `
							SELECT `+revisionCols+` FROM agent_revisions r WHERE r.id = $1`, *ex.CurrentRevisionID))
						if ferr != nil {
							return fmt.Errorf("platformdb: fetch current revision: %w", ferr)
						}
					}
					if rev == nil {
						return errors.New("platformdb: existing agent has no current revision")
					}
					res = &CreateAgentResult{Agent: *ex, Revision: *rev, Created: false}
					return nil
				}
				return fmt.Errorf("%w: agent name %q already exists in project", ErrConflict, p.Name)
			}
			return fmt.Errorf("platformdb: insert agent: %w", err)
		}

		// 4. Insert initial revision
		var rev *AgentRevision
		rev, err = scanRevision(tx.db.QueryRow(ctx, `
			INSERT INTO agent_revisions AS r (agent_id, revision_number, config, config_hash, idempotency_key, request_hash, created_by_user_id)
			VALUES ($1, 1, $2, $3, $4, $5, $6)
			RETURNING `+revisionCols,
			agent.ID, cfgBytes, p.ConfigHash, p.IdempotencyKey, p.RequestHash, p.UserID))
		if err != nil {
			return fmt.Errorf("platformdb: insert initial revision: %w", err)
		}

		// 5. Update agent current_revision_id
		_, err = tx.db.Exec(ctx, `
			UPDATE agents SET current_revision_id = $1, updated_at = now()
			WHERE id = $2`, rev.ID, agent.ID)
		if err != nil {
			return fmt.Errorf("platformdb: set agent current revision: %w", err)
		}
		agent.CurrentRevisionID = &rev.ID

		res = &CreateAgentResult{Agent: *agent, Revision: *rev, Created: true}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// ListAgentsForProject returns a page of agents for a user's project.
func (s *Store) ListAgentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp ListParams) (Page[AgentSummary], error) {
	limit := lp.limit()
	curT, curID, err := decodeOptionalCursor(lp.Cursor)
	if err != nil {
		return Page[AgentSummary]{}, err
	}

	// Verify project ownership
	if err := s.requireProject(ctx, userID, projectID); err != nil {
		return Page[AgentSummary]{}, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT `+agentCols+`,
			r.revision_number,
			act.id AS active_deployment_id,
			act.status AS active_deployment_status
		FROM agents a
		LEFT JOIN agent_revisions r ON r.id = a.current_revision_id
		LEFT JOIN LATERAL (
			SELECT d.id, d.status FROM agent_deployments d
			WHERE d.agent_id = a.id AND d.status = 'active'
			ORDER BY d.created_at DESC, d.id DESC LIMIT 1
		) act ON TRUE
		WHERE a.project_id = $1 AND a.user_id = $2 AND a.deleted_at IS NULL
		  AND ($3::timestamptz IS NULL OR (a.created_at, a.id) < ($3, $4::uuid))
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $5`,
		projectID, userID, curT, curID, limit+1)
	if err != nil {
		return Page[AgentSummary]{}, fmt.Errorf("platformdb: list agents: %w", err)
	}
	defer rows.Close()

	var items []AgentSummary
	for rows.Next() {
		var a Agent
		var revNum *int
		var actDepID *uuid.UUID
		var actStatus *AgentDeploymentStatus
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.UserID, &a.Name, &a.Description, &a.CurrentRevisionID,
			&a.IdempotencyKey, &a.RequestHash, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt,
			&revNum, &actDepID, &actStatus); err != nil {
			return Page[AgentSummary]{}, fmt.Errorf("platformdb: scan agent summary: %w", err)
		}
		items = append(items, AgentSummary{
			Agent:                  a,
			CurrentRevisionNumber:  revNum,
			ActiveDeploymentID:     actDepID,
			ActiveDeploymentStatus: actStatus,
		})
	}
	if err := rows.Err(); err != nil {
		return Page[AgentSummary]{}, fmt.Errorf("platformdb: list agents rows: %w", err)
	}

	return pageOf(items, limit, func(s AgentSummary) (time.Time, uuid.UUID) { return s.CreatedAt, s.ID }), nil
}

// GetAgentForUser returns the agent details if owned by the user.
func (s *Store) GetAgentForUser(ctx context.Context, userID, agentID uuid.UUID) (*AgentDetail, error) {
	row := s.db.QueryRow(ctx, `
		SELECT `+agentCols+`
		FROM agents a
		JOIN projects p ON p.id = a.project_id
		WHERE a.id = $1 AND p.user_id = $2 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
		agentID, userID)
	agent, err := scanAgent(row)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}

	detail := &AgentDetail{Agent: *agent}
	if agent.CurrentRevisionID != nil {
		revRow := s.db.QueryRow(ctx, `
			SELECT `+revisionCols+` FROM agent_revisions r WHERE r.id = $1`, *agent.CurrentRevisionID)
		if rev, err := scanRevision(revRow); err == nil {
			detail.CurrentRevision = rev
		}
	}

	depRow := s.db.QueryRow(ctx, `
		SELECT `+agentDeploymentCols+` FROM agent_deployments d
		WHERE d.agent_id = $1 AND d.status = 'active'
		ORDER BY d.created_at DESC, d.id DESC LIMIT 1`, agent.ID)
	if dep, err := scanAgentDeployment(depRow); err == nil {
		detail.ActiveDeployment = dep
	}

	return detail, nil
}

// CreateAgentRevision adds a new immutable revision to an agent definition.
// Idempotency is keyed by (agent_id, IdempotencyKey).
func (s *Store) CreateAgentRevision(ctx context.Context, p CreateRevisionParams) (*AgentRevision, bool, error) {
	if strings.TrimSpace(p.Config.Model) == "" {
		return nil, false, invalidArg("model is required")
	}
	p.IdempotencyKey = strings.TrimSpace(p.IdempotencyKey)
	if p.IdempotencyKey == "" || len(p.IdempotencyKey) > 128 {
		return nil, false, invalidArg("idempotency key is required (max 128 chars)")
	}
	if p.RequestHash == "" {
		return nil, false, invalidArg("request hash is required")
	}

	cfgBytes, err := json.Marshal(p.Config)
	if err != nil {
		return nil, false, fmt.Errorf("platformdb: marshal revision config: %w", err)
	}

	var rev *AgentRevision
	var created bool
	err = s.WithTx(ctx, func(tx *Store) error {
		// 1. Verify agent ownership
		var agentID uuid.UUID
		err := tx.db.QueryRow(ctx, `
			SELECT a.id FROM agents a
			JOIN projects p ON p.id = a.project_id
			WHERE a.id = $1 AND p.user_id = $2 AND a.deleted_at IS NULL AND p.deleted_at IS NULL
			FOR UPDATE OF a`,
			p.AgentID, p.UserID).Scan(&agentID)
		if err != nil {
			return notFoundIfNoRows(err)
		}

		// 2. Check existing revision by (agent_id, idempotency_key)
		existing, err := scanRevision(tx.db.QueryRow(ctx, `
			SELECT `+revisionCols+` FROM agent_revisions r
			WHERE r.agent_id = $1 AND r.idempotency_key = $2`,
			p.AgentID, p.IdempotencyKey))
		if err == nil {
			if existing.RequestHash != p.RequestHash {
				return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
			}
			rev = existing
			created = false
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("platformdb: check existing revision: %w", err)
		}

		// 3. Next revision number
		var nextRevNum int
		err = tx.db.QueryRow(ctx, `
			SELECT COALESCE(MAX(revision_number), 0) + 1
			FROM agent_revisions WHERE agent_id = $1`, p.AgentID).Scan(&nextRevNum)
		if err != nil {
			return fmt.Errorf("platformdb: calculate next revision number: %w", err)
		}

		// 4. Insert revision
		rev, err = scanRevision(tx.db.QueryRow(ctx, `
			INSERT INTO agent_revisions AS r (agent_id, revision_number, config, config_hash, idempotency_key, request_hash, created_by_user_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING `+revisionCols,
			p.AgentID, nextRevNum, cfgBytes, p.ConfigHash, p.IdempotencyKey, p.RequestHash, p.UserID))
		if err != nil {
			if isUniqueViolation(err) {
				// Concurrency race: check idempotency
				if ex, ferr := scanRevision(tx.db.QueryRow(ctx, `
					SELECT `+revisionCols+` FROM agent_revisions r
					WHERE r.agent_id = $1 AND r.idempotency_key = $2`, p.AgentID, p.IdempotencyKey)); ferr == nil {
					if ex.RequestHash != p.RequestHash {
						return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
					}
					rev = ex
					created = false
					return nil
				}
			}
			return fmt.Errorf("platformdb: insert revision: %w", err)
		}

		// 5. Update agent current_revision_id
		_, err = tx.db.Exec(ctx, `
			UPDATE agents SET current_revision_id = $1, updated_at = now()
			WHERE id = $2`, rev.ID, p.AgentID)
		if err != nil {
			return fmt.Errorf("platformdb: update current revision on agent: %w", err)
		}

		created = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return rev, created, nil
}

// ListAgentRevisions lists all immutable revisions for an agent, newest first.
func (s *Store) ListAgentRevisions(ctx context.Context, userID, agentID uuid.UUID) ([]AgentRevision, error) {
	// Verify agent ownership
	var dummy uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT a.id FROM agents a
		JOIN projects p ON p.id = a.project_id
		WHERE a.id = $1 AND p.user_id = $2 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
		agentID, userID).Scan(&dummy)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT `+revisionCols+` FROM agent_revisions r
		WHERE r.agent_id = $1
		ORDER BY r.revision_number DESC`, agentID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list revisions: %w", err)
	}
	defer rows.Close()

	var revisions []AgentRevision
	for rows.Next() {
		rev, err := scanRevision(rows)
		if err != nil {
			return nil, err
		}
		revisions = append(revisions, *rev)
	}
	return revisions, rows.Err()
}

// CreateAgentDeployment creates an agent deployment pinned to an immutable revision and environment,
// and transactionally inserts a provisioning outbox event.
// Keyed by (agent_id, environment_id, IdempotencyKey).
func (s *Store) CreateAgentDeployment(ctx context.Context, p CreateAgentDeploymentParams) (*AgentDeployment, bool, error) {
	p.IdempotencyKey = strings.TrimSpace(p.IdempotencyKey)
	if p.IdempotencyKey == "" || len(p.IdempotencyKey) > 128 {
		return nil, false, invalidArg("idempotency key is required (max 128 chars)")
	}
	if p.RequestHash == "" {
		return nil, false, invalidArg("request hash is required")
	}
	if p.RuntimeVersion == "" {
		p.RuntimeVersion = "v1"
	}

	var dep *AgentDeployment
	var created bool
	err := s.WithTx(ctx, func(tx *Store) error {
		// 1. Verify agent, environment, revision belong to the user's project
		var projID uuid.UUID
		var envMatch, revMatch bool
		err := tx.db.QueryRow(ctx, `
			SELECT a.project_id,
			       (e.id IS NOT NULL) AS env_match,
			       (r.id IS NOT NULL) AS rev_match
			FROM agents a
			JOIN projects p ON p.id = a.project_id
			LEFT JOIN environments e ON e.id = $3 AND e.project_id = a.project_id AND e.deleted_at IS NULL
			LEFT JOIN agent_revisions r ON r.id = $4 AND r.agent_id = a.id
			WHERE a.id = $1 AND p.user_id = $2 AND a.deleted_at IS NULL AND p.deleted_at IS NULL
			FOR UPDATE OF a`,
			p.AgentID, p.UserID, p.EnvironmentID, p.AgentRevisionID).Scan(&projID, &envMatch, &revMatch)
		if err != nil {
			return notFoundIfNoRows(err)
		}
		if !envMatch {
			return fmt.Errorf("%w: environment does not belong to agent's project", ErrInvalidArgument)
		}
		if !revMatch {
			return fmt.Errorf("%w: revision does not belong to agent", ErrInvalidArgument)
		}

		// 2. Check existing deployment by (agent_id, environment_id, idempotency_key)
		existing, err := scanAgentDeployment(tx.db.QueryRow(ctx, `
			SELECT `+agentDeploymentCols+` FROM agent_deployments d
			WHERE d.agent_id = $1 AND d.environment_id = $2 AND d.idempotency_key = $3`,
			p.AgentID, p.EnvironmentID, p.IdempotencyKey))
		if err == nil {
			if existing.RequestHash != p.RequestHash {
				return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
			}
			dep = existing
			created = false
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("platformdb: check existing deployment: %w", err)
		}

		// 3. Monotonic deployment number
		var nextDepNum int
		err = tx.db.QueryRow(ctx, `
			SELECT COALESCE(MAX(deployment_number), 0) + 1
			FROM agent_deployments WHERE agent_id = $1 AND environment_id = $2`,
			p.AgentID, p.EnvironmentID).Scan(&nextDepNum)
		if err != nil {
			return fmt.Errorf("platformdb: calculate next deployment number: %w", err)
		}

		// 4. Find supersedes_deployment_id if active deployment exists
		var supersedesID *uuid.UUID
		var actID uuid.UUID
		if err := tx.db.QueryRow(ctx, `
			SELECT id FROM agent_deployments
			WHERE agent_id = $1 AND environment_id = $2 AND status = 'active'
			LIMIT 1`, p.AgentID, p.EnvironmentID).Scan(&actID); err == nil {
			supersedesID = &actID
		}

		// 5. Insert deployment
		dep, err = scanAgentDeployment(tx.db.QueryRow(ctx, `
			INSERT INTO agent_deployments AS d (
				agent_id, agent_revision_id, project_id, environment_id,
				deployment_number, idempotency_key, request_hash,
				supersedes_deployment_id, runtime_version, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'provisioning')
			RETURNING `+agentDeploymentCols,
			p.AgentID, p.AgentRevisionID, projID, p.EnvironmentID,
			nextDepNum, p.IdempotencyKey, p.RequestHash,
			supersedesID, p.RuntimeVersion))
		if err != nil {
			if isUniqueViolation(err) {
				// Concurrency race: check idempotency
				if ex, ferr := scanAgentDeployment(tx.db.QueryRow(ctx, `
					SELECT `+agentDeploymentCols+` FROM agent_deployments d
					WHERE d.agent_id = $1 AND d.environment_id = $2 AND d.idempotency_key = $3`,
					p.AgentID, p.EnvironmentID, p.IdempotencyKey)); ferr == nil {
					if ex.RequestHash != p.RequestHash {
						return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
					}
					dep = ex
					created = false
					return nil
				}
			}
			return fmt.Errorf("platformdb: insert agent deployment: %w", err)
		}

		// 6. Insert outbox event transactionally (NO plaintext secrets, NO prompts)
		payload, err := NewAgentDeploymentProvisionPayload(AgentDeploymentProvisionPayload{
			AgentID:         dep.AgentID,
			DeploymentID:    dep.ID,
			ProjectID:       dep.ProjectID,
			EnvironmentID:   dep.EnvironmentID,
			AgentRevisionID: dep.AgentRevisionID,
			RuntimeVersion:  dep.RuntimeVersion,
			Status:          dep.Status,
		})
		if err != nil {
			return fmt.Errorf("platformdb: marshal outbox payload: %w", err)
		}

		_, err = tx.db.Exec(ctx, `
			INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
			VALUES ($1, $2, $3, $4, 'pending')`,
			OutboxAggregateAgentDeployment, dep.ID, OutboxEventAgentDeploymentProvision, payload)
		if err != nil {
			return fmt.Errorf("platformdb: insert outbox event: %w", err)
		}

		created = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return dep, created, nil
}

// GetAgentDeploymentForUser returns an agent deployment if owned by the user.
func (s *Store) GetAgentDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*AgentDeployment, error) {
	row := s.db.QueryRow(ctx, `
		SELECT `+agentDeploymentCols+`
		FROM agent_deployments d
		JOIN projects p ON p.id = d.project_id
		WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
		deploymentID, userID)
	dep, err := scanAgentDeployment(row)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return dep, nil
}

// ListAgentDeploymentsForAgent lists deployments for an agent owned by the user.
func (s *Store) ListAgentDeploymentsForAgent(ctx context.Context, userID, agentID uuid.UUID) ([]AgentDeployment, error) {
	var dummy uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT a.id FROM agents a
		JOIN projects p ON p.id = a.project_id
		WHERE a.id = $1 AND p.user_id = $2 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
		agentID, userID).Scan(&dummy)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT `+agentDeploymentCols+`
		FROM agent_deployments d
		WHERE d.agent_id = $1
		ORDER BY d.deployment_number DESC`, agentID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list agent deployments: %w", err)
	}
	defer rows.Close()

	var deps []AgentDeployment
	for rows.Next() {
		d, err := scanAgentDeployment(rows)
		if err != nil {
			return nil, err
		}
		deps = append(deps, *d)
	}
	return deps, rows.Err()
}

// CreateAgentSession creates an independent session for an agent deployment and transactionally
// enqueues an agent.session.ensure.requested outbox record.
// Keyed by (deployment_id, IdempotencyKey).
func (s *Store) CreateAgentSession(ctx context.Context, p CreateAgentSessionParams) (*AgentSession, bool, error) {
	p.IdempotencyKey = strings.TrimSpace(p.IdempotencyKey)
	if p.IdempotencyKey == "" || len(p.IdempotencyKey) > 128 {
		return nil, false, invalidArg("idempotency key is required (max 128 chars)")
	}
	if p.RequestHash == "" {
		return nil, false, invalidArg("request hash is required")
	}

	var sess *AgentSession
	var created bool
	err := s.WithTx(ctx, func(tx *Store) error {
		// 1. Verify deployment belongs to user
		var projID uuid.UUID
		err := tx.db.QueryRow(ctx, `
			SELECT d.project_id
			FROM agent_deployments d
			JOIN projects p ON p.id = d.project_id
			WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL
			FOR UPDATE OF d`,
			p.DeploymentID, p.UserID).Scan(&projID)
		if err != nil {
			return notFoundIfNoRows(err)
		}

		// 2. Check existing session by (deployment_id, idempotency_key)
		existing, err := scanAgentSession(tx.db.QueryRow(ctx, `
			SELECT `+agentSessionCols+` FROM agent_sessions s
			WHERE s.deployment_id = $1 AND s.idempotency_key = $2`,
			p.DeploymentID, p.IdempotencyKey))
		if err == nil {
			if existing.RequestHash != p.RequestHash {
				return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
			}
			sess = existing
			created = false
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("platformdb: check existing session: %w", err)
		}

		// 3. Insert session
		sess, err = scanAgentSession(tx.db.QueryRow(ctx, `
			INSERT INTO agent_sessions AS s (
				deployment_id, pi_conversation_id, actor_key_version,
				idempotency_key, request_hash, status, created_by_user_id
			) VALUES ($1, NULL, 'v1', $2, $3, 'provisioning', $4)
			RETURNING `+agentSessionCols,
			p.DeploymentID, p.IdempotencyKey, p.RequestHash, p.UserID))
		if err != nil {
			if isUniqueViolation(err) {
				// Concurrency race: check idempotency
				if ex, ferr := scanAgentSession(tx.db.QueryRow(ctx, `
					SELECT `+agentSessionCols+` FROM agent_sessions s
					WHERE s.deployment_id = $1 AND s.idempotency_key = $2`,
					p.DeploymentID, p.IdempotencyKey)); ferr == nil {
					if ex.RequestHash != p.RequestHash {
						return fmt.Errorf("%w: idempotency key %q reused with different request payload", ErrConflict, p.IdempotencyKey)
					}
					sess = ex
					created = false
					return nil
				}
			}
			return fmt.Errorf("platformdb: insert agent session: %w", err)
		}

		// 4. Insert outbox record: agent.session.ensure.requested
		// Actor key tuple per ADR 0001: ["summit-agent-v1", project_id, deployment_id, session_id]
		actorKey := []string{
			"summit-agent-v1",
			projID.String(),
			sess.DeploymentID.String(),
			sess.ID.String(),
		}
		payload, err := NewAgentSessionEnsurePayload(AgentSessionEnsurePayload{
			ProjectID:    projID,
			DeploymentID: sess.DeploymentID,
			SessionID:    sess.ID,
			ActorKey:     actorKey,
			Status:       sess.Status,
		})
		if err != nil {
			return fmt.Errorf("platformdb: marshal session ensure payload: %w", err)
		}

		_, err = tx.db.Exec(ctx, `
			INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
			VALUES ($1, $2, $3, $4, 'pending')`,
			OutboxAggregateAgentSession, sess.ID, OutboxEventAgentSessionEnsure, payload)
		if err != nil {
			return fmt.Errorf("platformdb: insert session outbox event: %w", err)
		}

		created = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return sess, created, nil
}

// GetAgentSessionForUser returns an agent session if owned by the user.
func (s *Store) GetAgentSessionForUser(ctx context.Context, userID, sessionID uuid.UUID) (*AgentSession, error) {
	row := s.db.QueryRow(ctx, `
		SELECT `+agentSessionCols+`
		FROM agent_sessions s
		JOIN agent_deployments d ON d.id = s.deployment_id
		JOIN projects p ON p.id = d.project_id
		WHERE s.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
		sessionID, userID)
	sess, err := scanAgentSession(row)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return sess, nil
}

// ListAgentSessionsForDeployment lists all sessions for a deployment owned by the user.
func (s *Store) ListAgentSessionsForDeployment(ctx context.Context, userID, deploymentID uuid.UUID) ([]AgentSession, error) {
	var dummy uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT d.id
		FROM agent_deployments d
		JOIN projects p ON p.id = d.project_id
		WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
		deploymentID, userID).Scan(&dummy)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT `+agentSessionCols+`
		FROM agent_sessions s
		WHERE s.deployment_id = $1
		ORDER BY s.created_at DESC`, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list agent sessions: %w", err)
	}
	defer rows.Close()

	var sessions []AgentSession
	for rows.Next() {
		sess, err := scanAgentSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, *sess)
	}
	return sessions, rows.Err()
}
