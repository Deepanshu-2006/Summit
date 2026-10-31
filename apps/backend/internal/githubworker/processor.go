package githubworker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/githubwebhook"
)

var (
	// ErrEventNotFound is returned when an event ID cannot be found.
	ErrEventNotFound = errors.New("githubworker: event not found")
	// ErrEventLocked is returned when an event is currently locked by another worker.
	ErrEventLocked = errors.New("githubworker: event is currently locked")
)

// webhookEventRecord represents a row claimed from github_webhook_events.
type webhookEventRecord struct {
	ID                   uuid.UUID
	DeliveryID           string
	EventType            string
	Action               *string
	GithubInstallationID *int64
	GithubRepositoryID   *int64
	Payload              []byte
	Attempts             int
}

// ProcessNextEvent claims the oldest unprocessed webhook event using safe SKIP LOCKED semantics,
// processes it according to its event type and action, and marks it processed, ignored, or failed.
// It returns (true, nil) if an event was claimed and processed, (false, nil) if no eligible events were available,
// or (true, err) if processing encountered an error.
func ProcessNextEvent(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer) (bool, error) {
	if pool == nil {
		return false, fmt.Errorf("githubworker: pool is nil")
	}

	claimQuery := `
		WITH next_event AS (
			SELECT id
			FROM github_webhook_events
			WHERE processing_status = 'received'
			  AND (locked_until IS NULL OR locked_until < now())
			  AND (available_at IS NULL OR available_at <= now())
			ORDER BY received_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE github_webhook_events e
		SET processing_status = 'processing',
		    locked_until = now() + INTERVAL '1 minute',
		    attempts = e.attempts + 1
		FROM next_event
		WHERE e.id = next_event.id
		RETURNING e.id, e.github_delivery_id, e.event_type, e.action, e.github_installation_id, e.github_repository_id, e.payload, e.attempts;
	`

	var rec webhookEventRecord
	err := pool.QueryRow(ctx, claimQuery).Scan(
		&rec.ID,
		&rec.DeliveryID,
		&rec.EventType,
		&rec.Action,
		&rec.GithubInstallationID,
		&rec.GithubRepositoryID,
		&rec.Payload,
		&rec.Attempts,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("claiming next webhook event: %w", err)
	}

	procErr := processEventRecord(ctx, pool, ghClient, auditWriter, rec)
	if procErr != nil {
		handleProcessingError(ctx, pool, rec.ID, rec.Attempts, procErr)
		return true, procErr
	}

	return true, nil
}

// ProcessEvent claims and processes a specific webhook event by ID.
func ProcessEvent(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer, eventID uuid.UUID) error {
	if pool == nil {
		return fmt.Errorf("githubworker: pool is nil")
	}

	claimQuery := `
		UPDATE github_webhook_events
		SET processing_status = 'processing',
		    locked_until = now() + INTERVAL '1 minute',
		    attempts = attempts + 1
		WHERE id = $1
		  AND (processing_status = 'received' OR (processing_status = 'processing' AND (locked_until IS NULL OR locked_until < now())))
		RETURNING id, github_delivery_id, event_type, action, github_installation_id, github_repository_id, payload, attempts;
	`

	var rec webhookEventRecord
	err := pool.QueryRow(ctx, claimQuery, eventID).Scan(
		&rec.ID,
		&rec.DeliveryID,
		&rec.EventType,
		&rec.Action,
		&rec.GithubInstallationID,
		&rec.GithubRepositoryID,
		&rec.Payload,
		&rec.Attempts,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// Check whether the event already succeeded, is being processed, or doesn't exist
		var status string
		checkErr := pool.QueryRow(ctx, "SELECT processing_status FROM github_webhook_events WHERE id = $1", eventID).Scan(&status)
		if errors.Is(checkErr, pgx.ErrNoRows) {
			return ErrEventNotFound
		}
		if status == "processed" || status == "ignored" {
			return nil
		}
		return ErrEventLocked
	}
	if err != nil {
		return fmt.Errorf("claiming event %s: %w", eventID, err)
	}

	procErr := processEventRecord(ctx, pool, ghClient, auditWriter, rec)
	if procErr != nil {
		handleProcessingError(ctx, pool, rec.ID, rec.Attempts, procErr)
		return procErr
	}

	return nil
}

