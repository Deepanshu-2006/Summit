package platformdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Limits applied by the repository layer.
const (
	MaxLogMessageBytes  = 8 * 1024 // per log line; longer lines are truncated
	MaxLogBatchLines    = 1000     // per AppendBuildLogs call
	DefaultLogPageLimit = 500
	MaxLogPageLimit     = 1000
	maxStageLen         = 64
	maxStatusMsgLen     = 2048
)

var digestRe = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

// GitHubCloneURL returns the HTTPS clone URL for a repository full name
// ("owner/name"), without credentials.
func GitHubCloneURL(fullName string) string {
	return "https://github.com/" + fullName + ".git"
}

// GetBuildJob returns a build job by id (trusted internal read, no user scoping).
func (s *Store) GetBuildJob(ctx context.Context, id uuid.UUID) (*BuildJob, error) {
	b, err := scanBuildJob(s.db.QueryRow(ctx, `SELECT `+buildJobCols+` FROM build_jobs b WHERE b.id = $1`, id))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return b, nil
}

// BuildContext is everything the orchestrator's spec resolver needs to turn a
// build job into a BuildExecutionSpec, resolved in one query. It contains no
// credentials.
type BuildContext struct {
	BuildJobID        uuid.UUID
	BuildJobStatus    BuildJobStatus
	BuildAttemptID    *uuid.UUID
	TimeoutSeconds    *int
	DeploymentID      uuid.UUID
	DeploymentStatus  DeploymentStatus
	CancelRequestedAt *time.Time

	UserID          uuid.UUID // tenant
	ProjectID       uuid.UUID
	ProjectSlug     string
	EnvironmentID   uuid.UUID
	EnvironmentName string
	ServiceID       uuid.UUID
	ServiceName     string
	ServiceType     string

	ServiceSourceID      uuid.UUID
	SourceStatus         string // service_sources.source_status
	RepositoryID         uuid.UUID
	GitHubRepositoryID   int64
	GitHubInstallationID int64  // GitHub's numeric installation id (for token minting)
	InstallationStatus   string // github_installations.status
	RepoFullName         string // owner/name
	RepoOwnerLogin       string
	RepoName             string
	CloneURL             string // https://github.com/<full_name>.git

	CommitSHA          string
	Branch             string
	Ref                string
	RootDirectory      string
	DockerfilePath     *string
	BuildConfiguration json.RawMessage

	Resources ServiceResources // defaults applied when the service has no row
}

