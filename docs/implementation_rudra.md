# Orchestrator Implementation Plan — Summit PaaS Control Plane

- **Document Path:** `docs/orchestrator_implementation_plan.md`
- **Owner:** Rudra (Orchestrator, Cluster Controller, & Sandboxed Execution Engine)
- **Backend Team:**
  - Priyanshu (Go API & Control Plane Ingress)
  - Rudra (Go Orchestrator & Kubernetes Reconciler)
  - Arpit (Platform Database & State Management)
- **Frontend Partner:** UI Developer (Design System, Console Dashboard, Real-time Stream Viewer)
- **Target Go Module:** `apps/backend` (Single Go 1.23 Module Monolith)
- **Target Test Environment:** 1–2 SSH-accessible Linux machines configured as **TEST ONLY** Kubernetes hosts

---

## 1. Executive Summary & Context

Summit is a next-generation Developer Platform-as-a-Service (PaaS) engineered to provide seamless Git-to-deploy workflows, isolated multi-tenant execution, automated networking, and secure secrets injection.

This document serves as the standalone, ticket-ready technical implementation plan for the **Go Orchestrator**, authored from the perspective of its lead engineer (**Rudra**). It details how the orchestrator bridges high-level intent stored in the platform database with the low-level infrastructure reality across Kubernetes clusters, ephemeral gVisor build sandboxes, Cilium network policies, Traefik ingress routes, and External Secrets Operator (ESO) bindings.