func processEventRecord(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer, rec webhookEventRecord) error {
	actionHint := ""
	if rec.Action != nil {
		actionHint = *rec.Action
	}

	ev, err := githubwebhook.Normalize(rec.EventType, actionHint, rec.Payload)
	if err != nil && !githubwebhook.IsUnsupported(err) {
		return markEventFailed(ctx, pool, rec.ID, "malformed_payload", err.Error())
	}
	if ev == nil || ev.Kind == githubwebhook.KindUnsupported {
		return markEventIgnored(ctx, pool, rec.ID, "unsupported_event_type")
	}

	switch ev.Kind {
	case githubwebhook.KindPush:
		return handlePush(ctx, pool, auditWriter, rec, ev)
	case githubwebhook.KindInstallation:
		return handleInstallation(ctx, pool, ghClient, auditWriter, rec, ev)
	case githubwebhook.KindInstallationRepositories:
		return handleInstallationRepositories(ctx, pool, auditWriter, rec, ev)
	default:
		return markEventIgnored(ctx, pool, rec.ID, "unhandled_event_kind")
	}
}

// handlePush processes push events and creates deployments for matching active service sources.
func handlePush(ctx context.Context, pool *pgxpool.Pool, auditWriter audit.Writer, rec webhookEventRecord, ev *githubwebhook.Event) error {
	if ev.Push == nil {
		return markEventIgnored(ctx, pool, rec.ID, "missing_push_data")
	}

	// 1. Ignore deleted branches
	if ev.Push.Deleted {
		return markEventIgnored(ctx, pool, rec.ID, "deleted_branch")
	}

	// 2. Ignore non-branch refs (tags, etc.)
	branch, ok := githubwebhook.BranchFromRef(ev.Push.Ref)
	if !ok || branch == "" {
		return markEventIgnored(ctx, pool, rec.ID, "non_branch_ref")
	}

	// 3. Ignore zero-SHA (null commits)
	afterSHA := ev.Push.After
	if afterSHA == "" || githubwebhook.IsZeroSHA(afterSHA) {
		return markEventIgnored(ctx, pool, rec.ID, "zero_commit_sha")
	}

	// 4. Resolve active installation by GitHub numeric ID
	var instGitHubID int64
	if rec.GithubInstallationID != nil {
		instGitHubID = *rec.GithubInstallationID
	} else if ev.InstallationID != 0 {
		instGitHubID = ev.InstallationID
	}
	if instGitHubID == 0 {
		return markEventIgnored(ctx, pool, rec.ID, "missing_installation_id")
	}

	var instUUID uuid.UUID
	var instUserID uuid.UUID
	var instStatus string
	err := pool.QueryRow(ctx,
		"SELECT id, user_id, status FROM github_installations WHERE github_installation_id = $1",
		instGitHubID,
	).Scan(&instUUID, &instUserID, &instStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
	} else if err != nil {
		return fmt.Errorf("resolving installation: %w", err)
	}

	if instStatus != "active" {
		return markEventIgnored(ctx, pool, rec.ID, fmt.Sprintf("installation_%s", instStatus))
	}

	// 5. Resolve active repository by GitHub numeric ID
	var repoGitHubID int64
	if rec.GithubRepositoryID != nil {
		repoGitHubID = *rec.GithubRepositoryID
	} else if ev.Push.Repository.ID != 0 {
		repoGitHubID = ev.Push.Repository.ID
	}
	if repoGitHubID == 0 {
		return markEventIgnored(ctx, pool, rec.ID, "missing_repository_id")
	}

	var repoUUID uuid.UUID
	var repoInstUUID uuid.UUID
	var repoFullName string
	var repoRemovedAt *time.Time
	err = pool.QueryRow(ctx,
		"SELECT id, installation_id, full_name, removed_at FROM github_repositories WHERE github_repository_id = $1",
		repoGitHubID,
	).Scan(&repoUUID, &repoInstUUID, &repoFullName, &repoRemovedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return markEventIgnored(ctx, pool, rec.ID, "repository_not_found")
	} else if err != nil {
		return fmt.Errorf("resolving repository: %w", err)
	}

	if repoRemovedAt != nil {
		return markEventIgnored(ctx, pool, rec.ID, "repository_removed")
	}
	if repoInstUUID != instUUID {
		return markEventIgnored(ctx, pool, rec.ID, "repository_installation_mismatch")
	}

	// 6. Query matching active service sources with auto_deploy = true
	sourceQuery := `
		SELECT 
			ss.id,
			ss.service_id,
			ss.branch,
			ss.root_directory,
			ss.dockerfile_path,
			ss.build_configuration,
			s.environment_id,
			e.project_id,
			p.user_id
		FROM service_sources ss
		JOIN services s ON ss.service_id = s.id
		JOIN environments e ON s.environment_id = e.id
		JOIN projects p ON e.project_id = p.id
		WHERE ss.repository_id = $1
		  AND ss.branch = $2
		  AND ss.auto_deploy = true
		  AND ss.source_status = 'active'
	`

	rows, err := pool.Query(ctx, sourceQuery, repoUUID, branch)
	if err != nil {
		return fmt.Errorf("querying matching service sources: %w", err)
	}
	defer rows.Close()

	type matchedSource struct {
		ID             uuid.UUID
		ServiceID      uuid.UUID
		Branch         string
		RootDir        string
		DockerfilePath *string
		BuildConfig    json.RawMessage
		EnvID          uuid.UUID
		ProjectID      uuid.UUID
		UserID         uuid.UUID
	}

	var matches []matchedSource
	for rows.Next() {
		var m matchedSource
		if err := rows.Scan(
			&m.ID,
			&m.ServiceID,
			&m.Branch,
			&m.RootDir,
			&m.DockerfilePath,
			&m.BuildConfig,
			&m.EnvID,
			&m.ProjectID,
			&m.UserID,
		); err != nil {
			return fmt.Errorf("scanning matched source: %w", err)
		}
		matches = append(matches, m)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating matched sources: %w", err)
	}

	if len(matches) == 0 {
		return markEventIgnored(ctx, pool, rec.ID, "no_matching_active_sources")
	}

	// 7. For each matching service source, create deployment + build job + outbox event transactionally
	for _, ss := range matches {
		// Ensure the service project and GitHub installation have the same personal owner.
		if ss.UserID != instUserID {
			slog.Warn("personal ownership mismatch between service project and github installation; skipping service",
				"service_id", ss.ServiceID,
				"project_user_id", ss.UserID,
				"installation_user_id", instUserID,
			)
			continue
		}

		idempotencyKey := fmt.Sprintf("gh-push:%s:%s", rec.DeliveryID, ss.ServiceID)

		snapshot := map[string]any{
			"platform_repository_id": repoUUID.String(),
			"github_repository_id":   repoGitHubID,
			"full_name":              repoFullName,
			"commit_sha":             afterSHA,
			"branch":                 branch,
			"ref":                    ev.Push.Ref,
			"root_directory":         ss.RootDir,
			"dockerfile_path":        ss.DockerfilePath,
			"build_configuration":    ss.BuildConfig,
			"service_source_id":      ss.ID.String(),
			"trigger_event_id":       rec.ID.String(),
		}
		snapshotJSON, err := json.Marshal(snapshot)
		if err != nil {
			return fmt.Errorf("marshaling source snapshot: %w", err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("starting deployment transaction: %w", err)
		}

		// Insert into deployments ON CONFLICT DO NOTHING
		insertDepQuery := `
			INSERT INTO deployments (
				project_id,
				environment_id,
				service_id,
				service_source_id,
				git_commit_sha,
				git_branch,
				status,
				trigger_type,
				trigger_event_id,
				ref,
				source_snapshot,
				idempotency_key
			) VALUES (
				$1, $2, $3, $4, $5, $6, 'queued', 'github_push', $7, $8, $9, $10
			)
			ON CONFLICT (project_id, idempotency_key) DO NOTHING
			RETURNING id;
		`

		var deploymentID uuid.UUID
		depErr := tx.QueryRow(ctx, insertDepQuery,
			ss.ProjectID,
			ss.EnvID,
			ss.ServiceID,
			ss.ID,
			afterSHA,
			branch,
			rec.ID,
			ev.Push.Ref,
			snapshotJSON,
			idempotencyKey,
		).Scan(&deploymentID)

		if errors.Is(depErr, pgx.ErrNoRows) {
			// Deployment already exists (duplicate delivery or replayed event)
			_ = tx.Rollback(ctx)
			continue
		} else if depErr != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("inserting deployment: %w", depErr)
		}

		// Insert into build_jobs (the durable build request)
		insertBuildQuery := `
			INSERT INTO build_jobs (
				deployment_id,
				service_source_id,
				repository_id,
				commit_sha,
				ref,
				status,
				builder_type
			) VALUES (
				$1, $2, $3, $4, $5, 'queued', 'gvisor_rootless_buildkit'
			)
			RETURNING id;
		`

		var buildJobID uuid.UUID
		err = tx.QueryRow(ctx, insertBuildQuery,
			deploymentID,
			ss.ID,
			repoUUID,
			afterSHA,
			ev.Push.Ref,
		).Scan(&buildJobID)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("inserting build_job: %w", err)
		}

		// Insert into outbox_events
		outboxPayload := map[string]any{
			"event_id":          uuid.New().String(),
			"deployment_id":     deploymentID.String(),
			"build_run_id":      buildJobID.String(),
			"service_id":        ss.ServiceID.String(),
			"service_source_id": ss.ID.String(),
			"user_id":           ss.UserID.String(),
			"project_id":        ss.ProjectID.String(),
			"environment_id":    ss.EnvID.String(),
			"repository": map[string]any{
				"platform_repository_id": repoUUID.String(),
				"github_repository_id":   repoGitHubID,
				"full_name":              repoFullName,
			},
			"source": map[string]any{
				"branch":          branch,
				"ref":             ev.Push.Ref,
				"commit_sha":      afterSHA,
				"root_directory":  ss.RootDir,
				"dockerfile_path": ss.DockerfilePath,
			},
			"build_configuration": ss.BuildConfig,
			"trigger": map[string]any{
				"type":             "github_push",
				"webhook_event_id": rec.ID.String(),
			},
		}
		outboxJSON, err := json.Marshal(outboxPayload)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("marshaling outbox payload: %w", err)
		}

		insertOutboxQuery := `
			INSERT INTO outbox_events (
				aggregate_type,
				aggregate_id,
				event_type,
				status,
				payload
			) VALUES (
				'deployment',
				$1,
				'deployment.build.requested',
				'pending',
				$2
			);
		`
		_, err = tx.Exec(ctx, insertOutboxQuery, deploymentID, outboxJSON)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("inserting outbox event: %w", err)
		}

		// Update service_sources last_seen_commit_sha and last_deployment_id
		updateSourceQuery := `
			UPDATE service_sources
			SET last_seen_commit_sha = $1,
			    last_deployment_id = $2,
			    updated_at = now()
			WHERE id = $3;
		`
		_, err = tx.Exec(ctx, updateSourceQuery, afterSHA, deploymentID, ss.ID)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("updating service source: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("committing deployment transaction: %w", err)
		}

		// Write audit event if auditWriter is available
		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      ss.UserID,
				ActorUserID: nil, // system webhook action
				Action:      audit.ActionDeploymentWebhookCreated,
				EntityType:  "deployment",
				EntityID:    deploymentID,
				Metadata: map[string]any{
					"service_id":  ss.ServiceID.String(),
					"commit_sha":  afterSHA,
					"branch":      branch,
					"delivery_id": rec.DeliveryID,
				},
				CreatedAt: time.Now().UTC(),
			})
		}
	}

	return markEventProcessed(ctx, pool, rec.ID)
}

