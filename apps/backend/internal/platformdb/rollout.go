package platformdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Limits for ListActiveDeployments.
const (
	DefaultActiveLimit = 200
	MaxActiveLimit     = 1000
)

// ActiveDeployment is one in-flight deployment with everything the
// orchestrator monitor needs to drive it without further queries.
type ActiveDeployment struct {
	Deployment Deployment // includes Status and CancelRequestedAt
	BuildJob   BuildJob

	UserID          uuid.UUID // tenant (namespace tenant-<UserID>)
	ProjectID       uuid.UUID
	ProjectSlug     string
	EnvironmentID   uuid.UUID
	EnvironmentName string
	ServiceID       uuid.UUID
	ServiceName     string
	ServiceType     string
	RepoFullName    string // empty if the source repository row is gone
	RepoOwnerLogin  string

	Resources ServiceResources // defaults applied when the service has no row
}

// ListActiveDeployments returns in-flight deployments (queued, building,
// image_ready, deploying, health_checking), oldest first, joined with their
// build job, service, project, environment, repository owner and resources.
// Deployments without a service or build job are skipped (they cannot be
// driven). Soft-deleted projects are included so the orchestrator can clean
// them up. limit <= 0 means DefaultActiveLimit; capped at MaxActiveLimit.
func (s *Store) ListActiveDeployments(ctx context.Context, limit int) ([]ActiveDeployment, error) {
	switch {
	case limit <= 0:
		limit = DefaultActiveLimit
	case limit > MaxActiveLimit:
		limit = MaxActiveLimit
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+deploymentCols+`,
		       `+buildJobCols+`,
		       p.user_id, p.id, p.slug, e.id, e.name, sv.id, sv.name, sv.type,
		       COALESCE(r.full_name, ''), COALESCE(r.owner_login, ''),
		       COALESCE(sr.cpu_request_millicores, 100), COALESCE(sr.cpu_limit_millicores, 500),
		       COALESCE(sr.memory_request_mb, 128), COALESCE(sr.memory_limit_mb, 512),
		       COALESCE(sr.min_replicas, 1), COALESCE(sr.max_replicas, 5), COALESCE(sr.port, 8080)
		FROM deployments d
		JOIN build_jobs b ON b.deployment_id = d.id
		JOIN services sv ON sv.id = d.service_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		LEFT JOIN github_repositories r ON r.id = b.repository_id
		LEFT JOIN service_resources sr ON sr.service_id = sv.id
		WHERE d.status = ANY($1::text[]::deployment_status[])
		ORDER BY d.created_at, d.id
		LIMIT $2`, statusStrings(InFlightStatuses), limit)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list active deployments: %w", err)
	}
	defer rows.Close()
	var out []ActiveDeployment
	for rows.Next() {
		var a ActiveDeployment
		d, b := &a.Deployment, &a.BuildJob
		r := &a.Resources
		if err := rows.Scan(
			&d.ID, &d.ProjectID, &d.EnvironmentID, &d.ServiceID, &d.ServiceSourceID, &d.CommitSHA, &d.Branch,
			&d.Ref, &d.Status, &d.TriggerType, &d.TriggerEventID, &d.TriggeredByUserID, &d.IdempotencyKey, &d.ErrorMessage,
			&d.StatusReason, &d.ImageRef, &d.PublicURL, &d.CancelRequestedAt, &d.StartedAt, &d.FinishedAt, &d.CreatedAt, &d.UpdatedAt,
			&b.ID, &b.DeploymentID, &b.ServiceSourceID, &b.RepositoryID, &b.CommitSHA, &b.Ref, &b.Status, &b.BuilderType,
			&b.AttemptID, &b.PodName, &b.ImageRepository, &b.ImageTag, &b.ImageDigest, &b.CurrentStage, &b.ErrorMessage,
			&b.TimeoutSeconds, &b.RequestedAt, &b.DispatchedAt, &b.StartedAt, &b.CompletedAt, &b.LastHeartbeatAt, &b.CreatedAt, &b.UpdatedAt,
			&a.UserID, &a.ProjectID, &a.ProjectSlug, &a.EnvironmentID, &a.EnvironmentName, &a.ServiceID, &a.ServiceName, &a.ServiceType,
			&a.RepoFullName, &a.RepoOwnerLogin,
			&r.CPURequestMillicores, &r.CPULimitMillicores, &r.MemoryRequestMB, &r.MemoryLimitMB,
			&r.MinReplicas, &r.MaxReplicas, &r.Port,
		); err != nil {
			return nil, fmt.Errorf("platformdb: scan active deployment: %w", err)
		}
		r.ServiceID = a.ServiceID
		out = append(out, a)
	}
	return out, rows.Err()
}

// PromoteResult is the outcome of PromoteRelease.
type PromoteResult struct {
	Release Release
	// SupersededDeploymentIDs lists the previously running deployments of the
	// same service that were moved to superseded by this call.
	SupersededDeploymentIDs []uuid.UUID
	// Created is false when the deployment already had a release (replay).
	Created bool
}