```
+--------------------------------------------------------------------------------------------------+
|                                      CONTROL PLANE TOPOLOGY                                      |
|                                                                                                  |
|   +-----------------------+              +--------------------------------------------------+    |
|   |   apps/web (Next.js)  |              |        GitHub Webhook / Git Provider             |    |
|   +-----------+-----------+              +------------------------+-------------------------+    |
|               |                                                   |                              |
|               | HTTPS REST                                        | Webhook Delivery             |
|               v                                                   v                              |
|   +-----------------------------------------------------------------------------------------+    |
|   | apps/backend (cmd/api) — Priyanshu                                                       |    |
|   | Validates JWT, verifies HMAC signatures, writes metadata & outbox rows                   |    |
|   +-------------------------------------------+---------------------------------------------+    |
|                                               |                                                  |
|                                               | ACID Commit (FOR UPDATE SKIP LOCKED)             |
|                                               v                                                  |
|   +-----------------------------------------------------------------------------------------+    |
|   | Supabase Postgres Platform DB — Arpit                                                    |    |
|   | Source of Truth: Tenants, Projects, Releases, Outbox Jobs, Lease Heartbeats              |    |
|   +-------------------------------------------+---------------------------------------------+    |
|                                               |                                                  |
|                                               | Poll / Lease Heartbeat (10s lock)                |
|                                               v                                                  |
|   +-----------------------------------------------------------------------------------------+    |
|   | apps/backend (cmd/orchestrator) — Rudra                                                  |    |
|   | Outbox Engine -> State Machine -> K8s Client / controller-runtime Reconciler            |    |
|   +-------------------+---------------------------------------+-----------------------------+    |
|                       |                                       |                                  |
+-----------------------|---------------------------------------|----------------------------------+
                        |                                       |
     gVisor Pod Launch  |                    Reconcile CRDs /   |
     & Log Stream Watch |                    Workload Primitives|
                        v                                       v
+--------------------------------------------------------------------------------------------------+
|                          TEST KUBERNETES HOSTS (1-2 Dedicated Nodes)                             |
|                                                                                                  |
|   +--------------------------------------------+    +---------------------------------------+    |
|   | Namespace: summit-builds                   |    | Namespace: tenant-<tenant_id>         |    |
|   |                                            |    |                                       |    |
|   | - Pod: build-<release_id>                  |    | - Deployment: web / workers           |    |
|   | - RuntimeClass: gvisor (runsc)             |    | - Service & Traefik IngressRoute      |    |
|   | - Rootless BuildKit Daemon                 |    | - CiliumNetworkPolicy (L3/L4 Deny-All)|    |
|   | - Railpack Build Engine                    |    | - ExternalSecret (OpenBao / AWS SM)   |    |
|   | - Ephemeral (Terminated on complete)       |    | - Tenant DB StatefulSet + PVC         |    |
|   |                                            |    | - Fluent Bit -> Loki Log Collection   |    |
|   | Egress: Git repo & Container Registry only |    | - Prometheus Metrics Scraping         |    |
|   +---------------------+----------------------+    +---------------------------------------+    |
|                         |                                                                        |
|                         | Push Built OCI Image                                                   |
|                         v                                                                        |
|   +--------------------------------------------+                                                 |
|   | Internal OCI Registry                      |                                                 |
|   | registry.jetway.internal:5000              |                                                 |
|   +--------------------------------------------+                                                 |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Ground Truth & Architectural Baseline

### 2.1 Monorepo Reality Check (Verified on Disk)
1. **Frontend (`apps/web`):** Next.js 16 workspace package. Contains prototype mock handlers and an in-memory Meridian store. These are temporary mocks and do not reflect platform persistence.
2. **Backend (`apps/backend`):** Go 1.23 module (`github.com/summit/backend`). Contains only a standard-library `net/http` router with structured logging (`log/slog`), configuration loading (`internal/config`), and a health check handler (`GET /api/v1/health` and `/health`).
   - *Current Implementation Gap:* Zero database integration, zero Kubernetes clients (`client-go` / `controller-runtime`), zero job consumer loops, and zero container runtime hooks currently exist in code.
3. **API Contract (`packages/api_spec/openapi.yaml`):** OpenAPI 3.1 specification declaring target schemas for `/projects`, `/resources`, `/releases`, `/observability/metrics`, and `/observability/logs`.
   - *Critical Gaps in Spec:* Does **NOT** declare endpoints for user authentication, tenant membership, project provisioning (`POST /api/v1/projects`), explicit deployment/job triggering, or GitHub webhook ingestion. These endpoints must be specified collaboratively before implementation.
4. **Architecture Blueprint (`docs/system_architechture.png`):** Establishes the authoritative target infrastructure:
   - Supabase Postgres as the centralized platform database + job queue.
   - Go Orchestrator functioning as an operator reconciling database outbox jobs into Kubernetes CRDs and native primitives via the K8s API server / etcd.
   - Isolated ephemeral build pool utilizing **gVisor (`runsc`)** sandbox runtime, **rootless BuildKit**, and **Railpack** to emit OCI images into a cluster registry.
   - Tenant isolation via dedicated namespaces, **Cilium CNI** L3/L4 network policies, Traefik ingress routing, **External Secrets Operator (ESO)** syncing from OpenBao / AWS Secrets Manager, and persistent volumes (PVC) for tenant databases with S3 WAL/nightly backup pipelines.
   - Telemetry through Fluent Bit, Loki, Prometheus, and `metrics-server`.
5. **Test Environment Constraint:** 1–2 bare-metal or VM Linux machines accessed over SSH designated as **TEST ONLY** Kubernetes hosts.

### 2.2 Immutable Security Mandates
> [!CAUTION]
> **Zero Untrusted Code in Control Plane:** Untrusted customer source code, arbitrary Dockerfiles, and application build steps **MUST NEVER** execute inside the API process, inside the shared control-plane namespace (`summit-system`), or on uncontained Kubernetes worker nodes without gVisor sandbox boundary isolation. Violation of this boundary is an immediate security blocker.

---

## 3. Orchestrator Responsibilities & Non-Goals

### 3.1 Core Responsibilities (Rudra)
- **Durable Job Outbox Consumption:** Poll, lease, heartbeat, and execute asynchronous deployment and build tasks emitted by the API into the platform database outbox table.
- **Finite State Machine (FSM) Execution:** Implement the deployment state machine approved at Gate 2. The working vocabulary is documented in the cross-plan proposal below.
- **Ephemeral Sandbox Provisioning:** Coordinate gVisor-isolated build pods (`summit-builds` namespace) running rootless BuildKit and Railpack; manage build timeouts, resource ceilings, log streaming to Loki/S3, and deterministic teardown.
- **OCI Artifact Pipeline:** Ensure compiled application containers are pushed to the internal OCI container registry, addressable by cryptographically immutable SHA-256 digests.
- **Tenant Infrastructure Lifecycle Management:** Reconcile tenant Kubernetes resources:
  - Tenant Namespaces (`tenant-<tenant_id>`) with `ResourceQuota` and `LimitRange`.
  - Cilium Network Policies enforcing strict tenant boundary isolation and egress whitelisting.
  - Traefik IngressRoutes providing external routing, path routing, and TLS termination.
  - External Secrets Operator (`ExternalSecret` / `SecretStore`) syncing credentials from OpenBao/AWS Secrets Manager into native Kubernetes secrets without control-plane exposure.
  - Tenant StatefulSets, PVCs, and automated backup triggers.
- **Control-Loop Self-Healing & Leader Election:** Recover from orchestrator restarts, handle Kubernetes node outages on the test hosts, clean up orphaned resources, and ensure active leases prevent split-brain processing.

### 3.2 Explicit Non-Goals (Delegated to Partners)
- **HTTP Routing, Request Validation, & Authn/Authz:** Owned by **Priyanshu (API)**. The orchestrator exposes no public HTTP endpoints; it interacts with the control plane purely via database state and Kubernetes APIs.
- **Database Schema DDL & Connection Pooling:** Owned by **Arpit (Database)**. Arpit defines tables, migration scripts, indices, and RLS policies. Rudra defines query requirements and consumes them via typed Go repositories.
- **End-User UI Rendering & Frontend State:** Owned by the **UI Developer**. Rudra guarantees accurate status and event reporting in the database so the UI developer can display real-time progress.
- **Multi-Region Fleet Federation:** The current milestone targets the 1–2 SSH test hosts. Distributed global routing is out of scope for the test-cluster baseline.

---

## 4. The Four Shared Gates

<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: All three backend owners (Priyanshu, Rudra, Arpit) must review, co-design, and formally approve each of the following four shared gates. Neither subsystem can proceed independently past these checkpoints without team consensus.

### Gate 1: Tenant/Auth Identity and Isolation Boundary
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Tenant identity dictates access control across the REST API, Row-Level Security (RLS) in the platform database, and cryptographic/network isolation in Kubernetes.
- **API (Priyanshu):** Validates authentication tokens, extracts verified `tenant_id`, enforces RBAC permissions, and scopes every write operation by tenant.
- **Database (Arpit):** Enforces multi-tenant foreign keys, tenant isolation schemas/RLS policies, and prevents cross-tenant data leaks.
- **Orchestrator (Rudra):** Maps `tenant_id` to isolated Kubernetes namespace `tenant-<tenant_id>`, establishes non-overlapping Cilium NetworkPolicies preventing cross-namespace traffic, and binds tenant-scoped `SecretStore` credentials.
- **Acceptance Gate:** Demonstration that a compromised tenant workload cannot access the platform database, control-plane APIs, or another tenant's network pods or volumes.

### Gate 2: Deployment Lifecycle + Persistence/Outbox + API Response Contract/Retries/Idempotency
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Deployments are long-running asynchronous workflows triggered via the API, persisted durably in the platform database, and driven to completion by the orchestrator.
- **API (Priyanshu):** Implements the Gate 2-approved deployment request, proposed as `POST /api/v1/projects/{slug}/deployments`, and returns `202 Accepted` after the durable transaction commits.
- **Database (Arpit):** Models the `deployments`, `releases`, and `orchestrator_outbox` tables with ACID transactional guarantees, state change audit triggers, and lease acquisition indices (`SKIP LOCKED`).
- **Orchestrator (Rudra):** Consumes outbox jobs, acquires a 10-second renewable lease, drives the state machine, guarantees idempotent retries, handles cancellation requests, and emits terminal states.
- **UI Developer Review:** The UI developer reviews the deployment state progression, error payloads, and polling/streaming contracts to guarantee the dashboard displays loading spinners, progress logs, and error toasts properly.
- **Acceptance Gate:** Simulated API deployment request successfully enqueues an outbox row, is claimed by the orchestrator, and survives an intentional orchestrator kill-and-restart without duplicate build pod creation or state corruption.

### Gate 3: Test-Cluster/Build Isolation/CRDs/Registry/Ingress/Network/Secrets Conventions
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Establishes cluster conventions for deploying Summit onto the 1–2 SSH test hosts.
- **API (Priyanshu):** Adheres to resource naming conventions, environment variable payload contracts, and secrets mapping specs.
- **Database (Arpit):** Stores cluster metadata, node capacity constraints, ingress domain assignments, and secrets manager reference paths.
- **Orchestrator (Rudra):** Installs and configures gVisor `runsc` runtimeClass, sets up rootless BuildKit in `summit-builds`, deploys Traefik IngressRoutes, configures Cilium egress lockdown, and provisions ESO `ExternalSecret` custom resources targeting OpenBao.
- **Acceptance Gate:** Successful build of a sample containerized app in a gVisor pod with rootless BuildKit, push to `registry.jetway.internal:5000`, and deployment into `tenant-test` with Traefik serving HTTP 200 over custom ingress.

### Gate 4: End-to-End Acceptance on Test-Only Machines with Migration/Security Review
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Full lifecycle verification on the physical/VM test Kubernetes hosts.
- **API (Priyanshu):** Submits real project provisioning and deployment payloads through the API gateway.
- **Database (Arpit):** Verifies all database migrations apply cleanly on Supabase Postgres, connection pools handle orchestrator burst traffic, and state changes persist without deadlock.
- **Orchestrator (Rudra):** Drives complete build, push, deploy, ingress configuration, and health check validation. Tests network lockdown, container privilege dropping, and secret masking.
- **Acceptance Gate:** End-to-end integration test passes: Git webhook trigger -> API validation -> Database transaction -> Orchestrator build in gVisor -> Image push -> Rolling update -> Traefik live traffic -> Verified zero egress leakage -> Teardown and cleanup.

---

## 5. Settled Architecture Facts vs. Proposed Design Decisions

### Cross-plan contract proposals (pending shared approval)

These proposals align this plan with the API and database plans. Detailed examples below are conditional on team approval:

- **Deployment request:** propose `POST /api/v1/projects/{slug}/deployments` with `202 Accepted`, a deployment ID, and `Location: /api/v1/deployments/{id}` after durable atomic persistence. Add `GET /api/v1/deployments/{id}` to OpenAPI after sign-off; retain `/releases` for release history/artifacts unless the UI and team decide otherwise.
- **Lifecycle vocabulary:** propose `queued → building → image_ready → deploying → health_checking → running`, with terminal `failed` and `cancelled`; keep retries in attempt metadata unless the team approves a distinct retry state. Gate 2 approves transitions and state ownership.
- **Queue/database:** a PostgreSQL outbox with `FOR UPDATE SKIP LOCKED` is the recommended Phase 1 option, not an architecture fact. If selected, Arpit owns schema and shared contracts in `apps/backend/internal/platformdb`; API and orchestrator use the same package boundary.
- **Auth, backup, leases, exact timeouts, and cluster-specific choices** remain open until agreed and verified against the selected provider and test-only machines. The diagram establishes the components, not these operational values.

To ensure engineering clarity, architectural boundaries are categorized as either **Settled Facts** (non-negotiable requirements derived from architecture diagrams and monorepo constraints) or **Proposed Decisions** (engineering choices submitted by Rudra for backend team sign-off).

### 5.1 Settled Architecture Facts
1. **Single Monorepo Go Module:** All Go backend code remains in `apps/backend` under `github.com/summit/backend`. No `go.work` or repository split is permitted.
2. **Untrusted Code Sandbox:** Application compilation must use **gVisor (`runsc`)** runtime with **rootless BuildKit** and **Railpack**; build pods must be ephemeral and destroyed immediately upon task termination.
3. **Platform Database:** Supabase Postgres is shown as the platform metadata database. A database outbox is a proposed dispatch option pending Gate 2 approval.
4. **Network & Ingress Stack:** **Cilium CNI** is the network security layer; **Traefik** is the ingress controller.
5. **Secrets Governance:** In-cluster secrets are managed via **External Secrets Operator (ESO)** synchronized with OpenBao / AWS Secrets Manager. Plaintext secrets are never held in the platform database or logged by the orchestrator.
6. **Telemetry Infrastructure:** Logs are shipped via Fluent Bit to Loki; metrics are scraped via Prometheus.
7. **Test Environment Limitation:** Target hosts are 1–2 SSH-accessible Linux machines running Kubernetes (k3s or kubeadm) strictly for testing.

### 5.2 Proposed Team Decisions (Open for Discussion)

| Decision ID | Topic | Rudra's Proposed Choice | Alternative Considered | Rationale & Trade-Offs | Status |
|---|---|---|---|---|---|
| **D1** | Outbox Job Dispatch Engine | **Postgres Outbox Table with `FOR UPDATE SKIP LOCKED`** | Redis Streams / Asynq / NATS JetStream | Eliminates dual-write anomalies; leverages existing Supabase Postgres; zero extra infrastructure dependencies on test hosts. | **PROPOSED** (Awaiting Arpit/Priyanshu sign-off) |
| **D2** | Kubernetes Control Architecture | **Direct `client-go` / `controller-runtime` Reconciler Loop Driven by Outbox** | Full Custom Resource Definitions (CRDs) for Projects & Apps with K8s Operator SDK | Keeps platform state in Postgres (source of truth); Kubernetes acts as the execution substrate rather than an unmanageable metadata datastore. Optional lightweight CRD (`SummitApp`) used strictly for workload abstraction. | **PROPOSED** (Awaiting Priyanshu sign-off) |
| **D3** | Source Ingestion Strategy | **API downloads Git tarball / commits to S3; Orchestrator pulls from S3** | Build pod executes `git clone` inside gVisor | Ingesting via API prevents passing Git provider access tokens/SSH keys into the untrusted build pod; ensures build inputs are cached and immutably reproducible in S3. | **PROPOSED** (Awaiting Priyanshu sign-off) |
| **D4** | Container Registry on Test Hosts | **In-Cluster Registry (`registry:2` on NodePort/ClusterIP with Cilium routing)** | External AWS ECR / Quay.io / GHCR | Minimizes test machine dependencies on external internet bandwidth and external cloud credentials during test phase. | **PROPOSED** (Awaiting Team sign-off) |
| **D5** | Health Check Strategy | **Kubernetes readiness plus optional Traefik route verification** | Kubernetes readiness only | Agree what qualifies as healthy before entering the proposed `running` state. | **PROPOSED** (Awaiting team/UI sign-off) |

---

## 6. Proposed Go Package & Command Architecture

To maintain high cohesion and separation of concerns within a single Go module (`apps/backend`), the orchestrator is architected as an independent binary entrypoint (`cmd/orchestrator`) that shares domain contracts and database clients with the API (`cmd/api`) without circular dependencies.

```text
apps/backend/
├── cmd/
│   ├── api/                              # Priyanshu: HTTP REST API entrypoint
│   │   └── main.go
│   └── orchestrator/                     # Rudra: Orchestrator daemon entrypoint
│       └── main.go                       # Signal handling, leader election, worker supervisor
├── internal/
│   ├── config/                           # Shared configuration (env parsing, validation)
│   │   ├── config.go
│   │   └── orchestrator_config.go        # Kubeconfig, worker concurrency, polling intervals
│   ├── database/                         # Arpit: Database connection pools, migrations, sqlc
│   │   ├── client.go
│   │   ├── queries/                      # SQL queries for outbox and releases
│   │   └── models.go
│   ├── common/                           # Shared domain types, errors, and loggers
│   │   ├── errors.go
│   │   └── types.go
│   ├── orchestrator/                     # Rudra: Core Orchestrator Business Logic
│   │   ├── engine/                       # Worker pool, lease manager, heartbeats
│   │   │   ├── engine.go
│   │   │   ├── lease.go
│   │   │   └── supervisor.go
│   │   ├── outbox/                       # Durable outbox consumer & dispatcher
│   │   │   ├── consumer.go
│   │   │   └── handler.go
│   │   ├── statemachine/                 # Deterministic state machine & transitions
│   │   │   ├── transitions.go
│   │   │   └── status_writer.go
│   │   ├── builder/                      # Ephemeral gVisor build engine (BuildKit/Railpack)
│   │   │   ├── builder.go
│   │   │   ├── pod_spec.go               # gVisor runtimeClass runsc & rootless BuildKit
│   │   │   └── log_streamer.go           # Real-time build log piping to Loki & Postgres
│   │   ├── reconciler/                   # Tenant infrastructure reconciler
│   │   │   ├── tenant_reconciler.go
│   │   │   └── app_reconciler.go
│   │   └── cleaner/                      # Garbage collection, tombstoning, stale resource pruning
│   │       ├── pruner.go
│   │       └── pod_gc.go
│   ├── cluster/                          # Kubernetes Clients, CRD Builders, & Manifest Generators
│   │   ├── client.go                     # K8s client-go / controller-runtime wrapper
│   │   ├── namespace.go                  # Tenant namespace, ResourceQuota, LimitRange
│   │   ├── networkpolicy.go              # CiliumNetworkPolicy generator (L3/L4 deny-all)
│   │   ├── ingress.go                    # Traefik IngressRoute generator
│   │   ├── secrets.go                    # ESO ExternalSecret / SecretStore generator
│   │   ├── workload.go                   # Deployment, Service, StatefulSet, PVC generator
│   │   └── rbac.go                       # Tenant ServiceAccount & RoleBinding generator
│   └── observability/                    # Shared metrics, telemetry, and Loki logger
│       ├── metrics.go                    # Prometheus collectors (queue lag, build durations)
│       └── loki.go                       # Loki API client for log query coordinates
├── go.mod                                # Single Go 1.23 module
└── go.sum
```

### Build & Execution Commands
- Build API: `go build -o bin/api ./cmd/api`
- Build Orchestrator: `go build -o bin/orchestrator ./cmd/orchestrator`
- Run Orchestrator locally against test cluster: `KUBECONFIG=~/.kube/config ORCHESTRATOR_WORKERS=4 go run ./cmd/orchestrator`

---

## 7. Durable Job Queue & Outbox Engine Semantics

The orchestrator operates as a distributed, fault-tolerant worker system consuming jobs from the platform database outbox.

### 7.1 Outbox Schema & Worker Polling Loop
The outbox table is managed by Arpit, matching the following operational requirements:

```sql
-- Logical representation of orchestrator outbox table (Owned by Arpit)
CREATE TABLE IF NOT EXISTS platform.orchestrator_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    release_id VARCHAR(64) NOT NULL,
    job_type VARCHAR(32) NOT NULL, -- 'BUILD_AND_DEPLOY', 'TEARDOWN', 'ROLLBACK'
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    locked_by VARCHAR(64) NULL,
    locked_until TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_dequeue ON platform.orchestrator_outbox (status, locked_until) 
