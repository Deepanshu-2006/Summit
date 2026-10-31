# Summit PaaS — Future Implementation Roadmap & Integration Blueprint

**Target Repository:** `/home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7`
**File Location:** [`docs/future_implementation.md`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/future_implementation.md)
**Document Status:** Draft roadmap from the local code audit; cross-team decisions remain subject to owner approval
**Audience:** Arpit (Platform Database), Priyanshu (API & Builder), Rudra (Orchestrator & Cluster), UI & Cross-Team

---

## 1. Executive Summary & Ground Truth Audit

This document establishes the actionable, point-wise implementation roadmap for the **Summit** Developer Platform-as-a-Service (PaaS) control plane. It synthesizes the local codebase audit across `apps/backend`, `builder`, `apps/web`, `packages/api_spec`, and `docs/`, aligning individual plans into an ordered, dependency-driven execution sequence.

### Codebase Reality vs. End-to-End Maturity

> [!IMPORTANT]
> **Audit Finding on End-to-End Execution:**
> Multiple packages contain data models, schemas, and unit test suites. This documentation update did not rerun tests. **The platform does not yet operate end-to-end**: the orchestrator runtime does not start the outbox worker, the builder image lacks its build execution binaries, and the frontend still uses prototype mocks instead of the Go backend.

| Subsystem | Repo Location | Currently Implemented (Verified) | Scaffolding / Slices Only | Follow-Up Required for End-to-End |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Database** | [`apps/backend/internal/db`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/db) | Migrations `0001_baseline` & `0002_github_integration`, `pgxpool` connection lifecycle, advisory-locked CLI migration runner | Raw SQL queries scattered across handlers; no centralized Go interface abstraction | Unify under `internal/db` or `internal/platformdb`, align outbox schemas with worker contracts, add deployment persistence |
| **API Control Plane** | [`apps/backend/internal/server`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/server) | Health probes, Supabase JWT auth verification, GitHub App OAuth/repo sync/webhooks, worker credential broker | Route multiplexer only registers GitHub and health routes; no deployment CRUD or callback endpoints | Implement deployment trigger handler, register build callback receiver endpoints (`/status`, `/logs`, `/result`) |
| **Isolated Builder** | [`builder/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder) | Worker CLI entrypoint, JSON schema validation, HTTP callback reporter, workspace manager | Dockerfile only has Go compile step; lacks BuildKit, Railpack, and buildctl binaries; `buildkitd.toml` references internal registry | Validate host environment first, package binaries into builder Dockerfile, configure GHCR push auth |
| **Orchestrator** | [`apps/backend/internal/orchestrator`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator) | Outbox lease acquisition with `SKIP LOCKED`, retry/backoff logic, build spec parsing, pod spec generator, workload reconciler | Standalone packages with unit tests; not instantiated or started in [`cmd/orchestrator/main.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/cmd/orchestrator/main.go) | Implement `BuildSpecResolver`, wire outbox worker into orchestrator lifecycle, reconcile deployments from build result digests |
| **Frontend Console** | [`apps/web/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/web) | Next.js 16 layout, project overview UI, dashboard views, login interface | Uses client-side mock handlers and in-memory `meridianStore`; mock `/api/v1/releases` | Replace mock stores with generated OpenAPI client calls to Go backend; wire SSE/WebSocket log viewer |
| **API Contract** | [`packages/api_spec/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/packages/api_spec) | OpenAPI 3.1 YAML definition, compiled TypeScript types package | Contract specifies `/api/v1/releases` instead of proposed asynchronous `/api/v1/projects/{slug}/deployments` | Realign contract with backend asynchronous deployment semantics, add callback schemas and build logs |

---

## 2. Core Architectural Concepts & Glossary

### 2.1 Shared Control-Plane Postgres vs. Tenant App Databases

A fundamental architectural invariant of Summit is the strict isolation between the **Platform Control-Plane Database** and **Tenant Application Databases**:

