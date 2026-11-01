# Summit Managed Agents Subsystem Specification

**Status:** Revised draft; Gate 1 proof of concept required before implementation

**Scope:** First shared-runtime managed-agent vertical slice

**Ownership model:** Personal user ownership, consistent with the current Summit database model

**Architecture references:** [Platform database plan](./implementation_arpit.md), [Go API plan](./implementation_priyanshu.md), [orchestrator plan](./implementation_rudra.md)

## 1. Purpose and boundaries

Managed Agents add user-owned, project-scoped agents to Summit. The Summit Go API remains authoritative for user authentication, ownership checks, agent definitions, deployments, runs, quotas, billing, and public API contracts. A TypeScript adapter connects the Go control plane to Rivet. Rivet Actors run Pi Durable and own conversation and execution state. Kubernetes hosts the subsystem, and isolated sandbox workloads are the only place where agent tools may execute customer code.

This subsystem preserves Summit's existing user-owned project model. A user owns a project; agent definitions store that `user_id`/`project_id` pair, and child records inherit ownership through constrained foreign keys to their agent, deployment, or run. Public API authorization always resolves the project owner from PostgreSQL; client-supplied owner IDs are ignored. No organization ownership resource or key is introduced.

The dashboard calls only Summit's Go API. It never receives unrestricted Rivet credentials or chooses actor keys. Internal service traffic uses authenticated service identities. Agent prompts, model output, tool arguments, credentials, and sandbox contents are sensitive data and must not appear in logs or ordinary telemetry.

The `outbox_events` table and Go orchestrator worker are implemented for the existing deployment/build flow. Managed-agent event types, their handler, and authenticated delivery to the TypeScript adapter still need to be added. Extend the Go-owned outbox path; the adapter must not poll PostgreSQL directly. The existing build worker and gVisor build pods do not provide the per-run agent sandbox lifecycle described below.

Current repository boundaries:

- Project ownership is represented by `projects.user_id` and enforced by user-scoped queries. See [`0001_baseline.up.sql`](../apps/backend/internal/db/migrations/0001_baseline.up.sql) and [`projects.go`](../apps/backend/internal/platformdb/projects.go). Managed-agent records must follow this ownership path.
- The Go orchestrator currently handles `deployment.build.requested`. See [`cmd/orchestrator`](../apps/backend/cmd/orchestrator/main.go) and [`internal/orchestrator`](../apps/backend/internal/orchestrator). No managed-agent event handler or Rivet adapter exists yet.
- The existing builder launches isolated build workloads. It is not a reusable agent sandbox/session lifecycle. Managed agents need a separate per-run sandbox provisioner and cleanup contract.

### Rivet storage topology candidate

As of 2026-11-01, current Rivet 3.0 preview self-host documentation describes three or more identical control-plane instances, each with its own non-shared block-storage disk, backed by one shared S3-compatible bucket; actor nodes connect to the control plane and scale separately. The docs describe writes being replicated to a majority of control-plane disks before acknowledgement and copied to the bucket in the background. This is a candidate for Summit's pinned `rivetkit@3.0.0-preview.2`, not verified behavior in this repository. Rivet 3.0 is still preview software, and its documented topology requires storage, backup/restore, and node-loss tests in Summit's environment.