WHERE status IN ('QUEUED', 'PROCESSING');
```

### 7.2 Lease Acquisition, Heartbeat, & Concurrency
1. **Dequeuing with Concurrency Safety:**
   Workers poll the outbox using PostgreSQL's row-level locking:
   ```sql
   UPDATE platform.orchestrator_outbox
   SET status = 'PROCESSING',
       locked_by = $1, -- Orchestrator Worker UUID
       locked_until = NOW() + INTERVAL '30 seconds',
       attempts = attempts + 1,
       updated_at = NOW()
   WHERE id = (
       SELECT id FROM platform.orchestrator_outbox
       WHERE status = 'QUEUED' 
          OR (status = 'PROCESSING' AND locked_until < NOW())
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
   )
   RETURNING id, tenant_id, project_id, release_id, job_type, payload, attempts, max_attempts;
   ```
2. **Heartbeat Goroutine:**
   While executing a build or deployment reconciliation, a background goroutine in `internal/orchestrator/engine/lease.go` pulses every 10 seconds, extending `locked_until = NOW() + INTERVAL '30 seconds'`. If the orchestrator instance crashes, the lease expires after 30 seconds, allowing surviving orchestrator instances to safely reclaim the job.
3. **Leader Election for Cluster-Wide Reconciler:**
   For background sweepers and garbage collection routines, the orchestrator employs Kubernetes Lease coordination (`coordination.k8s.io` via `leaderelection.LeaderElector`) ensuring only one active leader executes cluster pruning at any time.

### 7.3 Idempotency, Retries, Backoff, & Dead-Letter
- **Idempotency Key:** Format: `deploy:<project_id>:<commit_sha>:<release_counter>`. If an outbox row with the same key is inserted, PostgreSQL ignores the insert or returns the existing ID.
- **Exponential Backoff:** If a transient infrastructure error occurs (e.g., K8s API rate limit, container registry timeout), the orchestrator calculates backoff:
  $$\text{backoff} = \min(300\text{s}, 2^{\text{attempts}} \times 5\text{s}) + \text{jitter}(0, 3\text{s})$$
  The job's `locked_until` is updated into the future, and `status` is reset to `QUEUED`.
- **Dead-Letter Handling:** When `attempts >= max_attempts`, the orchestrator marks the outbox job as `FAILED` and sets `status = 'FAILED_DEADLETTER'`. It transitions the associated release to `FAILED`, persists the terminal error log, and publishes a critical platform metric.
- **Cancellation Semantics:** If an end-user triggers a cancellation via the API (`POST /api/v1/projects/{slug}/releases/{id}/cancel`), the API writes `CANCEL_REQUESTED` to the database. The orchestrator's heartbeat loop detects this state, cancels the running Go `context.Context`, sends a graceful SIGTERM to the build pod / stops the deployment rollout, and updates status to `CANCELLED`.

---

## 8. Deployment & Build State Machine

The state machine governs the entire lifecycle of a release from initial creation to active traffic serving.

```
                  +--------------------------------+
                  |             QUEUED             | (Awaiting Orchestrator pickup)
                  +---------------+----------------+
                                  |
                                  | Orchestrator claims lease
                                  v
                  +--------------------------------+
                  |            BUILDING            | (gVisor Pod executing BuildKit/Railpack)
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |           IMAGE_READY          | (Image pushed and identified by digest)
                  +---------------+----------------+
                                  |
                                  | Orchestrator reconciles K8s resources
                                  v
                                +------------------+
                                |    DEPLOYING     | (Rolling update, Ingress, ESO)
                                +---------+--------+
                                          |
                                          v
                                +------------------+
                                | HEALTH_CHECKING  | (Readiness and route checks)
                                +---------+--------+
                                          |
                                          | Workload healthy
                                          v
                                +------------------+
                                |      RUNNING     | (Serving live user traffic)
                                +------------------+