// PromoteRelease records a release for a deployment that has reached running.
// In one transaction it: creates the release (release_number = max+1 within
// the environment, serialised by a lock on the environment row), marks it
// active and deactivates the service's previous active releases, and moves the
// service's other running deployments to superseded (status_reason, finished_at
// and a deployment_events row each).
//
// Idempotent per deployment: a repeat returns the existing release with
// Created=false. The deployment must be in status running (ErrInvalidTransition
// otherwise; checked after the replay lookup). ErrNotFound if unknown;
// ErrInvalidArgument if configSnapshot is not valid JSON or the deployment has
// no service.
//
// Deviation note: "active" is tracked per service, not per environment, because
// an environment may hold several services whose releases are independent.
func (s *Store) PromoteRelease(ctx context.Context, deploymentID uuid.UUID, configSnapshot json.RawMessage) (*PromoteResult, error) {
	if len(configSnapshot) == 0 {
		configSnapshot = json.RawMessage(`{}`)
	}
	if !json.Valid(configSnapshot) {
		return nil, invalidArg("config snapshot is not valid JSON")
	}
	var res *PromoteResult
	err := s.WithTx(ctx, func(tx *Store) error {
		var envID uuid.UUID
		var serviceID *uuid.UUID
		var status DeploymentStatus
		if err := tx.db.QueryRow(ctx, `
			SELECT environment_id, service_id, status FROM deployments WHERE id = $1 FOR UPDATE`, deploymentID).
			Scan(&envID, &serviceID, &status); err != nil {
			return notFoundIfNoRows(err)
		}

		existing, err := tx.releaseByDeployment(ctx, deploymentID)
		if err != nil {
			return err
		}
		if existing != nil {
			res = &PromoteResult{Release: *existing, Created: false}
			return nil
		}
		if status != DeploymentRunning {
			return fmt.Errorf("%w: deployment %s is %s, not running", ErrInvalidTransition, deploymentID, status)
		}
		if serviceID == nil {
			return invalidArg("deployment has no service")
		}

		// Serialise release numbering per environment.
		if _, err := tx.db.Exec(ctx, `SELECT 1 FROM environments WHERE id = $1 FOR UPDATE`, envID); err != nil {
			return fmt.Errorf("platformdb: lock environment: %w", err)
		}

		if _, err := tx.db.Exec(ctx, `
			UPDATE releases r SET is_active = FALSE
			FROM deployments d2
			WHERE r.is_active AND r.environment_id = $1
			  AND d2.id = r.deployment_id AND d2.service_id = $2`, envID, *serviceID); err != nil {
			return fmt.Errorf("platformdb: deactivate releases: %w", err)
		}

		var rel Release
		err = tx.db.QueryRow(ctx, `
			INSERT INTO releases (environment_id, deployment_id, release_number, config_snapshot, is_active)
			SELECT $1, $2, COALESCE(MAX(release_number), 0) + 1, $3, TRUE FROM releases WHERE environment_id = $1
			RETURNING id, environment_id, deployment_id, release_number, config_snapshot, is_active, created_at`,
			envID, deploymentID, []byte(configSnapshot)).
			Scan(&rel.ID, &rel.EnvironmentID, &rel.DeploymentID, &rel.ReleaseNumber, &rel.ConfigSnapshot, &rel.IsActive, &rel.CreatedAt)
		if err != nil {
			return fmt.Errorf("platformdb: insert release: %w", err)
		}

		reason := "superseded by deployment " + deploymentID.String()
		rows, err := tx.db.Query(ctx, `
			WITH sup AS (
				UPDATE deployments
				SET status = 'superseded', status_reason = $3, finished_at = COALESCE(finished_at, now())
				WHERE service_id = $1 AND id <> $2 AND status = 'running'
				RETURNING id
			), ev AS (
				INSERT INTO deployment_events (deployment_id, from_status, to_status, reason)
				SELECT id, 'running', 'superseded', $3 FROM sup
			)
			SELECT id FROM sup ORDER BY id`, *serviceID, deploymentID, reason)
		if err != nil {
			return fmt.Errorf("platformdb: supersede deployments: %w", err)
		}
		var superseded []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return fmt.Errorf("platformdb: scan superseded id: %w", err)
			}
			superseded = append(superseded, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return fmt.Errorf("platformdb: supersede deployments: %w", err)
		}
		res = &PromoteResult{Release: rel, SupersededDeploymentIDs: superseded, Created: true}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Store) releaseByDeployment(ctx context.Context, deploymentID uuid.UUID) (*Release, error) {
	var rel Release
	err := s.db.QueryRow(ctx, `
		SELECT id, environment_id, deployment_id, release_number, config_snapshot, is_active, created_at
		FROM releases WHERE deployment_id = $1`, deploymentID).
		Scan(&rel.ID, &rel.EnvironmentID, &rel.DeploymentID, &rel.ReleaseNumber, &rel.ConfigSnapshot, &rel.IsActive, &rel.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("platformdb: lookup release: %w", err)
	}
	return &rel, nil
}