```
+-----------------------------------------------------------------------------------------+
|                               CONTROL PLANE (Global Platform)                           |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                  Shared Platform Database (Supabase Postgres)                   |   |
|   |  - Schemas: users, projects, services, outbox_events, build_jobs, deployments   |   |
|   |  - Sensitive Data: Pointer references ONLY (OpenBao paths, Secret ARNs)         |   |
|   |  - Access: Strictly restricted to apps/backend and orchestrator workers         |   |
|   |  - Isolation: Logical row-level tenant multi-tenancy                            |   |
|   +---------------------------------------------------------------------------------+   |
+--------------------------------------------+--------------------------------------------+
                                             | Dispatches Workload CRDs
                                             v
+-----------------------------------------------------------------------------------------+
|                               DATA PLANE (Tenant Workloads in Kubernetes)               |
|                                                                                         |
|   +--------------------------------------+   +--------------------------------------+   |
|   |  Namespace: tenant-acme-prod         |   |  Namespace: tenant-globex-dev        |   |
|   |                                      |   |                                      |   |
|   |  +--------------------------------+  |   |  +--------------------------------+  |   |
|   |  | Tenant Stateful App Database   |  |   |  | Tenant Stateful App Database   |  |   |
|   |  | (Postgres StatefulSet / PVC)   |  |   |  | (Postgres StatefulSet / PVC)   |  |   |
|   |  | - Customer application tables  |  |   |  | - Customer application tables  |  |   |
|   |  | - In-cluster service mesh only |  |   |  | - In-cluster service mesh only |  |   |
|   |  +--------------------------------+  |   |  +--------------------------------+  |   |
|   |                                      |   |                                      |   |
|   |  +--------------------------------+  |   |  +--------------------------------+  |   |
|   |  | Tenant Stateless Workload      |  |   |  | Tenant Stateless Workload      |  |   |
|   |  | (Deployment: Customer App)     |  |   |  | (Deployment: Customer App)     |  |   |
|   |  +--------------------------------+  |   |  +--------------------------------+  |   |
|   +--------------------------------------+   +--------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

| Dimension | Platform Control-Plane Database | Tenant Application Databases |
| :--- | :--- | :--- |
| **Engine & Host** | Managed Supabase PostgreSQL instance | Per-tenant containerized PostgreSQL Pods / StatefulSets on Kubernetes |
| **Owner** | Arpit (Persistence, Schemas, Migrations) | Tenant Application Workload (Provisioned/Managed by Rudra's Orchestrator) |
| **Data Stored** | User identity links, project configurations, deployment records, `outbox_events` queue, audit logs, secret pointers | Customer end-user business records, application sessions, transactional data |
| **Storage Layer** | Managed cloud database storage | Kubernetes PersistentVolumeClaims (PVCs) provisioned per tenant environment |
| **Network Boundary** | Ingress restricted strictly to Summit control plane API (`apps/backend`) | Isolated within tenant namespace via Cilium L3/L4 network policies; never routable to Platform DB |
| **Secret Management** | **Zero secret values:** Stores vault paths (`OpenBao`) and AWS ARNs only | Injected at runtime into tenant pods via External Secrets Operator (ESO) |
| **Failure Domain** | Control plane outage prevents new deployments and UI operations; running workloads remain up | Isolated to specific tenant namespace; zero blast radius across other tenants or platform |

---

### 2.2 Plain-Language Architecture Glossary

1. **Platform DB:**
   The centralized PostgreSQL database (hosted on Supabase for the control plane) that stores platform metadata, tenancy mapping, outbox dispatch queues, build job states, and deployment histories. It contains zero plaintext or ciphertext customer secrets; only references/pointers to secret storage are permitted.
2. **GHCR (GitHub Container Registry - `ghcr.io`):**
   The external OCI-compliant registry chosen for the MVP to eliminate the operational overhead of running in-cluster registry pods, storage volumes, and local backup pipelines on test nodes. Application image paths are scoped per repository owner (e.g. `ghcr.io/<org-or-user>/summit-app-<service-id>`), while the platform builder image is published to a platform-owned namespace (e.g. `ghcr.io/<platform-owner>/summit-builder:<tag>`).
3. **BuildKit / Railpack Binaries vs. Host gVisor / RuntimeClass:**
   - **Host gVisor / RuntimeClass (`runsc`):** An application kernel running on the Kubernetes worker node (configured in `containerd`). It intercepts system calls from untrusted container code, providing hardware-virtualization-grade isolation without running full virtual machines. Kubernetes selects this environment using `runtimeClassName: gvisor`.
   - **BuildKit (`buildkitd`, `buildctl`) & Railpack Binaries:** User-space build tools that run *inside* the container pod under unprivileged UID 1000. Railpack inspects repository source code to automatically generate Dockerfiles/build plans, while rootless BuildKit executes container compilation and pushes OCI layers.
4. **`BuildSpecResolver`:**
   A Go interface seam ([`apps/backend/internal/orchestrator/worker/build_handler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/worker/build_handler.go)) for connecting database lookups and the source credential flow to Rudra's build pod launcher. A future implementation will turn a bare outbox event into a validated `BuildExecutionSpec` with repository details, opaque credential references, GHCR destination, resource limits, timeout, and callback configuration. The production resolver does not exist yet; raw credentials must not be put in the spec or logs.