```

### 8.1 State Definitions & Status Ownership

| State | Responsible Writer | Description & Actions |
|---|---|---|
| `queued` | **Priyanshu (API)** | Initial accepted state after the deployment intent and dispatch record are durably committed. |
| `building` | **Rudra (Orchestrator)** | Ephemeral gVisor build is in progress. |
| `image_ready` | **Rudra (Orchestrator)** | OCI image is pushed and identified by digest. |
| `deploying` | **Rudra (Orchestrator)** | Kubernetes workload and required routing/secrets resources are being reconciled. |
| `health_checking` | **Rudra (Orchestrator)** | Readiness and route checks are in progress. |
| `running` | **Rudra (Orchestrator)** | Workload is healthy and serving traffic. |
| `failed` | **Rudra (Orchestrator)** | Build, provisioning, or health check failed; details are recorded without secret values. |
| `cancelled` | **Rudra (Orchestrator)** | Cancellation was accepted and active work was stopped/cleaned up. |

> [!NOTE]
> These state names are a shared proposal pending Gate 2 approval; update the schema, API contract, and UI together if the team chooses different names.
>
> **UI-Owner Review:** The UI Developer must review the state names, transition event payload structures, and error message schemas so that the frontend dashboard accurately reflects deployment status, build log streaming, and rollback notifications.

---

## 9. Ephemeral gVisor Build Sandbox & OCI Lifecycle

Building untrusted code submitted by arbitrary tenants represents the highest-risk attack vector in the cluster. The orchestrator implements strict multi-layer containment.

### 9.1 Build Sandbox Architecture
- **Namespace:** Dedicated `summit-builds` namespace, isolated from all tenant runtime workloads and the control-plane namespace.
- **Runtime Sandboxing:** Enforced Kubernetes `runtimeClassName: gvisor` (utilizing the `runsc` kernel virtualization engine). Syscalls are intercepted and handled in user-space, preventing kernel escape vulnerabilities.
- **Privilege Elimination:** Executed strictly under **rootless BuildKit** (`buildkitd`). Containers run with non-root UID/GID (1000:1000), `readOnlyRootFilesystem: true`, and all Linux capabilities dropped (`drop: ["ALL"]`).
- **Build Engine:** **Railpack** executes inside the rootless BuildKit daemon to automatically detect language stacks (Node.js, Go, Python, Rust, Dockerfile) and generate reproducible OCI build layers.

### 9.2 Build Pod Specification & Resource Ceilings
Each build job spawns an ephemeral pod constructed dynamically by `internal/orchestrator/builder/pod_spec.go`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: build-<release_id>
  namespace: summit-builds
  labels:
    summit.dev/tenant: "<tenant_id>"
    summit.dev/project: "<project_id>"
    summit.dev/release: "<release_id>"
    summit.dev/component: "builder"
spec:
  runtimeClassName: gvisor # Enforces runsc isolation boundary
  restartPolicy: Never
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: buildkit-railpack
      image: internal-registry.jetway.internal:5000/summit/buildkit-railpack:v1.0.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false # Required for cache layer writes in user-space
        capabilities:
          drop: ["ALL"]
      resources:
        requests:
          cpu: "500m"
          memory: "1Gi"
          ephemeral-storage: "2Gi"
        limits:
          cpu: "2000m"
          memory: "4Gi"
          ephemeral-storage: "10Gi"
      env:
        - name: BUILDKIT_ROOTLESS
          value: "true"
        - name: S3_SOURCE_ARCHIVE_URL
          valueFrom:
            secretKeyRef:
              name: build-creds-<release_id>
              key: source_url
      volumeMounts:
        - name: build-cache
          mountPath: /home/user/.local/share/buildkit
  volumes:
    - name: build-cache
      emptyDir:
        sizeLimit: 10Gi
```