// GetBuildContext resolves build_jobs -> deployments -> services ->
// service_sources -> github_repositories -> github_installations -> projects ->
// environments (+ service_resources) for the orchestrator. Soft-deleted rows
// are NOT filtered, so the orchestrator can still observe and clean up their
// builds. ErrNotFound if any link of the chain is missing.
func (s *Store) GetBuildContext(ctx context.Context, buildJobID uuid.UUID) (*BuildContext, error) {
	var c BuildContext
	var cfg []byte
	var ref *string
	var buildCommit *string
	err := s.db.QueryRow(ctx, `
		SELECT b.id, b.status, b.attempt_id, b.timeout_seconds,
		       d.id, d.status, d.cancel_requested_at,
		       p.user_id, p.id, p.slug, e.id, e.name, sv.id, sv.name, sv.type,
		       ss.id, ss.source_status, r.id, r.github_repository_id, i.github_installation_id, i.status,
		       r.full_name, r.owner_login, r.name,
		       COALESCE(b.commit_sha, d.git_commit_sha), d.git_branch, COALESCE(b.ref, d.ref),
		       ss.root_directory, ss.dockerfile_path, ss.build_configuration,
		       COALESCE(sr.cpu_request_millicores, 100), COALESCE(sr.cpu_limit_millicores, 500),
		       COALESCE(sr.memory_request_mb, 128), COALESCE(sr.memory_limit_mb, 512),
		       COALESCE(sr.min_replicas, 1), COALESCE(sr.max_replicas, 5), COALESCE(sr.port, 8080)
		FROM build_jobs b
		JOIN deployments d ON d.id = b.deployment_id
		JOIN services sv ON sv.id = d.service_id
		JOIN service_sources ss ON ss.id = COALESCE(b.service_source_id, d.service_source_id)
		JOIN github_repositories r ON r.id = COALESCE(b.repository_id, ss.repository_id)
		JOIN github_installations i ON i.id = r.installation_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		LEFT JOIN service_resources sr ON sr.service_id = sv.id
		WHERE b.id = $1`, buildJobID).Scan(
		&c.BuildJobID, &c.BuildJobStatus, &c.BuildAttemptID, &c.TimeoutSeconds,
		&c.DeploymentID, &c.DeploymentStatus, &c.CancelRequestedAt,
		&c.UserID, &c.ProjectID, &c.ProjectSlug, &c.EnvironmentID, &c.EnvironmentName, &c.ServiceID, &c.ServiceName, &c.ServiceType,
		&c.ServiceSourceID, &c.SourceStatus, &c.RepositoryID, &c.GitHubRepositoryID, &c.GitHubInstallationID, &c.InstallationStatus,
		&c.RepoFullName, &c.RepoOwnerLogin, &c.RepoName,
		&buildCommit, &c.Branch, &ref,
		&c.RootDirectory, &c.DockerfilePath, &cfg,
		&c.Resources.CPURequestMillicores, &c.Resources.CPULimitMillicores,
		&c.Resources.MemoryRequestMB, &c.Resources.MemoryLimitMB,
		&c.Resources.MinReplicas, &c.Resources.MaxReplicas, &c.Resources.Port)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	c.Resources.ServiceID = c.ServiceID
	c.CommitSHA = deref(buildCommit)
	c.Ref = deref(ref)
	c.CloneURL = GitHubCloneURL(c.RepoFullName)
	if len(cfg) == 0 {
		cfg = []byte(`{}`)
	}
	c.BuildConfiguration = cfg
	return &c, nil
}

// MarkBuildDispatched records that the orchestrator created the build Pod:
// status -> dispatched with attempt id, pod name and timeout. Idempotent while
// the job is still queued/dispatched (a redelivered outbox event may call it
// again). Returns ErrNotFound, or ErrInvalidTransition if the job already
// started or finished.
func (s *Store) MarkBuildDispatched(ctx context.Context, buildJobID, attemptID uuid.UUID, podName string, timeoutSeconds int) (*BuildJob, error) {
	if podName == "" || len(podName) > 253 {
		return nil, invalidArg("pod name is required (max 253 chars)")
	}
	if timeoutSeconds <= 0 {
		return nil, invalidArg("timeout seconds must be positive")
	}
	b, err := scanBuildJob(s.db.QueryRow(ctx, `
		UPDATE build_jobs b
		SET status = 'dispatched', attempt_id = $2, pod_name = $3, timeout_seconds = $4,
		    dispatched_at = COALESCE(b.dispatched_at, now())
		WHERE b.id = $1 AND b.status IN ('queued', 'dispatched')
		RETURNING `+buildJobCols, buildJobID, attemptID, podName, timeoutSeconds))
	if err == nil {
		return b, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("platformdb: mark build dispatched: %w", err)
	}
	if _, gerr := s.GetBuildJob(ctx, buildJobID); gerr != nil {
		return nil, gerr
	}
	return nil, fmt.Errorf("%w: build job %s already started or finished", ErrInvalidTransition, buildJobID)
}

// BuildStatusEvent is one builder status update (POST .../status).
type BuildStatusEvent struct {
	Sequence   int    // builder-assigned, unique per build; the idempotency key
	Stage      string // e.g. "source_checkout", "image_build", "heartbeat"
	Status     string // pending|running|succeeded|failed|skipped (stage status)
	Message    string
	ReportedAt time.Time // builder clock; server time is used when zero
}

// HeartbeatStage is the stage name builders use for liveness pings. It refreshes
// last_heartbeat_at but does not overwrite current_stage.
const HeartbeatStage = "heartbeat"