Gate 1 storage integration implements a typed wrapper adapter over Rivet's actor-scoped `c.db` (`RawAccess`) conforming to `@earendil-works/chord/sqlite`'s `SqliteDatabase` interface. All 25 Pi Durable Storage conformance test cases execute directly over actual Rivet actor `c.db` in `test/storage.test.ts`. This replaces actor-level `PI_STORAGE_DIR` local filesystem files with Rivet-owned actor databases. The underlying SQLite database is natively owned, managed, and purged by Rivet on actor destruction. While local actor storage and session teardown are verified, actual multi-worker placement, replication across control-plane disks, and machine-failure durability remain unproven until a Kubernetes cluster test. Do not put SQLite files on a shared network filesystem. See the [Rivet self-host Kubernetes guide](https://rivet.dev/docs/deploy/self-host/control-plane/kubernetes/), [storage reference](https://rivet.dev/docs/deploy/self-host/control-plane/storage/), and [Rivet 3.0 preview architecture](https://rivet.dev/changelog/2026-10-26-introducing-rivet-3-0-preview/).

## 2. Domain model

| Resource | Meaning | Source of truth |
| --- | --- | --- |
| User | Summit account that owns projects | Go API and PostgreSQL |
| Project | User-owned application boundary | Go API and PostgreSQL |
| Agent definition | Stable identity and current revision pointer for a configured agent | Go API and PostgreSQL |
| Agent revision | Immutable model, instructions, tool allowlist, limits, and credential-reference set | Go API and PostgreSQL |
| Agent deployment | One environment-specific activation pinned to one revision | Go API and PostgreSQL |
| Agent session | Independent conversation within one deployment, mapped 1:1 to one Rivet Actor owning one Pi Durable root conversation | Go API and PostgreSQL projection |
| Agent run | One accepted prompt/task execution in one session, pinned to the deployment revision | Go API and PostgreSQL projection |
| Rivet Actor | Runtime process for one agent session; holds one Pi Durable root conversation | Rivet |
| Pi Durable state | Conversation transcript, task state, and resumable execution state | Resides in the session actor's actor-scoped `c.db` via the typed `SqliteStorage` adapter; owned, managed, and destroyed natively by Rivet |
| Sandbox | Isolated filesystem/process environment used by approved tools | Kubernetes sandbox provisioner |

An agent definition can have deployments in multiple existing project environments. Each deployment pins one immutable revision. Each session belongs to one deployment and maps to exactly one Rivet Actor. Each actor owns one Pi Durable root conversation with independent context. Each run belongs to one session and records the same revision as its deployment. Pi's `requestId` is derived from the Summit `run_id` and is a second idempotency boundary, not the public API's only deduplication mechanism.

Gate 1 review verified that pinned `@earendil-works/pi-durable@1.4.0` has no supported conversation deletion API. Grouping multiple sessions into one deployment Actor would require raw SQLite deletions to purge individual sessions, breaking Pi's internal storage invariants. Therefore, Summit adopted the ADR 0001 fallback: one Rivet Actor per Summit session. Each session actor is keyed by `["summit-agent-v1", project_id, deployment_id, session_id]`. This guarantees that deleting a session allows destroying that session's actor and purging its dedicated storage without affecting other sessions in the deployment.

V1 is an on-demand, user-prompted agent. Sessions have independent conversation and actor state, but V1 does not run two sessions concurrently: at most one active run is allowed per deployment. Runs in every session share a bounded FIFO deployment queue managed durably in Go (`deployment_queue_seq`), so one long run can delay other sessions. Inputs within a session execute in order via per-actor serialization; V1 does not steer an active run. Cancellation of a queued run is immediate; cancellation of an active run remains a request until Pi confirms it. The initial `max_pending_runs` is 20 per deployment; excess requests receive `429 quota_exceeded`. Increase concurrency only after Gate 1 validates actor/session behavior and resource controls.

## 3. Kubernetes topology

Deploy shared managed-agent infrastructure in `agent-system`, separate from the Go control-plane namespace and customer application namespaces.

| Component | Responsibility |
| --- | --- |
| Agent API adapter | Authenticated internal bridge from Go job dispatch to Rivet; no public client endpoint |
| Rivet control plane | Actor addressing, scheduling, lifecycle, and runtime control |
| Rivet worker pool | Executes the registered Pi Durable Actor type |
| Model gateway / credential broker | Authorizes scoped model requests and credential capabilities without exposing provider keys to Rivet workers |
| Actor state storage | Stores durable actor database and Pi Durable conversation/run state according to a validated Rivet production topology |
| Proposed encrypted object storage | Holds bounded queued run inputs and permitted backups/artifacts; never stores plaintext prompts. This agent input service is not implemented yet. |
| Agent event collector | Converts allowlisted runtime events to Summit's event projection and telemetry |
| Sandbox provisioner | Creates, expires, and deletes an isolated sandbox for each run attempt |
| Execution namespace | Runs per-run customer-code sandboxes under the approved isolation runtime |

The initial runtime is shared across Summit users. Logical isolation is enforced through Summit ownership checks, server-generated actor keys, per-deployment configuration and credentials, tool allowlists, sandbox identity, quotas, and network policy. Shared runtime does not imply shared authorization or shared sandbox filesystems.

Rivet documents a single-writer invariant for an actor ID: at most one actor instance owns that actor's state at a time. This does not by itself establish storage replication, durable-write acknowledgement, backup, or recovery guarantees. The exact Rivet control-plane and worker manifests, actor storage backend, replication, backup, and restore topology are not specified until they are verified against the selected Rivet version and supported deployment mode. Do not use a shared filesystem PVC as a presumed multi-worker actor database. The feasibility test may use a single-node runtime with local persistent storage; that mode must be explicitly marked non-HA and must not claim cross-worker recovery. Before production, document actor placement/ownership, durable-write acknowledgement, worker failure/migration, backup/restore, and measured RPO/RTO. A worker-kill test must prove another worker can resume an acknowledged Pi execution before enabling multi-worker production scheduling.

### Execution boundary

Pi Durable's `CodingTools` must not execute in the Go API, adapter, or Rivet worker process. When shell or project filesystem access is enabled, the tools connect to a Summit-provisioned sandbox in the execution namespace. The sandbox must use the cluster's approved strong isolation runtime (the existing architecture specifies gVisor), bounded CPU/memory/storage and wall time, a per-sandbox service account, default-deny network policy, and explicit egress allowlists. OpenBao/ESO values are resolved by the scoped credential broker; they are never copied into PostgreSQL, actor state, Rivet worker environment, or logs. V1 does not expose raw credentials to arbitrary shell code.

If the cluster cannot place Rivet workers and sandbox workloads under the approved isolation model, code-executing agent tools remain disabled. A Rivet sandbox adapter by itself does not establish the required security boundary.

## 4. Ownership and data flow

1. A user calls the Go API with their authenticated Summit token. The API resolves the project and verifies its `user_id` matches the authenticated user.
2. The API transaction writes or updates the definition/deployment/run record and a corresponding `outbox_events` row.
3. The Go-owned outbox worker dispatches a managed-agent event through a new handler and authenticated adapter delivery path. The adapter receives resource IDs and an idempotency/event ID, not database credentials.
4. The adapter locates or creates the session actor using the server-generated key `("summit-agent-v1", project_id, deployment_id, session_id)`, then invokes Pi Durable through Rivet's typed actor API.
5. Rivet/Pi stores detailed conversation and execution state in actor storage. The adapter reports allowlisted lifecycle, event projection, and usage facts to authenticated Go internal endpoints.
6. The Go API validates that each callback's deployment and run belong to the expected user/project, writes the relational projection, and updates metering idempotently.
7. The dashboard reads run status and event projections through Go API endpoints. A live stream, if enabled, is proxied through the Go API or a short-lived, narrowly scoped capability minted by Go; the dashboard never receives a Rivet control-plane token.

The TypeScript adapter has no direct PostgreSQL access in the initial design. This preserves the repo's API-owned database boundary and avoids duplicating the Go persistence layer.

## 5. Proposed PostgreSQL records

The next migration is owned by the platform database maintainer and must preserve user ownership through project foreign keys and composite ownership constraints. Exact DDL and indexes are implementation work after review.

Use composite keys or constrained owner columns wherever a child row repeats `project_id` or `user_id`; they must match the parent project. Revisions belong to their agent, deployments to an agent/revision/project/environment, sessions to a deployment, runs to a session/deployment/revision, and attempts/events/usage/sandboxes to their run or attempt. Authorization must follow this ownership chain even when a child table does not repeat owner columns.

| Table | Proposed columns and constraints |
| --- | --- |
| `agents` | `id`, `project_id`, `user_id`, `name`, `current_revision_id`, create idempotency key/request hash, lifecycle/deletion fields, timestamps; composite FK to `(projects.id, projects.user_id)`; unique live name and create key per project |
| `agent_revisions` | `id`, `agent_id`, monotonically increasing `revision_number`, immutable `config` JSONB, `config_hash`, revision idempotency key/request hash, `created_by_user_id`, `created_at`; unique `(agent_id, revision_number)` and `(agent_id, idempotency_key)`; no secret values |
| `agent_deployments` | `id`, `agent_id`, `agent_revision_id`, `project_id`, `environment_id`, monotonic deployment number, deployment idempotency key/request hash, optional `supersedes_deployment_id`, pinned `runtime_version`, status (`provisioning`, `active`, `draining`, `read_only`, `failed`, `terminated`), deletion/retention fields, timestamps; composite FKs ensure the revision and environment belong to the agent's project; at most one active deployment per agent/environment and unique `(agent_id, environment_id, idempotency_key)` |
| `agent_sessions` | `id`, `deployment_id`, runtime-assigned `pi_conversation_id`, actor identity/key version, session idempotency key/request hash, status (`provisioning`, `active`, `read_only`, `purge_pending`, `purged`, `failed`), `created_by_user_id`, `created_at`, `last_activity_at`, `delete_requested_at`, `purge_after`; unique `(deployment_id, pi_conversation_id)` and `(deployment_id, idempotency_key)`; session state never crosses deployments |
| `agent_runs` | `id`, `session_id`, `deployment_id`, `agent_revision_id`, monotonic `deployment_queue_seq`, `idempotency_key`, `request_hash`, encrypted object `input_ref`, status, `created_at`, accepted/start/completion timestamps, error code, usage summary; composite FKs ensure the session and revision belong to the deployment; unique `(deployment_id, idempotency_key)` and `(deployment_id, deployment_queue_seq)` |
| `agent_run_attempts` | `id`, `run_id`, attempt number, dispatch/runtime attempt status, timestamps, stable runtime submission ID, safe error code; unique `(run_id, attempt_number)` |
| `agent_events` | `id`, `run_id`, actor-assigned monotonic `sequence`, stable `source_event_id`, `schema_version`, type, redacted payload JSONB, `occurred_at`; unique `(run_id, sequence)` and `(run_id, source_event_id)` |
| `agent_usage` | `id`, `run_id`, `run_attempt_id`, `metric_type`, `quantity`, `unit`, optional provider/model and provider-cost attribution, stable `source_event_id`, `idempotency_hash`, `created_at`, `purge_after`; unique source and idempotency keys; no prompt or secret data |
| `agent_credentials` | `id`, `agent_id`, `project_id`, `environment_id`, `user_id`, name, `secret_reference_id`, purpose, timestamps; ownership constraints require the agent and referenced `secret_references` row to belong to the same user/project/environment; V1 tool grants only; no secret value column |
| `agent_sandboxes` | `id`, `run_attempt_id`, opaque provider sandbox ID, status, scope fixed to `run_attempt`, expiry/heartbeat fields, timestamps; one sandbox per attempt; no filesystem contents or sandbox credentials |

Agent revisions are immutable: changing model, instructions, tools, limits, or credential references creates a new revision. A deployment pins one revision, and every run copies that revision ID. Updating a definition does not mutate active deployments; applying the new revision requires a deployment update/redeploy. Rollback means deploying a prior immutable revision, subject to runtime compatibility. Agent, revision, and deployment create requests use stable idempotency keys and canonical request hashes. The key is unique within the project for agent creation, within the agent for revision creation, and within the agent/environment for deployment creation. A replay with the same hash returns the existing resource; reuse with a different hash returns `409`.

Each deploy creates a new `agent_deployments` record. Every session in that deployment has a separate actor key derived from the project, deployment, and session IDs. At cutover, the prior deployment stops accepting new sessions/runs; already-running runs finish or are cancelled under the rollout policy. Its session actors remain available in read-only mode until their retention expires, then each actor and its storage are destroyed. Sessions remain bound to their original deployment/revision. V1 does not migrate transcript/context between revisions. A rollback creates another deployment pinned to the earlier revision and starts fresh sessions.

The runtime assigns each session's Pi conversation ID after actor initialization. Clients cannot choose this ID, and the session creation request and outbox event omit it until the runtime reports it to Go.

`agent_runs` and `agent_events` are a platform-facing projection, not a second Pi transcript store. Events contain lifecycle and UI-safe progress fields only. Full conversation history and tool payloads stay in actor storage. If users need transcript display, the Go API retrieves it through the adapter under authorization and explicit retention policy rather than copying it wholesale into `agent_events`.

`request_hash` is a SHA-256 hash over a canonical representation of deployment ID, session ID, revision ID, input content, attachment references, and execution options. It excludes server-derived data and secret values. In one transaction, the unique `(deployment_id, idempotency_key)` insert either creates the run, returns the existing run when hashes match, or returns `409` when they differ. Reusing a deployment key in another session produces a different hash and a conflict. Run retries create attempt rows, not new runs. The PoC's actor-level `[session_id, prompt]` hash is only a narrow deduplication check; it does not replace this Go-owned admission hash.

V1 creates one fresh ephemeral sandbox per run attempt. A retry gets a new sandbox; no filesystem is mounted into a later attempt, and persistent workspaces are out of scope. This avoids carrying untrusted files across retries and concurrent runs. A future workspace feature requires explicit volume lifecycle, locking, snapshot, and access-control contracts.

Deletion is explicit and asynchronous. Deleting an agent tombstones it, blocks new deployments/runs, cancels queued runs, and revokes the agent's credential grants immediately; it does not delete project/user credentials. Active runs receive a cancellation request. The control plane waits for terminal confirmation or fences and force-terminates the actor/sandbox after a bounded deadline before purging conversation state. Run/event/usage source records are retained for 30 days after deletion for operational audit and billing reconciliation, then purged; append-only billing ledger records follow the platform's billing retention policy. Actor backups must honor deletion tombstones and expire deleted state within the same retention window.

Deleting a single session blocks new submissions and immediately cancels queued runs. It requests cancellation of an active run and keeps the session `purge_pending` until that run is terminal or its actor has been fenced. Then it destroys that session's Rivet actor via its `destroy` action (`c.destroy()`). Rivet invokes `onDestroy` to close the Pi Harness and natively purges that actor's `c.db`; Summit does not remove SQLite files through filesystem APIs or raw SQL. Other session actors in the deployment remain completely unaffected. Non-content run status and usage facts remain under the stated retention period.

The existing append-only `metering_ledger` remains the billable ledger. Its current schema stores user/project/environment, `metric_type`, `quantity`, time window, and unique `idempotency_hash`. `agent_usage` retains source facts and provider/model cost attribution; the reconciler emits idempotent ledger rows for chargeable quantities such as model input/output tokens and sandbox seconds. Keep model cost, sandbox compute, runtime infrastructure, and storage as distinct dimensions. Runtime/storage billing is out of V1. Do not assume the current ledger stores arbitrary monetary cost; if direct provider-cost entries are required, define a ledger contract change before implementing them. Never bill both a usage projection and the corresponding ledger row.

### Durable run input

An accepted `202` response means Summit durably accepted responsibility for processing; it does not mean Rivet has accepted or started the run. The prompt must survive API/adapter restarts before Rivet accepts it. The outbox must not contain plaintext prompts.

- V1 stores bounded prompt/attachment input in a private encrypted object store. `agent_runs` and `outbox_events` contain only an opaque `input_ref` and canonical request hash. Object keys are unguessable; access is limited to Go and the authenticated adapter, with server-side encryption using an approved OpenBao/cloud-KMS-managed key.
- The Go API uploads input before committing the run and outbox transaction. If the transaction fails, an orphan-object sweeper removes the unreferenced input. The API returns `202` only after both object upload and the database transaction succeed.
- After receiving the run job, the adapter fetches input from a Go internal endpoint using its short-lived service identity. Go verifies the job/run binding and returns only that run's input over internal TLS. The adapter submits it to the correct actor. Keep the object until the run reaches a terminal state, then delete it after the bounded input-retention window. If the run is permanently undispatchable or its input expires while queued, mark it terminal with a safe error code and delete the object.

Input size and retention are bounded, and logs/errors never include input text. This storage path makes the accepted-run contract explicit without putting prompts in PostgreSQL or the outbox.

## 6. Public API contract proposal

All endpoints below are authenticated user endpoints. Every lookup and mutation is scoped by the verified user's ownership of the project. Public paths use project slugs for project-scoped operations and UUIDs for persisted resources. Add these operations to `packages/api_spec/openapi.yaml` before implementation.

| Operation | Semantics |
| --- | --- |
| `POST /api/v1/projects/{slug}/agents` | Require an `Idempotency-Key`; validate model, tool names, resource limits, and credential references; atomically create the definition and initial immutable revision. Return `201`. A replay with the same hash returns the same resources; a different hash returns `409`. Creation does not silently choose an environment. |
| `GET /api/v1/projects/{slug}/agents` | List the caller's agent definitions for the project. |
| `GET /api/v1/agents/{agent_id}` | Return definition and deployment summaries after ownership verification. |
| `GET /api/v1/agents/{agent_id}/revisions` | List immutable revisions, with secrets represented only by reference metadata. |
| `POST /api/v1/agents/{agent_id}/revisions` | Require an `Idempotency-Key`; validate and create a new immutable revision; return `201` and its revision ID. A replay with the same hash returns the same revision; a different hash returns `409`. Updates never edit an existing revision. |
| `POST /api/v1/agents/{agent_id}/deployments` | Require an `Idempotency-Key`, existing project `environment_id`, and `agent_revision_id`; transactionally create a new deployment generation and outbox event; return `202`, deployment ID, pinned revision, initial status, and `Location`. A replay with the same hash returns that deployment. The prior active deployment is superseded only after the new deployment is healthy. |
| `GET /api/v1/agent-deployments/{deployment_id}` | Return persisted deployment lifecycle state and redacted runtime status. |
| `GET /api/v1/agent-deployments/{deployment_id}/sessions` | List sessions owned by the deployment. |
| `POST /api/v1/agent-deployments/{deployment_id}/sessions` | Require an `Idempotency-Key`; persist an independent session and enqueue `agent.session.ensure.requested`; return `202` with status `provisioning`. The adapter creates/locates the Pi conversation idempotently and Go marks the session `active`. Same key/hash returns the same session; different hash returns `409`. |
| `GET /api/v1/agent-sessions/{session_id}` | Return session metadata after ownership verification. |
| `GET /api/v1/agent-sessions/{session_id}/runs` | List runs in session order. |
| `POST /api/v1/agent-sessions/{session_id}/runs` | Require an `Idempotency-Key`; store the input object, then atomically persist run metadata and dispatch intent in PostgreSQL. Return `202` only after both are durable, with `run_id`, status `queued`, and `Location`. An orphan-object sweeper cleans input whose database transaction failed. Same key and hash returns the same run; same key with a different hash returns `409`. |
| `GET /api/v1/agent-runs/{run_id}` | Return status, timestamps, safe error code, and usage summary. |
| `GET /api/v1/agent-runs/{run_id}/events?after={sequence}` | Return durable, cursor-paginated UI-safe events whose actor-assigned sequence is greater than `after`. Reconnect resumes from the last stored sequence. |
| `GET /api/v1/agent-runs/{run_id}/stream` | Optional authenticated SSE stream proxied by Go. Token deltas are ephemeral; durable milestone events retain the same sequence and can be fetched after reconnect. |
| `GET /api/v1/agent-sessions/{session_id}/messages?after={cursor}` | Return authorized, paginated conversation messages through the adapter; redact secrets and omit internal-only tool payloads. Never expose a Rivet token or actor key. |
| `DELETE /api/v1/agent-sessions/{session_id}` | Stop new runs, request cancellation of an active run, mark the session for deletion, and asynchronously purge its Pi conversation and event projection. |
| `POST /api/v1/agent-runs/{run_id}/cancel` | Request idempotent cancellation; return `202` while cancellation is being reconciled. |
| `DELETE /api/v1/agents/{agent_id}` | Tombstone the definition and enqueue deployment termination; return `202` until all deployments are terminated. |

Errors use the backend's existing RFC 7807 response helper. At minimum, distinguish `not_found` (including inaccessible ownership-scoped resources), `conflict`, `invalid_agent_config`, `quota_exceeded`, `runtime_unavailable`, and `idempotency_conflict`.

V1 is on-demand: users explicitly create sessions and submit prompts. Always-on agents, scheduled triggers, inbound webhooks, agent-to-agent delegation, human approval flows, persistent workspaces, and bring-your-own model credentials are outside this slice. Keep the contracts versionable, but do not add unimplemented product modes to the V1 API.

## 7. Internal contracts

### Go outbox to TypeScript adapter

Use the existing outbox and Go orchestrator worker as the durable dispatch source. Add a managed-agent handler and authenticated internal adapter delivery with stable `event_id`, `event_type`, `schema_version`, `aggregate_id`, and a minimal payload. Candidate event types:

- `agent.deployment.provision.requested`
- `agent.deployment.terminate.requested`
- `agent.session.ensure.requested`
- `agent.run.submit.requested`
- `agent.run.cancel.requested`

The adapter must handle duplicate delivery idempotently by `event_id` and resource ID. It acknowledges only after Rivet has durably accepted or located the corresponding actor operation. A failed delivery remains retryable under the outbox's existing attempt/lease policy. Terminal failures are reported back as redacted status codes; the adapter does not mutate Summit tables directly.

Session creation is asynchronous: `202` means Summit persisted the session and dispatch intent, not that the Pi conversation is ready. Runs submitted while the session is `provisioning` remain queued and cannot execute until the Go projection marks it `active`. If session provisioning reaches a permanent failure, queued runs become terminal with a safe `session_unavailable` error.

### Adapter to Go event/usage intake

Internal callbacks use a distinct machine-to-machine audience and a short-lived scoped credential. Each callback carries stable `event_id`, deployment/run IDs, a monotonic per-run sequence, schema version, and event type. The actor's event collector serializes per-run appends, increments the sequence, and atomically stores the event in bounded durable actor state before callback delivery; the sequence and journal survive actor restarts. Go verifies IDs and runtime identity, deduplicates by event ID and sequence, persists out-of-order events without exposing them, and returns the highest contiguous `ack_through_sequence`. The actor deletes only journal entries at or below that acknowledgement and resends later entries until gaps close. A full journal pauses further milestone production rather than dropping events. Duplicate callbacks are harmless. Reject unknown event types, oversized payloads, cross-project identifiers, and callback data containing credential-shaped fields.

Persist only durable runtime milestones: run accepted/started/completed, model call started/completed, tool started/completed, approval (when later enabled), and error. The queued state is authoritative in `agent_runs`; it is not duplicated as an actor event. Do not persist every token delta or raw Pi event. The Go event endpoint uses `?after={sequence}` as a resumable cursor. Live text deltas may travel through authenticated SSE and are intentionally ephemeral; after reconnect, the client resumes from the latest durable milestone and reads the final transcript only through an authorized API path.

## 8. Actor and Pi identity

Actor keys are generated only from persisted IDs, not accepted from clients. Versioned actor key tuple:

```text
["summit-agent-v1", project_id, agent_deployment_id, session_id]
```

Rivet namespace and environment configuration distinguish development from production. Project, deployment, and session IDs are opaque identifiers; API authorization is still mandatory because obscurity of an actor key is not an authorization mechanism. Actor configuration references a versioned agent definition and credential references, but contains no secret values.

Each session actor owns exactly one Pi Durable root conversation. Gate 1 review confirmed that pinned `@earendil-works/pi-durable@1.4.0` has no supported conversation deletion API. The Gate 1 pivot to one Actor per session aligns actor lifecycle with session lifecycle: destroying a session destroys its Rivet Actor, closes the Pi harness in `onDestroy`, and lets Rivet purge only that session actor's actor-scoped `c.db`.

Pin exact compatible versions of Node.js, `rivetkit`, `@rivet-dev/pi` if used, `@earendil-works/pi-durable`, and Pi dependencies. Current Rivet documentation lists Node.js 22.19 or later and describes Pi Durable as beta. It also documents roll-forward-only state compatibility: a new version may write state that an older version cannot read. Each upgrade therefore needs a tested migration/restore procedure; a binary rollback against newer state is prohibited. If rollback is required, deploy a new actor generation from a verified compatible backup.

Use Summit's stable `run_id` as Pi's `requestId`. Pi deduplicates a repeated submission with that ID, but this does not make external side effects exactly once. Current Pi Durable guidance says plain tool calls are not rerun after a crash, cut-off model requests may be sent again from the start, and replay behavior depends on whether a task or tool is marked safe. Use durable tasks or safe replay only after the receiving side enforces the stable `operation_id` described below. Reconcile provider usage so a replayed model request cannot be counted twice. Pi's documented wait limit is ten minutes; long work must use the asynchronous submission/streaming path and Summit's run timeout contract.

## 9. Secrets, telemetry, and billing

### Scoped credential broker

OpenBao values are never mounted wholesale into Rivet workers, placed in worker environment variables, or stored in actor state. PostgreSQL contains only references. A Summit credential broker resolves references after authorization against the active deployment, pinned revision, user/project/environment, requested purpose, and tool allowlist. Each request uses a short-lived credential scoped to the deployment/revision, environment, purpose, audience, and expiry. V1 uses Summit-managed model provider credentials; bring-your-own provider keys are not enabled.

The `agent_credentials` table only grants tools access to approved project/environment secret references. Model-provider keys are platform-managed broker configuration and are not copied into per-agent credential rows.

Model requests originate in the Pi runtime, but raw provider keys stay in the broker. Configure Pi's model provider to use a Summit model gateway/proxy that authenticates the scoped actor credential, enforces provider/model allowlists and per-run limits, and forwards to the provider. It returns model responses, never the raw provider key. Before implementation, prove that the selected Pi provider integration can route requests through this gateway without persisting the scoped credential in Pi conversation state.

Sandbox credentials have a different path. Rivet workers receive no sandbox secrets. V1 sandboxes receive no general-purpose secret mounts. Approved tools request a single credential capability from the broker; the broker either performs the operation itself or issues a short-lived, one-purpose credential directly to the sandbox. Arbitrary shell tools cannot ask for credentials. A sandbox must not inherit credentials from a previous run. If a secret must be readable by user-controlled code, that requires a separate product/security decision and is not allowed in this V1 slice.

The broker authenticates the runtime identity and verifies the deployment/revision/tool/environment binding on every request. Its actor identity assertion must be unforgeable by the model and sandbox and scoped to one deployment; validating how the chosen Rivet worker runtime supplies this identity is a Gate 1 requirement. Broker access is denied by default. Provider credentials and sandbox credentials use separate audiences and policies. A short-lived model-gateway token may exist only in actor process memory, including Rivet's non-persisted runtime variables if required. It must never enter persisted actor state or SQLite, Pi entries, tool results, snapshots, logs, or sandbox environments.

Rivet workers run only Summit-maintained actor code and approved extensions. User-defined code and arbitrary extensions never execute in the worker process. Network policy denies direct access to OpenBao and provider endpoints from workers; provider traffic goes through the model gateway. This limits the blast radius of shared worker processes, though a worker-process compromise remains a shared-runtime security incident and must be treated accordingly.

### Telemetry and usage

- Emit OpenTelemetry traces and structured logs with resource IDs in trace fields/log records, not metric labels. Never record prompts, transcripts, model output, tool arguments/results, environment values, or secret material in telemetry attributes.
- Agent event collector forwards low-cardinality aggregate metrics to Prometheus and redacted structured operational logs to existing Fluent Bit/Loki. Do not duplicate raw Pi event streams or token deltas into Loki.
- Persist model input/output token counts and provider cost, and sandbox active seconds for V1. Keep provider cost, sandbox compute, runtime infrastructure, and storage as separate usage dimensions; runtime/storage billing is out of scope for V1. Reconcile billable facts idempotently into `metering_ledger` using stable source hashes.
- Back up actor durable storage. V1 sandbox workspaces are ephemeral and are not backed up. Agent deletion destroys actor state and sandbox contents according to the deletion/retention policy in Section 5.

### Side-effecting tool safety

Durable execution is not exactly-once execution. Before dispatching a side-effecting tool call, Summit records a stable `operation_id` derived from the Summit run ID and stable Pi tool-call ID. The same ID is reused for every delivery retry, independent of attempt number. A Summit-owned receiving service must persist that ID with the result and return the saved result on duplicate delivery. Gate 1 must verify that the selected Pi execution path preserves a usable tool-call ID across recovery; otherwise side-effecting tools stay disabled for that path. Regenerated model output can represent a new operation and is not deduplicated by this mechanism. Run idempotency, Pi request deduplication, tool-operation idempotency, and event-delivery deduplication are four distinct contracts.

V1 exposes only read-only tools and Summit-owned side-effect tools whose receiving services enforce `operation_id` idempotency. Do not expose generic email, payment, GitHub mutation, deployment, database-write, or arbitrary HTTP tools unless their destination supports idempotency or the operation has a separately designed approval/compensation contract. A replay-safe Pi tool must only be marked safe after its external side effects are idempotent.

Tool outputs are treated as untrusted data. Secret-bearing responses are filtered/redacted before returning to the model, and secrets are never included in errors. This is a defense-in-depth rule, not a guarantee that a model can never infer sensitive data from a tool response; tool schemas must return the minimum data necessary.

## 10. State machines, execution ordering, and recovery

Deployment lifecycle:

```text
provisioning -> active -> draining -> read_only -> terminated
      |            |         |
      +----------> failed    +----------> failed
```

Session lifecycle: `provisioning -> active -> read_only -> purge_pending -> purged`; provisioning can end in `failed`, and deletion can move an active session directly to `purge_pending` after its runs are terminal or fenced.

Run lifecycle:

```text
queued -> dispatching -> accepted -> running -> succeeded
    |            |          |          |  \
    |            |          |          +--> failed
    |            |          +------------> cancelling -> cancelled
    |            +-----------------------> failed (permanent dispatch failure)
    +------------------------------------> cancelled (cancelled before dispatch)
```

`202 Accepted` means Summit durably accepted responsibility for the queued run, not that the adapter or Rivet accepted it. `accepted` means the actor durably admitted the Pi submission. `running` begins only when Pi reports execution start. Transient dispatch failure remains queued/retryable; exhausting policy moves the run to `failed` with a stable `dispatch_failed` code and visible retry/manual-requeue metadata. Do not leave an accepted response indefinitely in a vague state.

Rivet Actor actions run in parallel across actors, and each session actor serializes submissions locally via an in-memory queue (`inActorOrder`). However, actor action concurrency cannot provide deployment-wide ordering across sessions. Summit's Go outbox and PostgreSQL-assigned `deployment_queue_seq` remain strictly authoritative for deployment-wide admission, concurrency limits (1 active run per deployment across all sessions), and FIFO ordering across session actors. V1 submissions do not steer an active run. A Pi busy or rejection response is mapped to safe queue/retry handling, never a duplicate run.

Assign `deployment_queue_seq` transactionally when accepting each run. The Go dispatcher must claim only the next sequence for a deployment and must not submit a later run while an earlier one is active. The outbox's concurrent `SKIP LOCKED` claims may otherwise reorder jobs; actor action concurrency cannot be used as the ordering guarantee. The initial `max_pending_runs` default is 20 per deployment, including runs waiting behind the active run.

State transitions and timestamps are owned by Go's reconciled projection. Every run attempt has a row and preserves the same run ID/request hash. Runtime retries use the same stable Pi request ID. Rivet actor state is not a substitute for Summit deployment/run status.

There are four separate idempotency domains:

1. **Run admission:** `(deployment_id, idempotency_key)` under a database unique constraint; compare `request_hash` to distinguish a retry from key reuse with different input.
2. **Pi submission:** Summit `run_id` as Pi `requestId`.
3. **Tool side effect:** stable `operation_id` at the receiving service, recorded with the completed result.
4. **Event intake:** stable source `event_id` and actor-assigned sequence, deduplicated by Go before exposing the cursor.

Expected recovery behavior:

- Adapter restarts: unacknowledged outbox deliveries retry; actor lookup and operations remain idempotent.
- Actor worker crash: Rivet restores actor state; Pi resumes from committed steps according to its documented replay rules.
- Duplicate run request: Go returns the existing run for the same idempotency key and payload.
- Duplicate runtime event: Go ignores the already-recorded event ID/sequence.
- Delayed/out-of-order runtime event: Go buffers later actor-assigned sequences and exposes only a contiguous prefix; the actor's durable journal retries missing deliveries, and the sequence remains stable after actor restart.
- Concurrent session submissions: each session retains its own Pi root conversation in its dedicated session actor; the V1 deployment queue admits one active run at a time and preserves FIFO order without merging context.
- Sandbox loss: deployment remains recoverable; sandbox is recreated only under policy. If files are not persisted, report workspace loss and do not imply otherwise.
- Rivet/storage outage: agent reads that do not require the runtime continue from PostgreSQL projections; new runs remain queued or fail with a retryable status, never falsely report success.
- Actor storage corruption or failed migration: quarantine the actor/deployment and restore from verified backup. Do not downgrade Pi Durable blindly.

## 11. Implementation gates

### Gate 1 — Rivet/Pi feasibility proof of concept

Do this before database migrations, public API work, or dashboard work. Deploy a minimal Rivet test runtime and a Pi Durable Actor in the test Kubernetes environment. Keep it out of production and use synthetic credentials and data.

An executable partial PoC is in [`poc-managed-agents`](../poc-managed-agents/README.md). Pi Durable 1.4.0 Harness tests verify separate concurrent conversations, same-conversation follow-up ordering, repeated request IDs, and local SQLite transcript recovery. Following verification that pinned Pi Durable 1.4.0 has no supported conversation deletion API, Gate 1 pivoted from one actor per deployment to one Rivet Actor per Summit session. Actor-level tests run through RivetKit 3.0.0-preview.2's local test runtime with the pinned statically linked `@rivetkit/engine-cli-linux-x64-musl` binary and verify two session actors with separate 4-element keys (`["summit-agent-v1", project_id, deployment_id, session_id]`), separate SQLite files, transcript isolation, request idempotency, and isolated session destruction without affecting surviving session actors.

The destruction lifecycle is tested using public Rivet APIs: calling `destroy()` invokes the engine's `onDestroy` hook, which gracefully closes the Pi Harness. Rivet owns and purges the actor-scoped `c.db` when the actor is destroyed; the actor runtime does not remove SQLite files through filesystem APIs or raw SQL.

Exact runtime engine findings: The local static musl Rivet Engine CLI runs in this environment. In the test runtime, invoking `destroy()` reliably calls the `onDestroy` callback and marks the actor destroyed so subsequent `get()` queries fail with `not_found`. During actor stopping, the engine logs an internal `serializeState callback returned error: Actor stopping` warning.

Actor recovery over `c.db` is verified using public Rivet actor APIs: invoking `sleep()` calls `c.sleep()`, which triggers `onSleep` to gracefully close the Pi Harness, releasing Pi storage resources while keeping `c.db` intact, and unloads in-memory actor state. When the actor is subsequent addressed via `client.managedAgent.get(key)`, Rivet wakes the actor and re-invokes `createVars`, re-opening the Pi Harness over `c.db`. Tests confirm that previously acknowledged conversation transcripts survive intact, request idempotency and input conflict detection are preserved, and follow-up submissions execute successfully over the recovered conversation.

Testability boundary: In pinned `rivetkit@3.0.0-preview.2`, the native runtime N-API binding (`rivetkit-napi`) operates as a process-level singleton. Calling `registry.shutdown()` terminates the local engine child process and transitions the native module into an unrecoverable `shut_down` state. In-process attempts to start a second registry instance within the same test runner process fail at readiness check (`503 status: shut_down`) and invoke `process.exit(1)`. Full engine restart testing is bounded by this single-process test harness constraint, while actual-runtime actor recovery over durable `c.db` is verified via actor sleep/wake lifecycle. Multi-worker scheduling, cross-worker actor migration, quorum disk replication, and machine-failure durability/RPO/RTO remain unverified in the local environment and require Kubernetes cluster testing.

Remaining Gate 1 validation items:
- Redeliver session provisioning after adapter/actor restart and verify retries locate the same logical Pi conversation; queued runs must wait until Go records the session as active.
- Submit concurrent prompts across sessions. Verify Pi's conversation busy semantics, Rivet's parallel action behavior, and Summit's explicit per-deployment queue/limit. Confirm no prompt appears in another session.
- Kill a worker during a model request, a tool invocation, and between durable Pi task phases. Verify replay behavior and whether a second worker can resume the actor's state.
- Emit sequenced milestone events, restart the actor, and deliver callbacks duplicated and out of order. Verify the actor journal preserves sequence and Go withholds cursor results until gaps are filled.
- Pi Durable storage is now adapted to Rivet's actor-scoped `c.db` via the typed `SqliteDatabase` wrapper, passing all 25 storage conformance cases. Next, validate multi-worker actor placement/ownership, quorum write acknowledgement, storage migration, backup/restore, worker loss behavior, and the selected multi-worker topology against the pinned release in a Kubernetes cluster test. If only local single-node storage works in staging, document the runtime as non-HA and constrain scheduling to that node for the prototype.
- Record measured RPO/RTO and require an operational owner to approve the production values. Do not imply zero-RPO or automatic migration without test evidence.
- Test a fresh sandbox per run attempt under gVisor, default-deny egress, cleanup, and the credential broker path. No raw secret may appear in actor state, worker environment, prompt, logs, or telemetry; retry must not reuse prior sandbox files or credentials.
- Pin exact Rivet/Pi/Node dependency versions and document actor state upgrade, backup, restore, and no-downgrade behavior.

Gate 1 passes only when the results are recorded and the Go API, database, and orchestrator owners accept the runtime, storage, session, concurrency, and security contracts.

### Gate 2 — Summit control-plane integration

- Add migrations and typed Go persistence/service contracts for definitions, immutable revisions, deployments, sessions, runs, attempts, redacted event projections, credential references, sandbox references, and usage facts.
- Add OpenAPI operations and Go handlers for revision/session/run lifecycle, ownership checks, run idempotency hashes, cursor events, cancellation, and internal callbacks.
- Implement or extend the Go outbox consumer to deliver authenticated jobs and track retry/permanent failure.
- Build the TypeScript adapter and actor registry; adapter accesses Rivet and the Go internal APIs only, never PostgreSQL directly.

### Gate 3 — Security and isolated execution

- Implement the model gateway and scoped credential broker; validate actor/deployment identity, revision, environment, tool, purpose, and short expiry on every resolution.
- Ensure Rivet workers cannot read OpenBao values or directly reach provider endpoints; ensure no worker environment contains per-user credentials.
- Provision one fresh gVisor sandbox per run attempt, with a per-sandbox service account, resource/wall-time limits, network policy, and deterministic cleanup. A retry must not inherit the previous attempt's filesystem or credentials.
- Enable only allowlisted read-only or idempotent tools. Verify cross-user access denial and that tool operation IDs deduplicate side effects.

### Gate 4 — Product experience

- Add dashboard support for definitions/revisions, deployments, independent sessions, run queue/state, cancellation, cursor reconnect, and usage.
- Decide then implement any always-on agent, schedule/webhook trigger, human approval, agent delegation, persistent workspace, or user-provided model credential feature as separate product scope.

## 12. Acceptance and failure-recovery checks

- A user cannot read, modify, deploy, run, cancel, or delete another user's agent by changing a project, definition, deployment, or run ID.
- Agent revision creation is immutable; deployment pins one revision; every run reports that revision even after the agent's current revision changes or rolls back.
- Agent creation and initial revision persist in one transaction. Agent, revision, deployment, and run create retries return the existing resource for the same idempotency key/hash and return `409` for key reuse with a different request.
- A run returns `202` only after run metadata, bounded input storage, and outbox dispatch intent are durable. Same idempotency key and request hash returns the same run; the same key with another hash is rejected transactionally.
- Two sessions on one deployment have independent Pi conversations. Same-session runs execute in order; V1 deployment concurrency is one and backlog limits produce a clear `429`.
- A run queued behind a `provisioning` session does not dispatch early; permanent session-provisioning failure produces a visible `session_unavailable` run result.
- Kill the adapter after receiving an event but before acknowledgement; redelivery locates the same actor and does not duplicate deployment or run.
- Kill a Rivet worker during a model call, during a tool call, and between Pi task phases; verify resulting behavior against Pi Durable's replay contract and ensure tool `operation_id` side effects are deduplicated by their receiving service.
- Restart or reschedule actor workers across nodes; verify Pi state survives using the selected documented storage topology. If the chosen adapter stores actor data in SQLite, prove database recovery and single-writer behavior without assuming a shared filesystem is a supported multi-worker backend.
- Interrupt Rivet storage, event callback delivery, and Go database availability independently; status remains truthful and retries are safe.
- Retry a run and verify it receives a fresh sandbox with no prior files or credentials; verify gVisor, network restrictions, secret boundaries, resource ceilings, and cleanup.
- Duplicate and reorder runtime events; ensure actor-assigned sequences survive restart, Go exposes only contiguous cursor results, client reconnect resumes after its cursor, and metering remains idempotent.
- Verify only milestone events are persisted; token deltas are ephemeral and do not create per-token PostgreSQL/Loki writes.
- Verify active-run cancellation waits for a confirmed terminal result, queued-run cancellation is immediate, and exhausted dispatch retries reach a visible permanent failure.
- Verify agent deletion revokes credential access, terminates actors and sandboxes, applies transcript/event retention, and expires corresponding backups.
- Verify telemetry, logs, errors, and event payloads contain no prompt, transcript, tool output, environment secret, or provider credential.
- Restore actor state and sandbox metadata from backup in an isolated test environment; document recovery point and recovery time results.

## 13. Decisions and open gates

### V1 design targets

- Summit Go remains the public control plane and owner of platform records.
- The target is one Rivet Actor per Summit session, keyed by project, deployment, and session IDs, with one Pi Durable root conversation per actor. The pinned Pi Durable version does not support deleting a single conversation from a multi-session Harness, so session deletion destroys its dedicated actor and storage.
- Initial offering uses one shared Rivet runtime across Summit users, with actor/process sharing treated as a threat boundary and credentials never placed in shared worker environments.
- User ownership remains the complete and only account model for this subsystem.
- Immutable revisions are pinned to deployments and runs; new revisions deploy as new deployment generations.
- V1 uses independent on-demand sessions, one active run per deployment, a bounded FIFO run queue, and a fresh ephemeral gVisor sandbox per run attempt.
- V1 uses Summit-managed model credentials through a scoped model gateway; arbitrary worker/sandbox credential mounts and bring-your-own model keys are excluded.
- V1 queued prompt inputs use private encrypted object storage; PostgreSQL and outbox payloads keep only opaque input references and hashes.
- V1 exposes only read-only tools or Summit-owned tools with receiver-enforced operation idempotency.
- Runtime milestone sequence is assigned and journaled by the actor; Go deduplicates and exposes a contiguous cursor stream.
- Agent code execution is confined to isolated Kubernetes sandboxes; no shell/filesystem tools run in control-plane processes.
- PostgreSQL holds resource metadata and projections. Actor storage holds conversations and detailed durable execution state.

### Must be validated before production deployment

- Rivet's selected release's actor placement/ownership, multi-worker persistence topology, durable write acknowledgement, backup/restore workflow, node failure behavior, and measured RPO/RTO.
- Pi Durable version compatibility, actor storage migration, and forward-only upgrade/restore procedure. Never roll back a binary against state written by a newer incompatible runtime; deploy a fresh actor generation for rollback.
- Model gateway compatibility with the selected Pi provider integration, signed actor/deployment identity, scoped credential broker policies, and provider usage reconciliation.
- Sandbox provider integration with Summit's gVisor runtime, per-run-only filesystem policy, egress rules, credential isolation, resource limits, and cleanup.
- Validate the selected object storage service, OpenBao/cloud-KMS key ownership, queued-input expiry, and orphan-object cleanup.
- Exact event transport, service authentication, delivery acknowledgements, retry policy, and callback schema.
- V1 quota ceilings, run timeouts, model/tool allowlist, billing units, and event retention.

These gates resolve runtime and operational guarantees within Summit's existing user-owned project model.

## 14. Current documentation references

- Vendor documentation checked on 2026-11-01.
- [Rivet Pi integration](https://rivet.dev/agents/docs/pi/): one Pi session per Actor in the documented integration, sandbox tool boundary, Node.js minimum, beta status, replay limits, and roll-forward compatibility.
- [Rivet agent recovery model](https://rivet.dev/agents/docs/architecture/): actor sleep, restart, upgrade, tool replay, and sandbox persistence behavior.
- [Rivet actor state](https://rivet.dev/actors/docs/state/): durable actor state, ephemeral runtime variables, and actor-scoped SQLite.
- [Rivet actor keys](https://rivet.dev/actors/docs/keys/): stable actor addressing and the actor single-writer identity boundary.
- [Rivet actor lifecycle](https://rivet.dev/actors/docs/lifecycle/): create/wake/sleep/destroy hooks and cleanup expectations.
- [Rivet actor actions](https://rivet.dev/actors/docs/actions/): action invocation behavior; actions execute in parallel by default.
- [Rivet self-host Kubernetes guide](https://rivet.dev/docs/deploy/self-host/control-plane/kubernetes/), [storage reference](https://rivet.dev/docs/deploy/self-host/control-plane/storage/), and [3.0 preview architecture](https://rivet.dev/changelog/2026-10-26-introducing-rivet-3-0-preview/): candidate control-plane, disk, object-bucket, actor-node, replication, and recovery topology; verify against pinned preview versions before relying on it.
- [Pi Durable package documentation](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md): API, durable tasks, persistent request IDs, storage, and replay behavior.
- [Pi Durable busy conversations](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md#busy-conversations): per-conversation queued follow-ups, steering, and rejection behavior.