5. **Callbacks (Status, Logs, Result):**
   HTTP endpoints exposed by the control plane API (`apps/backend`) that the ephemeral builder container calls during execution ([`builder/internal/reporter/http.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/internal/reporter/http.go)). Using a short-lived, job-scoped JWT token, the builder continuously reports step transitions (`/status`), streams batched compilation output (`/logs`), and submits terminal execution results containing the immutable image digest (`/result`).
6. **OpenBao & External Secrets Operator (ESO):**
   - **OpenBao:** An open-source, community-governed fork of HashiCorp Vault powering centralized secrets storage. In Summit, OpenBao stores sensitive environment variables and credentials under paths formatted as `tenants/<user_id>/projects/<project_id>/<environment>`.
   - **External Secrets Operator (ESO):** A Kubernetes operator running in the cluster that synchronizes secrets from external APIs (OpenBao) into native Kubernetes `Secret` objects. Orchestrator-generated `SecretStore` resources authenticate against OpenBao via Kubernetes ServiceAccount tokens (`summit-eso-vault`), and `ExternalSecret` custom resources extract secret key-value pairs into `app-env-secret` mounted by tenant workloads.

---

## 3. Person-Wise Implementation Roadmaps

### 3.1 Arpit — Platform Database & State Management

**Domain:** Supabase Postgres schemas, migrations, advisory locks, connection pooling (`pgxpool`), outbox storage, and Go persistence abstractions.

#### Current Baseline (Verified)
- Migrations [`0001_baseline.up.sql`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/db/migrations/0001_baseline.up.sql) and [`0002_github_integration.up.sql`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/db/migrations/0002_github_integration.up.sql) are active and tracked via migration runner CLI [`apps/backend/cmd/migrate`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/cmd/migrate).
- `outbox_events` table contains `status`, `available_at`, `locked_until`, `locked_by`, and payload JSONB columns with index `idx_outbox_queue`.
- `deployments` table contains `status`, `idempotency_key`, `git_commit_sha`, and foreign key links.

#### Point-Wise Follow-Up Tasks
- [ ] **Unify Go Repository Interfaces:** Create a consolidated persistence package (e.g., [`apps/backend/internal/db`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/db) or `internal/platformdb`) defining clear repository interfaces:
  - `DeploymentRepository`: Atomic insertion of `deployments` record and `outbox_events` entry within a single PostgreSQL transaction (`pgx.Tx`).
  - `BuildJobRepository`: Tracking build attempts, pod status, lease renewals, and completion summaries.
- [ ] **Schema Alignment for Deployment & Build State:**
  - Verify that `deployments` and `build_jobs` tables have columns to store the final immutable OCI image reference (`image_digest`, e.g., `sha256:...`) and resolved GHCR repository path.
  - Align outbox event payload schemas for `deployment.build.requested` with Priyanshu and Rudra.
- [ ] **Idempotency & Advisory Locks:**
  - Enforce database-level uniqueness across `(project_id, idempotency_key)` to prevent duplicate concurrent build dispatches from API retries.
  - Provide helper functions for transactional `SELECT ... FOR UPDATE SKIP LOCKED` matching the `queue.DBTX` interface required by Rudra's outbox poller.
- [ ] **Zero Secrets Audit:** Ensure no migration or table schema allows storing plaintext or encrypted secret values. Pointers (`secret_references`) must point strictly to OpenBao vault paths or AWS Secrets Manager ARNs.

#### Explicit Handoffs
- **Handoff to Priyanshu:** Provide Go database client methods for transactional deployment creation (`CreateDeploymentWithOutboxTx`).
- **Handoff to Rudra:** Supply `queue.DBTX` implementation and SQL query definitions for lease acquisition, lease renewal (heartbeat), and terminal status updates in `outbox_events`.

#### Acceptance Checks
- [ ] Migration applies cleanly on a fresh database without errors.
- [ ] Calling `CreateDeploymentWithOutboxTx` writes both `deployments` and `outbox_events` atomically; rolling back aborts both writes.
- [ ] No table schema allows secret values; all credential columns reference URI/path pointers.

---

### 3.2 Priyanshu — API Control Plane & Isolated Builder Subsystem

**Domain:** Go HTTP control plane, REST endpoints, middleware, GitHub integration, and the complete builder subsystem (host gVisor validation, rootless BuildKit, Railpack, builder image, and callback receiver).

#### Current Baseline (Verified)
- Control plane server [`apps/backend/internal/server`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/server) serves health probes and GitHub App endpoints.
- GitHub integration suite complete: webhook HMAC verification, installation token management, and worker credential broker ([`apps/backend/internal/githubworker/broker_handler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/githubworker/broker_handler.go)).
- Standalone builder logic in [`builder/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder) has CLI command parsing, schema validation, and HTTP callback reporting client.

#### Point-Wise Follow-Up Tasks
- [ ] **Validate Host Environment (First in Sequence):**
  - Note established plan ownership: Priyanshu owns/coordinates the builder and host runtime environment.
  - Coordinate with Rudra to verify whether the target test environment (laptop Kind cluster) supports `runsc` and the Kubernetes `RuntimeClass: gvisor`.
  - Document prerequisites for containerd configuration on the node before publishing or running builder pods.
- [ ] **Package Isolated Builder Image (Image After Environment):**
  - Update [`builder/deployments/worker.Dockerfile`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/deployments/worker.Dockerfile) to install:
    - Rootless BuildKit daemon (`buildkitd`) and client (`buildctl`) (v0.19+).
    - Railpack binary (v0.3.2+) for automatic buildpack detection and plan generation.
    - Compiled Summit builder worker CLI binary.
  - Configure [`builder/deployments/buildkitd.toml`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/deployments/buildkitd.toml) to support rootless OCI execution without hardcoded internal registry endpoints.
- [ ] **Build Credential & GHCR Push Verification:**
  - Implement authentication injection for pushing images to GHCR using dedicated builder credentials.
  - Resolve package ownership according to [`docs/ghcr_mvp_setup.md`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/ghcr_mvp_setup.md): organization login for org-owned repos, personal username for personal repos.
- [ ] **Implement API Callback Receiver Endpoints:**
  - In `apps/backend`, implement HTTP handler routes matching the builder reporter protocol ([`builder/internal/reporter/http.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/internal/reporter/http.go)):
    - `POST /internal/v1/builds/{build_id}/status`: Ingest stage transitions and heartbeats.
    - `POST /internal/v1/builds/{build_id}/logs`: Ingest batched build logs.
    - `POST /internal/v1/builds/{build_id}/result`: Ingest terminal completion payload, verifying the generated OCI image digest and metadata.
  - Protect these routes using job-scoped worker JWT verification (`WORKER_JWT_SECRET`).
