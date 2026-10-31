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

const deploymentCols = `d.id, d.project_id, d.environment_id, d.service_id, d.service_source_id, d.git_commit_sha, d.git_branch,
	d.ref, d.status, d.trigger_type, d.trigger_event_id, d.triggered_by_user_id, d.idempotency_key, d.error_message,
	d.status_reason, d.image_ref, d.public_url, d.cancel_requested_at, d.started_at, d.finished_at, d.created_at, d.updated_at`

func scanDeployment(row pgx.Row) (*Deployment, error) {
	var d Deployment
	if err := row.Scan(&d.ID, &d.ProjectID, &d.EnvironmentID, &d.ServiceID, &d.ServiceSourceID, &d.CommitSHA, &d.Branch,
		&d.Ref, &d.Status, &d.TriggerType, &d.TriggerEventID, &d.TriggeredByUserID, &d.IdempotencyKey, &d.ErrorMessage,
		&d.StatusReason, &d.ImageRef, &d.PublicURL, &d.CancelRequestedAt, &d.StartedAt, &d.FinishedAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	return &d, nil
}

const buildJobCols = `b.id, b.deployment_id, b.service_source_id, b.repository_id, b.commit_sha, b.ref, b.status, b.builder_type,
	b.attempt_id, b.pod_name, b.image_repository, b.image_tag, b.oci_image_digest, b.current_stage, b.error_message,
	b.timeout_seconds, b.requested_at, b.dispatched_at, b.started_at, b.completed_at, b.last_heartbeat_at, b.created_at, b.updated_at`

func scanBuildJob(row pgx.Row) (*BuildJob, error) {
	var b BuildJob
	if err := row.Scan(&b.ID, &b.DeploymentID, &b.ServiceSourceID, &b.RepositoryID, &b.CommitSHA, &b.Ref, &b.Status, &b.BuilderType,
		&b.AttemptID, &b.PodName, &b.ImageRepository, &b.ImageTag, &b.ImageDigest, &b.CurrentStage, &b.ErrorMessage,
		&b.TimeoutSeconds, &b.RequestedAt, &b.DispatchedAt, &b.StartedAt, &b.CompletedAt, &b.LastHeartbeatAt, &b.CreatedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

// CreateDeploymentParams is the input to CreateDeploymentWithOutbox.
type CreateDeploymentParams struct {
	UserID            uuid.UUID  // owner of the service's project (tenant); verified
	ServiceID         uuid.UUID  // must belong to UserID and have an active service source
	IdempotencyKey    string     // unique per project; generated when empty
	TriggerType       string     // TriggerManual (default) or TriggerGitHubPush
	TriggeredByUserID *uuid.UUID // actor for manual deploys; nil for webhooks
	TriggerEventID    *uuid.UUID // github_webhook_events.id for pushes; deduplicates per service
	CommitSHA         string     // exact commit, required
	Branch            string     // required
	Ref               string     // defaults to Branch
}

// CreateDeploymentResult is returned by CreateDeploymentWithOutbox.
type CreateDeploymentResult struct {
	Deployment Deployment
	BuildJob   BuildJob
	// Created is false when an existing deployment was returned for a repeated
	// idempotency key (or webhook trigger event); nothing was written then.
	Created bool
}

type sourceHierarchy struct {
	ServiceID      uuid.UUID
	EnvironmentID  uuid.UUID
	ProjectID      uuid.UUID
	SourceID       *uuid.UUID
	RepositoryID   *uuid.UUID
	RootDirectory  *string
	DockerfilePath *string
	BuildConfig    []byte
	SourceStatus   *string
	GitHubRepoID   *int64
	RepoFullName   *string
	InstallStatus  *string
}

// CreateDeploymentWithOutbox atomically inserts, in one transaction:
//
//	deployments (status queued) + build_jobs (status queued) +
//	outbox_events ('deployment.build.requested', aggregate 'deployment', pending) +
//	deployment_events (NULL -> queued)
//
// and records last_seen_commit_sha/last_deployment_id on the service source.
// Repository, root directory, Dockerfile path and build configuration are read
// from the service source, never from the caller.
//
// Idempotent on (project_id, IdempotencyKey): a repeat returns the existing
// deployment and build job with Created=false and writes nothing. Reusing a
// key for a different service returns ErrConflict. Errors: ErrNotFound (service
// not owned/visible), ErrSourceNotConfigured, ErrSourceInactive,
// ErrInvalidArgument.
func (s *Store) CreateDeploymentWithOutbox(ctx context.Context, p CreateDeploymentParams) (*CreateDeploymentResult, error) {
	p.CommitSHA = strings.TrimSpace(p.CommitSHA)
	p.Branch = strings.TrimSpace(p.Branch)
	if p.CommitSHA == "" || len(p.CommitSHA) > 64 {
		return nil, invalidArg("commit sha is required (max 64 chars)")
	}
	if p.Branch == "" || len(p.Branch) > 128 {
		return nil, invalidArg("branch is required (max 128 chars)")
	}
	if p.Ref == "" {
		p.Ref = p.Branch
	}
	if p.TriggerType == "" {
		p.TriggerType = TriggerManual
	}
	if p.IdempotencyKey == "" {
		p.IdempotencyKey = uuid.NewString()
	}
	if len(p.IdempotencyKey) > 128 {
		return nil, invalidArg("idempotency key too long (max 128 chars)")
	}

	var res *CreateDeploymentResult
	err := s.WithTx(ctx, func(tx *Store) error {
		h, err := tx.loadSourceHierarchy(ctx, p.UserID, p.ServiceID)
		if err != nil {
			return err
		}

		// Replay: same key (or same webhook event) -> existing deployment.
		if existing, err := tx.findExistingDeployment(ctx, h.ProjectID, p); err != nil {
			return err
		} else if existing != nil {
			res = existing
			return nil
		}

		if h.SourceID == nil || h.RepositoryID == nil {
			return ErrSourceNotConfigured
		}
		if h.SourceStatus == nil || *h.SourceStatus != "active" || h.InstallStatus == nil || *h.InstallStatus != "active" {
			return ErrSourceInactive
		}

		var buildCfg json.RawMessage = h.BuildConfig
		if len(buildCfg) == 0 {
			buildCfg = json.RawMessage(`{}`)
		}
		snapshot, err := json.Marshal(map[string]any{
			"platform_repository_id": h.RepositoryID.String(),
			"github_repository_id":   deref(h.GitHubRepoID),
			"full_name":              deref(h.RepoFullName),
			"commit_sha":             p.CommitSHA,
			"branch":                 p.Branch,
			"ref":                    p.Ref,
			"root_directory":         deref(h.RootDirectory),
			"dockerfile_path":        h.DockerfilePath,
			"build_configuration":    buildCfg,
			"service_source_id":      h.SourceID.String(),
			"trigger_event_id":       p.TriggerEventID,
		})
		if err != nil {
			return fmt.Errorf("platformdb: marshal source snapshot: %w", err)
		}

		var depID uuid.UUID
		err = tx.db.QueryRow(ctx, `
			INSERT INTO deployments (project_id, environment_id, service_id, service_source_id, git_commit_sha, git_branch,
				status, trigger_type, trigger_event_id, ref, source_snapshot, triggered_by_user_id, idempotency_key)
			VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8, $9, $10, $11, $12)
			ON CONFLICT DO NOTHING
			RETURNING id`,
			h.ProjectID, h.EnvironmentID, h.ServiceID, h.SourceID, p.CommitSHA, p.Branch,
			p.TriggerType, p.TriggerEventID, p.Ref, snapshot, p.TriggeredByUserID, p.IdempotencyKey).Scan(&depID)
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race with a concurrent identical request: return its row.
			existing, ferr := tx.findExistingDeployment(ctx, h.ProjectID, p)
			if ferr != nil {
				return ferr
			}
			if existing == nil {
				return fmt.Errorf("platformdb: deployment insert conflicted but no existing row found")
			}
			res = existing
			return nil
		}
		if err != nil {
			return fmt.Errorf("platformdb: insert deployment: %w", err)
		}

		var jobID uuid.UUID
		if err := tx.db.QueryRow(ctx, `
			INSERT INTO build_jobs (deployment_id, service_source_id, repository_id, commit_sha, ref, status)
			VALUES ($1, $2, $3, $4, $5, 'queued') RETURNING id`,
			depID, h.SourceID, h.RepositoryID, p.CommitSHA, p.Ref).Scan(&jobID); err != nil {
			return fmt.Errorf("platformdb: insert build job: %w", err)
		}

		in := BuildRequestedInput{
			DeploymentID:         depID,
			BuildRunID:           jobID,
			ServiceID:            h.ServiceID,
			ServiceSourceID:      *h.SourceID,
			UserID:               p.UserID,
			ProjectID:            h.ProjectID,
			EnvironmentID:        h.EnvironmentID,
			PlatformRepositoryID: *h.RepositoryID,
			GitHubRepositoryID:   deref(h.GitHubRepoID),
			RepoFullName:         deref(h.RepoFullName),
			Branch:               p.Branch,
			Ref:                  p.Ref,
			CommitSHA:            p.CommitSHA,
			RootDirectory:        deref(h.RootDirectory),
			DockerfilePath:       h.DockerfilePath,
			BuildConfiguration:   buildCfg,
			TriggerType:          p.TriggerType,
			WebhookEventID:       p.TriggerEventID,
		}
		payload, err := NewBuildRequestedPayload(in)
		if err != nil {
			return fmt.Errorf("platformdb: marshal outbox payload: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
			VALUES ($1, $2, $3, $4, 'pending')`,
			OutboxAggregateDeployment, depID, OutboxEventDeploymentBuildRequest, payload); err != nil {
			return fmt.Errorf("platformdb: insert outbox event: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			INSERT INTO deployment_events (deployment_id, from_status, to_status, reason)
			VALUES ($1, NULL, 'queued', $2)`, depID, "deployment created ("+p.TriggerType+")"); err != nil {
			return fmt.Errorf("platformdb: insert deployment event: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			UPDATE service_sources SET last_seen_commit_sha = $1, last_deployment_id = $2 WHERE id = $3`,
			p.CommitSHA, depID, h.SourceID); err != nil {
			return fmt.Errorf("platformdb: update service source: %w", err)
		}

		dep, err := scanDeployment(tx.db.QueryRow(ctx, `SELECT `+deploymentCols+` FROM deployments d WHERE d.id = $1`, depID))
		if err != nil {
			return fmt.Errorf("platformdb: reload deployment: %w", err)
		}
		job, err := scanBuildJob(tx.db.QueryRow(ctx, `SELECT `+buildJobCols+` FROM build_jobs b WHERE b.id = $1`, jobID))
		if err != nil {
			return fmt.Errorf("platformdb: reload build job: %w", err)
		}
		res = &CreateDeploymentResult{Deployment: *dep, BuildJob: *job, Created: true}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}

func (s *Store) loadSourceHierarchy(ctx context.Context, userID, serviceID uuid.UUID) (*sourceHierarchy, error) {
	var h sourceHierarchy
	err := s.db.QueryRow(ctx, `
		SELECT sv.id, e.id, p.id,
		       ss.id, ss.repository_id, ss.root_directory, ss.dockerfile_path, ss.build_configuration, ss.source_status,
		       r.github_repository_id, r.full_name, i.status
		FROM services sv
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		LEFT JOIN service_sources ss ON ss.service_id = sv.id
		LEFT JOIN github_repositories r ON r.id = ss.repository_id
		LEFT JOIN github_installations i ON i.id = r.installation_id
		WHERE sv.id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceID, userID).
		Scan(&h.ServiceID, &h.EnvironmentID, &h.ProjectID,
			&h.SourceID, &h.RepositoryID, &h.RootDirectory, &h.DockerfilePath, &h.BuildConfig, &h.SourceStatus,
			&h.GitHubRepoID, &h.RepoFullName, &h.InstallStatus)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return &h, nil
}

// findExistingDeployment looks up a prior deployment for the same idempotency
// key or webhook trigger event. Returns (nil, nil) when none exists.
func (s *Store) findExistingDeployment(ctx context.Context, projectID uuid.UUID, p CreateDeploymentParams) (*CreateDeploymentResult, error) {
	dep, err := scanDeployment(s.db.QueryRow(ctx, `
		SELECT `+deploymentCols+` FROM deployments d
		WHERE d.project_id = $1 AND d.idempotency_key = $2`, projectID, p.IdempotencyKey))
	if errors.Is(err, pgx.ErrNoRows) && p.TriggerEventID != nil {
		dep, err = scanDeployment(s.db.QueryRow(ctx, `
			SELECT `+deploymentCols+` FROM deployments d
			WHERE d.trigger_event_id = $1 AND d.service_id = $2`, *p.TriggerEventID, p.ServiceID))
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("platformdb: lookup existing deployment: %w", err)
	}
	if dep.ServiceID == nil || *dep.ServiceID != p.ServiceID {
		return nil, fmt.Errorf("%w: idempotency key already used for a different service", ErrConflict)
	}
	job, err := scanBuildJob(s.db.QueryRow(ctx, `SELECT `+buildJobCols+` FROM build_jobs b WHERE b.deployment_id = $1`, dep.ID))
	if err != nil {
		return nil, fmt.Errorf("platformdb: lookup existing build job: %w", err)
	}
	return &CreateDeploymentResult{Deployment: *dep, BuildJob: *job, Created: false}, nil
}

// GetDeploymentForUser returns a deployment owned by userID with its build job
// summary and transition history (oldest first).
func (s *Store) GetDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*DeploymentDetail, error) {
	dep, err := scanDeployment(s.db.QueryRow(ctx, `
		SELECT `+deploymentCols+` FROM deployments d
		JOIN projects p ON p.id = d.project_id
		WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`, deploymentID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	detail := &DeploymentDetail{Deployment: *dep}

	job, err := scanBuildJob(s.db.QueryRow(ctx, `SELECT `+buildJobCols+` FROM build_jobs b WHERE b.deployment_id = $1`, dep.ID))
	switch {
	case err == nil:
		detail.BuildJob = job
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, fmt.Errorf("platformdb: load build job: %w", err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT id, deployment_id, from_status, to_status, reason, created_at
		FROM deployment_events WHERE deployment_id = $1 ORDER BY id`, dep.ID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: load deployment events: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var ev DeploymentEvent
		if err := rows.Scan(&ev.ID, &ev.DeploymentID, &ev.FromStatus, &ev.ToStatus, &ev.Reason, &ev.CreatedAt); err != nil {
			return nil, fmt.Errorf("platformdb: scan deployment event: %w", err)
		}
		detail.Events = append(detail.Events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return detail, nil
}

// ListDeploymentsForProject lists a project's deployments newest first with
// keyset pagination. An unowned or deleted project yields ErrNotFound.
func (s *Store) ListDeploymentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp ListParams) (Page[Deployment], error) {
	limit := lp.limit()
	curT, curID, err := decodeOptionalCursor(lp.Cursor)
	if err != nil {
		return Page[Deployment]{}, err
	}
	if err := s.requireProject(ctx, userID, projectID); err != nil {
		return Page[Deployment]{}, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+deploymentCols+` FROM deployments d
		WHERE d.project_id = $1
		  AND ($2::timestamptz IS NULL OR (d.created_at, d.id) < ($2, $3::uuid))
		ORDER BY d.created_at DESC, d.id DESC
		LIMIT $4`, projectID, curT, curID, limit+1)
	if err != nil {
		return Page[Deployment]{}, fmt.Errorf("platformdb: list deployments: %w", err)
	}
	defer rows.Close()
	var items []Deployment
	for rows.Next() {
		d, err := scanDeployment(rows)
		if err != nil {
			return Page[Deployment]{}, fmt.Errorf("platformdb: scan deployment: %w", err)
		}
		items = append(items, *d)
	}
	if err := rows.Err(); err != nil {
		return Page[Deployment]{}, err
	}
	return pageOf(items, limit, func(d Deployment) (time.Time, uuid.UUID) { return d.CreatedAt, d.ID }), nil
}

// RequestCancel records a user's cancel request (cancel_requested_at) on an
// in-flight deployment (queued/building/image_ready/deploying/health_checking).
// It does not change status: the orchestrator performs the cancellation and
// the transition. Repeat calls are idempotent (the first timestamp is kept).
// Errors: ErrNotFound (not owned), ErrInvalidTransition (running or terminal).
func (s *Store) RequestCancel(ctx context.Context, userID, deploymentID uuid.UUID) (*Deployment, error) {
	d, err := scanDeployment(s.db.QueryRow(ctx, `
		UPDATE deployments d
		SET cancel_requested_at = COALESCE(d.cancel_requested_at, now())
		FROM projects p
		WHERE d.id = $1 AND p.id = d.project_id AND p.user_id = $2 AND p.deleted_at IS NULL
		  AND d.status = ANY($3::text[]::deployment_status[])
		RETURNING `+deploymentCols, deploymentID, userID, statusStrings(InFlightStatuses)))
	if err == nil {
		return d, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("platformdb: request cancel: %w", err)
	}
	var one int
	if err := s.db.QueryRow(ctx, `
		SELECT 1 FROM deployments d JOIN projects p ON p.id = d.project_id
		WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`, deploymentID, userID).Scan(&one); err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return nil, fmt.Errorf("%w: deployment is not in flight", ErrInvalidTransition)
}

// GetDeployment returns a deployment by id without ownership scoping. It is
// for trusted internal callers (orchestrator); API code must use
// GetDeploymentForUser.
func (s *Store) GetDeployment(ctx context.Context, id uuid.UUID) (*Deployment, error) {
	d, err := scanDeployment(s.db.QueryRow(ctx, `SELECT `+deploymentCols+` FROM deployments d WHERE d.id = $1`, id))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return d, nil
}
