# MVP Runtime Contracts (Build → Deploy Loop)

**Status:** Implementation contract for the MVP backend. These are the working
decisions the code follows. Items marked **TEAM DECISION** are still open for
Gate review; the code isolates them behind config so they can change.

## C1. Identity and naming

| Concept | Value |
|---|---|
| Tenant | Personal user. `tenant_id` = `users.id` |
| Tenant namespace | `tenant-<user_id>` |
| Build namespace | `summit-builds` |
| Build ID | `build_jobs.id` = outbox payload `build_run_id` = `BuildExecutionSpec.build.id` = `attempt_id` (single attempt per build job) |
| App image tag | `ghcr.io/<lowercase repo owner>/summit-app-<service_id>:sha-<commit_sha>` |
| App image deployed | `ghcr.io/<owner>/summit-app-<service_id>@sha256:<digest>` (digest only) |
| SummitService name | `svc-<service_id>` in `tenant-<user_id>` |

## C2. Deployment lifecycle

`queued → building → image_ready → deploying → health_checking → running`,
terminal `failed` / `cancelled`. A previous `running` deployment of the same
service becomes `superseded` when a newer one reaches `running`. Legacy enum
values `pending` and `active` remain in the type for compatibility but new code
does not write them.

| Transition | Writer |
|---|---|
| create → `queued` | API (manual deploy) or GitHub worker (push) |
| `queued` → `building` | Orchestrator, after the build Pod is created |
| `building` → `image_ready` | Orchestrator, after the API persisted a `succeeded` build result with digest |
| `image_ready` → `deploying` | Orchestrator, after applying the SummitService |
| `deploying` → `health_checking` → `running` | Orchestrator, from SummitService/Deployment readiness |
| any non-terminal → `failed` | Orchestrator (the API only persists a failed build result on `build_jobs`; the orchestrator moves the deployment) |
| any non-terminal → `cancelled` | Orchestrator, after the API set `cancel_requested_at` |

Every transition is compare-and-set and appends a `deployment_events` row.

## C3. Worker token

Package `apps/backend/internal/workertoken`. HS256 JWT signed with
`WORKER_JWT_SECRET` (≥32 bytes), `sub` = `job_id` = build job ID,
`aud` = `summit-builder`, `exp` required. The orchestrator mints one per build
(TTL = build timeout + 10 min). Unscoped tokens and the raw shared secret are
rejected.

## C4. Per-build Kubernetes Secret (orchestrator-owned)

Before creating the build Pod the orchestrator creates Secret
`summit-build-<build_id>` in `summit-builds` with key `token` = worker token,
labelled `summit.dev/build-id`, then sets an ownerReference to the Pod after
creation so Kubernetes garbage-collects it with the Pod.

Spec references:

- `credentials.source_credential_ref` = `secret:summit-build-<build_id>`
- `reporting.token_ref` = `secret:summit-build-<build_id>`
- `credentials.registry_credential_ref` = `secret:<ORCHESTRATOR_GHCR_PUSH_SECRET>` (default `ghcr-push`, type `kubernetes.io/dockerconfigjson`, created out-of-band by an operator in `summit-builds`). **TEAM DECISION:** trusted push boundary (see `ghcr_mvp_setup.md`). The push credential is only read by `buildctl` in the worker process; it is never mounted into BuildKit `RUN` steps.

Mounted files inside the build Pod (env vars already set by `build/pod.go`):

| Env | File |
|---|---|
| `SUMMIT_SOURCE_CREDENTIAL_FILE` | `/var/run/secrets/summit/source/token` (worker JWT) |
| `SUMMIT_REPORTING_TOKEN_FILE` | `/var/run/secrets/summit/reporting/token` (worker JWT) |
| `SUMMIT_REGISTRY_CREDENTIAL_FILE` | `/var/run/secrets/summit/registry/config.json` (docker config) |
| `SUMMIT_SOURCE_BROKER_URL` | `<ORCHESTRATOR_API_INTERNAL_URL>/internal/v1/build-requests` |

## C5. Source credentials (builder)

The builder exchanges the worker JWT at
`POST {SUMMIT_SOURCE_BROKER_URL}/{build_id}/source-token`
(`Authorization: Bearer <worker JWT>`) for a short-lived GitHub installation
token (`{token, expires_at, repository{clone_url, commit_sha}}`) and clones with
it. The token is never logged or written to disk outside the git process
environment. For local tests without a broker, a file containing a non-JWT
token is used directly.

## C6. Build callbacks (API-owned receiver)

`reporting.endpoint` = `<ORCHESTRATOR_API_INTERNAL_URL>/internal/v1/builds`.
The builder's HTTP reporter posts:

| Route | Body | Persistence |
|---|---|---|
| `POST /internal/v1/builds/{build_id}/status` | builder `StatusUpdate` | `build_job_events` (idempotent on sequence), `build_jobs.current_stage`, `last_heartbeat_at`, status `running` |
| `POST /internal/v1/builds/{build_id}/logs` | array of builder `LogEvent` | `build_job_logs` |
| `POST /internal/v1/builds/{build_id}/result` | builder `BuildExecutionResult` | `build_jobs` terminal status, image repository/tag/digest, error |

Auth: `Authorization: Bearer <worker JWT>` verified with `workertoken.Verify`
for `{build_id}`. The API never talks to Kubernetes; the orchestrator observes
persisted results.

## C7. Orchestrator loops

1. **Outbox worker:** claims `deployment.build.requested`, resolves the spec from
   the database, creates Secret + ConfigMap + Pod, marks build job `dispatched`,
   moves deployment `queued → building`.
2. **Deployment monitor:** polls non-terminal deployments; drives
   `building → image_ready → deploying → health_checking → running`, handles
   failed builds, build Pods that die without a result, build timeouts, and
   cancellation requests.
3. **SummitService controller:** existing `workloads.Controller` reconciles CRs
   into Deployment + Service.
4. **Pruner:** deletes terminal build Pods older than 30 min and orphaned
   `summit-build-*` Secrets/ConfigMaps.

## C8. Optional cluster add-ons (feature-flagged, off by default on Kind)

Each is off unless its env flag is `true`, because the CRDs may not be installed:
`ORCHESTRATOR_ENABLE_INGRESS` (Traefik `IngressRoute`, host
`<service>-<project-slug>.<ORCHESTRATOR_APPS_DOMAIN>`),
`ORCHESTRATOR_ENABLE_NETWORK_POLICY` (CiliumNetworkPolicy),
`ORCHESTRATOR_ENABLE_ESO` (SecretStore + ExternalSecret),
`ORCHESTRATOR_ENABLE_TENANT_QUOTAS` (ResourceQuota + LimitRange; core API, safe on Kind).

## Out of scope for this MVP slice

Stateful tenant databases (StatefulSet + PVC), backups, metering
reconciliation from Prometheus, multi-replica leader election for the pruner.