- [ ] **Implement Asynchronous Deployment Trigger Endpoint:**
  - Expose `POST /api/v1/projects/{slug}/deployments` (or agreed route) that validates inputs and invokes Arpit's transactional outbox write, returning `202 Accepted` with a tracking header.

#### Explicit Handoffs
- **Handoff to Rudra:** Supply published builder container image reference and verified host `RuntimeClass` name.
- **Handoff to Rudra:** Ensure callback endpoint URLs and authentication secret configurations are known so Rudra's pod launcher can inject them into the builder pod environment.
- **Handoff to UI / Cross-Team:** Provide OpenAPI definitions for deployment creation, build status polling, and log streaming.

#### Acceptance Checks
- [ ] Builder Dockerfile compiles into a functional container image containing `buildkitd`, `buildctl`, `railpack`, and `worker`.
- [ ] Callback HTTP endpoints accept valid payloads signed with the worker JWT and reject unauthorized requests with `401 Unauthorized`.
- [ ] Receiving a successful `/result` callback updates the build status in the database to `succeeded` and persists the image digest.

---

### 3.3 Rudra — Orchestrator & Cluster Controller

**Domain:** Outbox reconciler loop, Kubernetes scheduling and build pod lifecycle, CRD definitions, workload reconciler, Cilium network policies, Traefik ingress, and External Secrets Operator (ESO).

#### Current Baseline (Verified)
- Outbox polling and lease queue logic implemented in [`apps/backend/internal/orchestrator/queue`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/queue).
- Ephemeral build pod spec construction implemented in [`apps/backend/internal/orchestrator/build/pod.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/build/pod.go).
- Workload reconciler implemented in [`apps/backend/internal/cluster/workloads/reconciler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/cluster/workloads/reconciler.go) for managing tenant namespaces, deployments, and services.

#### Point-Wise Follow-Up Tasks
- [ ] **Verify Local Kind Cluster Capabilities (First in Sequence):**
  - Run initial feasibility verification on the local Kind cluster to check whether user-space gVisor emulation or node-level `runsc` containerd runtime can be attached.
  - If gVisor is unavailable on local laptop Kind without kernel headers, document the fallback emulation configuration for development while preserving `runtimeClassName: gvisor` manifests for production/test hosts.