// handleInstallation processes installation lifecycle changes (created, deleted, suspend, unsuspend).
func handleInstallation(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer, rec webhookEventRecord, ev *githubwebhook.Event) error {
	if ev.Installation == nil {
		return markEventIgnored(ctx, pool, rec.ID, "missing_installation_data")
	}

	action := ev.Installation.Action
	instGitHubID := ev.Installation.InstallationID
	if instGitHubID == 0 && rec.GithubInstallationID != nil {
		instGitHubID = *rec.GithubInstallationID
	}
	if instGitHubID == 0 {
		return markEventIgnored(ctx, pool, rec.ID, "missing_installation_id")
	}

	switch action {
	case "created", "unsuspend":
		var instUUID uuid.UUID
		var userID uuid.UUID
		err := pool.QueryRow(ctx, `
			UPDATE github_installations
			SET status = 'active',
			    suspended_at = NULL,
			    suspended_by_github = FALSE,
			    updated_at = now()
			WHERE github_installation_id = $1
			RETURNING id, user_id;
		`, instGitHubID).Scan(&instUUID, &userID)

		if errors.Is(err, pgx.ErrNoRows) {
			return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
		} else if err != nil {
			return fmt.Errorf("updating installation to active: %w", err)
		}

		if ghClient != nil {
			_ = syncRepositoriesForInstallation(ctx, pool, ghClient, instUUID, instGitHubID)
		}

		if auditWriter != nil {
			auditAction := audit.ActionInstallationUpdated
			if action == "created" {
				auditAction = audit.ActionInstallationLinked
			}
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      auditAction,
				EntityType:  "github_installation",
				EntityID:    instUUID,
				Metadata: map[string]any{
					"action":                 action,
					"github_installation_id": instGitHubID,
				},
			})
		}

	case "deleted":
		var instUUID uuid.UUID
		var userID uuid.UUID
		err := pool.QueryRow(ctx, `
			UPDATE github_installations
			SET status = 'revoked',
			    updated_at = now()
			WHERE github_installation_id = $1
			RETURNING id, user_id;
		`, instGitHubID).Scan(&instUUID, &userID)

		if errors.Is(err, pgx.ErrNoRows) {
			return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
		} else if err != nil {
			return fmt.Errorf("updating installation to revoked: %w", err)
		}

		// Invalidate cached tokens per spec 7.12 & 11.4
		if ghClient != nil {
			ghClient.InvalidateInstallationTokens(instGitHubID)
		}

		// Mark matching service sources as disconnected
		disconnectQuery := `
			UPDATE service_sources
			SET source_status = 'disconnected',
			    disconnect_reason = 'github_app_uninstalled',
			    updated_at = now()
			WHERE repository_id IN (
				SELECT id FROM github_repositories WHERE installation_id = $1
			);
		`
		_, err = pool.Exec(ctx, disconnectQuery, instUUID)
		if err != nil {
			return fmt.Errorf("disconnecting service sources for uninstalled app: %w", err)
		}

		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      audit.ActionInstallationRevoked,
				EntityType:  "github_installation",
				EntityID:    instUUID,
				Metadata: map[string]any{
					"action":                 action,
					"github_installation_id": instGitHubID,
				},
			})
		}

	case "suspend":
		var instUUID uuid.UUID
		var userID uuid.UUID
		err := pool.QueryRow(ctx, `
			UPDATE github_installations
			SET status = 'suspended',
			    suspended_at = now(),
			    suspended_by_github = TRUE,
			    updated_at = now()
			WHERE github_installation_id = $1
			RETURNING id, user_id;
		`, instGitHubID).Scan(&instUUID, &userID)

		if errors.Is(err, pgx.ErrNoRows) {
			return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
		} else if err != nil {
			return fmt.Errorf("updating installation to suspended: %w", err)
		}

		// Invalidate cached tokens per spec 11.4
		if ghClient != nil {
			ghClient.InvalidateInstallationTokens(instGitHubID)
		}

		// Mark matching service sources as blocked
		blockQuery := `
			UPDATE service_sources
			SET source_status = 'blocked',
			    disconnect_reason = 'github_app_suspended',
			    updated_at = now()
			WHERE repository_id IN (
				SELECT id FROM github_repositories WHERE installation_id = $1
			);
		`
		_, err = pool.Exec(ctx, blockQuery, instUUID)
		if err != nil {
			return fmt.Errorf("blocking service sources for suspended app: %w", err)
		}

		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      audit.ActionInstallationSuspended,
				EntityType:  "github_installation",
				EntityID:    instUUID,
				Metadata: map[string]any{
					"action":                 action,
					"github_installation_id": instGitHubID,
				},
			})
		}

	case "new_permissions_accepted":
		var instUUID uuid.UUID
		var userID uuid.UUID
		err := pool.QueryRow(ctx, `
			SELECT id, user_id FROM github_installations
			WHERE github_installation_id = $1
		`, instGitHubID).Scan(&instUUID, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
		} else if err != nil {
			return fmt.Errorf("finding installation: %w", err)
		}

		if ghClient != nil {
			inst, err := ghClient.GetInstallation(ctx, instGitHubID)
			if err == nil && inst.Permissions != nil {
				permBytes, _ := json.Marshal(inst.Permissions)
				_, _ = pool.Exec(ctx, `
					UPDATE github_installations
					SET permissions = $1, updated_at = now()
					WHERE id = $2
				`, permBytes, instUUID)
			}
		}

		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      audit.ActionInstallationUpdated,
				EntityType:  "github_installation",
				EntityID:    instUUID,
				Metadata: map[string]any{
					"action":                 action,
					"github_installation_id": instGitHubID,
				},
			})
		}

	default:
		return markEventIgnored(ctx, pool, rec.ID, fmt.Sprintf("unhandled_installation_action_%s", action))
	}

	return markEventProcessed(ctx, pool, rec.ID)
}