// RecordBuildStatus persists a builder status update. It is idempotent on
// (build job, sequence): a replay returns applied=false and changes nothing.
// For a new event it appends a build_job_events row, refreshes
// last_heartbeat_at (server clock), sets current_stage (except for heartbeats)
// and moves a queued/dispatched job to running. Updates arriving after the job
// is terminal are stored but do not modify the job. ErrNotFound if the job is
// unknown.
func (s *Store) RecordBuildStatus(ctx context.Context, buildJobID uuid.UUID, ev BuildStatusEvent) (applied bool, err error) {
	ev.Stage = truncateString(sanitizeText(strings.TrimSpace(ev.Stage)), maxStageLen)
	ev.Status = truncateString(sanitizeText(strings.TrimSpace(ev.Status)), maxStageLen)
	if ev.Stage == "" || ev.Status == "" {
		return false, invalidArg("stage and status are required")
	}
	if ev.Sequence < 0 {
		return false, invalidArg("sequence must be >= 0")
	}
	msg := truncateString(sanitizeText(ev.Message), maxStatusMsgLen)
	reportedAt := ev.ReportedAt
	if reportedAt.IsZero() {
		reportedAt = time.Now().UTC()
	}

	err = s.WithTx(ctx, func(tx *Store) error {
		var status BuildJobStatus
		if err := tx.db.QueryRow(ctx, `SELECT status FROM build_jobs WHERE id = $1 FOR UPDATE`, buildJobID).Scan(&status); err != nil {
			return notFoundIfNoRows(err)
		}
		tag, err := tx.db.Exec(ctx, `
			INSERT INTO build_job_events (build_job_id, sequence, stage, status, message, reported_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (build_job_id, sequence) DO NOTHING`,
			buildJobID, ev.Sequence, ev.Stage, ev.Status, nullableString(msg), reportedAt)
		if err != nil {
			return fmt.Errorf("platformdb: insert build event: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil // replay
		}
		applied = true
		if status.IsTerminal() {
			return nil
		}
		setStage := ev.Stage != HeartbeatStage
		if _, err := tx.db.Exec(ctx, `
			UPDATE build_jobs
			SET last_heartbeat_at = now(),
			    current_stage = CASE WHEN $2 THEN $3 ELSE current_stage END,
			    status = CASE WHEN status IN ('queued', 'dispatched') THEN 'running' ELSE status END,
			    started_at = CASE WHEN status IN ('queued', 'dispatched') THEN COALESCE(started_at, now()) ELSE started_at END
			WHERE id = $1`, buildJobID, setStage, ev.Stage); err != nil {
			return fmt.Errorf("platformdb: update build job: %w", err)
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return applied, nil
}

// LogLine is one build log line to append.
type LogLine struct {
	Sequence int64  // builder sequence; informational, not enforced unique
	Stream   string // stdout|stderr|system (default stdout)
	Level    string // debug|info|warn|error (default info)
	Stage    string
	Message  string    // truncated to MaxLogMessageBytes
	LoggedAt time.Time // server time when zero
}

// BuildLogLine is a stored build log line.
type BuildLogLine struct {
	ID         int64 // monotonically increasing; use as the "after" cursor
	BuildJobID uuid.UUID
	Sequence   *int64
	Stream     string
	Level      string
	Stage      *string
	Message    string
	LoggedAt   time.Time
}

func normalizeEnum(v string, def string, allowed ...string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	for _, a := range allowed {
		if v == a {
			return v
		}
	}
	return def
}

// AppendBuildLogs stores log lines for a build job and returns how many were
// inserted. At most MaxLogBatchLines lines per call (ErrInvalidArgument
// otherwise); each message is truncated to MaxLogMessageBytes. ErrNotFound if
// the job is unknown. Logs are accepted after the job is terminal (late flush).
func (s *Store) AppendBuildLogs(ctx context.Context, buildJobID uuid.UUID, lines []LogLine) (int, error) {
	if len(lines) == 0 {
		return 0, nil
	}
	if len(lines) > MaxLogBatchLines {
		return 0, invalidArg("at most %d log lines per request", MaxLogBatchLines)
	}
	now := time.Now().UTC()
	seqs := make([]int64, len(lines))
	streams := make([]string, len(lines))
	levels := make([]string, len(lines))
	stages := make([]string, len(lines))
	msgs := make([]string, len(lines))
	times := make([]time.Time, len(lines))
	for i, l := range lines {
		seqs[i] = l.Sequence
		streams[i] = normalizeEnum(l.Stream, "stdout", "stdout", "stderr", "system")
		levels[i] = normalizeEnum(l.Level, "info", "debug", "info", "warn", "error")
		stages[i] = truncateString(sanitizeText(l.Stage), maxStageLen)
		msgs[i] = truncateString(sanitizeText(l.Message), MaxLogMessageBytes)
		times[i] = l.LoggedAt
		if times[i].IsZero() {
			times[i] = now
		}
	}
	// unnest(...) WITH ORDINALITY keeps the batch order in the identity column.
	tag, err := s.db.Exec(ctx, `
		INSERT INTO build_job_logs (build_job_id, sequence, stream, level, stage, message, logged_at)
		SELECT $1, t.seq, t.stream, t.level, NULLIF(t.stage, ''), t.message, t.logged_at
		FROM unnest($2::bigint[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[])
		     WITH ORDINALITY AS t(seq, stream, level, stage, message, logged_at, ord)
		ORDER BY t.ord`,
		buildJobID, seqs, streams, levels, stages, msgs, times)
	if err != nil {
		if isFKViolation(err) {
			return 0, ErrNotFound
		}
		return 0, fmt.Errorf("platformdb: append build logs: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func clampLogLimit(limit int) int {
	switch {
	case limit <= 0:
		return DefaultLogPageLimit
	case limit > MaxLogPageLimit:
		return MaxLogPageLimit
	default:
		return limit
	}
}

func scanLogs(rows pgx.Rows) ([]BuildLogLine, error) {
	defer rows.Close()
	var out []BuildLogLine
	for rows.Next() {
		var l BuildLogLine
		if err := rows.Scan(&l.ID, &l.BuildJobID, &l.Sequence, &l.Stream, &l.Level, &l.Stage, &l.Message, &l.LoggedAt); err != nil {
			return nil, fmt.Errorf("platformdb: scan build log: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// ListBuildLogs returns up to limit log lines with id > afterID in insertion
// order (trusted internal read). Pass the last returned ID as afterID to tail.
func (s *Store) ListBuildLogs(ctx context.Context, buildJobID uuid.UUID, afterID int64, limit int) ([]BuildLogLine, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, build_job_id, sequence, stream, level, stage, message, logged_at
		FROM build_job_logs WHERE build_job_id = $1 AND id > $2 ORDER BY id LIMIT $3`,
		buildJobID, afterID, clampLogLimit(limit))
	if err != nil {
		return nil, fmt.Errorf("platformdb: list build logs: %w", err)
	}
	return scanLogs(rows)
}

// ListDeploymentLogsForUser returns the build logs of a deployment owned by
// userID (same paging semantics as ListBuildLogs). ErrNotFound if the
// deployment is not visible to the user.
func (s *Store) ListDeploymentLogsForUser(ctx context.Context, userID, deploymentID uuid.UUID, afterID int64, limit int) ([]BuildLogLine, error) {
	var jobID uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT b.id FROM build_jobs b
		JOIN deployments d ON d.id = b.deployment_id
		JOIN projects p ON p.id = d.project_id
		WHERE d.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`, deploymentID, userID).Scan(&jobID)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return s.ListBuildLogs(ctx, jobID, afterID, limit)
}

// BuildResult is the final outcome reported by the builder.
type BuildResult struct {
	Status          BuildJobStatus // succeeded | failed | cancelled
	ImageRepository string         // required on success
	ImageTag        string
	Digest          string // required on success: sha256:<64 lowercase hex>
	ErrorMessage    string
}

func (r BuildResult) validate() error {
	switch r.Status {
	case BuildSucceeded:
		if strings.TrimSpace(r.ImageRepository) == "" {
			return invalidArg("image repository is required for a succeeded build")
		}
		if !digestRe.MatchString(r.Digest) {
			return invalidArg("digest must match sha256:<64 hex>")
		}
	case BuildFailed, BuildCancelled:
	default:
		return invalidArg("result status must be succeeded, failed or cancelled")
	}
	return nil
}

// RecordBuildResult persists the builder's terminal result on the build job
// (status, completed_at, image repository/tag/digest, error). It does not touch
// the deployment: the orchestrator observes the result and transitions it.
//
// Idempotent: repeating the same result returns the stored job with
// applied=false. A different terminal result than the one already stored (a
// different status, or a different digest) returns ErrConflict and changes
// nothing. A succeeded result requires a repository and a digest matching
// sha256:<64 hex>. ErrNotFound if the job is unknown.
func (s *Store) RecordBuildResult(ctx context.Context, buildJobID uuid.UUID, r BuildResult) (job *BuildJob, applied bool, err error) {
	if err := r.validate(); err != nil {
		return nil, false, err
	}
	errMsg := truncateString(sanitizeText(r.ErrorMessage), maxMessageLen)
	err = s.WithTx(ctx, func(tx *Store) error {
		var status BuildJobStatus
		var digest *string
		if err := tx.db.QueryRow(ctx, `SELECT status, oci_image_digest FROM build_jobs WHERE id = $1 FOR UPDATE`, buildJobID).
			Scan(&status, &digest); err != nil {
			return notFoundIfNoRows(err)
		}
		if status.IsTerminal() {
			if status != r.Status || (status == BuildSucceeded && deref(digest) != r.Digest) {
				return fmt.Errorf("%w: build job already finished as %s", ErrConflict, status)
			}
			var gerr error
			job, gerr = tx.GetBuildJob(ctx, buildJobID)
			return gerr
		}
		var gerr error
		job, gerr = scanBuildJob(tx.db.QueryRow(ctx, `
			UPDATE build_jobs b
			SET status = $2,
			    completed_at = now(),
			    started_at = COALESCE(b.started_at, now()),
			    image_repository = $3, image_tag = $4, oci_image_digest = $5,
			    error_message = $6
			WHERE b.id = $1
			RETURNING `+buildJobCols,
			buildJobID, string(r.Status), nullableString(r.ImageRepository), nullableString(r.ImageTag),
			nullableString(r.Digest), nullableString(errMsg)))
		if gerr != nil {
			return fmt.Errorf("platformdb: record build result: %w", gerr)
		}
		applied = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return job, applied, nil
}

// MarkBuildJobTerminal lets the orchestrator close a build it detected as
// failed or cancelled without a builder result (Pod died, timeout, cancel).
// status must be failed or cancelled. If the job is already terminal nothing
// changes and applied=false (the builder's result wins). ErrNotFound if unknown.
func (s *Store) MarkBuildJobTerminal(ctx context.Context, buildJobID uuid.UUID, status BuildJobStatus, errorMessage string) (job *BuildJob, applied bool, err error) {
	if status != BuildFailed && status != BuildCancelled {
		return nil, false, invalidArg("status must be failed or cancelled")
	}
	errMsg := truncateString(sanitizeText(errorMessage), maxMessageLen)
	job, err = scanBuildJob(s.db.QueryRow(ctx, `
		UPDATE build_jobs b
		SET status = $2, completed_at = now(), error_message = COALESCE($3, b.error_message)
		WHERE b.id = $1 AND b.status IN ('queued', 'dispatched', 'running')
		RETURNING `+buildJobCols, buildJobID, string(status), nullableString(errMsg)))
	if err == nil {
		return job, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("platformdb: mark build terminal: %w", err)
	}
	job, err = s.GetBuildJob(ctx, buildJobID)
	if err != nil {
		return nil, false, err
	}
	return job, false, nil
}
