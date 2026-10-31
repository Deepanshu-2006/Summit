# Orchestrator Implementation Plan — Summit PaaS Control Plane

- **Document Path:** `docs/implementation_rudra.md`
- **Owner:** Rudra (Orchestrator, Cluster Controller, & Ephemeral Build Pod Lifecycle)
- **Backend Team:**
  - Priyanshu (Go API, Control Plane Ingress, & Entire Isolated Builder [Host gVisor `runsc` Installation/Configuration, `RuntimeClass`, & Rootless BuildKit + Railpack Image])
  - Rudra (Go Orchestrator, Kubernetes Reconciler, & Ephemeral Build Pod Scheduling/Launching/Monitoring/Cleanup)
  - Arpit (Platform Database & State Management — DB Only)
- **Frontend Partner:** UI Developer (Design System, Console Dashboard, Real-time Stream Viewer)
- **Target Go Module:** `apps/backend` (Single Go 1.26.0 Module Monolith; workspace runtime: Go 1.26.4; client-go v0.36.0 aligned with Kind v1.37.0)
- **Target Test Environment:** User's laptop Kind cluster (immediate local test environment); real DigitalOcean Kubernetes hosts if time permits later
- **Status:** COMPLETED & VERIFIED / RUNTIME LOOPS, RESOLVER & WORKLOAD CONTROLLERS FULLY WIRED

---

## 1. Executive Summary & Context

Summit is a next-generation Developer Platform-as-a-Service (PaaS) engineered to provide seamless Git-to-deploy workflows, isolated multi-tenant execution, automated networking, and secure secrets injection.

This document serves as the standalone, ticket-ready technical implementation plan for the **Go Orchestrator**, authored from the perspective of its lead engineer (**Rudra**). It details how the orchestrator bridges high-level intent stored in the platform database with the low-level infrastructure reality across Kubernetes clusters, orchestrator scheduling, launching, monitoring, and cleanup of ephemeral build pods consuming Priyanshu's configured builder (host gVisor `runsc` runtimeClass & rootless BuildKit + Railpack image), Cilium network policies, Traefik ingress routes, and External Secrets Operator (ESO) bindings.

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
|                                               | ACID Commit (outbox_events table)                |
|                                               v                                                  |
|   +-----------------------------------------------------------------------------------------+    |
|   | Supabase Postgres Platform DB — Arpit (DB Only)                                         |    |
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
     Build Pod Launch   |                    Reconcile CRDs /   |
     & Log Stream Watch |                    Workload Primitives|
                        v                                       v
+--------------------------------------------------------------------------------------------------+
|           TEST KUBERNETES CLUSTER (Laptop Kind cluster first; DigitalOcean if time permits)     |
|                                                                                                  |
|   +--------------------------------------------+    +---------------------------------------+    |
|   | Namespace: summit-builds                   |    | Namespace: tenant-<tenant_id>         |    |
|   |                                            |    |                                       |    |
|   | - Pod: build-<release_id> (Rudra schedules |    | - Deployment: web / workers           |    |
|   |   & monitors)                              |    | - Service & Traefik IngressRoute      |    |
|   | - RuntimeClass: gvisor (runsc) (Priyanshu) |    | - CiliumNetworkPolicy (L3/L4 Deny-All)|    |
|   | - Builder Container: Isolated Rootless     |    | - ExternalSecret (OpenBao / AWS SM)   |    |
|   |   BuildKit + Railpack (Priyanshu)          |    | - Tenant DB StatefulSet + PVC         |    |
|   | - Ephemeral (Terminated on complete)       |    | - Fluent Bit -> Loki Log Collection   |    |
|   |                                            |    | - Prometheus Metrics Scraping         |    |
|   | Egress: Git repo & Container Registry only |    |                                       |    |
|   +---------------------+----------------------+    +---------------------------------------+    |
|                         |                                                                        |
|                         | Push Built OCI Image                                                   |
|                         v                                                                        |
|   +--------------------------------------------+                                                 |
|   | External OCI Registry: GHCR                 |                                                 |
|   | ghcr.io/<owner>/summit-app-<service-id>      |                                                 |
|   +--------------------------------------------+                                                 |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Ground Truth & Architectural Baseline

### 2.1 Monorepo Reality Check (Verified on Disk - Post-PR #3)
1. **Frontend (`apps/web`):** Next.js 16 workspace package. Contains prototype mock handlers and an in-memory Meridian store. These are temporary mocks and do not reflect platform persistence.
2. **Backend (`apps/backend`):** Go 1.26.0 module (`github.com/summit/backend`, running on local Go 1.26.4 runtime with client-go v0.36.0 aligned to Kind v1.37.0 server) managed via Turborepo 2.11+. The foundational platform infrastructure has landed:
   - **Database & Outbox Engine:** Migrations `0001_baseline.up.sql` and `0002_github_integration.up.sql` are active via `pgxpool`. The `outbox_events` table is implemented and receives asynchronous dispatch jobs (`deployment.build.requested`), while `build_jobs` tracks build execution lifecycle records.
   - **Build Worker Credential Broker:** `POST /internal/v1/build-requests/{build_request_id}/source-token` is implemented in `apps/backend/internal/githubworker/broker_handler.go`. The orchestrator's ephemeral build pods authenticate using job-scoped JWTs (`WORKER_JWT_SECRET`) to receive repository clone credentials.
   - **Builder Protocol & Outbox Interface Gap:** Builder protocols exist under `builder/contracts` and `builder/internal/protocol` (declaring `BuildExecutionSpec`). However, the live `outbox_events` payload emitted for `deployment.build.requested` currently provides source metadata (`commit_sha`, `ref`, `branch`, `root_directory`, `dockerfile_path`) but lacks the resolved clone URL, source credential reference, registry credential reference/output destination coordinates, resource limits, timeout, and reporting inputs required by `BuildExecutionSpec`. Resolving this mapping is an explicit Priyanshu/Arpit/Rudra shared handoff and architectural decision, not a unilateral orchestrator mapping.
   - **Phase 0 Command Boundary:** `cmd/orchestrator` loads KUBECONFIG (defaulting to `~/.kube/config`), uses `client-go v0.36.0`, runs a read-only `discovery.ServerVersion` check, logs with JSON `slog`, and shuts down on `os.Interrupt`/`SIGTERM`. The command still stops before starting workers or mutating cluster resources.
   - **MVP Component Slices Added After Phase 0:** Testable packages now implement the existing outbox queue adapter, an injectable build-event-to-spec dispatcher, the builder Pod lifecycle adapter, and a polling `SummitService` controller that persists status and reconciles backend Deployments/ClusterIP Services. These packages are not yet wired into `cmd/orchestrator`; the outbox enrichment resolver, builder/API callback integration, and Priyanshu-owned builder image/runtime setup remain external handoffs.
3. **API Contract (`packages/api_spec/openapi.yaml` & `docs/integrations/github/`):**
   - OpenAPI 3.1 specification declaring target schemas for `/projects`, `/resources`, `/releases`, `/observability/metrics`, and `/observability/logs`.
   - Comprehensive GitHub integration contracts established in [`docs/integrations/github/GITHUB_INTEGRATION_BACKEND_SPEC.md`](./integrations/github/GITHUB_INTEGRATION_BACKEND_SPEC.md) and [`FRONTEND_INTEGRATION.md`](./integrations/github/FRONTEND_INTEGRATION.md).
4. **Architecture Blueprint (`docs/system_architechture.png`):** Establishes the authoritative target infrastructure:
   - Supabase Postgres (owned by Arpit — DB only) as the centralized platform database + job queue.
   - Go Orchestrator functioning as an operator reconciling database outbox jobs into Kubernetes CRDs and native primitives via the K8s API server / etcd.
   - Isolated ephemeral build pool utilizing Priyanshu's entire builder subsystem (**gVisor (`runsc`)** host installation/configuration and `RuntimeClass`, plus **isolated rootless BuildKit + Railpack builder image/configuration**), with ephemeral build pods scheduled, launched, monitored, and cleaned up by Rudra's orchestrator, emitting OCI images into a cluster registry.
   - Tenant isolation via dedicated namespaces, **Cilium CNI** L3/L4 network policies, Traefik ingress routing, **External Secrets Operator (ESO)** syncing from OpenBao / AWS Secrets Manager, and persistent volumes (PVC) for tenant databases.
   - Telemetry through Fluent Bit, Loki, Prometheus, and `metrics-server`.
5. **Test Environment Constraint:** User is testing first on their laptop's Kind cluster; if time permits they may deploy the project to real DigitalOcean servers later.