- [ ] **Wire `BuildSpecResolver` & Outbox Poller:**
  - Implement `BuildSpecResolver` ([`apps/backend/internal/orchestrator/worker/build_handler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/worker/build_handler.go)) to enrich raw outbox events with:
    - Target GHCR repository name and commit tag.
    - Ephemeral callback token signed with `WORKER_JWT_SECRET`.
    - Resource ceilings (CPU millicores, Memory MiB, Ephemeral Storage).
  - Wire the outbox worker loop into [`apps/backend/cmd/orchestrator/main.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/cmd/orchestrator/main.go); keep it in the orchestrator process, separate from the API server.
- [ ] **Pod Lifecycle Management & Idempotency:**
  - Launch ephemeral build Pods in `summit-builds` with `restartPolicy: Never`; retries remain orchestrator-controlled. (`backoffLimit` applies to Kubernetes Jobs, which are not the current adapter's resource.)
  - Use deterministic pod names (e.g., `build-<attempt_id>`) to guarantee that worker crashes or retries do not spawn duplicate pods.
  - Mount temporary emptyDir volumes for `/workspace`, `/run/buildkit`, and `/tmp`. Mount execution spec via ConfigMap/Secret.
- [ ] **Reconcile Stateless Workloads by Image Digest:**
  - Connect the workload reconciler ([`apps/backend/internal/cluster/workloads/reconciler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/cluster/workloads/reconciler.go)) to deployment success events:
  - Once a build completes and the image digest is recorded, roll out the stateless tenant app Deployment in namespace `tenant-<tenant_id>` using the immutable image digest:
    `ghcr.io/<resolved-github-owner>/summit-app-<service-id>@sha256:<digest>`.
  - Do NOT deploy using mutable Git branch tags or commit tags.
- [ ] **Later Milestone Work:**
  - Configure Cilium network policies restricting builder pod egress exclusively to Git clone targets, GHCR, and the control plane callback IP.
  - Deploy and configure External Secrets Operator (ESO) to sync tenant environment variables from OpenBao into tenant namespaces.
  - Setup Traefik ingress routing for public traffic to tenant services.

#### Explicit Handoffs
- **Handoff to Arpit:** Consume outbox records via `queue.DBTX` interface without writing competing SQL query layers.
- **Handoff to Priyanshu:** Receive verified builder container image, callback URL routes, and host `RuntimeClass` definitions.
- **Handoff to UI / Cross-Team:** Expose real-time workload phase (`deploying`, `running`, `failed`) and health status to the database.

#### Acceptance Checks
- [ ] Outbox processor claims `deployment.build.requested` events via `FOR UPDATE SKIP LOCKED` and launches a corresponding builder Pod in `summit-builds`.
- [ ] Ephemeral builder pod runs as UID 1000 with a read-only root filesystem and ephemeral emptyDir mounts.
- [ ] Successful build completion triggers workload reconciliation, spinning up a Kubernetes Deployment pinned to the exact `sha256:...` digest.

---

### 3.4 UI & Cross-Team — Frontend & Contract Alignment

**Domain:** Next.js 16 Console Dashboard, real-time log streaming, design system, OpenAPI 3.1 specification, and end-to-end integration contracts.

#### Current Baseline (Verified)
- Next.js 16 app layout in [`apps/web/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/web) with modern component structure.
- OpenAPI specification in [`packages/api_spec/openapi.yaml`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/packages/api_spec/openapi.yaml) defining core schemas.

#### Point-Wise Follow-Up Tasks
- [ ] **OpenAPI Specification Realignment:**
  - Reconcile the discrepancy between OpenAPI `/api/v1/releases` and the backend asynchronous deployment endpoint (`POST /api/v1/projects/{slug}/deployments`).
  - Document the build status endpoint (`GET /api/v1/deployments/{id}` or `GET /api/v1/builds/{id}`) and log streaming endpoints.
  - Re-generate TypeScript contract types in `packages/api_spec` using `pnpm build`.
- [ ] **Decommission In-Memory Frontend Mocks:**
  - Replace the temporary mock API routes in [`apps/web/app/api/v1/releases/route.ts`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/web/app/api/v1/releases/route.ts) and [`apps/web/lib/meridian-store.ts`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/web/lib/meridian-store.ts) with real HTTP fetch calls to the Go backend API (`apps/backend`).
  - Ensure API client transmits Supabase Auth JWT bearer tokens in the `Authorization` header.
- [ ] **Real-Time Build & Deployment Stream UI:**
  - Build a live log viewer component in the console dashboard that subscribes to build output (via Server-Sent Events or WebSocket stream from the API).
  - Display the state machine progression clearly: `queued → building → image_ready → deploying → health_checking → running` (or `failed`).

#### Explicit Handoffs
- **Handoff to Backend (Priyanshu & Rudra):** Provide reviewed OpenAPI schema updates reflecting frontend dashboard needs.
- **Handoff to Team:** Validate that dashboard deployment triggers successfully initiate backend builds and stream live status.

#### Acceptance Checks
- [ ] Dashboard triggers a deployment by calling Go backend REST API; mock store is completely removed from the deployment path.
- [ ] Console dashboard displays live log updates as emitted by the builder container.
- [ ] `packages/api_spec` builds cleanly and exported TypeScript types match backend response envelopes.

---

## 4. Ordered Integration Sequence

The following nine-step sequence defines the strict order of operations for taking Summit from the current audit baseline to a functional MVP:

```
[Step 1: Local Kind & Host Runtime Validation]
                   │
                   ▼
[Step 2: Host runsc / containerd Setup (Priyanshu)]
                   │
                   ▼
[Step 3: Builder Image Packaging with Binaries]
                   │
                   ▼
[Step 4: Source Credentials & GHCR Auth Contract]
                   │
                   ▼
[Step 5: Database Interfaces & Schema Alignment (Arpit)]
                   │
                   ▼
[Step 6: Orchestrator Outbox Worker & Resolver Wiring (Rudra)]
                   │
                   ▼
[Step 7: Callback Receiver API & Digest Reconciliation]
                   │
                   ▼
[Step 8: UI & OpenAPI Contract Realignment]
                   │
                   ▼
[Step 9: Deferred Stateful Services, Ingress, Network Policies & ESO]
```

### Step 1: Local Kind Cluster Validation (Environment First)
- **Goal:** Verify whether the local laptop Kind cluster can support gVisor (`runsc`) and `RuntimeClass: gvisor`.
- **Action:** Inspect the local Kind node configuration. Test whether containerd inside the Kind node can register the `runsc` handler or if an unprivileged sandbox fallback is required for local dev.
- **Owner:** Priyanshu (coordinating with Rudra).

### Step 2: Host `runsc`, containerd & `RuntimeClass` Setup
- **Goal:** Establish a working `RuntimeClass: gvisor` in Kubernetes.
- **Action:** Apply the `RuntimeClass` manifest to the cluster. Verify that a test pod with `runtimeClassName: gvisor` schedules and executes `uname -a` or a sandbox-identifying syscall check.
- **Owner:** Priyanshu.
- **Acceptance:** Pod scheduled with `runtimeClassName: gvisor` enters `Running` state and completes successfully.

### Step 3: Builder Image Assembly (Image After Environment)
- **Goal:** Package the rootless builder container image containing all required execution tools.
- **Action:** Update [`builder/deployments/worker.Dockerfile`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/deployments/worker.Dockerfile) to download and install:
  - `buildkitd` & `buildctl` (v0.19+)
  - `railpack` (v0.3.2+)
  - Summit builder worker binary
- **Owner:** Priyanshu.
- **Acceptance:** Container runs locally under UID 1000; executing `railpack --version` and `buildctl --version` inside the container succeeds.

### Step 4: Source Credential Broker & GHCR Authentication
- **Goal:** Enable the builder to clone private tenant repositories and push generated image layers to GHCR.
- **Action:**
  - Verify GitHub App installation token generation via [`apps/backend/internal/githubworker/broker_handler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/githubworker/broker_handler.go).
  - Implement GHCR authentication boundary per [`docs/ghcr_mvp_setup.md`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/ghcr_mvp_setup.md). Agree on the trusted push path: builder uses a dedicated push credential without exposing write tokens to user build scripts.
  - Create `imagePullSecret` in target tenant namespaces for pulling private application images.
- **Owners:** Priyanshu & Rudra.
- **Acceptance:** Builder authenticates with GHCR and pushes a test layer; Kubernetes pulls the image using the pull secret.

### Step 5: Database Interfaces & Schema Alignment
- **Goal:** Provide atomic transaction boundaries and repository interfaces for deployment state and outbox events.
- **Action:**
  - Arpit defines repository methods in `apps/backend/internal/db` (or `internal/platformdb`).
  - Align `outbox_events` payload format for `deployment.build.requested` with the fields expected by `BuildSpecResolver`.
  - Add `image_digest` column to `deployments` / `build_jobs` if not already present.
- **Owner:** Arpit.
- **Acceptance:** Unit tests verify atomic insertion of deployment + outbox event; query contracts satisfy `queue.DBTX`.

### Step 6: Orchestrator Outbox Worker & Resolver Wiring
- **Goal:** Automatically dequeue build requests and launch ephemeral builder pods in Kubernetes.
- **Action:**
  - Implement `BuildSpecResolver` in [`apps/backend/internal/orchestrator/worker/build_handler.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/orchestrator/worker/build_handler.go).
  - Connect the `queue.Queue` poller in [`apps/backend/cmd/orchestrator/main.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/cmd/orchestrator/main.go) and run it as part of the orchestrator process.
  - On claiming an event, resolve the build spec, create the ephemeral builder Pod in `summit-builds`, and record the attempt.
- **Owner:** Rudra.
- **Acceptance:** Committing an outbox event causes the orchestrator to automatically launch a builder pod in `summit-builds`.

### Step 7: Callback Receiver API & Digest Reconciliation
- **Goal:** Complete the feedback loop from builder pod back to the control plane and trigger deployment rollout.
- **Action:**
  - Priyanshu registers `/internal/v1/builds/{build_id}/status`, `/logs`, and `/result` endpoints in `apps/backend/internal/server`.
  - On receiving `/result` with `status: "succeeded"`, persist the immutable image digest into PostgreSQL.
  - Rudra's workload controller consumes the success event and calls [`workloads.Reconciler`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/cluster/workloads/reconciler.go) to deploy the tenant workload using `ghcr.io/<owner>/summit-app-<service-id>@sha256:<digest>`.
- **Owners:** Priyanshu & Rudra.
- **Acceptance:** Ephemeral builder pod reports completion; backend marks build successful; tenant app deployment starts in `tenant-<tenant_id>` pinned to the image digest.

### Step 8: UI & OpenAPI Contract Realignment
- **Goal:** Connect the Next.js console dashboard to the live control plane.
- **Action:**
  - Update `packages/api_spec/openapi.yaml` to reflect the deployment creation and status contract.
  - Replace mock handlers in `apps/web` with real fetch requests against the Go backend.
  - Verify that initiating a deployment from the UI triggers Step 5 through Step 7 and displays live build logs.
- **Owners:** UI Developer & Priyanshu.
- **Acceptance:** User clicks "Deploy" in dashboard -> builder pod launches -> live logs stream to UI -> app status turns green.

### Step 9: Deferred Stateful Services, Ingress, Network Policies & ESO
- **Goal:** Provision production-grade networking, secrets, and tenant database services.
- **Action:**
  - Deploy Cilium CNI network policies isolating tenant namespaces.
  - Deploy External Secrets Operator (ESO) syncing from OpenBao into tenant namespaces.
  - Configure Traefik ingress controller for routing external domain traffic to tenant services.
  - Implement stateful tenant PostgreSQL workload provisioning (Stateless backend first; Postgres after).
- **Owner:** Rudra.
- **Acceptance:** Tenant stateless application connects to isolated tenant PostgreSQL pod; external traffic reaches tenant service via Traefik.

#### Detailed Specification: OpenBao Secrets Management & ESO Integration

1. **Zero Plaintext Secrets Architectural Rule:**
   - The platform PostgreSQL database stores zero plaintext or ciphertext secret values. Only reference paths (`tenants/<user_id>/projects/<project_id>/<environment>`) or AWS ARNs are permitted.
   - OpenBao (Vault-compatible API) serves as the centralized, multi-tenant secrets store.
   - Secrets are synchronized into tenant namespaces strictly at runtime via Kubernetes custom resources generated by the orchestrator.

2. **Orchestrator Code & Generated Custom Resources ([`apps/backend/internal/cluster/addons/eso.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/cluster/addons/eso.go)):**
   - **Tenant Identity ServiceAccount:** Creates `summit-eso-vault` in each `tenant-<user_id>` namespace.
   - **ESO `SecretStore` (`openbao-store`):**
     - API Version: `external-secrets.io/v1`
     - Provider: `vault` (compatible with OpenBao)
     - Server: `ORCHESTRATOR_OPENBAO_SERVER_URL`
     - Path: `secret` (default KV-v2 engine)
     - Authentication: Kubernetes auth method targeting OpenBao's `kubernetes` auth mount path with role `ORCHESTRATOR_OPENBAO_ROLE` and `serviceAccountRef.name: summit-eso-vault`.
   - **ESO `ExternalSecret` (`app-env-secrets`):**
     - Target: `app-env-secret` (`creationPolicy: Owner`)
     - Refresh Interval: `1h` (configurable via `ESOConfig.RefreshInterval`)
     - Secret Extraction: `dataFrom.extract.key: tenants/<user_id>/projects/<project_id>/<environment>`
   - **Workload Consumption:**
     - The tenant application container spec in `SummitService` mounts the materialized secrets via `envFrom: [{secretRef: {name: "app-env-secret"}}]`.

3. **Orchestrator Environment Configuration & Feature Flags:**
   - Controlled in [`apps/backend/internal/cluster/addons/config.go`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/apps/backend/internal/cluster/addons/config.go):
     - `ORCHESTRATOR_ENABLE_ESO`: Boolean flag, defaults to `false` for MVP simplicity.
     - `ORCHESTRATOR_OPENBAO_SERVER_URL`: URL of the OpenBao cluster (e.g. `http://openbao.openbao-system.svc.cluster.local:8200`).
     - `ORCHESTRATOR_OPENBAO_ROLE`: OpenBao Kubernetes auth role bound to tenant namespaces.
     - `ORCHESTRATOR_OPENBAO_KV_PATH`: Vault KV mount path (default: `secret`).
     - `ORCHESTRATOR_OPENBAO_KV_VERSION`: Vault KV version (default: `v2`).
     - `ORCHESTRATOR_OPENBAO_AUTH_MOUNT`: Kubernetes auth engine mount path in OpenBao (default: `kubernetes`).
   - If `ORCHESTRATOR_ENABLE_ESO=false`, the orchestrator skips ESO resource generation, allowing development workloads to run with direct environment variables or manually applied Kubernetes secrets without requiring an active OpenBao cluster.

4. **Production Activation & Cluster Setup Checklist:**
   - **Step A: Deploy OpenBao Cluster:** Install OpenBao via Helm or Kubernetes Operator into namespace `openbao-system` and initialize the unsealed vault cluster.
   - **Step B: Enable KV-v2 Engine:**
     ```sh
     vault secrets enable -path=secret kv-v2
     ```
   - **Step C: Enable & Configure Kubernetes Auth Engine:**
     ```sh
     vault auth enable kubernetes
     vault write auth/kubernetes/config \
       kubernetes_host="https://kubernetes.default.svc"
     ```
   - **Step D: Define OpenBao Tenant Read Policy & Role:**
     ```sh
     vault policy write summit-tenant-read - <<VAULT_EOF
     path "secret/data/tenants/{{identity.entity.aliases.auth_kubernetes.metadata.service_account_namespace}}/*" {
       capabilities = ["read"]
     }
     VAULT_EOF

     vault write auth/kubernetes/role/summit-tenant-role \
       bound_service_account_names="summit-eso-vault" \
       bound_service_account_namespaces="tenant-*" \
       policies="summit-tenant-read" \
       ttl="1h"
     ```
   - **Step E: Install External Secrets Operator (ESO):**
     ```sh
     helm repo add external-secrets https://charts.external-secrets.io
     helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
     ```
   - **Step F: Enable Orchestrator Sync:** Set `ORCHESTRATOR_ENABLE_ESO=true` and configure the OpenBao server URL and role in the orchestrator environment (`summit-orchestrator-env`).

---

## 5. Architectural Invariants & MVP Deferrals

To ensure MVP velocity and system stability, the following architectural boundaries are strictly maintained:

1. **MVP Backup Deferral (Preserved):**
   Automated backups, point-in-time recovery (PITR), and volume snapshotting for tenant databases are **explicitly deferred post-MVP**. The initial focus is proving the core compile-build-reconcile pipeline. Running backup daemons, volume snapshotters, and remote object storage sinks on test hosts introduces operational overhead that is unnecessary for initial validation.
2. **Workload Ordering (Stateless First, Stateful After):**
   The platform will support **stateless web and backend applications first**. Stateful tenant databases (per-tenant PostgreSQL instances on PersistentVolumeClaims) will be tackled in Step 9 only after the stateless build-to-deploy pipeline is fully proven.
3. **Zero Plaintext Secrets in Platform Database:**
   The platform PostgreSQL database must **never store secret values** (no plaintext, no database-encrypted columns). Secret columns are strictly URI/path pointers (`OpenBao` paths or AWS ARNs). Secrets are injected directly into Kubernetes namespaces at runtime via External Secrets Operator.
4. **Single-Attempt Ephemeral Builders:**
   The current builder adapter creates standalone Pods with `restartPolicy: Never`. Retries are governed by the orchestrator via outbox state transitions, not Kubernetes restarts. If the implementation later changes to Kubernetes Jobs, set `backoffLimit: 0` so the Job controller does not retry independently.

---

## 6. Unresolved Architectural Decisions Log

The following decisions are currently open across plans and must be resolved by team consensus at the relevant gates:

| # | Topic / Decision | Options Considered | Impact & Trade-offs | Current Status / Forum |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Authentication Provider & Authority** | **Option A:** Supabase Auth (built-in JWT, sets `auth.uid()`).<br>**Option B:** Managed Better Auth / OIDC issued tokens. | Option A ties user table foreign keys to Supabase internal `auth.users`. Option B keeps `users` purely application-managed in `public.users`. | **Unresolved** (Pending Gate 1 review between Priyanshu & Arpit) |
| **2** | **GHCR Trusted Push Authentication** | **Option A:** Personal Access Token (classic) with `write:packages` injected into builder via secret volume.<br>**Option B:** In-cluster registry cache / intermediate proxy that performs trusted pushes. | Option A must ensure the write token is never accessible to tenant build scripts/buildpacks. Option B adds operational complexity. | **Unresolved** (Pending Gate 3 review between Priyanshu & Rudra; see [`docs/ghcr_mvp_setup.md`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/ghcr_mvp_setup.md)) |
| **3** | **Deployment API Endpoint Path** | **Option A:** `POST /api/v1/releases` (current OpenAPI spec).<br>**Option B:** `POST /api/v1/projects/{slug}/deployments` (proposed in backend plans). | Option A matches existing OpenAPI YAML. Option B provides clearer resource hierarchy and REST semantics for multi-service projects. | **Unresolved** (Pending Gate 2 review between Priyanshu & UI Developer) |
| **4** | **Async Queue Evolution** | **Option A:** Transactional Outbox in Supabase Postgres (`outbox_events` with `SKIP LOCKED`).<br>**Option B:** Dedicated message broker (NATS JetStream, Redis, or RabbitMQ). | Option A guarantees ACID consistency with zero extra infrastructure. Option B decouples worker polling from database connection pools. Team consensus is Option A for MVP. | **Consensus on Option A for MVP**; evaluate Option B if polling overhead impacts DB |
| **5** | **Row-Level Security (RLS) Enforcement** | **Option A:** Enforce multi-tenancy strictly in Go application queries (`WHERE tenant_id = $1`).<br>**Option B:** Enable Postgres RLS policies on all tables using Supabase session claims. | Option A is simpler with connection pooling (`pgxpool`). Option B provides defense-in-depth but requires transaction-scoped `SET LOCAL` role switching. | **Unresolved** (Pending Gate 1 security review with Arpit) |

---

## 7. Cross-Functional Handoff Matrix & Acceptance Gates

### Shared Collaboration Gates

```
[Gate 1: Identity & Isolation] ──► [Gate 2: Deployment & Outbox] ──► [Gate 3: Sandbox & Registry] ──► [Gate 4: E2E Acceptance]
```

- **Gate 1: Personal User Identity and Isolation Boundary**
  *Focus:* Resolve Supabase Auth vs. Better Auth; verify tenant isolation in SQL queries and API middleware.
- **Gate 2: Deployment Lifecycle + Persistence/Outbox + API Response Contract**
  *Focus:* Settle `POST /deployments` vs `/releases`; verify transactional write of deployment + outbox event; establish state machine transitions.
- **Gate 3: Test-Cluster / Build Isolation / CRDs / Registry / Secrets Conventions**
  *Focus:* Verify host `RuntimeClass: gvisor`; settle GHCR push authentication; validate ephemeral build pod spec and resource limits.
- **Gate 4: End-to-End Acceptance on Test Hosts**
  *Focus:* Full run: trigger build from UI/API -> builder pod compiles code -> image pushed to GHCR -> workload deployed by digest -> logs streamed to console.

### Explicit Handoff Matrix

| From | To | Deliverable / Artifact | Handoff Criteria & Acceptance Standard |
| :--- | :--- | :--- | :--- |
| **Priyanshu** | **Rudra** | Verified `RuntimeClass: gvisor` definition | Manifest applied on Kind/test node; test pod running under `runsc` succeeds |
| **Priyanshu** | **Rudra** | Published Builder Image (`summit-builder:<tag>`) | Image contains `buildkitd`, `buildctl`, `railpack`, and `worker`; runs as UID 1000 |
| **Arpit** | **Priyanshu** | Go `DeploymentRepository` interface | Thread-safe methods for atomic creation of deployment and outbox event |
| **Arpit** | **Rudra** | Database schema & `queue.DBTX` interface | Outbox table supports `FOR UPDATE SKIP LOCKED` lease claiming and heartbeats |
| **Priyanshu** | **Rudra** | Callback receiver endpoints & JWT secret | Endpoints accept stage updates, logs, and final results signed by worker JWT |
| **Rudra** | **Priyanshu / Arpit** | Workload deployment by image digest | Workload controller rolls out tenant pod pinned to `sha256:...` upon build success |
| **Priyanshu / Rudra** | **UI Developer** | OpenAPI 3.1 YAML & live API endpoints | Schema defines deployment triggers, build status polling, and log streaming |
| **UI Developer** | **Team** | Next.js Dashboard connected to Go API | Console triggers real builds and displays live compilation and deployment logs |

---

*This document serves as the sole canonical future implementation roadmap. Individual engineers should update their respective plan docs (`docs/implementation_*.md`) to reflect progress against this sequence without altering cross-team architectural boundaries.*