### 9.3 Build Network Lockdown (Cilium Policy)
The build pod's network egress is strictly locked down via a dedicated `CiliumNetworkPolicy`:
- **Allowed Ingress:** None (Deny all incoming traffic).
- **Allowed Egress:**
  - Internal DNS (`kube-dns` on port 53 UDP/TCP).
  - Internal Registry (`registry.jetway.internal:5000` on port 5000 TCP).
  - External Package Repositories (npm registry, PyPI, Go Proxy, crates.io over port 443 TCP).
- **Strictly Blocked Egress:**
  - Link-local cloud metadata service (`169.254.169.254`).
  - Kubernetes API server (`10.43.0.1` / `10.96.0.1`).
  - Control-plane database (Supabase Postgres on port 5432).
  - All tenant workload namespaces (`tenant-*`).

### 9.4 OCI Image Lifecycle & Immutability
1. **Naming & Tagging Scheme:**
   Format: `registry.jetway.internal:5000/<tenant_id>/<project_slug>:<commit_sha>-<release_counter>`
2. **Digest Verification:**
   Upon successful image build and push, the orchestrator queries the registry to obtain the cryptographic SHA-256 digest (`sha256:7f...`).
3. **Immutability Enforcement:**
   When generating Kubernetes workload manifests, the orchestrator **ALWAYS** references the image by its immutable digest:
   `image: registry.jetway.internal:5000/tenant-abc/api@sha256:7f83b1657ff1...`
   This prevents image tag poisoning or tampering attacks.
4. **Registry Authentication:**
   Registry credentials are provisioned dynamically per tenant as an ephemeral Kubernetes Secret (`imagePullSecret`) injected into the tenant namespace.

---

## 10. Tenant Namespace & Workload Resource Lifecycle

When a release enters the `DEPLOYING` state, the orchestrator reconciles all required Kubernetes primitives in the tenant namespace.