// handleInstallationRepositories processes repository additions and removals.
func handleInstallationRepositories(ctx context.Context, pool *pgxpool.Pool, auditWriter audit.Writer, rec webhookEventRecord, ev *githubwebhook.Event) error {
	if ev.Repositories == nil {
		return markEventIgnored(ctx, pool, rec.ID, "missing_repositories_data")
	}

	instGitHubID := ev.Repositories.InstallationID
	if instGitHubID == 0 && rec.GithubInstallationID != nil {
		instGitHubID = *rec.GithubInstallationID
	}
	if instGitHubID == 0 {
		return markEventIgnored(ctx, pool, rec.ID, "missing_installation_id")
	}

	var instUUID uuid.UUID
	var userID uuid.UUID
	err := pool.QueryRow(ctx,
		"SELECT id, user_id FROM github_installations WHERE github_installation_id = $1",
		instGitHubID,
	).Scan(&instUUID, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return markEventIgnored(ctx, pool, rec.ID, "installation_not_found")
	} else if err != nil {
		return fmt.Errorf("resolving installation for repos change: %w", err)
	}

	// 1. Process added repositories
	for _, repo := range ev.Repositories.Added {
		upsertRepoQuery := `
			INSERT INTO github_repositories (
				installation_id,
				github_repository_id,
				owner_login,
				name,
				full_name,
				default_branch,
				private,
				archived,
				disabled,
				html_url,
				pushed_at,
				last_synced_at,
				removed_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), NULL
			)
			ON CONFLICT (github_repository_id) DO UPDATE SET
				installation_id = EXCLUDED.installation_id,
				owner_login = EXCLUDED.owner_login,
				name = EXCLUDED.name,
				full_name = EXCLUDED.full_name,
				default_branch = COALESCE(NULLIF(EXCLUDED.default_branch, ''), github_repositories.default_branch),
				private = EXCLUDED.private,
				archived = EXCLUDED.archived,
				disabled = EXCLUDED.disabled,
				html_url = COALESCE(NULLIF(EXCLUDED.html_url, ''), github_repositories.html_url),
				removed_at = NULL,
				updated_at = now()
			RETURNING id;
		`
		var repoUUID uuid.UUID
		err := pool.QueryRow(ctx, upsertRepoQuery,
			instUUID,
			repo.ID,
			repo.OwnerLogin,
			repo.Name,
			repo.FullName,
			repo.DefaultBranch,
			repo.Private,
			repo.Archived,
			repo.Disabled,
			repo.HTMLURL,
			repo.PushedAt,
		).Scan(&repoUUID)
		if err != nil {
			return fmt.Errorf("upserting added repository %s: %w", repo.FullName, err)
		}

		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      audit.ActionRepositorySynced,
				EntityType:  "github_repository",
				EntityID:    repoUUID,
				Metadata: map[string]any{
					"full_name":              repo.FullName,
					"github_repository_id":   repo.ID,
					"github_installation_id": instGitHubID,
				},
			})
		}
	}

	// 2. Process removed repositories
	for _, repo := range ev.Repositories.Removed {
		var repoUUID uuid.UUID
		err := pool.QueryRow(ctx, `
			UPDATE github_repositories
			SET removed_at = now(),
			    updated_at = now()
			WHERE github_repository_id = $1
			RETURNING id;
		`, repo.ID).Scan(&repoUUID)

		if errors.Is(err, pgx.ErrNoRows) {
			// Repository wasn't tracked locally; continue
			continue
		} else if err != nil {
			return fmt.Errorf("marking repository %d as removed: %w", repo.ID, err)
		}

		// Mark matching service sources as blocked
		blockQuery := `
			UPDATE service_sources
			SET source_status = 'blocked',
			    disconnect_reason = 'github_repository_removed',
			    updated_at = now()
			WHERE repository_id = $1;
		`
		_, err = pool.Exec(ctx, blockQuery, repoUUID)
		if err != nil {
			return fmt.Errorf("blocking service sources for removed repository: %w", err)
		}

		if auditWriter != nil {
			_ = auditWriter.Write(ctx, audit.Event{
				UserID:      userID,
				ActorUserID: nil,
				Action:      audit.ActionRepositoryAccessRemoved,
				EntityType:  "github_repository",
				EntityID:    repoUUID,
				Metadata: map[string]any{
					"full_name":              repo.FullName,
					"github_repository_id":   repo.ID,
					"github_installation_id": instGitHubID,
				},
			})
		}
	}

	return markEventProcessed(ctx, pool, rec.ID)
}

