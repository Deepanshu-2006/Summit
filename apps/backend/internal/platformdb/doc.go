// Package platformdb is the typed persistence layer for the Summit control
// plane. The API (apps/backend/internal/githubapi and friends) and the
// orchestrator both use it instead of writing SQL against the platform
// database. It owns no HTTP, Kubernetes or GitHub logic.
//
// # Construction
//
//	store := platformdb.New(pool)                // *pgxpool.Pool
//	err := store.WithTx(ctx, func(tx *platformdb.Store) error { ... })
//
// *Store is the only implementation. A *Store passed to a WithTx callback is
// bound to that transaction (nested WithTx uses a savepoint). Consumers should
// depend on the narrow interfaces below and assert them with
// `var _ platformdb.X = (*platformdb.Store)(nil)`; fake those in unit tests.
//
// # Errors (use errors.Is)
//
//	ErrNotFound            missing row, or not owned by the caller, or soft-deleted
//	ErrConflict            slug / service name / secret key / idempotency-key-for-other-service,
//	                       or a different terminal build result already recorded
//	ErrInvalidTransition   compare-and-set did not match (stale state, lost race, terminal)
//	ErrInvalidArgument     validation failed before touching the database
//	ErrSourceNotConfigured service has no service_sources row
//	ErrSourceInactive      source_status or GitHub installation is not 'active'
//
// Ownership: tenant == users.id. Every API-facing method takes userID and
// filters through projects.user_id; a row owned by someone else is
// indistinguishable from a missing one (ErrNotFound). Soft-deleted projects,
// environments and services are invisible to user-scoped methods. Methods
// marked "internal" are not user-scoped and do not filter on ownership or
// soft deletion: use them only from trusted code (orchestrator, authenticated
// build callbacks).
//
// # Status vocabulary
//
// DeploymentStatus mirrors the deployment_status enum:
//
//	queued -> building -> image_ready -> deploying -> health_checking -> running
//	terminal: failed, cancelled, superseded
//	legacy (never written by new code): pending, active
//
// DeploymentQueued..DeploymentHealthChecking are "in flight" (InFlightStatuses);
// IsTerminal covers failed/cancelled/superseded. running is a steady state that
// becomes superseded when a newer deployment of the same service reaches
// running (done inside PromoteRelease).
//
// BuildJobStatus mirrors the build_jobs.status CHECK:
//
//	queued -> dispatched -> running -> succeeded | failed | cancelled
//
// Who writes what (docs/mvp_runtime_contracts.md C2, C6, C7):
//
//	API / GitHub worker  deployment created as queued (CreateDeploymentWithOutbox)
//	builder callbacks    build_jobs only: status events, logs, final result
//	orchestrator         every deployment transition, MarkBuildDispatched,
//	                     MarkBuildJobTerminal, PromoteRelease
//
// # API surface (ProjectStore, DeploymentStore)
//
// Projects, environments, services, resources, secret pointers (ProjectStore):
//
//	CreateProject(ctx, userID, CreateProjectParams) (*Project, *Environment, error)  // also creates the 'production' environment
//	ListProjects(ctx, userID, ListParams) (Page[Project], error)                      // newest first, keyset cursor
//	GetProjectBySlug(ctx, userID, slug) (*Project, error)
//	UpdateProject(ctx, userID, projectID, UpdateProjectParams) (*Project, error)      // name, default branch
//	SoftDeleteProject(ctx, userID, projectID) error                                   // also soft-deletes envs and services; slug stays reserved
//	ListEnvironments(ctx, userID, projectID) ([]Environment, error)
//	CreateEnvironment(ctx, userID, projectID, name, type) (*Environment, error)       // staging|preview; preview is ephemeral
//	CreateService(ctx, userID, environmentID, name, type) (*Service, error)           // web|worker|cron + default resources
//	CreateTypedService(ctx, userID, environmentID, ServiceCreate) (*Service, error)   // image, postgres, redis, and the git kinds
//	ListServicesByProject(ctx, userID, projectID) ([]Service, error)
//	SoftDeleteService(ctx, userID, serviceID) (*Service, error)                       // disconnect source, cancel in-flight, service.deleted
//	GetServiceForUser(ctx, userID, serviceID) (*Service, error)
//	GetServiceResources / UpsertServiceResources(ctx, userID, serviceID[, res])
//	ListSecretReferences / CreateSecretReference / DeleteSecretReference              // pointers only: provider + vault path + optional version
//
// Deployments (DeploymentStore):
//
//	CreateDeploymentWithOutbox(ctx, CreateDeploymentParams) (*CreateDeploymentResult, error)
//	CreateImageDeployment / CreateAddonDeployment(ctx, params) (*CreateDeploymentResult, error) // status image_ready, no build job, no build outbox
//	GetDeploymentForUser(ctx, userID, deploymentID) (*DeploymentDetail, error)        // deployment + build job + events (oldest first)
//	ListDeploymentsForProject(ctx, userID, projectID, ListParams) (Page[Deployment], error)
//	RequestCancel(ctx, userID, deploymentID) (*Deployment, error)                     // sets cancel_requested_at on in-flight deployments only
//	ListDeploymentLogsForUser(ctx, userID, deploymentID, afterID, limit) ([]BuildLogLine, error)
//
// Pagination: ListParams{Limit, Cursor}. Limit defaults to 20 and is capped at
// 100. Page.NextCursor is an opaque base64 token over (created_at, id); empty
// means last page. A malformed cursor is ErrInvalidArgument.
//
// # Build callbacks and orchestrator reads (BuildStore, RolloutStore)
//
// BuildStore (internal; the callback receiver must authenticate the worker
// token for the build id before calling these):
//
//	GetBuildJob(ctx, id) (*BuildJob, error)
//	GetBuildContext(ctx, buildJobID) (*BuildContext, error)       // one-query spec inputs: user, project, env, service, repo, clone URL, commit, source paths, build config JSON, statuses, resources incl. port
//	MarkBuildDispatched(ctx, buildJobID, attemptID, podName, timeoutSeconds) (*BuildJob, error)
//	RecordBuildStatus(ctx, buildJobID, BuildStatusEvent) (applied bool, err error)
//	AppendBuildLogs(ctx, buildJobID, []LogLine) (inserted int, err error)
//	RecordBuildResult(ctx, buildJobID, BuildResult) (job *BuildJob, applied bool, err error)
//	ListBuildLogs(ctx, buildJobID, afterID, limit) ([]BuildLogLine, error)
//	MarkBuildJobTerminal(ctx, buildJobID, failed|cancelled, message) (job *BuildJob, applied bool, err error)
//
// RolloutStore (internal; orchestrator):
//
//	ListActiveDeployments(ctx, limit) ([]ActiveDeployment, error)  // in-flight only; LEFT JOIN build job (zero when absent). Use ServiceType, EnvironmentName, Resources.Port, Deployment.ImageRef
//	GetDeployment(ctx, id) (*Deployment, error)
//	TransitionDeployment(ctx, id, from []DeploymentStatus, to DeploymentStatus, reason string, opts ...TransitionOption) (*Deployment, error)
//	PromoteRelease(ctx, deploymentID, configSnapshot) (*PromoteResult, error)
//
// EnvironmentAddonStore (internal; orchestrator, not part of RolloutStore):
//
//	ListEnvironmentAddons(ctx, environmentID) ([]EnvironmentAddon, error)  // live postgres|redis; port, engine, version
//
// Pinger: (*Store).Ping(ctx). The pool-level helper is db.Ping(ctx, pool, timeout).
//
// service.deleted outbox (aggregate_type "service", event_type "service.deleted")
// is written by SoftDeleteService and SoftDeleteProject. The payload is
// ServiceDeletedEvent: event_id, service_id, service_name, service_type,
// user_id, project_id, project_slug, environment_id, environment_name.
// event_id is not the outbox row id. There is no backup API.
//
// # Idempotency and concurrency guarantees
//
//   - CreateImageDeployment and CreateAddonDeployment are idempotent on
//     (project_id, IdempotencyKey) via ON CONFLICT ON CONSTRAINT
//     uq_project_idempotency. A repeat returns Created=false and a zero BuildJob.
//     The same key for a different service is ErrConflict. git_commit_sha and
//     git_branch are NULL. No deployment.build.requested event is written.
//   - CreateDeploymentWithOutbox is idempotent on (project_id, IdempotencyKey)
//     and, for webhook triggers, on (TriggerEventID, service): a repeat returns
//     the original deployment and build job with Created=false and writes
//     nothing. Concurrent identical calls yield exactly one deployment, build
//     job and outbox row. The same key for a different service is ErrConflict.
//     Deployment, build job, outbox event, deployment_events row and the
//     service_sources tracking update commit atomically or not at all.
//   - The outbox payload is built by NewBuildRequestedPayload and has the same
//     document shape as the GitHub worker's, so
//     orchestrator.DecodeBuildRequestedPayload accepts it. build_run_id ==
//     build_jobs.id == attempt id (single attempt per build).
//   - TransitionDeployment is a row-locked compare-and-set: exactly one of
//     several concurrent callers wins; the rest get ErrInvalidTransition. Each
//     success appends one deployment_events row in the same transaction.
//     started_at is set on first leaving queued; finished_at on
//     failed/cancelled/superseded. The allowed (from, to) graph is the
//     caller's policy; the store rejects only unknown statuses and terminal
//     sources.
//   - RecordBuildStatus is idempotent on (build job, sequence). It never moves
//     a terminal job and never lets a 'heartbeat' stage overwrite current_stage.
//   - RecordBuildResult is idempotent: the same result again returns the stored
//     job with applied=false. A different terminal status, or a different
//     digest, is ErrConflict and changes nothing. Success requires an image
//     repository and a digest matching sha256:<64 lowercase hex>. It does not
//     touch the deployment; the orchestrator observes the job and transitions.
//   - MarkBuildJobTerminal never overrides an existing terminal result
//     (applied=false); the first terminal writer wins.
//   - MarkBuildDispatched is repeatable while the job is queued or dispatched.
//   - PromoteRelease is idempotent per deployment (unique index on
//     releases.deployment_id), requires status running, serialises release
//     numbering per environment, and deactivates/supersedes per service.
//   - RequestCancel is idempotent (first timestamp kept) and only records the
//     request; the orchestrator performs the cancellation. It is rejected with
//     ErrInvalidTransition for running or terminal deployments.
//
// # Limits and safety
//
// Build log lines are truncated to MaxLogMessageBytes (8 KiB), batches are at
// most MaxLogBatchLines, and reasons/error messages are capped (1 KiB / 4 KiB).
// The package never stores secret values: SecretReferenceInput has no value
// field and rejects paths that look like credentials. Image references are
// stored as repository@digest; no registry credentials are ever persisted.
package platformdb