```
+----------------------------------------------------------------------------------------------------+
|                                    TENANT NAMESPACE: tenant-abc                                    |
|                                                                                                    |
|    +-------------------------+                                 +------------------------------+    |
|    |  Traefik IngressRoute   | ---> Routing Rules              |   CiliumNetworkPolicy        |    |
|    |  subdomain.jetway.app   |                                 |   - Allow Ingress: Traefik   |    |
|    +------------+------------+                                 |   - Allow Egress: DNS, DB    |    |
|                 |                                              |   - Deny: Cross-Tenant, K8s  |    |
|                 v                                              +------------------------------+    |
|    +-------------------------+                                                                     |
|    |   Kubernetes Service    |                                 +------------------------------+    |
|    |   ClusterIP: 80 -> 8080 |                                 |  External Secrets Operator   |    |
|    +------------+------------+                                 |  - SecretStore (OpenBao)     |    |
|                 |                                              |  - ExternalSecret CRD        |    |
|                 v                                              +--------------+---------------+    |
|    +-----------------------------------------------+                          |                    |
|    |        Kubernetes Deployment (Rolling Update) |                          v                    |
|    |  +-----------------------------------------+  |           +------------------------------+    |
|    |  | Pod (web):                              |  |           | Native Kubernetes Secret     |    |
|    |  | - Image: registry@sha256:abc...         |  | <-------- | app-env-secrets              |    |
|    |  | - envFrom: secretRef app-env-secrets    |  |           +------------------------------+    |
|    |  | - Liveness/Readiness: /health           |  |                                               |
|    |  | - SecurityContext: non-root, drop ALL   |  |           +------------------------------+    |
|    |  +-----------------------------------------+  |           | Tenant Database (StatefulSet)|    |
|    +-----------------------------------------------+           | - Embedded DB / SQLite / PG  |    |
|                                                                | - PVC (Local Storage / CEPH) |    |
|                                                                | - S3 Nightly WAL Backup Job  |    |
|                                                                +------------------------------+    |
+----------------------------------------------------------------------------------------------------+
```

### 10.1 Namespace Isolation & Quotas
- Every tenant receives a dedicated namespace: `tenant-<tenant_id>`.
- **ResourceQuota:** Restricts compute consumption:
  - `requests.cpu`: 4 cores, `limits.cpu`: 8 cores.
  - `requests.memory`: 8Gi, `limits.memory`: 16Gi.
  - `persistentvolumeclaims`: 5.
- **LimitRange:** Enforces mandatory memory/CPU requests and limits on every pod spawned within the namespace to prevent runaway workloads.

### 10.2 Cilium Network Policies (L3/L4 Isolation)
A zero-trust network posture is enforced via `CiliumNetworkPolicy`:
1. **Ingress:** Deny all incoming traffic by default. Explicitly allow ingress traffic targeting port 8080 only from the Traefik Ingress Controller pods (`app.kubernetes.io/name: traefik`).
2. **Egress:**
   - Allow egress to `kube-dns` (`10.43.0.10:53` UDP/TCP) for domain resolution.
   - Allow egress to the tenant's internal database service within the same namespace.
   - Allow external egress to HTTPS (`port 443`) for outbound third-party API integration.
   - **BLOCK ALL** traffic targeting other tenant namespaces (`tenant-*`), the control plane namespace (`summit-system`), and host link-local addresses.

### 10.3 Ingress Routing (Traefik)
The orchestrator provisions a Traefik `IngressRoute` custom resource:
- Domain scheme: `<project_slug>.<tenant_id>.jetway.app` (plus custom tenant-defined CNAME domains).
- TLS termination configured via `cert-manager` Let's Encrypt certificates or local wildcard certificates on the test hosts.
- Middleware applied for rate limiting, security headers (HSTS, CSP, X-Frame-Options), and path prefix routing.

### 10.4 Secrets Management via ESO (External Secrets Operator)
Application secrets (API keys, database URLs, encryption tokens) are injected without exposing plaintext credentials to the orchestrator:
1. Priyanshu's API writes secrets directly into OpenBao (or AWS Secrets Manager).
2. The orchestrator provisions an ESO `SecretStore` custom resource bound to the tenant namespace, referencing OpenBao using a scoped AppRole or Kubernetes ServiceAccount token.
3. The orchestrator provisions an `ExternalSecret` custom resource:
   ```yaml
   apiVersion: external-secrets.io/v1beta1
   kind: ExternalSecret
   metadata:
     name: app-env-secrets
     namespace: tenant-<tenant_id>
   spec:
     refreshInterval: 1h
     secretStoreRef:
       name: openbao-store
       kind: SecretStore
     target:
       name: app-env-secret
       creationPolicy: Owner
     dataFrom:
       - extract:
           key: tenants/<tenant_id>/projects/<project_id>/production
   ```
4. ESO synchronizes secrets into a standard Kubernetes `Secret` (`app-env-secret`) consumed by pods via `envFrom: secretRef`.

### 10.5 Tenant Database & Storage Volume Lifecycle
For projects requiring stateful storage or an embedded tenant database:
- Provisioned as a `StatefulSet` with a `PersistentVolumeClaim` (PVC) bound to local host-path storage or a CSI driver on the test machines.
- The orchestrator configures a backup sidecar or scheduled Kubernetes `CronJob` that initiates WAL archiving and nightly snapshots exported to S3-compatible object storage (e.g., MinIO or AWS S3).

---

## 11. Kubernetes RBAC & Cluster Access on Test-Only Hosts

The test environment comprises 1–2 bare-metal or virtualized Linux machines running Kubernetes. The orchestrator connects using in-cluster service account credentials or a scoped `KUBECONFIG`.