func markEventProcessed(ctx context.Context, pool *pgxpool.Pool, eventID uuid.UUID) error {
	query := `
		UPDATE github_webhook_events
		SET processing_status = 'processed',
		    processed_at = now(),
		    locked_until = NULL,
		    error_code = NULL,
		    error_message = NULL
		WHERE id = $1;
	`
	_, err := pool.Exec(ctx, query, eventID)
	return err
}

func markEventIgnored(ctx context.Context, pool *pgxpool.Pool, eventID uuid.UUID, reason string) error {
	query := `
		UPDATE github_webhook_events
		SET processing_status = 'ignored',
		    processed_at = now(),
		    locked_until = NULL,
		    error_code = NULL,
		    error_message = $2
		WHERE id = $1;
	`
	_, err := pool.Exec(ctx, query, eventID, reason)
	return err
}

func markEventFailed(ctx context.Context, pool *pgxpool.Pool, eventID uuid.UUID, errCode, errMsg string) error {
	query := `
		UPDATE github_webhook_events
		SET processing_status = 'failed',
		    processed_at = now(),
		    locked_until = NULL,
		    error_code = $2,
		    error_message = $3
		WHERE id = $1;
	`
	_, err := pool.Exec(ctx, query, eventID, errCode, errMsg)
	return err
}