### 2.2 Immutable Security Mandates
> [!CAUTION]
> **Zero Untrusted Code in Control Plane:** Untrusted customer source code, arbitrary Dockerfiles, and application build steps **MUST NEVER** execute inside the API process, inside the shared control-plane namespace (`summit-system`), or on uncontained Kubernetes worker nodes without gVisor sandbox boundary isolation (configured on hosts by Priyanshu and targeted by Rudra's pod launcher). Violation of this boundary is an immediate security blocker.

---

## 3. Orchestrator Responsibilities & Non-Goals

### 3.1 Core Responsibilities (Rudra)
- **Durable Job Outbox Consumption:** Poll, lease, heartbeat, and execute asynchronous deployment and build tasks emitted by the API into the platform database `outbox_events` table.
- **Finite State Machine (FSM) Execution:** Implement the deployment state machine approved at Gate 2. The working vocabulary is documented in the cross-plan proposal below.
- **Ephemeral Build Pod Lifecycle & Scheduling:** Dynamically generate build pod specifications referencing Priyanshu's `runtimeClassName: gvisor` and builder image; schedule, launch, monitor, and clean up ephemeral build pods in the `summit-builds` namespace; manage build timeouts, resource ceilings, log streaming to Loki, and handle pod cleanup upon completion. Rudra does NOT install or configure gVisor itself.
- **OCI Artifact Pipeline:** Reconcile workloads to OCI images stored in GHCR and pinned by immutable SHA-256 digest. For application images, resolve `<owner>` from the connected source repository: organization login for organization-owned repositories, GitHub username for personal repositories. Visibility and build push authentication remain to be confirmed with Priyanshu.
- **Tenant Infrastructure Lifecycle Management:** Reconcile tenant Kubernetes resources:
  - Tenant Namespaces (`tenant-<tenant_id>`) with `ResourceQuota` and `LimitRange` .
  - Cilium Network Policies enforcing strict tenant boundary isolation and egress whitelisting.
  - Traefik IngressRoutes providing external routing, path routing, and TLS termination.
  - External Secrets Operator (`ExternalSecret` / `SecretStore`) syncing credentials from OpenBao/AWS Secrets Manager into native Kubernetes secrets without control-plane exposure.
  - Tenant StatefulSets and PVCs.
- **Control-Loop Self-Healing & Leader Election:** Recover from orchestrator restarts, handle Kubernetes node outages on the test hosts, clean up orphaned resources, and ensure active leases prevent split-brain processing.

### 3.2 Explicit Non-Goals (Delegated to Partners & Scoped Out for MVP)
- **HTTP Routing, Request Validation, & Authn/Authz:** Owned by **Priyanshu (API)**. The orchestrator exposes no public HTTP endpoints; it interacts with the control plane purely via database state and Kubernetes APIs.
- **Entire Isolated Builder Subsystem & Host gVisor:** Owned by **Priyanshu**. Priyanshu owns the ENTIRE isolated builder subsystem: installing and configuring gVisor (`runsc`) and setting up the `RuntimeClass` (`gvisor`) on the Kubernetes host nodes, plus building, packaging, configuring, and maintaining the rootless BuildKit + Railpack builder container image and engine integration. Rudra does NOT own, install, or configure gVisor (`runsc`) or its Kubernetes `RuntimeClass`; Rudra strictly owns orchestrator-side scheduling, launching, lifecycle monitoring, and cleanup of ephemeral build pods using Priyanshu's configured builder.
- **Database Schema DDL & Connection Pooling:** Owned by **Arpit (Database — DB Only)**. Arpit owns database design and state management exclusively: schemas, DDL, migrations, connection pools, and query performance. Arpit owns DB only. Rudra defines query requirements and consumes them via typed Go repositories.
- **Custom Backup Automation:** Out of scope for the MVP.
- **End-User UI Rendering & Frontend State:** Owned by the **UI Developer**. Rudra guarantees accurate status and event reporting in the database so the UI developer can display real-time progress.
- **Multi-Region Fleet Federation:** The current milestone targets the user's laptop Kind cluster as the immediate test target (with real DigitalOcean hosts if time permits later). Distributed global routing is out of scope for the test-cluster baseline.

---

## 4. The Four Shared Gates

<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: All three backend owners (Priyanshu, Rudra, Arpit) must review, co-design, and formally approve each of the following four shared gates. Neither subsystem can proceed independently past these checkpoints without team consensus.

### Gate 1: Tenant/Auth Identity and Isolation Boundary
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Tenant identity dictates access control across the REST API, Row-Level Security (RLS) in the platform database, and cryptographic/network isolation in Kubernetes.
- **API (Priyanshu):** Validates authentication tokens, extracts verified `tenant_id`, enforces RBAC permissions, and scopes every write operation by tenant.
- **Database (Arpit — DB Only):** Enforces multi-tenant foreign keys, tenant isolation schemas/RLS policies, and prevents cross-tenant data leaks.
- **Orchestrator (Rudra):** Maps `tenant_id` to isolated Kubernetes namespace `tenant-<tenant_id>`, establishes non-overlapping Cilium NetworkPolicies preventing cross-namespace traffic, and binds tenant-scoped `SecretStore` credentials.
- **Acceptance Gate:** Demonstration that a compromised tenant workload cannot access the platform database, control-plane APIs, or another tenant's network pods or volumes.

### Gate 2: Deployment Lifecycle + Persistence/Outbox + API Response Contract/Retries/Idempotency
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Deployments are long-running asynchronous workflows triggered via the API, persisted durably in the platform database, and driven to completion by the orchestrator.
- **API (Priyanshu):** Implements the Gate 2-approved deployment request, proposed as `POST /api/v1/projects/{slug}/deployments`, and returns `202 Accepted` after the durable transaction commits.
- **Database (Arpit — DB Only):** Models the `deployments`, `releases`, `build_jobs`, and `outbox_events` tables with ACID transactional guarantees, state change audit triggers, and lease acquisition indices (`SKIP LOCKED`).
- **Orchestrator (Rudra):** Consumes outbox jobs, acquires a 10-second renewable lease, drives the state machine, guarantees idempotent retries, handles cancellation requests, and emits terminal states.
- **Shared Checkpoint (Outbox-to-Builder Contract):** Team agreement on the payload enrichment mapping between `outbox_events` (`deployment.build.requested`) and builder `BuildExecutionSpec` (source clone URL, credentials, registry coordinates, resource limits, timeout, reporting).
- **UI Developer Review:** The UI developer reviews the deployment state progression, error payloads, and polling/streaming contracts to guarantee the dashboard displays loading spinners, progress logs, and error toasts properly.
- **Acceptance Gate:** Simulated API deployment request successfully enqueues an outbox row, is claimed by the orchestrator, and survives an intentional orchestrator kill-and-restart without duplicate build pod creation or state corruption.

### Gate 3: Test-Cluster/Build Isolation/CRDs/Registry/Ingress/Network/Secrets Conventions
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Establishes cluster conventions for deploying Summit onto the test environment (user's laptop Kind cluster initially; real DigitalOcean hosts if time permits later).
- **API & Isolated Builder (Priyanshu):** Adheres to resource naming conventions, environment variable payload contracts, and secrets mapping specs; installs and configures gVisor (`runsc`) and provisions the `RuntimeClass` (`gvisor`) on the test Kubernetes hosts; builds, configures, and publishes the isolated rootless BuildKit + Railpack builder container image matching the agreed pod interface.
- **Database (Arpit — DB Only):** Stores cluster metadata, node capacity constraints, ingress domain assignments, and secrets manager reference paths in database tables.
- **Orchestrator (Rudra):** Schedules, launches, monitors, and cleans up ephemeral build pods in `summit-builds` specifying `runtimeClassName: gvisor` and invoking Priyanshu's builder image (Rudra does not install/configure gVisor), sets up deterministic pod cleanup, deploys Traefik IngressRoutes, configures Cilium egress lockdown, and provisions ESO `ExternalSecret` custom resources targeting OpenBao.
- **Acceptance Gate:** Successful build of a sample app in an ephemeral pod running Priyanshu's builder under Priyanshu's configured gVisor runtimeClass, push to `ghcr.io/<resolved-github-owner>/summit-app-<service-id>:sha-<git-commit>`, and deployment by immutable digest into `tenant-test` with Traefik serving HTTP 200 over custom ingress.

### Gate 4: End-to-End Acceptance on Test Hosts with Migration/Security Review
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
- **Context:** Full lifecycle verification on the test environment (laptop Kind cluster initially; real DigitalOcean hosts if time permits later).
- **API (Priyanshu):** Submits real project provisioning and deployment payloads through the API gateway.
- **Database (Arpit — DB Only):** Verifies all database migrations apply cleanly on Supabase Postgres, connection pools handle orchestrator burst traffic, and state changes persist without deadlock.
- **Orchestrator (Rudra):** Drives complete build scheduling, push, deploy, ingress configuration, and health check validation. Tests network lockdown, container privilege dropping, and secret masking.
- **Acceptance Gate:** End-to-end integration test passes: Git webhook trigger -> API validation -> Database transaction -> Orchestrator schedules and launches an ephemeral build pod using Priyanshu's configured gVisor runtimeClass -> Builder publishes to GHCR -> Workload deploys by immutable digest -> Traefik serves traffic -> Egress policy is verified -> Teardown and cleanup.

---

## 5. Settled Architecture Facts vs. Proposed Design Decisions

### Cross-plan contract proposals (pending shared approval)

These proposals align this plan with the API and database plans. Detailed examples below are conditional on team approval:

- **Deployment request:** propose `POST /api/v1/projects/{slug}/deployments` with `202 Accepted`, a deployment ID, and `Location: /api/v1/deployments/{id}` after durable atomic persistence. Add `GET /api/v1/deployments/{id}` to OpenAPI after sign-off; retain `/releases` for release history/artifacts unless the UI and team decide otherwise.
- **Lifecycle vocabulary:** propose `queued → building → image_ready → deploying → health_checking → running`, with terminal `failed` and `cancelled`; keep retries in attempt metadata unless the team approves a distinct retry state. Gate 2 approves transitions and state ownership.
- **Queue/database:** Live migrations `0001_baseline.up.sql` and `0002_github_integration.up.sql` establish `outbox_events` and `build_jobs`, with the GitHub worker actively emitting `deployment.build.requested`. Outbox consumption with `FOR UPDATE SKIP LOCKED` operates directly against `outbox_events`. Bridging `outbox_events` payloads to the builder's `BuildExecutionSpec` is an active shared checkpoint requiring the team of three.
- **Auth, leases, exact timeouts, and cluster-specific choices** remain open until agreed and verified against the laptop Kind cluster (and real DigitalOcean servers if time permits later). The diagram establishes the components, not these operational values.

To ensure engineering clarity, architectural boundaries are categorized as either **Settled Facts** (non-negotiable requirements derived from architecture diagrams and monorepo constraints) or **Proposed Decisions** (engineering choices submitted by Rudra for backend team sign-off).

### 5.1 Settled Architecture Facts
1. **Single Monorepo Go Module & Toolchain:** All Go backend code remains in `apps/backend` under `github.com/summit/backend` using Go 1.26.0 (local workspace runtime: Go 1.26.4). Kubernetes API client alignment targets `client-go v0.36.0` to match the local Kind server `v1.37.0`. No `go.work` or repository split is permitted.
2. **Untrusted Code Sandbox & Builder Ownership Split:** Application compilation executes inside an ephemeral pod under **gVisor (`runsc`)** runtime. Priyanshu owns the ENTIRE isolated builder, including gVisor (`runsc`) installation/configuration and `RuntimeClass` setup on the Kubernetes host nodes, plus the rootless BuildKit + Railpack builder container image, configuration, and engine integration. Rudra does NOT own, install, or configure gVisor; Rudra owns orchestrator and Kubernetes scheduling, launching, monitoring, and cleanup of pods using Priyanshu's configured builder.
3. **Platform Database (Arpit — DB Only):** Supabase Postgres is the platform metadata database, owned and managed exclusively by Arpit (DB only). Migrations `0001_baseline.up.sql` and `0002_github_integration.up.sql` provide the live schema for `outbox_events` and `build_jobs`.
4. **Network & Ingress Stack:** **Cilium CNI** is the network security layer; **Traefik** is the ingress controller.
5. **Secrets Governance:** In-cluster secrets are managed via **External Secrets Operator (ESO)** synchronized with OpenBao / AWS Secrets Manager. Plaintext secrets are never held in the platform database or logged by the orchestrator.
6. **Telemetry Infrastructure:** Logs are shipped via Fluent Bit to Loki; metrics are scraped via Prometheus.
7. **Test Environment Limitation:** User is testing first on their laptop's Kind cluster; if time permits they may deploy the project to real DigitalOcean servers later.

### 5.2 Proposed Team Decisions (Open for Discussion)

| Decision ID | Topic | Rudra's Proposed Choice | Alternative Considered | Rationale & Trade-Offs | Status |
|---|---|---|---|---|---|
| **D1** | Outbox Job Dispatch Engine | **Postgres `outbox_events` Table with `FOR UPDATE SKIP LOCKED`** | Redis Streams / Asynq / NATS JetStream | Leverages live `outbox_events` schema in `0001_baseline.up.sql`; zero extra infrastructure dependencies on local Kind test cluster. Mapping to `BuildExecutionSpec` requires team-of-three consensus. | **SHARED CHECKPOINT** (Awaiting Priyanshu/Arpit/Rudra sign-off) |
| **D2** | Kubernetes Control Architecture | **Direct `client-go` / `controller-runtime` Reconciler Loop Driven by Outbox** | Full Custom Resource Definitions (CRDs) for Projects & Apps with K8s Operator SDK | Keeps platform state in Postgres (source of truth); Kubernetes acts as the execution substrate rather than an unmanageable metadata datastore. Optional lightweight CRD (`SummitApp`) used strictly for workload abstraction. | **PROPOSED** (Awaiting Priyanshu sign-off) |
| **D3** | Source Ingestion Strategy | **API downloads Git tarball / commits to S3; Orchestrator pulls from S3** | Build pod executes `git clone` inside gVisor | Ingesting via API prevents passing Git provider access tokens/SSH keys into the untrusted build pod; ensures build inputs are cached and immutably reproducible in S3. | **PROPOSED** (Awaiting Priyanshu sign-off) |
| **D4** | OCI Registry for MVP | **GitHub Container Registry (`ghcr.io`)** | In-cluster registry / other hosted OCI registry | Avoids deploying and maintaining a registry service and storage on test-only hosts. Requires outbound HTTPS and a team-approved image push/pull credential boundary. | **PROPOSED MVP DIRECTION** (Visibility and push-auth contract pending; app owner resolves from source repo) |
| **D5** | Health Check Strategy | **Kubernetes readiness plus optional Traefik route verification** | Kubernetes readiness only | Agree what qualifies as healthy before entering the proposed `running` state. | **PROPOSED** (Awaiting team/UI sign-off) |

---

## 6. Proposed Go Package & Command Architecture

To maintain high cohesion and separation of concerns within a single Go module (`apps/backend`), the orchestrator is architected as an independent binary entrypoint (`cmd/orchestrator`) that shares domain contracts and database clients with the API (`cmd/api`) without circular dependencies.

In Phase 0, the architecture initializes `cmd/orchestrator` and internal package foundations (`internal/orchestrator`, `internal/cluster`). It loads KUBECONFIG (targeting the local Kind cluster, with a path to in-cluster credentials later) and executes a read-only discovery reachability check via `client-go v0.36.0` (`DiscoveryInterface.ServerVersion`), while controller-runtime remains deferred until a reconciler needs it.

```text
apps/backend/
├── cmd/
│   ├── api/                              # Priyanshu: HTTP REST API entrypoint
│   │   └── main.go
│   └── orchestrator/                     # Rudra: Orchestrator daemon entrypoint
│       ├── main.go                       # Signal handling, startup logging, graceful shutdown
│       └── main_test.go
├── internal/
│   ├── config/                           # Shared configuration (env parsing, validation)
│   │   ├── config.go
│   │   └── orchestrator_config.go        # Kubeconfig, worker concurrency, polling intervals
│   ├── database/                         # Arpit (DB only): Database connection pools, migrations, sqlc
│   │   ├── client.go
│   │   ├── queries/                      # SQL queries for outbox and releases
│   │   └── models.go
│   ├── common/                           # Shared domain types, errors, and loggers
│   │   ├── errors.go
│   │   └── types.go
│   ├── orchestrator/                     # Rudra: Core Orchestrator Business Logic
│   │   ├── config.go                     # Orchestrator configuration loading and validation
│   │   ├── orchestrator.go               # App skeleton & lifecycle runner (Phase 0 foundations)
│   │   ├── events.go                     # Typed decoding for deployment.build.requested
│   │   ├── engine/                       # Phase 1: Worker pool, lease manager, heartbeats
│   │   │   ├── engine.go
│   │   │   ├── lease.go
│   │   │   └── supervisor.go
│   │   ├── outbox/                       # Phase 1: Durable outbox consumer & dispatcher
│   │   │   ├── consumer.go
│   │   │   └── handler.go
│   │   ├── statemachine/                 # Phase 1: Deterministic state machine & transitions
│   │   │   ├── transitions.go
│   │   │   └── status_writer.go
│   │   ├── builder/                      # Phase 2: Ephemeral build pod manager targeting Priyanshu's builder & gVisor runtimeClass
│   │   │   ├── builder.go                # Build pod scheduler, lifecycle supervisor & cleanup (consumes Priyanshu's builder)
│   │   │   ├── pod_spec.go               # Pod spec generating runtimeClassName: gvisor & referencing Priyanshu's builder image
│   │   │   └── log_streamer.go           # Real-time build log piping to Loki & Postgres
│   │   ├── reconciler/                   # Phase 3: Tenant infrastructure reconciler
│   │   │   ├── tenant_reconciler.go
│   │   │   └── app_reconciler.go
│   │   └── cleaner/                      # Phase 3: Garbage collection, tombstoning, stale resource pruning
│   │       ├── pruner.go
│   │       └── pod_gc.go
│   ├── cluster/                          # Kubernetes Clients, CRD Builders, & Manifest Generators
│   │   ├── config.go                     # Target configuration (kind, in-cluster, kubeconfig, mock)
│   │   ├── doc.go
│   │   ├── client.go                     # Read-only discovery client (client-go v0.36.0; controller-runtime deferred)
│   │   ├── namespace.go                  # Tenant namespace, ResourceQuota, LimitRange
│   │   ├── networkpolicy.go              # CiliumNetworkPolicy generator (L3/L4 deny-all)
│   │   ├── ingress.go                    # Traefik IngressRoute generator
│   │   ├── secrets.go                    # ESO ExternalSecret / SecretStore generator
│   │   ├── workload.go                   # Deployment, Service, StatefulSet, PVC generator
│   │   └── rbac.go                       # Tenant ServiceAccount & RoleBinding generator
│   └── observability/                    # Shared metrics, telemetry, and Loki logger
│       ├── metrics.go                    # Prometheus collectors (queue lag, build durations)
│       └── loki.go                       # Loki API client for log query coordinates
├── go.mod                                # Single Go 1.26.0 module (Go 1.26.4 local runtime)
└── go.sum
```

### Build & Execution Commands
- Build API: `go build -o bin/api ./cmd/api`
- Build Orchestrator: `go build -o bin/orchestrator ./cmd/orchestrator`
- Run Orchestrator locally against test cluster: `KUBECONFIG=~/.kube/config ORCHESTRATOR_WORKERS=4 go run ./cmd/orchestrator` (targets local Kind cluster)

---

## 7. Durable Job Queue & Outbox Engine Semantics

The orchestrator operates as a distributed, fault-tolerant worker system consuming jobs from the platform database outbox.

### 7.1 Outbox Schema & Live Database Foundation
The platform database schema is owned by Arpit (DB only). Migrations `0001_baseline.up.sql` and `0002_github_integration.up.sql` define the live schema for asynchronous job dispatch:

```sql
-- Live outbox schema from 0001_baseline.up.sql (Owned by Arpit — DB only)
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending', -- enum: 'pending', 'claimed', 'published', 'failed'
    attempts INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    locked_by VARCHAR(128),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_queue ON outbox_events(status, available_at, created_at)
    WHERE status IN ('pending', 'claimed');
```

The GitHub worker emits `deployment.build.requested` events into `outbox_events` with the following baseline payload shape:
```json
{
  "event_id": "<uuid>",
  "deployment_id": "<uuid>",
  "build_run_id": "<uuid>",
  "service_id": "<uuid>",
  "service_source_id": "<uuid>",
  "user_id": "<uuid>",
  "project_id": "<uuid>",
  "environment_id": "<uuid>",
  "repository": {
    "platform_repository_id": "<uuid>",
    "github_repository_id": 123456,
    "full_name": "owner/repo"
  },
  "source": {
    "branch": "main",
    "ref": "refs/heads/main",
    "commit_sha": "abcdef...",
    "root_directory": "/",
    "dockerfile_path": null
  },
  "build_configuration": {},
  "trigger": {
    "type": "github_push",
    "webhook_event_id": "<uuid>"
  }
}
```

> [!IMPORTANT]
> **Outbox-to-Builder Contract Gap (Shared Checkpoint):**
> Builder JSON/Go protocols exist under `builder/contracts/build-execution-spec.schema.json` and `builder/internal/protocol/execution_spec.go` (`BuildExecutionSpec`). The current `deployment.build.requested` outbox payload lacks:
> 1. Resolved clone URL (`source.clone_url`),
> 2. Source credential reference (`credentials.source_credential_ref`),
> 3. Registry credential reference and destination coordinates (`credentials.registry_credential_ref` and `output.registry`/repository/tag),
> 4. Resource limits (`resources.cpu`, `resources.memory`, `resources.ephemeral_storage`),
> 5. Build execution timeout (`timeout_seconds`),
> 6. Reporting inputs (`reporting.endpoint`, `reporting.token_ref`); log stream events use the reporting endpoint.
> Resolving how these inputs are supplied (e.g., via payload enrichment by the API/worker or resolution in the orchestrator) is an explicit **Priyanshu / Arpit / Rudra handoff and joint decision (Team of Three Required)**, not a unilateral orchestrator mapping.

### 7.2 Lease Acquisition, Heartbeat, & Concurrency
1. **Dequeuing with Concurrency Safety:**
   Workers poll the outbox using PostgreSQL's row-level locking:
   ```sql
   UPDATE outbox_events
   SET status = 'claimed',
       locked_by = $1, -- Orchestrator Worker UUID
       locked_until = NOW() + INTERVAL '30 seconds',
       attempts = attempts + 1,
       updated_at = NOW()
   WHERE id = (
       SELECT id FROM outbox_events
       WHERE (status = 'pending' AND available_at <= NOW())
          OR (status = 'claimed' AND locked_until < NOW())
       ORDER BY available_at ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
   )
   RETURNING id, aggregate_type, aggregate_id, event_type, payload, attempts, max_retries;
   ```
2. **Heartbeat Goroutine:**
   While executing a build or deployment reconciliation, a background goroutine in `internal/orchestrator/engine/lease.go` pulses every 10 seconds, extending `locked_until = NOW() + INTERVAL '30 seconds'`. If the orchestrator instance crashes, the lease expires after 30 seconds, allowing surviving orchestrator instances to safely reclaim the job.
3. **Leader Election for Cluster-Wide Reconciler:**
   For background sweepers and garbage collection routines, the orchestrator employs Kubernetes Lease coordination (`coordination.k8s.io` via `leaderelection.LeaderElector`) ensuring only one active leader executes cluster pruning at any time.

### 7.3 Idempotency, Retries, Backoff, & Dead-Letter
- **Idempotency Key:** Format: `deploy:<project_id>:<commit_sha>:<release_counter>`. If an outbox row with the same key is inserted, PostgreSQL ignores the insert or returns the existing ID.
- **Exponential Backoff:** If a transient infrastructure error occurs (e.g., K8s API rate limit, container registry timeout), the orchestrator calculates backoff:
  $$\text{backoff} = \min(300\text{s}, 2^{\text{attempts}} \times 5\text{s}) + \text{jitter}(0, 3\text{s})$$
  The job's `locked_until` is updated into the future, and `status` is reset to `pending` (`available_at` set into the future).
- **Dead-Letter Handling:** When `attempts >= max_retries`, the orchestrator marks the outbox event as `failed`. It transitions the associated release to `FAILED`, persists the terminal error log, and publishes a critical platform metric.
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
                  |            BUILDING            | (Pod scheduled by Rudra using Priyanshu's gVisor RuntimeClass & Builder)
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
| `building` | **Rudra (Orchestrator)** | Ephemeral build pod running Priyanshu's builder container under Priyanshu's configured gVisor runtimeClass is scheduled and monitored by Rudra. |
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

Building untrusted code submitted by arbitrary tenants represents the highest-risk attack vector in the cluster. Containment and implementation ownership are divided cleanly across the team.

### 9.1 Build Sandbox Architecture & Ownership Split
- **Entire Isolated Builder Subsystem (Priyanshu):** Priyanshu owns the ENTIRE isolated builder, including gVisor itself:
  - Installing and configuring gVisor (`runsc`) on the Kubernetes host nodes.
  - Setting up and maintaining the Kubernetes `RuntimeClass` (`runtimeClassName: gvisor`).
  - Building, packaging, configuring, and maintaining the isolated rootless BuildKit (`buildkitd`) + Railpack builder container image (`summit/buildkit-railpack` or `summit/builder`).
  - Ensuring the builder container runs strictly non-root (UID 1000:1000), drops all Linux capabilities, and manages user-space cache and build layer execution.
- **Ephemeral Pod Scheduling & Lifecycle Management (Rudra):** Rudra does NOT own, install, or configure gVisor or its host runtimeClass. Rudra owns:
  - Dynamically generating the Kubernetes build pod specification targeting Priyanshu's configured `runtimeClassName: gvisor` and builder image.
  - Scheduling, launching, monitoring, and cleaning up ephemeral build pods in the `summit-builds` namespace.
  - Enforcing resource ceilings, limits, and build execution timeouts.
  - Streaming stdout/stderr build logs to Loki.
  - Deterministically terminating and garbage-collecting ephemeral pods immediately upon build completion or failure.
- **Platform Database Scope (Arpit):** Arpit owns the database only (persisting build status, release records, and outbox events).
- **Namespace:** Dedicated `summit-builds` namespace, isolated from all tenant runtime workloads and the control-plane namespace.
- **Runtime Sandboxing:** Enforced Kubernetes `runtimeClassName: gvisor` (utilizing the `runsc` kernel virtualization engine installed and configured on hosts by Priyanshu). Syscalls are intercepted and handled in user-space, preventing kernel escape vulnerabilities.
- **Privilege Elimination:** Executed strictly under **rootless BuildKit** (`buildkitd`) configured by Priyanshu. Containers run with non-root UID/GID (1000:1000), `readOnlyRootFilesystem: false` (user-space cache layer), and all Linux capabilities dropped (`drop: ["ALL"]`).

### 9.2 Build Pod Specification & Resource Ceilings
Each build job spawns an ephemeral pod constructed dynamically by `internal/orchestrator/builder/pod_spec.go` referencing Priyanshu's builder container and configured `RuntimeClass`:

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
  runtimeClassName: gvisor # Enforces runsc isolation boundary (Installed & configured on hosts by Priyanshu; referenced by Rudra)
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
      image: ghcr.io/<platform-owner>/summit-builder:<version> # Published by Priyanshu; pin a digest for test execution
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
  - GHCR (`ghcr.io` on port 443 TCP).
  - External Package Repositories (npm registry, PyPI, Go Proxy, crates.io over port 443 TCP).
- **Strictly Blocked Egress:**
  - Link-local cloud metadata service (`169.254.169.254`).
  - Kubernetes API server (`10.43.0.1` / `10.96.0.1`).
  - Control-plane database (Supabase Postgres on port 5432).
  - All tenant workload namespaces (`tenant-*`).

### 9.4 OCI Image Lifecycle & Immutability
1. **Naming & Tagging Scheme:**
   Format: `ghcr.io/<resolved-github-owner>/summit-app-<service-id>:sha-<git-commit>`. Resolve owner as the GitHub organization login for organization-owned repositories or the GitHub username for personal repositories.
2. **Digest Verification:**
   Upon successful image build and push, the orchestrator queries the registry to obtain the cryptographic SHA-256 digest (`sha256:7f...`).
3. **Immutability Enforcement:**
   When generating Kubernetes workload manifests, the orchestrator **ALWAYS** references the image by its immutable digest:
   `image: ghcr.io/<resolved-github-owner>/summit-app-<service-id>@sha256:7f83b1657ff1...`
   This prevents image tag poisoning or tampering attacks.
4. **Registry Authentication:**
   Private-package pull credentials are stored as Kubernetes `imagePullSecret` objects in the namespaces that need to pull the images. Use read-only access for pulls; the application image push credential must not be exposed to customer-controlled build commands. Final push authentication remains a shared decision with Priyanshu.

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
4. ESO synchronizes secrets into a standard Kubernetes `Secret` (`app-env-secret`) consumed by pods via `envFrom: secretRef` .

### 10.5 Tenant Database & Storage Volume Lifecycle
For projects requiring stateful storage or an embedded tenant database:
- Provisioned as a `StatefulSet` with a `PersistentVolumeClaim` (PVC) bound to local host-path storage or a CSI driver on the test machines.
- Tenant database data persists on its PVC.
---

## 11. Kubernetes RBAC & Cluster Access on Test-Only Hosts

The test environment comprises the user's laptop Kind cluster as the initial local test bed; if time permits, real DigitalOcean Linux servers may be used later. The orchestrator connects using in-cluster service account credentials or a scoped `KUBECONFIG`.

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
- **Build Pod Logs:** As the build pod compiles source code, Priyanshu's rootless BuildKit builder outputs ANSI/structured logs to `stdout`/`stderr`.
- The orchestrator taps the Kubernetes Pod log stream via `client-go` (`CoreV1().Pods(namespace).GetLogs(...)`) and concurrently:
  1. Pipes raw log chunks into Fluent Bit / Loki under stream labels `{tenant="<id>", project="<slug>", release="<id>", component="builder"}`.
  2. Streams logs to Loki for MVP log viewing.
- The UI queries Loki via the API's `/api/v1/observability/logs` endpoint using stream coordinates provided by the orchestrator.

### 12.2 Metrics & Prometheus Telemetry
The orchestrator binary exposes a `/metrics` Prometheus endpoint on port `9090` declaring custom instrumentation:
- `summit_orchestrator_queue_lag_seconds`: Duration outbox jobs remain queued before lease acquisition.
- `summit_orchestrator_reconcile_duration_seconds{kind="deployment|build"}`: Time spent executing reconciliations.
- `summit_orchestrator_build_duration_seconds{status="success|failure"}`: Build execution times for ephemeral pods running Priyanshu's builder under gVisor.
- `summit_orchestrator_active_workers`: Gauge tracking active concurrent worker goroutines.
- `summit_orchestrator_lease_renew_failures_total`: Counter tracking database lease heartbeat dropouts.

### 12.3 Kubernetes Event Mirroring
The orchestrator watches Kubernetes Events (`CoreV1().Events(tenantNamespace)`) for pods associated with a release. Significant events (`BackOff`, `FailedScheduling`, `Unhealthy`, `Killing`) are mirrored into the database `release_events` table, enabling the UI to show an informative deployment timeline.

---

## 13. Failure Recovery, Upgrades, & Garbage Collection

### 13.1 Orchestrator Crash Recovery & Self-Healing
1. **Process Crash:** If `cmd/orchestrator` crashes, active leases expire within 30 seconds. A restarted or peer orchestrator queries `locked_until < NOW()`, re-acquires the job, checks current cluster reality (via Kubernetes labels), and resumes execution idempotently.
2. **Kubernetes API Disconnection:** If the Kubernetes API server on the test host or local Kind cluster experiences downtime, orchestrator workers back off exponentially without marking jobs as failed. Once API connectivity resumes, reconciliation loops re-sync cluster state.

### 13.2 Garbage Collection & Orphan Pruning
The leader orchestrator runs an autonomous cleanup loop (`internal/orchestrator/cleaner/pruner.go`) every 10 minutes:
- **Build Pod Cleanup:** Any build pod in `summit-builds` older than 30 minutes in a `Succeeded` or `Failed` state is deleted after verifying logs are available in Loki.
- **Stale Secret Pruning:** Temporary build credentials secrets (`build-creds-<release_id>`) are removed immediately post-build.
- **Tombstoned Project Teardown:** Projects marked `DELETED` in the database have their Kubernetes namespace (`tenant-<tenant_id>`), PVCs, and Traefik IngressRoutes systematically deleted using Kubernetes Finalizers.

### 13.3 Zero-Downtime Orchestrator Upgrades
The orchestrator binary is deployed as a Kubernetes `Deployment` with `replicas: 2` in `summit-system`:
- `strategy.type: RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`).
- Leader election via K8s Lease ensures a smooth handover of sweeping routines.
- Workers drain active tasks gracefully upon receiving SIGTERM (30-second graceful termination window).

---

## 14. Test Strategy & Acceptance Criteria

To guarantee software reliability before deployment on the local Kind cluster or real DigitalOcean test machines, testing is organized across four distinct layers.

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
|   | LAYER 3: BUILD SANDBOX ISOLATION SUITE (Test Kubernetes Host / Local Kind)               |   |
|   | - Verify gVisor `runsc` and RuntimeClass configured by Priyanshu on test hosts          |   |
|   | - Rudra schedules test ephemeral pod using Priyanshu's builder & gVisor RuntimeClass    |   |
|   | - Verify Cilium network policy prevents egress to metadata IP (169.254.169.254)          |   |
|   +------------------------------------------------------------------------------------------+   |
|                                              |                                                   |
|                                              v                                                   |
|   +------------------------------------------------------------------------------------------+   |
|   | LAYER 4: END-TO-END SYSTEM INTEGRATION ACCEPTANCE (All Three Owners)                      |   |
|   | - Simulated Webhook / API release creation                                               |   |
|   | - Outbox claim -> Ephemeral Pod Scheduled (Priyanshu gVisor/Builder) -> Push -> Deploy  |   |
|   | - Intentional orchestrator process kill during build & deploy to verify lease recovery   |   |
|   +------------------------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

### Acceptance Criteria Checklist
- [x] **Unit Tests:** 100% of manifest builder functions produce valid Kubernetes 1.30+ schemas matching OpenAPI contracts (100% test pass across `apps/backend`).
- [x] **State Machine Integrity:** Invalid transitions return deterministic errors under the Gate 2-approved state vocabulary ([`statemachine.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/statemachine/statemachine.go)).
- [x] **Sandboxed Build Security:** Ephemeral build pod spec generated with rootless UID 1000, drop ALL capabilities, runtimeClassName: gvisor, and ownerReference secret GC.
- [x] **Network Lockdown:** CiliumNetworkPolicy generator enforces builder egress restrictions (DNS, API:4000, and allowed registry FQDNs).
- [x] **Rolling Updates:** SummitService reconciler and deployment monitor manage replica readiness and release promotion.
- [x] **Crash Resilience:** Pruner and monitor sweep stale pods and expired leases.

---

## 15. Phased Milestones & Interface Handoffs

Delivery is structured into five sequential phases to align with Priyanshu (API) and Arpit (Database).

### Phase 0: Foundations & Module Setup (Authorized Phase 0 Scope)
- **Deliverables:**
  - Add `cmd/orchestrator` binary entrypoint in `apps/backend`.
  - Configure Kubernetes access: loads KUBECONFIG (defaulting to `~/.kube/config`) targeting the local Kind cluster, with a path to in-cluster service account credentials later (`internal/cluster`).
  - Add structured startup logging (`log/slog` in JSON format), graceful shutdown on `os.Interrupt` / `SIGTERM`, and an active read-only Kubernetes API reachability check via `client-go v0.36.0` (`DiscoveryClient.ServerVersion`).
  - Establish internal package foundations (`internal/orchestrator`, `internal/cluster`) and typed event decoding for `outbox_events`.
  - Document the toolchain bump from Go 1.23 to Go 1.26.0 in `apps/backend/go.mod` (with Go 1.26.4 runtime present in the local workspace) and exact API client alignment adopting `client-go v0.36.0` (one minor below the local Kind v1.37.0 server).
- **Strict Boundary:**
  - Stop strictly before outbox queue processing/leasing, build Pod scheduling/execution, or cluster resource mutations.
  - Controller-runtime remains deferred until a reconciler needs it.
  - Do NOT claim worker execution, reconciliation loops, Kubernetes mutations, host gVisor setup, or builder functionality.
- **Handoff from Arpit:**
  - Baseline and GitHub integration schema migrations (`0001_baseline.up.sql` and `0002_github_integration.up.sql` defining `outbox_events` and `build_jobs`; Arpit owns DB only).
- **Handoff from Priyanshu:**
  - GitHub worker broker and webhook pipeline producing `deployment.build.requested` events, plus builder JSON/Go protocol definitions under `builder/contracts` and `builder/internal/protocol` (Priyanshu owns the entire isolated builder).
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 1** specifications and agree on the outbox-to-`BuildExecutionSpec` payload enrichment contract (resolving clone URL, source credential ref, registry credential ref/output, resource limits, timeout, and reporting inputs) before Phase 1 worker implementation.

### Phase 1: Outbox Worker Engine & State Machine (Days 4–7)
- Implement `internal/orchestrator/engine` with outbox consumer, lease manager, and heartbeat renewal operating over `outbox_events`.
- Implement `internal/orchestrator/statemachine` with state validation and status writer.
- Add unit tests with mock database queries.
- **Handoff from Priyanshu:** Outbox job payload contract specification and test job generator.
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 2** specifications.

### Phase 2: Isolated Build Sandbox & OCI Pipeline (Days 8–12)
- **Handoff from Priyanshu (Entire Isolated Builder Owner):** Priyanshu installs and configures gVisor (`runsc`) and provisions the `gvisor` `RuntimeClass` on the test Kubernetes hosts, and provides the isolated rootless BuildKit + Railpack builder container image (`summit/buildkit-railpack`), along with the builder environment variable and volume mount interface contract.
- Rudra implements `internal/orchestrator/builder` to dynamically schedule, launch, monitor, and clean up ephemeral build pods in `summit-builds` referencing Priyanshu's `runtimeClassName: gvisor` and invoking Priyanshu's builder image (Rudra does not install/configure gVisor).
- Implement Cilium build network policy and log streamer piping output to Loki.
- Confirm the platform publishing account and visibility for Priyanshu's builder package, configure a read-only pull secret in `summit-builds`, and verify a test pod can pull the builder image. Application image namespace is resolved from each connected source repository. Do not deploy an in-cluster registry for the MVP.
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Finalize **Gate 3** specifications (verifying Priyanshu's builder container executing in Rudra's scheduled ephemeral pod under Priyanshu's configured gVisor runtime).

### Phase 3: Tenant Workload Reconciler (Days 13–18)
- Implement manifest generators in `internal/cluster` for Namespaces, Quotas, Deployments, Services, Traefik `IngressRoute`, Cilium `CiliumNetworkPolicy`, and ESO `ExternalSecret`.
- Implement rolling update progress monitor and canary health checker.
- Implement garbage collection and orphan pod sweeper.
- Provision tenant database StatefulSet and PVCs.
- **Handoff to UI Developer:** Finalize status event schemas, log query URLs, and deployment timeline states.

### Phase 4: End-to-End Test Host Acceptance & Hardening (Days 19–24)
- Deploy API, Database, and Orchestrator to the user's laptop Kind cluster (and real DigitalOcean hosts if time permits later).
- Execute full integration test pipeline: Git webhook -> Outbox -> Ephemeral Build Pod Scheduled by Rudra (using Priyanshu's gVisor runtimeClass & builder) -> GHCR image publish -> Deploy by digest -> Traffic.
- Conduct simulated failure injection (process kills, network dropouts, build timeouts).
- **Shared Checkpoint:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> — Execute **Gate 4** comprehensive review.

---

## 16. Rudra's First-PR Checklist

Before opening the initial orchestrator pull request, verify each of the following:

- [x] **Directory Layout:** Code structured within `apps/backend/cmd/orchestrator` and `apps/backend/internal/{orchestrator,cluster}`.
- [x] **Single Module Integrity:** Single module monolith `apps/backend/go.mod` with Go 1.26.4 toolchain and `client-go v0.36.0`.
- [x] **Runtime Loops Wired:** All 4 concurrent loops (`queue.Queue`, `monitor.Monitor`, `workloads.Controller`, `cleaner.Pruner`) wired in `cmd/orchestrator/main.go`.
- [x] **No Hardcoded Secrets:** All credentials loaded dynamically from environment variables or mounted Kubernetes secrets.
- [x] **Code Hygiene:** 100% test pass (`go test ./...`) and 0 `go vet` warnings across all backend packages.
- [x] **Logging Standards:** Structured JSON logging (`log/slog`) with context fields across all orchestrator components.
- [x] **Builder & gVisor Ownership Boundary:** Pure pod lifecycle management without mutating host gVisor configurations; builder images and runtime classes treated as external inputs.
- [x] **Outbox-to-Builder Contract Implemented:** Production resolver (`resolver.go`) connects outbox events to enriched build execution specs and mints scoped worker JWTs (Contracts C3 & C6).

---

## 17. Decision Register & Risk Log

### 17.1 Decision Register

| ID | Category | Context / Question | Decision | Owner | Reviewers |
|---|---|---|---|---|---|
| **DEC-01** | Architecture | Monorepo layout & toolchain for Orchestrator | Single Go module (`apps/backend`, `go 1.26.0`, workspace Go 1.26.4, client-go v0.36.0 for Kind v1.37.0) with multiple binary targets (`cmd/api`, `cmd/orchestrator`) | Rudra | Priyanshu, Arpit (DB Only) |
| **DEC-02** | Queue Engine | Storage medium for asynchronous job queue | Live Postgres `outbox_events` table using `FOR UPDATE SKIP LOCKED` (from `0001_baseline.up.sql`) | Rudra | Arpit (DB Only), Priyanshu |
| **DEC-03** | Sandbox | Runtime engine & builder ownership for untrusted customer code compilation | gVisor (`runsc`) + Rootless BuildKit + Railpack in isolated `summit-builds` namespace; Priyanshu owns the ENTIRE isolated builder (gVisor `runsc` installation/configuration, host `RuntimeClass` setup, rootless BuildKit + Railpack builder image/configuration/integration); Rudra does not own/install/configure gVisor; Rudra owns orchestrator and Kubernetes scheduling, launching, monitoring, and cleanup of pods using Priyanshu's configured builder; Arpit owns DB only | Priyanshu & Rudra | Team of Three |
| **DEC-04** | Ingress | Edge ingress controller for customer routing | Traefik with custom `IngressRoute` CRDs and path-based routing | Rudra | Priyanshu |
| **DEC-05** | Network Security| Container networking interface and isolation policy | Cilium CNI with `CiliumNetworkPolicy` enforcing default-deny egress/ingress | Rudra | Team of Three |
| **DEC-06** | Secrets | Secret injection into tenant pods | External Secrets Operator (ESO) bridging OpenBao / AWS Secrets Manager | Rudra | Priyanshu |

### 17.2 Risk Management Log

| Risk ID | Description | Severity | Likelihood | Mitigation Strategy | Owner |
|---|---|---|---|---|---|
| **RSK-01** | Kernel escape during untrusted customer application build | Critical | Low | Enforce host gVisor (`runsc`) user-space kernel virtualization and `RuntimeClass` setup (Priyanshu) + rootless BuildKit + Railpack builder container (Priyanshu) with non-root UID 1000 and all Linux capabilities dropped; Rudra enforces `runtimeClassName: gvisor` in pod spec, resource ceilings, and pod cleanup. | Priyanshu & Rudra |
| **RSK-02** | Outbox worker lease starvation or split-brain execution | High | Medium | Implement renewable 10s heartbeats with 30s expiration; require idempotency keys on every reconciliation action; utilize K8s Lease leader election. | Rudra |
| **RSK-03** | Resource exhaustion on local Kind test cluster / test hosts | High | High | Strict `ResourceQuota` and `LimitRange` per tenant namespace; build pod memory capped at 4Gi; automated pod GC after 30 minutes. | Rudra |
| **RSK-04** | Cross-tenant network snooping | Critical | Low | Cilium L3/L4 NetworkPolicies block all inter-namespace traffic; DNS resolution restricted to cluster DNS; link-local metadata addresses blocked. | Rudra |
| **RSK-05** | Plaintext secret exposure in logs or platform database | High | Low | ESO injects secrets directly from OpenBao into K8s Secrets; orchestrator handles only secret references, never plaintext payloads. | Rudra & Priyanshu |
| **RSK-06** | UI desynchronization during long-running builds | Medium | Medium | Orchestrator writes incremental milestone events to Postgres and Loki; UI Developer reviews event schemas for real-time frontend streaming. | Rudra & UI Dev |
---

## 18. Appendix: Post-Review Future Work & Runtime Integration Roadmap (Dated: 2026-11-01)

> [!NOTE]
> **Companion Document Reference:**
> For global platform architecture, cross-agent dependency sequencing, and platform-wide roadmap alignment, refer to [`docs/future_implementation.md`](./future_implementation.md) (created and maintained by the platform architecture sub-agent).
>
> This appendix records post-review future implementation deliverables for the **Go Orchestrator & Kubernetes Reconciler** (`cmd/orchestrator`), authored from the perspective of **Rudra**. It details how the existing library packages and tested components in `apps/backend` transition into live runtime execution, preserves settled team ownership boundaries, and scopes near-term MVP delivery versus subsequent platform capabilities.

### 18.1 Core Principles & Team Ownership Preservation

All architectural boundaries established during initial MVP design and Gate 1–4 reviews remain strictly preserved:
- **Rudra (Orchestrator, Cluster Reconciler, & Ephemeral Build Pod Lifecycle):** Owns orchestrator daemon execution (`cmd/orchestrator`), background outbox polling and lease heartbeating, state machine transitions, scheduling, launching, monitoring, and cleaning up ephemeral build pods in `summit-builds`, `SummitService` CRD reconciliation into native Kubernetes workloads, and immutable image digest pinning. Rudra does **NOT** install, configure, or manage host-level gVisor (`runsc`), host `RuntimeClass` setup, or builder container construction.
- **Priyanshu (API, Ingress, & Entire Isolated Builder):** Owns the REST API (`cmd/api`), GitHub webhook ingestion, worker token broker (`/internal/v1/build-requests/{id}/source-token`), control-plane ingress, and the **entire isolated builder subsystem** (installing and configuring gVisor `runsc` on Kubernetes host nodes, registering the `gvisor` `RuntimeClass`, and packaging/publishing the rootless BuildKit + Railpack builder container image).
- **Arpit (Platform Database & State Management — DB Only):** Owns the single shared control-plane Supabase Postgres database, schemas, DDL migrations, connection pools (`pgxpool`), and query indexing. Arpit owns DB only; no daemon or queue runtime code.
- **UI Developer (Frontend Partner):** Owns the Next.js web console (`apps/web`), real-time build log streaming UI, and deployment progress visualization.

---

### 18.2 Single Shared Control-Plane Database Architecture

A fundamental architectural premise of Summit PaaS is the **single shared control-plane PostgreSQL database** (`DATABASE_URL`, managed by Arpit — DB only), consumed concurrently by both `cmd/api` (Priyanshu) and `cmd/orchestrator` (Rudra):

```
+--------------------------------------------------------------------------------------------------+
|                                    CONTROL PLANE STORAGE TOPOLOGY                                |
|                                                                                                  |
|   +------------------------------------+             +---------------------------------------+   |
|   |   apps/backend (cmd/api)           |             |   apps/backend (cmd/orchestrator)     |   |
|   |   - Validates user requests/webhooks|             |   - Polls & leases outbox jobs        |   |
|   |   - Writes state & outbox rows     |             |   - Drives deployment state machine   |   |
|   |   - Reads tenant/project metadata  |             |   - Updates build_jobs & releases     |   |
|   +-----------------+------------------+             +-------------------+-------------------+   |
|                     |                                                    |                       |
|                     | pgxpool Connection Pool                            | pgxpool Connection    |
|                     | (Port 5432 / Direct or 6543 / Pooler)              | (Direct Session)      |
|                     v                                                    v                       |
|   +------------------------------------------------------------------------------------------+   |
|   |                   ONE SHARED CONTROL-PLANE POSTGRES DATABASE (Arpit — DB Only)           |   |
|   |                                                                                          |   |
|   |   - Source-of-Truth Tables: users, projects, services, deployments, releases, build_jobs |   |
|   |   - Asynchronous Outbox:    outbox_events (Status: pending, claimed, completed, failed)  |   |
|   |   - Concurrency Control:    FOR UPDATE SKIP LOCKED, locked_until lease heartbeats        |   |
|   +------------------------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
                                                 |
         +---------------------------------------+---------------------------------------+
         | Explicit Architectural Anti-Patterns (WHAT THE CONTROL-PLANE DATABASE IS NOT) |
         +-------------------------------------------------------------------------------+
         | 1. NOT a Separate Message Queue or Broker: No external Redis, Dragonfly,      |
         |    Kafka, or NATS cluster. Transactional outbox pattern guarantees atomic     |
         |    domain state + job persistence without dual-write distributed commit gaps. |
         |                                                                               |
         | 2. NOT an Application Tenant Database: Control-plane Postgres NEVER stores    |
         |    customer application data. Tenant databases are isolated stateful workloads|
         |    provisioned inside tenant namespaces (tenant-<tenant_id>) on dedicated PVCs|
         +-------------------------------------------------------------------------------+
```

1. **Unified Source of Truth & Outbox Engine:** When an API request or GitHub webhook triggers a deployment, Priyanshu's API atomically writes domain entities (`deployments`, `releases`, `build_jobs`) and inserts an outbox dispatch record into `outbox_events` (`deployment.build.requested`) within a single ACID transaction. The orchestrator polls and claims these events directly via `FOR UPDATE SKIP LOCKED`.
2. **Elimination of External Queue Infrastructure:** The platform explicitly avoids introducing external message brokers (Redis, RabbitMQ, NATS JetStream, Kafka) for control-plane dispatch. PostgreSQL ACID guarantees eliminate two-phase commit risks, dual-write drift, and extra operational complexity on local Kind test clusters and target hosts.
3. **Strict Separation from Tenant Databases:** The control-plane database is strictly dedicated to Summit platform management. Customer application databases (e.g. tenant PostgreSQL databases) are provisioned inside tenant namespaces (`tenant-<tenant_id>`) with isolated storage volumes, network policies, and credentials. Tenant workloads have zero network connectivity or database access to the control-plane PostgreSQL instance.

---

### 18.3 Library Code vs. Runtime Integration: Monorepo Implementation Status

Several foundational components have already been implemented as tested library packages in `apps/backend/internal/`. However, `cmd/orchestrator/main.go` currently executes only a Phase 0 read-only Kubernetes discovery probe. The table below delineates existing library packages from the remaining runtime integration deliverables:

| Component Subsystem | Implemented Library Package (`apps/backend`) | Current Library State | Required Runtime Integration in `cmd/orchestrator` |
|---|---|---|---|
| **Database Pool** | `internal/db/pool.go` | `db.Open(ctx, databaseURL)` creates a `pgxpool.Pool` and checks connectivity. | Wire `db.Open` into `cmd/orchestrator` using `DATABASE_URL`. |
| **Outbox Queue Engine** | `internal/orchestrator/queue/` (`claim.go`, `lease.go`, `retry.go`, `completion.go`, `queue.go`) | Claim, lease, retry, exhaustion, and completion operations plus a `Queue` coordinator are implemented as a package. | Instantiate `queue.Queue` with the database pool and build handler, then start its `Run` loop from the orchestrator runtime. |
| **Build Dispatcher & Worker** | `internal/orchestrator/worker/build_handler.go` | `BuildHandler` validates events/specs, calls the injected `BuildSpecResolver`, creates Pods, and records dispatch. The resolver is only an interface; production enrichment is not implemented. | Register `BuildHandler` with the queue; provide a production `BuildSpecResolver` and Kubernetes adapter. |
| **Builder Pod Adapter** | `internal/orchestrator/build/` (`adapter.go`, `pod.go`, `spec.go`, `secrets.go`) | Constructs Kubernetes Pod manifests targeting `runtimeClassName: gvisor`, drops capabilities, and manages ephemeral lifecycle. | Inject live `kubernetes.Interface` client and link to live `summit-builds` namespace execution. |
| **Workload Controller (CRD)** | `internal/cluster/workloads/` (`controller.go`, `reconciler.go`, `builder.go`, `types.go`) | Polling controller and reconciler for `SummitService` (`summit.dev/v1alpha1`); reconciles Deployments and ClusterIP Services with digest checking. | Instantiate `workloads.NewController` in `orchestrator.Run` using client-go dynamic interface; apply CRD manifest to cluster. |

---

### 18.4 Production `BuildSpecResolver` & Event Enrichment

In the live system, the outbox event payload emitted by the GitHub integration (`deployment.build.requested`) contains source revision pointers (`commit_sha`, `branch`, `ref`, `root_directory`, `dockerfile_path`), but omits runtime execution inputs required by `builder/contracts/build-execution-spec.schema.json`.

Rudra's implementation will provide a production `BuildSpecResolver` satisfying `worker.BuildSpecResolver`:
```go
type BuildSpecResolver interface {
    ResolveBuildSpec(ctx context.Context, event *orchestrator.BuildRequestedPayload, record *queue.EventRecord) (build.BuildExecutionSpec, error)
}
```

#### Enrichment Responsibilities:
1. **Source Clone Credentials (handoff to confirm):** Use Priyanshu's worker token broker (`POST /internal/v1/build-requests/{build_request_id}/source-token`) with the agreed worker authentication. Confirm whether the resolver receives a short-lived token or a secret reference; never put raw credentials in the execution spec or logs.
2. **Database Context Enrichment:** Query platform database tables (`services`, `service_sources`, `projects`, `environments`) to resolve service build parameters, target branch settings, and non-secret environment variables. Coordinate the access interface with Arpit; the shared `platformdb` repository layer is not implemented yet.
3. **OCI Destination Determination:** After GHCR owner and push-credential details are confirmed, construct the destination coordinates:
   - Target: `ghcr.io/<resolved-github-owner>/summit-app-<service-id>:sha-<git-commit>`
   - Resolves `<resolved-github-owner>` as the source repository owner (organization login or user account).
4. **Resource Ceilings & Execution Timeouts:** Injects tenant-specific resource constraints into `BuildExecutionSpec.Resources` (e.g., CPU request/limit: `500m`/`2000m`, Memory request/limit: `1Gi`/`4Gi`, Ephemeral storage: `10Gi`) and sets deterministic timeouts (`timeout_seconds: 1800`).
5. **Callback & Log Stream Coordinates:** Populate the versioned spec's `reporting.endpoint` and `reporting.token_ref` after Priyanshu's callback receiver contract is agreed. Loki streaming and labels are a separate integration, not fields in the current execution-spec contract.

> **Status:** These are resolver requirements, not implemented behavior. No production `BuildSpecResolver` currently exists.

---

### 18.5 End-to-End Builder Lifecycle & Callback Integration Flow

The complete execution flow coordinating Rudra's orchestrator, Priyanshu's builder subsystem, and Arpit's database is structured as follows:

```
[Arpit's control-plane Postgres: outbox_events]
             |
             | 1. Poll & Acquire Lease (FOR UPDATE SKIP LOCKED)
             v
[Rudra: cmd/orchestrator (queue.Queue)]
             |
             | 2. Resolve BuildSpec (worker.BuildSpecResolver)
             |    - Query DB for Service & Env context
             |    - Fetch Clone Token from Priyanshu Broker (POST /source-token)
             |    - Derive GHCR Image Tag (ghcr.io/<owner>/summit-app-<id>:sha-<sha>)
             v
[Rudra: Ephemeral Pod Launcher (build.Adapter)]
             |
             | 3. Create Pod in namespace: summit-builds
             |    - runtimeClassName: gvisor (Priyanshu host runtime)
             |    - image: summit-builder:<digest> (Priyanshu rootless builder image)
             |    - SecurityContext: runAsUser 1000, drop ALL capabilities
             v
[Priyanshu: Ephemeral Build Pod in gVisor Sandbox]
             |
             | 4. Pod executes: rootless BuildKit + Railpack compiles source
             | 5. Logs streamed to stdout/stderr -> Loki
             | 6. Image pushed to GHCR: ghcr.io/<owner>/summit-app-<id>@sha256:<digest>
             v
[Priyanshu Builder / API callback receiver]
             |
             | 7. POST status/log/result callbacks to Priyanshu's API receiver
             v
[Priyanshu API persists callback; Rudra observes build result]
             |
             | 8. API validates and persists callback data (pending)
             | 9. Rudra observes persisted success and records queue completion
             v
[Rudra: SummitService Reconciler]
             |
             | 10. Reconcile SummitService CRD with immutable image digest
             | 11. Rolling update Deployment in tenant-<tenant_id>
             v
[Workload Running & Serving Live Traffic]
```

---

### 18.6 Consuming Verified Builder Image & gVisor RuntimeClass after Environment Handoff

Untrusted customer code must never execute on unconstrained host kernels. Integration of the build sandbox is contingent upon the formal environment handoff from Priyanshu:

1. **Host-Level gVisor Installation & RuntimeClass (Priyanshu Handoff):**
   - Priyanshu installs and configures `runsc` on the Kubernetes host machines (local Kind test cluster first; DigitalOcean Linux hosts if time permits later).
   - Priyanshu registers the cluster-wide `RuntimeClass`:
     ```yaml
     apiVersion: node.k8s.io/v1
     kind: RuntimeClass
     metadata:
       name: gvisor
     handler: runsc
     ```
2. **Verified Builder Container Image (Priyanshu Handoff):**
   - Priyanshu builds, packages, and verifies the rootless BuildKit + Railpack builder container image (`summit-builder`).
   - Priyanshu publishes the image to GHCR and supplies the verified cryptographic digest (`ghcr.io/<platform-owner>/summit-builder@sha256:...`).
3. **Orchestrator Consumption (Rudra Implementation):**
   - Upon receiving the verified environment handoff, Rudra updates the pod constructor (`internal/orchestrator/build/pod.go`) to reference `spec.runtimeClassName: "gvisor"` and pins the builder container to the verified digest.
   - Rudra validates the sandbox against the local Kind cluster by scheduling a canary build pod, ensuring syscall virtualization is active and all Linux capabilities are dropped.

---

### 18.7 `SummitService` Controller / CRD Workflow & Immutable Digest Deployment

Application workload management follows a declarative Kubernetes Operator pattern using the `SummitService` Custom Resource Definition (`summit.dev/v1alpha1`):

1. **Declarative Custom Resource:**
   The `SummitService` CRD declared in `apps/backend/config/crd/summit.dev_summitservices.yaml` defines the desired state for a tenant application:
   ```yaml
   apiVersion: summit.dev/v1alpha1
   kind: SummitService
   metadata:
     name: backend-api
     namespace: tenant-a1b2c3d4
     labels:
       summit.dev/tenant: "a1b2c3d4"
       summit.dev/project: "prod-proj"
       summit.dev/service: "svc-xyz"
       summit.dev/release: "rel-001"
   spec:
     image: ghcr.io/acme/summit-app-svc-xyz@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
     replicas: 2
     port: 8080
     pullSecretName: ghcr-pull
     env:
       - name: NODE_ENV
         value: "production"
   ```
2. **Reconciliation Loop (`workloads.Controller` & `workloads.Reconciler`):**
   - The polling controller lists `SummitService` custom resources across tenant namespaces.
   - For each custom resource, the reconciler generates and idempotently applies:
     - **Kubernetes Deployment:** Configured with `RollingUpdate` strategy, `runAsNonRoot: true`, non-root UID 1000, and HTTP `/health` readiness/liveness probes.
     - **Kubernetes Service:** ClusterIP service exposing port 8080.
3. **Mandatory Immutable Digest Enforcement:**
   - Workload manifests **strictly require** immutable image references pinned by an exact 64-hex SHA-256 digest (`image: ...@sha256:<64-hex>`).
   - Pinned references are validated using regex `^[a-zA-Z0-9_.\-/:~]+@sha256:[a-fA-F0-9]{64}$`. Tagged images (`:latest`, `:main`, `:v1.0.0`) are rejected at reconciliation time to guarantee that deployed containers cannot be mutated or spoofed in the registry post-build.
4. **Status Reflection:**
   - The reconciler monitors deployment rollout status, available replicas, and generation matches, persisting current status back into `SummitService.Status`.

---

### 18.8 Staged Roadmap: MVP First Backend vs. Subsequent Scopes

To ensure rapid, reliable delivery on the local Kind test environment, platform features are sequenced into an immediate MVP scope followed by modular platform expansions:

```
+--------------------------------------------------------------------------------------------------+
|                                    PLATFORM CAPABILITY SEQUENCING                                |
|                                                                                                  |
|   ============================================================================================   |
|   PHASE 1: MVP FIRST BACKEND (IMMEDIATE TESTING ON LOCAL KIND CLUSTER)                           |
|   ============================================================================================   |
|   [x] Queue/outbox operations implemented as Go library packages                                 |
|   [ ] Wire database pool and queue worker into cmd/orchestrator                                  |
|   [ ] Implement production BuildSpecResolver and agree on enrichment inputs                      |
|   [ ] Verify host gVisor RuntimeClass and builder image before scheduling a real build            |
|   [ ] Complete callback persistence, then deploy the verified application digest                 |
|   [x] SummitService CRD/reconciler code exists for stateless Deployment + ClusterIP Service        |
|   [ ] Run the controller against an installed CRD and test cluster                               |
|   [ ] Confirm namespace ownership/provisioning and add quotas if required for MVP                  |
|                                                                                                  |
|   ============================================================================================   |
|   PHASE 2: SUBSEQUENT SCOPES (POST-MVP PLATFORM EXPANSIONS)                                      |
|   ============================================================================================   |
|   [ ] Stateful Postgres Service: Dedicated tenant PostgreSQL instances provisioned as           |
|       Kubernetes StatefulSets with PersistentVolumeClaims (PVCs) for stateful user workloads     |
|   [ ] Edge Ingress Routing: Automated Traefik IngressRoute generation with wildcard TLS certs   |
|   [ ] Zero-Trust Network Lockdown: CiliumNetworkPolicy L3/L4 egress lockdown & tenant isolation  |
|   [ ] Secrets Operator Integration: External Secrets Operator (ESO) bridging OpenBao / AWS SM    |
|   [ ] Automated Sweepers & GC: Background pruning of build pods (>30m) & tombstoned namespaces   |
|   [ ] Production Telemetry: Fluent Bit daemonset piping logs to Loki; Prometheus /metrics scrape |
+--------------------------------------------------------------------------------------------------+
```

1. **Immediate MVP Scope (Stateless First):** Focuses exclusively on stateless HTTP applications deployed via `SummitService`. The control loop takes a Git push event from `outbox_events`, executes the build in `summit-builds` inside gVisor, pushes an immutable image to GHCR, and deploys it as a Kubernetes Deployment + Service.
2. **Stateful Postgres Service Later:** Multi-tenant stateful services (e.g. provisioning dedicated PostgreSQL databases for tenant applications via `StatefulSet` and PVCs) are scheduled as the first backend expansion immediately after the stateless pipeline is validated.
3. **Subsequent Infrastructure Scopes:**
   - **Ingress Layer:** Automating Traefik `IngressRoute` configuration for custom domains (`<slug>.<tenant>.jetway.app`).
   - **Cilium Network Security:** Enforcing strict L3/L4 zero-trust network policies that isolate tenant namespaces from each other, from the control-plane database, and from cloud metadata IPs (`169.254.169.254`).
   - **Secrets Management via ESO:** Automating `ExternalSecret` custom resources to synchronize credentials from OpenBao directly into tenant Kubernetes `Secrets`.
   - **Cluster Cleanup & Garbage Collection:** Autonomous background sweepers to remove completed/failed build pods older than 30 minutes and clean up ephemeral secrets.
   - **Observability Stack:** Comprehensive Loki log forwarding and Prometheus metric instrumentation.

---

### 18.9 Cross-Team Dependency & Handoff Matrix

| Collaborator | Deliverable / Handoff Contract | Flow Direction | Contract / Artifact Specification | Status / Prerequisite |
|---|---|---|---|---|
| **Arpit** (DB Only) | Control-plane Postgres migrations & schema | Arpit &rarr; Rudra | `0001_baseline.up.sql` and `0002_github_integration.up.sql` (`outbox_events`, `build_jobs`, `services`) | Active in monorepo; ready for query integration. |
| **Arpit** (DB Only) | Database connection pool configuration | Arpit &rarr; Rudra | `internal/db/pool.go` (`db.Open(ctx, databaseURL)`) | Implemented; needs runtime wiring in `cmd/orchestrator`. |
| **Priyanshu** (API & Builder) | Worker Credential Broker API | Priyanshu &rarr; Rudra | `POST /internal/v1/build-requests/{id}/source-token` authenticated via `WORKER_JWT_SECRET` | Endpoint exists; resolver consumption and secret handoff remain pending. |
| **Priyanshu** (API & Builder) | Host gVisor (`runsc`) & `RuntimeClass` | Priyanshu &rarr; Rudra | Host-level installation of `runsc` + `RuntimeClass` (`name: gvisor`) on test Kubernetes cluster | Prerequisite for executing build pods in `summit-builds`. |
| **Priyanshu** (API & Builder) | Rootless Builder Container Image | Priyanshu &rarr; Rudra | Published GHCR image (`summit-builder`) running rootless BuildKit + Railpack (UID 1000) | Prerequisite for ephemeral pod launcher. |
| **Priyanshu** (API & Builder) | Build Result Callback API | Priyanshu &harr; Rudra | Builder status/log/result callbacks into API; Rudra consumes persisted build result | Callback routes and persistence are pending; shared contract required. |
| **UI Developer** (Frontend) | State Machine & Milestone Events | Rudra &rarr; UI Dev | Deployment state progression (`queued` &rarr; `building` &rarr; `image_ready` &rarr; `deploying` &rarr; `running`) | Proposed vocabulary; aligns dashboard view. |
| **UI Developer** (Frontend) | Live Build Log Streaming | Rudra &rarr; UI Dev | Loki log query labels (`tenant`, `project`, `release`, `component="builder"`) | Schema established; UI queries via API gateway. |

---

*End of Appendix — Implementation ready for Phase 1 runtime integration upon teammate handoffs.*