### 11.1 Principle of Least Privilege
The orchestrator operates under the `summit-orchestrator-sa` ServiceAccount located in the `summit-system` namespace. It is granted a tightly scoped `ClusterRole`:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: summit-orchestrator-role
rules:
  # Tenant Namespace Management
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  # Workload Primitives in Tenant and Build Namespaces
  - apiGroups: ["", "apps", "batch"]
    resources:
      - pods
      - pods/log
      - services
      - endpoints
      - configmaps
      - secrets
      - persistentvolumeclaims
      - deployments
      - statefulsets
      - jobs
    verbs: ["*"]
  # Ingress Routing (Traefik)
  - apiGroups: ["traefik.containo.us", "traefik.io"]
    resources: ["ingressroutes", "middlewares"]
    verbs: ["*"]
  # Network Security (Cilium)
  - apiGroups: ["cilium.io"]
    resources: ["ciliumnetworkpolicies"]
    verbs: ["*"]
  # Secrets Operator (ESO)
  - apiGroups: ["external-secrets.io"]
    resources: ["externalsecrets", "secretstores"]
    verbs: ["*"]
  # Lease Management for Leader Election
  - apiGroups: ["coordination.k8s.io"]
    resources: ["leases"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
  # Node Telemetry (Read-only)
  - apiGroups: [""]
    resources: ["nodes", "nodes/status"]
    verbs: ["get", "list", "watch"]
```

### 11.2 Prohibited Privileges
The orchestrator is explicitly **PROHIBITED** from:
- Granting or modifying `ClusterRoleBindings` or cluster-level RBAC rules.
- Modifying resources in `kube-system`, `cilium-system`, or `traefik-system`.
- Accessing node root filesystems or launching privileged containers (`privileged: true`, `hostPID: true`, `hostNetwork: true`).

---

## 12. Observability, Telemetry, & Status Pipeline

Real-time visibility is vital for both platform operations and user experience.

### 12.1 Log Streaming Architecture
- **Build Pod Logs:** As the gVisor build pod compiles source code, BuildKit outputs ANSI/structured logs to `stdout`/`stderr`.
- The orchestrator taps the Kubernetes Pod log stream via `client-go` (`CoreV1().Pods(namespace).GetLogs(...)`) and concurrently:
  1. Pipes raw log chunks into Fluent Bit / Loki under stream labels `{tenant="<id>", project="<slug>", release="<id>", component="builder"}`.
  2. Batches and persists log chunks into S3-compatible storage upon build termination for durable audit retention.
- The UI queries Loki via the API's `/api/v1/observability/logs` endpoint using stream coordinates provided by the orchestrator.

### 12.2 Metrics & Prometheus Telemetry
The orchestrator binary exposes a `/metrics` Prometheus endpoint on port `9090` declaring custom instrumentation:
- `summit_orchestrator_queue_lag_seconds`: Duration outbox jobs remain queued before lease acquisition.
- `summit_orchestrator_reconcile_duration_seconds{kind="deployment|build"}`: Time spent executing reconciliations.
- `summit_orchestrator_build_duration_seconds{status="success|failure"}`: gVisor/BuildKit build times.
- `summit_orchestrator_active_workers`: Gauge tracking active concurrent worker goroutines.
- `summit_orchestrator_lease_renew_failures_total`: Counter tracking database lease heartbeat dropouts.

### 12.3 Kubernetes Event Mirroring
The orchestrator watches Kubernetes Events (`CoreV1().Events(tenantNamespace)`) for pods associated with a release. Significant events (`BackOff`, `FailedScheduling`, `Unhealthy`, `Killing`) are mirrored into the database `release_events` table, enabling the UI to show an informative deployment timeline.

---

## 13. Failure Recovery, Upgrades, & Garbage Collection

### 13.1 Orchestrator Crash Recovery & Self-Healing
1. **Process Crash:** If `cmd/orchestrator` crashes, active leases expire within 30 seconds. A restarted or peer orchestrator queries `locked_until < NOW()`, re-acquires the job, checks current cluster reality (via Kubernetes labels), and resumes execution idempotently.
2. **Kubernetes API Disconnection:** If the Kubernetes API server on the test host experiences downtime, orchestrator workers back off exponentially without marking jobs as failed. Once API connectivity resumes, reconciliation loops re-sync cluster state.

### 13.2 Garbage Collection & Orphan Pruning
The leader orchestrator runs an autonomous cleanup loop (`internal/orchestrator/cleaner/pruner.go`) every 10 minutes:
- **Build Pod Cleanup:** Any build pod in `summit-builds` older than 30 minutes in a `Succeeded` or `Failed` state is deleted after verifying logs are committed to Loki/S3.
- **Stale Secret Pruning:** Temporary build credentials secrets (`build-creds-<release_id>`) are removed immediately post-build.
- **Tombstoned Project Teardown:** Projects marked `DELETED` in the database have their Kubernetes namespace (`tenant-<tenant_id>`), PVCs, and Traefik IngressRoutes systematically deleted using Kubernetes Finalizers.

### 13.3 Zero-Downtime Orchestrator Upgrades
The orchestrator binary is deployed as a Kubernetes `Deployment` with `replicas: 2` in `summit-system`:
- `strategy.type: RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`).
- Leader election via K8s Lease ensures a smooth handover of sweeping routines.
- Workers drain active tasks gracefully upon receiving SIGTERM (30-second graceful termination window).

---

## 14. Test Strategy & Acceptance Criteria

To guarantee software reliability before physical deployment on test machines, testing is organized across four distinct layers.

```
+--------------------------------------------------------------------------------------------------+
|                                    TESTING VERIFICATION MATRIX                                   |
|                                                                                                  |
|   +------------------------------------------------------------------------------------------+   |
|   | LAYER 1: UNIT & SPEC TESTS (Local & CI)                                                  |   |
|   | - Manifest generation tests (Validate Cilium, Traefik, K8s Deployment YAML output)       |   |
|   | - State machine transition tests (Validate permitted vs prohibited FSM transitions)     |   |
|   | - Outbox lease & exponential backoff algorithm validation                                |   |
|   +------------------------------------------------------------------------------------------+   |
|                                              |                                                   |
|                                              v                                                   |
|   +------------------------------------------------------------------------------------------+   |
|   | LAYER 2: INTEGRATION TESTS WITH ENVTEST / K3S CONTAINER                                  |   |
|   | - Real API server validation using controller-runtime's `envtest` suite                  |   |
|   | - CRD schema validation (Traefik IngressRoute, ESO ExternalSecret, CiliumNetworkPolicy)  |   |
|   | - Postgres outbox polling using testcontainers-go (Postgres + pgvector)                  |   |
|   +------------------------------------------------------------------------------------------+   |
|                                              |                                                   |
|                                              v                                                   |
|   +------------------------------------------------------------------------------------------+   |
|   | LAYER 3: BUILD SANDBOX ISOLATION SUITE (Test Kubernetes Host)                            |   |
|   | - Verify gVisor `runsc` runtimeClass is active and functional                            |   |
|   | - Execute test rootless BuildKit pod compiling a sample Node.js and Go repository        |   |
|   | - Verify Cilium network policy prevents egress to metadata IP (169.254.169.254)          |   |
|   +------------------------------------------------------------------------------------------+   |
|                                              |                                                   |
|                                              v                                                   |
|   +------------------------------------------------------------------------------------------+   |
|   | LAYER 4: END-TO-END SYSTEM INTEGRATION ACCEPTANCE (All Three Owners)                      |   |
|   | - Simulated Webhook / API release creation                                               |   |
|   | - Outbox claim -> gVisor Build -> Image Push -> Rolling Deploy -> Traefik HTTP 200      |   |
|   | - Intentional orchestrator process kill during build & deploy to verify lease recovery   |   |
|   +------------------------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

### Acceptance Criteria Checklist
- [ ] **Unit Tests:** 100% of manifest builder functions produce valid Kubernetes 1.30+ schemas matching OpenAPI contracts.
- [ ] **State Machine Integrity:** Invalid transitions (e.g., `building` directly to `running`) return deterministic errors under the Gate 2-approved state vocabulary.
- [ ] **Sandboxed Build Security:** A malicious test repo attempting root file access or container escape inside a gVisor pod fails with a permission error.
- [ ] **Network Lockdown:** Probing port 5432 (Postgres) or `169.254.169.254` from a build pod times out (verified by Cilium drop metrics).
- [ ] **Rolling Updates:** Updating an application deployment from release `v1` to `v2` causes zero HTTP 502/503 dropped packets on Traefik.
- [ ] **Crash Resilience:** Killing the orchestrator process mid-build leaves the database and cluster in an uncorrupted state; restarted orchestrator cleans up stale pods.

---

## 15. Phased Milestones & Interface Handoffs

Delivery is structured into five sequential phases to align with Priyanshu (API) and Arpit (Database).

### Phase 0: Foundations & Module Setup (Days 1–3)
- Initialize package tree in `apps/backend` (`cmd/orchestrator`, `internal/orchestrator`, `internal/cluster`).
- Add Kubernetes Go client dependencies (`k8s.io/client-go`, `sigs.k8s.io/controller-runtime`).
- Establish shared domain types with Priyanshu and Arpit.
- **Handoff from Arpit:** Initial database schema definitions and connection pooling client.
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 1** specifications.

### Phase 1: Outbox Worker Engine & State Machine (Days 4–7)
- Implement `internal/orchestrator/engine` with outbox consumer, lease manager, and heartbeat renewal.
- Implement `internal/orchestrator/statemachine` with state validation and status writer.
- Add unit tests with mock database queries.
- **Handoff from Priyanshu:** Outbox job payload contract specification and test job generator.
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 2** specifications.

### Phase 2: Isolated Build Sandbox & OCI Pipeline (Days 8–12)
- Configure gVisor (`runsc`) and rootless BuildKit daemon manifests on test hosts.
- Implement `internal/orchestrator/builder` to dynamically spawn and monitor build pods in `summit-builds`.
- Implement Cilium build network policy and log streamer piping output to Loki.
- Deploy internal test registry (`registry.jetway.internal:5000`).
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 3** specifications.

### Phase 3: Tenant Workload Reconciler (Days 13–18)
- Implement manifest generators in `internal/cluster` for Namespaces, Quotas, Deployments, Services, Traefik `IngressRoute`, Cilium `CiliumNetworkPolicy`, and ESO `ExternalSecret`.
- Implement rolling update progress monitor and canary health checker.
- Implement garbage collection and orphan pod sweeper.
- **Handoff to UI Developer:** Finalize status event schemas, log query URLs, and deployment timeline states.

### Phase 4: End-to-End Test Host Acceptance & Hardening (Days 19–24)
- Deploy API, Database, and Orchestrator to the 1–2 SSH test Kubernetes hosts.
- Execute full integration test pipeline: Git webhook -> Outbox -> Build -> Push -> Deploy -> Traffic.
- Conduct simulated failure injection (process kills, network dropouts, build timeouts).
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Execute **Gate 4** comprehensive review.

---

## 16. Rudra's First-PR Checklist

Before opening the initial orchestrator pull request, verify each of the following:

- [ ] **Directory Layout:** New code resides entirely within `apps/backend/cmd/orchestrator` and `apps/backend/internal/{orchestrator,cluster}`.
- [ ] **Single Module Integrity:** `apps/backend/go.mod` remains the sole module definition. All new imports use `github.com/summit/backend/...`.
- [ ] **No Hardcoded Secrets:** Cluster endpoints, tokens, and database connection strings read exclusively from environment variables via `internal/config`.
- [ ] **Zero Implementation Claims:** PR description explicitly clarifies what is being added (scaffolding, clients, types) without claiming unimplemented features are complete.
- [ ] **Code Hygiene:** Code passes `go -C apps/backend vet ./...` and `go -C apps/backend test ./...`.
- [ ] **Logging Standards:** All logs use structured logging (`log/slog`) with context fields (`tenant_id`, `project_id`, `release_id`, `worker_id`).
- [ ] **Sandboxing Enforced:** Build pod generator unconditionally sets `runtimeClassName: gvisor` and drops all capabilities.

---

## 17. Decision Register & Risk Log

### 17.1 Decision Register

| ID | Category | Context / Question | Decision | Owner | Reviewers |
|---|---|---|---|---|---|
| **DEC-01** | Architecture | Monorepo layout for Orchestrator | Single Go module (`apps/backend`) with multiple binary targets (`cmd/api`, `cmd/orchestrator`) | Rudra | Priyanshu, Arpit |
| **DEC-02** | Queue Engine | Storage medium for asynchronous job queue | Postgres Outbox table using `FOR UPDATE SKIP LOCKED` | Rudra | Arpit, Priyanshu |
| **DEC-03** | Sandbox | Runtime engine for untrusted customer code compilation | gVisor (`runsc`) + Rootless BuildKit + Railpack in isolated `summit-builds` namespace | Rudra | Team of Three |
| **DEC-04** | Ingress | Edge ingress controller for customer routing | Traefik with custom `IngressRoute` CRDs and path-based routing | Rudra | Priyanshu |
| **DEC-05** | Network Security| Container networking interface and isolation policy | Cilium CNI with `CiliumNetworkPolicy` enforcing default-deny egress/ingress | Rudra | Team of Three |
| **DEC-06** | Secrets | Secret injection into tenant pods | External Secrets Operator (ESO) bridging OpenBao / AWS Secrets Manager | Rudra | Priyanshu |

### 17.2 Risk Management Log

| Risk ID | Description | Severity | Likelihood | Mitigation Strategy | Owner |
|---|---|---|---|---|---|
| **RSK-01** | Kernel escape during untrusted customer application build | Critical | Low | Enforce gVisor (`runsc`) user-space kernel virtualization + rootless BuildKit (UID 1000) with all Linux capabilities dropped. | Rudra |
| **RSK-02** | Outbox worker lease starvation or split-brain execution | High | Medium | Implement renewable 10s heartbeats with 30s expiration; require idempotency keys on every reconciliation action; utilize K8s Lease leader election. | Rudra |
| **RSK-03** | Resource exhaustion on 1–2 test Kubernetes hosts | High | High | Strict `ResourceQuota` and `LimitRange` per tenant namespace; build pod memory capped at 4Gi; automated pod GC after 30 minutes. | Rudra |
| **RSK-04** | Cross-tenant network snooping | Critical | Low | Cilium L3/L4 NetworkPolicies block all inter-namespace traffic; DNS resolution restricted to cluster DNS; link-local metadata addresses blocked. | Rudra |
| **RSK-05** | Plaintext secret exposure in logs or platform database | High | Low | ESO injects secrets directly from OpenBao into K8s Secrets; orchestrator handles only secret references, never plaintext payloads. | Rudra & Priyanshu |
| **RSK-06** | UI desynchronization during long-running builds | Medium | Medium | Orchestrator writes incremental milestone events to Postgres and Loki; UI Developer reviews event schemas for real-time frontend streaming. | Rudra & UI Dev |