func handleProcessingError(ctx context.Context, pool *pgxpool.Pool, eventID uuid.UUID, attempts int, procErr error) {
	const maxAttempts = 5
	newStatus := "received"
	if attempts >= maxAttempts {
		newStatus = "failed"
	}

	backoffInterval := time.Duration(attempts*30) * time.Second

	query := `
		UPDATE github_webhook_events
		SET processing_status = $2,
		    locked_until = NULL,
		    error_code = 'processing_error',
		    error_message = $3,
		    available_at = now() + $4::interval
		WHERE id = $1;
	`
	intervalStr := fmt.Sprintf("%d seconds", int(backoffInterval.Seconds()))
	_, _ = pool.Exec(ctx, query, eventID, newStatus, procErr.Error(), intervalStr)
}

func syncRepositoriesForInstallation(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, instUUID uuid.UUID, instGitHubID int64) error {
	page := 1
	for {
		repoPage, err := ghClient.ListInstallationRepositories(ctx, instGitHubID, page, 100)
		if err != nil {
			return err
		}
		for _, repo := range repoPage.Repositories {
			upsertQuery := `
				INSERT INTO github_repositories (
					installation_id, github_repository_id, owner_login, name, full_name,
					default_branch, private, archived, disabled, html_url, last_synced_at, removed_at
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, false, false, $8, now(), NULL
				)
				ON CONFLICT (github_repository_id) DO UPDATE SET
					installation_id = EXCLUDED.installation_id,
					owner_login = EXCLUDED.owner_login,
					name = EXCLUDED.name,
					full_name = EXCLUDED.full_name,
					default_branch = COALESCE(NULLIF(EXCLUDED.default_branch, ''), github_repositories.default_branch),
					private = EXCLUDED.private,
					html_url = COALESCE(NULLIF(EXCLUDED.html_url, ''), github_repositories.html_url),
					removed_at = NULL,
					updated_at = now();
			`
			_, _ = pool.Exec(ctx, upsertQuery, instUUID, repo.ID, repo.OwnerLogin, repo.Name, repo.FullName, repo.DefaultBranch, repo.Private, repo.HTMLURL)
		}
		if !repoPage.HasNext || len(repoPage.Repositories) == 0 {
			break
		}
		page++
	}
	return nil
}
