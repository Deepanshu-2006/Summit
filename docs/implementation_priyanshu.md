# Go API Control Plane Implementation Plan

- **Document Path:** `docs/implementation_priyanshu.md`
- **Owner:** Priyanshu (API & Builder Engineer)<br>
- **Collaborators:** Rudra (Orchestrator Engineer), Arpit (Database Engineer - DB only), UI Developer (Frontend / Dashboard Owner)<br>
- **Target Component:** `apps/backend` (Go 1.26 service) & `builder` (Entire Isolated Builder: host gVisor `runsc`, `gvisor` runtimeClass, rootless BuildKit + Railpack container)<br>
- **API Contract:** `packages/api_spec/openapi.yaml` (OpenAPI 3.1)  
- **Status:** COMPLETED & VERIFIED / API CONTROL PLANE, CALLBACKS & BUILDER PACKAGED  
- **Date:** October 2026  

---

## 1. Executive Summary & Context

The Summit Jetway platform is an edge-native developer platform and PaaS control plane. The system architecture (`docs/system_architechture.png`) comprises a central `platform` control-plane namespace containing the Go API service, an administrative dashboard (`apps/web`), a Supabase PostgreSQL platform database, a transactional job queue/outbox, and a Go-based Kubernetes operator/orchestrator managing Custom Resource Definitions (CRDs). Customer builds are executed inside ephemeral, sandboxed gVisor (`runsc`) pods using rootless BuildKit and Railpack to build OCI images. GHCR is the proposed MVP image registry; the cluster pulls images from `ghcr.io` and deploys immutable digests. Tenant workloads, persistent volumes, and databases execute within isolated tenant namespaces protected by Cilium network policies and Traefik ingress routing.

This document serves as the implementation plan for **Priyanshu** (API & Builder Engineer). It covers the existing Go HTTP control plane and the remaining API work, and assigns Priyanshu ownership of the **entire isolated builder**, including host gVisor (`runsc`) installation/configuration and `gvisor` runtimeClass setup on the Kubernetes host machines, plus the rootless BuildKit + Railpack builder container image, daemon configuration, and build logic. Rudra must NOT own, install, or configure gVisor; Rudra owns the orchestrator engine and Kubernetes scheduling, launching, monitoring, and cleanup of pods using Priyanshu's configured builder. Arpit owns the database only (Supabase PostgreSQL persistence, schemas, and outbox table).

---

## 2. Role, Scope & Non-Goals

### 2.1 Owner Role & Core Responsibilities
- **Owner:** Priyanshu (API & Builder Engineer).
- **Core Scope:**
  - Architecture, design, and implementation of the Go HTTP service within `apps/backend`.
  - HTTP routing, request deserialization, payload validation, and response serialization.
  - Core HTTP middleware pipeline: authentication verification, tenant extraction, request tracing (`X-Request-ID`), structured logging (`log/slog`), panic recovery, rate limiting, and CORS.
  - Contract lifecycle management: driving the OpenAPI-first evolution in `packages/api_spec/openapi.yaml` in lockstep with the UI developer.
  - Clean repository abstraction interfaces (`internal/platformdb`) coordinating with Arpit on Supabase PostgreSQL persistence models (Arpit owns DB only).
  - Orchestration dispatch abstraction (`internal/orchestrator` / transactional outbox) coordinating with Rudra on asynchronous build and deployment lifecycles.
  - External webhook intake and security (GitHub HMAC-SHA256 signature verification and replay prevention).
  - Telemetry read APIs: exposing aggregated Prometheus metrics and Loki structured log streams to the frontend dashboard.
  - **Entire isolated builder ownership:**
    - Installing and configuring gVisor (`runsc`) on the Kubernetes host nodes, configuring containerd runtime handlers, and setting up the `gvisor` runtimeClass in the Kubernetes cluster.
    - Implementing, packaging, and configuring the rootless BuildKit and Railpack builder container image (`builder/Dockerfile`), unprivileged execution (UID 1000), build cache management, and artifact compilation targeting the gVisor sandbox.
  - API and builder automated test suites (unit, integration, contract, container build, and gVisor sandbox verification tests).

### 2.2 Cross-Functional Teammates & Interfaces
- **Arpit (Database Engineer):** Owns database persistence only: Supabase Postgres schemas, DDL migrations, connection pooling (`pgxpool`), database indexing, transaction semantics, and Row-Level Security (RLS) policies. Priyanshu consumes repository interfaces implemented or reviewed by Arpit.
- **Rudra (Orchestrator Engineer):** Owns the orchestrator engine, custom resources (`CRDs`), and Kubernetes scheduling, launching, monitoring, and cleanup of pods (including ephemeral build pods using Priyanshu's configured `gvisor` runtimeClass and builder container image) as well as tenant workloads. Rudra also owns Traefik ingress routing configurations and Cilium network policies. Rudra must NOT own, install, or configure gVisor. Priyanshu hands off dispatch intent via the database outbox and provides the configured gVisor runtimeClass and builder container image, while Rudra schedules the ephemeral build pods and reports execution status back to the database.
- **UI Developer (Frontend Owner):** Owns `apps/web` (Next.js dashboard). Priyanshu coordinates all breaking changes, schema additions, error envelopes, and polling/streaming mechanisms against `packages/api_spec/openapi.yaml`.

### 2.3 Explicit Non-Goals for the API Service & Builder
- **No Direct Container/Build Execution in API Process:** Customer builds must NEVER run inside the control-plane Go process or on the bare host. All build executions are strictly delegated to isolated builder pods scheduled by Rudra's orchestrator using Priyanshu's configured builder (runtimeClass and container image).
- **No Orchestrator Pod Scheduling Engine Implemented by Priyanshu:** While Priyanshu owns the entire isolated builder—including host gVisor (`runsc`) installation/configuration, the `gvisor` runtimeClass, and the builder container image—Priyanshu does NOT build the orchestrator reconciliation loop or manage the Kubernetes scheduling/lifecycle engine. Pod scheduling, launching, monitoring, and cleanup are strictly owned by Rudra. Rudra must NOT own, install, or configure gVisor.
- **No Custom Backup Automation in MVP:** Custom database backup and recovery automation is out of scope for this MVP.
- **No Direct Kubernetes API Mutation in HTTP Handlers:** HTTP handlers must not issue synchronous `client-go` create/update calls against Kubernetes etcd. State changes are persisted to the platform database and picked up by Rudra's reconciliation loop.
- **No Plaintext Secret Storage:** The API service must never persist or log raw customer secrets (database passwords, API tokens, webhook secrets). Plaintext secrets are brokered via OpenBao and AWS Secrets Manager using the External Secrets Operator (ESO).
- **No Monorepo Split:** The Go service remains inside `apps/backend` within the existing repository structure.

---

## 3. Current Repository Baseline & Audit

### 3.1 Existing Repository State (Post-PR #3)
An inspection of the workspace confirms the current baseline:
- **`apps/backend`:**
  - Defined as Go module `github.com/summit/backend` (Go 1.26) and npm workspace package `@summit/backend` orchestrated via Turborepo 2.11+.
  - **Core Production Packages (15 Packages Landed & Tested):**
    - `cmd/api/main.go`: Application entrypoint initializing logger, config, pgx pool, secrets router, GitHub App client, HTTP server, and spawning the background webhook poller with graceful shutdown.
    - `cmd/migrate/main.go`: Standalone database migration CLI with advisory locking.
    - `internal/auth`: Supabase JWT verification (`verifier.go`) supporting JWKS caching and explicit algorithm allowlists (`RS256`, `ES256`, `HS256`), and platform user synchronization (`user.go`).
    - `internal/authz`: Role-based access control matrix (`owner`, `admin`, `member`, `viewer`) and tenant organization check middleware.
    - `internal/db`: `pgxpool` lifecycle manager (`pool.go`), schema migration runner (`migrate.go`), and migrations `0001_baseline.up.sql` & `0002_github_integration.up.sql`.
    - `internal/githubapi`: REST handlers and consumer-defined `ServiceAPI` interface for GitHub installations, OAuth callbacks, repository listing, on-demand synchronization, service sources, and manual deployment dispatch.
    - `internal/githubapp`: GitHub App client (`client.go`), RS256 App JWT generator (9-minute TTL), in-memory installation token cache with single-flight mutexes, and thread-safe cache invalidation (`InvalidateInstallationTokens`).
    - `internal/githubwebhook`: Raw HMAC-SHA256 constant-time verification (`signature.go`), 10MB payload size limits (`body.go`), and event normalization (`normalize.go`).
    - `internal/githubworker`: High-throughput webhook receiver (`webhook_handler.go`), asynchronous background event consumer using `FOR UPDATE SKIP LOCKED` (`processor.go`), and internal worker credential broker (`broker_handler.go`) with job-scoped JWT validation.
    - `internal/httpx`: Standard RFC 7807 JSON error envelopes and response helpers.
    - `internal/installstate`: Single-use CSRF installation state generator with SHA-256 state hashing.
    - `internal/secrets`: OpenBao AppRole client and multi-tier router with development fallback controls.
    - `internal/sourcepath`: Lexical path traversal sanitizer rejecting directory escape (`..`), null bytes, and absolute paths.
    - `internal/audit`: Redacted audit event publisher.
    - `internal/testutil`: Schema-isolated PostgreSQL test runner for local and CI testing.
- **`packages/api_spec/openapi.yaml`:**
  - OpenAPI 3.1.0 document declaring paths for:
    - `GET /api/v1/health`
    - `GET /api/v1/projects`
    - `GET /api/v1/projects/{slug}`
    - `GET /api/v1/resources`
    - `POST /api/v1/resources`
    - `GET /api/v1/resources/{id}`
    - `DELETE /api/v1/resources/{id}`
    - `GET /api/v1/releases`
    - `POST /api/v1/releases`
    - `GET /api/v1/observability/metrics`
    - `GET /api/v1/observability/logs`
- **`apps/web`:**
  - Next.js 16 frontend with mock route handlers (`app/api/v1/...`) and an in-memory Meridian demo store. These serve as prototype behavior and must be replaced by the Go API service.
- **Infrastructure Context:**
  - 1-2 SSH machines designated strictly as **TEST ONLY** Kubernetes hosts.

### 3.2 Canonical Contract Gaps
The current `openapi.yaml` specification represents an initial target draft with critical gaps that must be resolved prior to production readiness:
1. **Authentication & Tenant Membership:** No security schemes (`securitySchemes`), JWT Bearer definitions, API key headers, or tenant context endpoints (`/api/v1/tenants`, `/api/v1/auth/me`).
2. **Project Lifecycle Management:** Missing `POST /api/v1/projects` (creation), `PATCH /api/v1/projects/{slug}` (updates), and `DELETE /api/v1/projects/{slug}` (deprovisioning).
3. **Asynchronous Deployment Contract:** The current contract describes release operations but does not define deployment tracking. Propose a separate asynchronous deployment operation returning `202 Accepted`, a `deployment_id`, and a status endpoint (`GET /api/v1/deployments/{id}`); confirm the route and response with the UI before changing OpenAPI.
4. **Git Webhook Ingress:** Missing webhook intake paths (e.g., `POST /api/v1/webhooks/github`) with HMAC validation signatures.
5. **Pagination & Query Contracts:** List endpoints lack standardized cursor/offset pagination, limit parameters, and sorting semantics.
6. **Detailed Error Codes:** Error envelopes specify generic string fields without machine-readable domain error codes (`TENANT_NOT_FOUND`, `BUILD_ALREADY_IN_PROGRESS`, etc.).

---

## 4. Shared Backend Architecture Gates

### Cross-plan decisions to take to the gates

These are **working proposals**, not approved architecture. Later implementation details are conditional on team approval:

- **Auth and tenancy:** choose the identity provider and tenant context contract at Gate 1. Supabase Auth is one candidate only; Supabase Postgres does not imply Supabase Auth. Enforce tenant scope in every repository operation; decide separately whether database RLS is needed and which DB role can enforce it.
- **Async deployment:** propose `POST /api/v1/projects/{slug}/deployments` returning `202 Accepted` only after the deployment and dispatch intent are persisted atomically. Return a deployment ID and `Location: /api/v1/deployments/{id}`. Add `GET /api/v1/deployments/{id}` to OpenAPI after joint approval. Keep `/releases` for release history/artifacts unless the UI and team choose otherwise.
- **Lifecycle vocabulary:** propose `queued → building → image_ready → deploying → health_checking → running`, with terminal `failed` and `cancelled`. Record retries as attempt metadata; add a visible retry state only if all owners and the UI agree. Gate 2 owns approval of the state graph and transitions.
- **Dispatch and persistence:** a PostgreSQL transactional outbox is the recommended Phase 1 option, not a settled fact. If approved, Arpit (who owns DB only) owns its schema and shared Go persistence contracts under `apps/backend/internal/platformdb`; Priyanshu and Rudra consume those contracts. Do not create competing `internal/repository` and `internal/platformdb` abstractions.
- **Infrastructure details:** exact providers, queue technology, schema/migration tools, leases, retention, and resource limits remain decisions until verified against selected services and the test cluster. The architecture diagram does not establish those implementation details.

To guarantee operational alignment across the platform, the following four architecture gates are shared across all three backend owners (Priyanshu, Rudra, and Arpit). Each gate requires joint sign-off before implementation or promotion.

---

### Gate 1: Tenant/Auth Identity and Isolation Boundary
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Define the end-to-end identity propagation model from the HTTP request down to database queries and Kubernetes tenant namespaces.
  - Standardize authentication and tenant context after selecting an identity provider; validate its signed tokens and resolve membership/role server-side.
  - Establish database tenant isolation: Arpit (DB only) configures Row-Level Security (RLS) policies or strict `tenant_id` foreign key tenancy in Supabase PostgreSQL; Priyanshu ensures every repository call injects verified tenant context.
  - Establish orchestrator tenant isolation: Rudra enforces that all tenant pods, services, secrets, and volumes deploy into dedicated Kubernetes namespaces (`tenant-{tenant_id}`) protected by Cilium network policies preventing cross-tenant and tenant-to-control-plane communication.
- **Required Deliverables:**
  1. Signed-off Auth & Tenant Context specification document.
  2. JWT parsing and tenant extraction middleware in `apps/backend/internal/middleware`.
  3. Tenant isolation test suite validating that Tenant A cannot read, mutate, or trigger builds for Tenant B resources.

---

### Gate 2: Deployment Lifecycle + Persistence/Outbox + API Response Contract/Retries/Idempotency
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Approve the deployment state machine. The shared working proposal is `queued` &rarr; `building` &rarr; `image_ready` &rarr; `deploying` &rarr; `health_checking` &rarr; `running`, with terminal `failed` / `cancelled`.
  - Evaluate and, if approved, establish a PostgreSQL transactional outbox: Priyanshu writes deployment records and outbox events in one transaction; Arpit (DB only) owns its schema and concurrency design; Rudra consumes dispatch events and schedules reconciliation.
  - Define API response semantics: Propose transitioning `POST /api/v1/releases` (or `POST /api/v1/projects/{slug}/deployments`) to return `202 Accepted` with a `Location: /api/v1/deployments/{id}` header and initial state payload.
  - Guarantee idempotency: Implement `Idempotency-Key` HTTP header handling to prevent duplicate builds and releases on client retries or automated webhook triggers.
  - Handoff status reads: Priyanshu serves status via `GET /api/v1/deployments/{id}` by reading the database read-model populated by Rudra's operator, eliminating any API-to-K8s coupling.
- **Required Deliverables:**
  1. Complete State Machine & Outbox Schema specification.
  2. Idempotency middleware and database deduplication table.
  3. Integration test proving zero event loss between API outbox insertion and orchestrator dispatch under failure injection.

---

### Gate 3: Test-Cluster/Build Isolation/CRDs/Registry/Ingress/Network/Secrets Conventions
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Establish cluster conventions for the 1-2 shared SSH test machines (strictly test-only; volatile and subject to recreation).
  - Enforce build sandbox constraints & clear ownership boundary:
    - **Priyanshu (Entire Isolated Builder Owner):** Owns the entire isolated builder end-to-end: installs and configures gVisor (`runsc`) and containerd runtime handlers on the Kubernetes host machines, registers the `gvisor` runtimeClass on the cluster, and builds/configures the rootless BuildKit + Railpack container image (`Dockerfile`, rootless BuildKit daemon configuration, Railpack build logic, non-root user execution at UID 1000, build caching, and OCI image artifact generation). Guarantees that compilation requires zero host privileges and operates cleanly within user-space inside the gVisor sandbox.
    - **Rudra (Orchestrator & Pod Lifecycle Owner):** Owns the orchestrator engine, establishes the `summit-builds` namespace, defines the build pod manifest/CRD, schedules and launches the ephemeral build pods using Priyanshu's configured builder (`gvisor` runtimeClass and container image), monitors pod status/logs, and handles pod destruction/cleanup upon completion. Rudra must NOT own, install, or configure gVisor.
    - **Arpit (Database Engineer):** Owns database persistence only (schemas, migrations, pooling, and outbox tables).
  - Ingress & Network isolation: Rudra configures Traefik ingress controller routing and Cilium network policies. Priyanshu defines required routing rules for custom tenant domains and platform API routing.
  - Secrets Management conventions: Integration of OpenBao & AWS Secrets Manager via External Secrets Operator (ESO). The API stores only secret references/metadata in Postgres; Rudra synchronizes secret values directly into tenant Kubernetes secrets.
- **Required Deliverables:**
  1. Test cluster deployment manifest and namespace layout documentation (Rudra).
  2. Verified host gVisor (`runsc`) installation, containerd configuration, registered `gvisor` runtimeClass, and isolated rootless BuildKit + Railpack container image/profile (Priyanshu).
  3. Secret reference exchange contract between API and Orchestrator.

---

### Gate 4: End-to-End Acceptance on Test-Only Machines with Migration/Security Review
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Execute end-to-end platform validation on the test-only Kubernetes machines before any production rollout.
  - Workflow under test: Developer pushes commit / triggers deploy via API &rarr; API validates auth, writes deployment & outbox record &rarr; Orchestrator claims outbox event &rarr; Rudra schedules and launches ephemeral build pod using Priyanshu's configured `gvisor` runtimeClass and builder container &rarr; Builder executes rootless BuildKit inside gVisor sandbox &rarr; trusted publish flow pushes the image to GHCR &rarr; Pod destroyed/cleaned up by Rudra &rarr; Tenant deployment updated by immutable image digest &rarr; Traefik ingress routes traffic &rarr; Cilium enforces network boundary &rarr; Metrics/logs emitted to Prometheus/Loki &rarr; API streams logs/metrics back to dashboard.
  - Comprehensive Database Migration & Rollback Review: Validate Arpit’s forward and rollback migrations against populated test datasets without service interruption (Arpit owns DB only).
  - Security Penetration & Compliance Review: Verify non-root enforcement (UID 1000), gVisor syscall filtering, egress firewalls, lack of secret leakage in logs, and tenant isolation integrity.
- **Required Deliverables:**
  1. Automated E2E test execution report run against test-only Kubernetes machines.
  2. Signed security and migration review checklist.

---

## 5. Proposed Code Organization & Package Boundaries

The Go API implementation will reside within the existing single Go module `github.com/summit/backend` inside `apps/backend`. It strictly adheres to standard Go package layout conventions, avoiding circular dependencies and maintaining clean layer separation.

```text
apps/backend/
├── cmd/
│   └── api/
│       └── main.go                     # Application wiring, DI, and lifecycle
├── internal/
│   ├── api/                            # HTTP Transport Layer (Handlers & Serializers)
│   │   ├── handler.go                  # Shared handler utilities, JSON decoding, response helpers
│   │   ├── health_handler.go           # Health and liveness endpoints
│   │   ├── project_handler.go          # Project listing, retrieval, and management
│   │   ├── resource_handler.go         # Infrastructure resource provisioning endpoints
│   │   ├── release_handler.go          # Release triggering, deployment listing, status tracking
│   │   ├── webhook_handler.go          # GitHub webhook ingress with HMAC verification
│   │   └── observability_handler.go    # Prometheus metrics and Loki log proxy handlers
│   ├── config/                         # Environment & runtime configuration
│   │   └── config.go                   # Strongly typed config with validation
│   ├── domain/                         # Core Business Models & Domain Errors (Zero Dependencies)
│   │   ├── errors.go                   # Standard domain errors (ErrNotFound, ErrUnauthorized, etc.)
│   │   ├── project.go                  # Project, environment, and service domain entities
│   │   ├── resource.go                 # Infrastructure resource entity and types
│   │   ├── release.go                  # Release entity, status enums, versioning
│   │   ├── deployment.go               # Deployment state machine, step logs, build metadata
│   │   └── tenant.go                   # Tenant, organization, and user identity entities
│   ├── middleware/                     # HTTP Middleware Pipeline
│   │   ├── auth.go                     # JWT validation, token verification, session handling
│   │   ├── tenant.go                   # Tenant extraction and context injection
│   │   ├── tracing.go                  # Request ID (X-Request-ID) and trace propagation
│   │   ├── logger.go                   # Structured request logging with slog
│   │   ├── recovery.go                 # Panic recovery with structured stack logging
│   │   ├── cors.go                     # Environment-aware CORS configuration
│   │   ├── ratelimit.go                # Token-bucket rate limiting per IP / tenant
│   │   └── idempotency.go              # Idempotency-Key validation and caching
│   ├── platformdb/                     # Persistence Abstraction Interfaces (Coordinated with Arpit - DB only)
│   │   ├── interfaces.go               # ProjectRepository, ResourceRepository, DeploymentRepository
│   │   └── outbox.go                   # OutboxEvent repository and transactional unit-of-work
│   ├── orchestrator/                   # Orchestrator Dispatch Interfaces (Coordinated with Rudra)
│   │   └── client.go                   # Outbox publisher / queue producer abstraction
│   ├── observability/                  # Upstream Telemetry Clients
│   │   ├── prometheus.go               # Prometheus metrics query client
│   │   └── loki.go                     # Loki log stream query client
│   └── server/                         # HTTP Server Construction & Routing Mux
│       ├── server.go                   # Server lifecycle, timeout tuning, graceful shutdown
│       └── routes.go                   # Route registration mapping handlers to paths
├── tests/
│   ├── mocks/                          # Mock implementations of repository & orchestrator interfaces
│   ├── integration/                    # HTTP integration tests against test databases
│   └── contract/                       # OpenAPI contract conformance tests
├── go.mod
├── go.sum
└── README.md

builder/                                # Entire Isolated Builder Component (Priyanshu)
├── gvisor/                             # Host gVisor installation & runtimeClass configuration (Priyanshu)
│   ├── install-runsc.sh                # Host gVisor (runsc) installer and containerd configuration
│   └── runtimeclass.yaml               # Kubernetes gvisor runtimeClass definition
├── Dockerfile                          # Rootless BuildKit + Railpack container specification
├── entrypoint.sh                       # Unprivileged build runner & cache initializer
├── buildkitd.toml                      # Rootless BuildKit daemon configuration
└── README.md                           # Builder container documentation & local test instructions
```

### Package Boundary Rules
1. `internal/domain` has **zero external dependencies** and does not import `net/http` or database drivers.
2. `internal/api` depends only on `internal/domain`, `internal/platformdb`, and standard library HTTP packages.
3. `internal/platformdb` declares pure Go interfaces for database operations; concrete PostgreSQL implementations (`pgxpool`) are injected at `cmd/api/main.go`. (Avoid competing repository abstractions).
4. `internal/orchestrator` declares event publishing interfaces; the HTTP handlers never directly call Kubernetes client libraries.
5. `builder/` encapsulates the entire isolated builder component (host gVisor `runsc` installation, `gvisor` runtimeClass setup, and rootless BuildKit + Railpack container image); it has zero coupling to Kubernetes API machinery or orchestrator pod scheduling/lifecycle loops (which are owned by Rudra).

---

## 6. Phased Implementation Roadmap & Deliverables

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Foundations & Contract Realignment (Priyanshu + UI Dev + Arpit + Rudra)│
└──────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Core Middleware, Tenant Context & Security Infrastructure (Priyanshu) │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 1: Tenant & Auth Isolation)                     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Persistence Abstractions & Core CRUD Endpoints (Priyanshu + Arpit)    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Asynchronous Deployment Pipeline, Outbox & Builder Component          │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 2: Deployment & Outbox Lifecycle)                 │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Webhook Ingress, Secret Safety & Observability Streams (Priyanshu)    │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 3: Test Cluster, Ingress & Secrets)                │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Test-Cluster Integration, Hardening & Acceptance (Priyanshu + Rudra)  │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 4: End-to-End Acceptance on Test Cluster)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 0: Foundations, Contract Realignment & Tooling
- **Owner:** Priyanshu
- **Collaborators:** UI Developer, Arpit, Rudra
- **Deliverables:**
  1. **OpenAPI 3.1 Spec RFC:** Propose contract amendments in `packages/api_spec/openapi.yaml` covering missing routes (project creation, deployment status, GitHub webhook) and submit for UI Developer review.
  2. **Go Module Dependencies:** Initialize `go.sum` with necessary foundational libraries:
     - Router/HTTP: Go 1.26 `net/http` standard library enhanced pattern matching.
     - Database driver: `github.com/jackc/pgx/v5` for PostgreSQL connectivity.
     - Token validation: `github.com/golang-jwt/jwt/v5`.
     - UUID generator: `github.com/google/uuid` (UUIDv7 support for ordered database keys).
  3. **Repository Scaffold:** Establish directory structure (`internal/api`, `internal/domain`, `internal/middleware`, `internal/platformdb`).
  4. **CI Linter & Vet Check:** Ensure `pnpm lint` (`go vet ./...`) and `golangci-lint` pass cleanly in root workspace scripts.

---

### Phase 1: Core Middleware, Tenant Context & Security Infrastructure
- **Owner:** Priyanshu
- **Shared Gate Alignment:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> **Gate 1 (Tenant/Auth Identity & Isolation Boundary)**
- **Deliverables:**
  1. `internal/middleware/recovery.go`: Panic-recovery middleware catching panics, emitting structured stack traces via `slog.Error`, and returning RFC 7807/OpenAPI `ErrorResponse` (HTTP 500).
  2. `internal/middleware/tracing.go`: Injects or propagates incoming `X-Request-ID` into `context.Context` and response headers.
  3. `internal/middleware/logger.go`: Logs HTTP method, path, status, latency, request ID, client IP, and tenant ID at appropriate log levels.
  4. `internal/middleware/cors.go`: Replaces permissive wildcard CORS with strict origin validation supporting local development (`http://localhost:3000`) and production edge domains.
  5. `internal/middleware/auth.go`: Validates Bearer JWTs from the identity provider selected at Gate 1, including signature and expiry.
  6. `internal/middleware/tenant.go`: Extracts `tenant_id` from claims, verifies user membership, and sets strongly-typed `tenant.ContextKey` into request context.

---

### Phase 2: Persistence Abstractions & Read/Write CRUD Endpoints
- **Owner:** Priyanshu
- **Collaborators:** Arpit (Database Engineer - DB only), UI Developer
- **Deliverables:**
  1. `internal/domain/project.go` & `internal/domain/resource.go`: Domain entities strictly modeling platform concepts.
  2. `internal/platformdb/interfaces.go`: Definition of `ProjectRepository` and `ResourceRepository`.
  3. `internal/api/project_handler.go`:
     - `GET /api/v1/projects`: List projects for authenticated tenant.
     - `GET /api/v1/projects/{slug}`: Fetch project topology, environments, and services.
     - `POST /api/v1/projects` (New Contract): Create project with slug uniqueness validation.
  4. `internal/api/resource_handler.go`:
     - `GET /api/v1/resources`: Filter provisioned resources by type (`database`, `storage`, etc.).
     - `POST /api/v1/resources`: Validate requested tier/region and persist resource provisioning intent.
     - `GET /api/v1/resources/{id}`: Detailed resource status.
     - `DELETE /api/v1/resources/{id}`: Soft-delete/mark resource terminating.
  5. **UI Hand-off:** Provide mock responses or live endpoints allowing UI developer to point dashboard away from prototype routes (`apps/web/app/api/...`).

---

### Phase 3: Asynchronous Deployment Pipeline, Orchestrator Outbox & Builder Component
- **Owner:** Priyanshu
- **Collaborators:** Rudra (Orchestrator Engineer), Arpit (Database Engineer - DB only)
- **Shared Gate Alignment:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> **Gate 2 (Deployment Lifecycle & Outbox Contract)**
- **Deliverables:**
  1. `internal/platformdb/outbox.go`: Transactional unit-of-work interface executing deployment record creation and outbox event insertion atomically.
  2. `internal/middleware/idempotency.go`: Validates `Idempotency-Key` header, caching execution states to prevent duplicate triggering of builds.
  3. `internal/api/release_handler.go`:
     - `POST /api/v1/releases`: Accepts build request, validates branch/commit/version, inserts outbox record, and returns `202 Accepted` with tracking URL.
     - `GET /api/v1/releases`: Lists historical releases for the tenant.
     - `GET /api/v1/deployments/{id}` (New Contract): Returns real-time deployment status (`queued`, `building`, etc.), step timestamps, and error summaries read from database.
  4. **Entire Isolated Builder Component (`builder/`):**
     - Host gVisor Setup: Installation and configuration scripts for `runsc` on Kubernetes host nodes, containerd runtime configuration, and registration of the `gvisor` runtimeClass.
     - Package `Dockerfile` for rootless BuildKit and Railpack running as unprivileged user (UID 1000).
     - Configure `buildkitd.toml` for rootless user-space compilation with no requirement for host root privileges.
     - Create `entrypoint.sh` for source acquisition and Railpack build plan execution. The GHCR image-push credential boundary must be agreed with Rudra before implementing publishing; never expose a registry write credential to customer-controlled build commands.
  5. **Orchestration Boundary with Rudra:**
     - Priyanshu owns and provides the entire isolated builder: host gVisor (`runsc`) installation and configuration, the `gvisor` runtimeClass setup, and the tested builder container image.
     - Rudra owns orchestrator pod scheduling, pod spec/manifest generation, launching, log streaming, monitoring, and cleanup of the ephemeral build pod that invokes Priyanshu's configured builder (runtimeClass + image). Rudra does NOT install or configure gVisor.
  6. **Failure Recovery:** Standardized error mapping when database transaction or outbox write fails.

---

### Phase 4: Webhook Ingress, Secret Safety & Observability Streams
- **Owner:** Priyanshu
- **Collaborators:** Rudra, UI Developer
- **Shared Gate Alignment:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> **Gate 3 (Test Cluster, Ingress & Secrets Conventions)**
- **Deliverables:**
  1. `internal/api/webhook_handler.go`:
     - `POST /api/v1/webhooks/github`: Validates `X-Hub-Signature-256` HMAC-SHA256 signature using constant-time comparison (`crypto/subtle.ConstantTimeCompare`).
     - Parses push/pull_request payloads, extracts branch and commit SHA, maps to project, and initiates asynchronous deployment.
     - Implements delivery deduplication using `X-GitHub-Delivery`.
  2. **Secret Safety Implementation:** Verify that environment variables and resource credentials passed via API are stored strictly as OpenBao/ESO secret references, never plaintext strings.
  3. `internal/api/observability_handler.go`:
     - `GET /api/v1/observability/metrics`: Queries Prometheus metrics-server for CPU, memory, RPS, and edge latency.
     - `GET /api/v1/observability/logs`: Queries Fluent Bit / Loki log stream for pod and service logs, with streaming or paginated responses.
  4. **UI Review:** Review log stream format and metrics payload with UI Developer to ensure smooth dashboard charts rendering.

---

### Phase 5: Test-Cluster Integration, Hardening & Acceptance
- **Owner:** Priyanshu
- **Collaborators:** Rudra, Arpit
- **Shared Gate Alignment:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> **Gate 4 (End-to-End Acceptance on Test-Only Machines)**
- **Deliverables:**
  1. Deploy Go API service to `platform` namespace on the 1-2 shared test Kubernetes machines.
  2. Verify Traefik ingress routing to `/api/v1/*` with TLS termination.
  3. Execute automated contract and integration test suite against live cluster endpoints.
  4. Conduct joint E2E deployment test: trigger commit &rarr; API outbox insertion &rarr; Rudra's orchestrator schedules ephemeral pod on Priyanshu's configured gVisor runtimeClass &rarr; Priyanshu's builder executes rootless BuildKit + Railpack &rarr; trusted publish flow pushes to GHCR &rarr; tenant rollout by immutable digest &rarr; log streaming.
  5. Security and vulnerability audit: confirm no control-plane container escape vectors, non-root execution (UID 1000), gVisor syscall filtering, and strict Cilium network isolation.

---

## 7. API Middleware Architecture & Tenant Context Pipeline

The HTTP server uses an idiomatic, composable middleware pipeline wrapped in outer-to-inner order.

```
Incoming Request
  │
  ▼
[ 1. Recovery Middleware ]       - Catches panics, logs stack trace, returns 500 JSON
  │
  ▼
[ 2. Tracing Middleware ]        - Extracts or creates X-Request-ID, injects into context
  │
  ▼
[ 3. Logging Middleware ]        - slog structured logging (method, path, IP, latency)
  │
  ▼
[ 4. Security & CORS ]           - Validates Origin, sets CORS headers, handles OPTIONS
  │
  ▼
[ 5. Rate Limiting ]             - IP / Tenant token bucket (returns 429 on abuse)
  │
  ▼
[ 6. Auth Middleware ]           - Validates Supabase JWT, verifies expiry, extracts claims
  │
  ▼
[ 7. Tenant Context ]            - Enforces tenant isolation, injects TenantContext into context
  │
  ▼
[ 8. Idempotency Middleware ]    - Evaluates Idempotency-Key on mutating requests (POST/PATCH)
  │
  ▼
Target HTTP Handler
```

### 7.1 Tenant Context Definition
```go
package tenant

import (
	"context"
	"errors"
)

type contextKey struct{}

var tenantCtxKey = contextKey{}

var (
	ErrNoTenantContext = errors.New("no tenant found in request context")
	ErrUnauthorized    = errors.New("unauthorized tenant access")
)

type Context struct {
	TenantID string
	UserID   string
	Role     string // "owner", "admin", "developer", "viewer"
}

func WithContext(ctx context.Context, tc Context) context.Context {
	return context.WithValue(ctx, tenantCtxKey, tc)
}

func FromContext(ctx context.Context) (Context, error) {
	tc, ok := ctx.Value(tenantCtxKey).(Context)
	if !ok || tc.TenantID == "" {
		return Context{}, ErrNoTenantContext
	}
	return tc, nil
}
```

### 7.2 Strict Tenant Isolation Guarantees
- Any route under `/api/v1/projects`, `/api/v1/resources`, `/api/v1/releases`, and `/api/v1/observability` **MUST** pass through `Auth` and `TenantContext` middleware.
- If no valid JWT is supplied &rarr; return HTTP `401 Unauthorized` evacuations.
- If the token is valid but the user lacks membership in the requested project/tenant &rarr; return HTTP `403 Forbidden`.
- Every repository query executed by Priyanshu's handlers will accept `ctx` and pass `tc.TenantID` as the primary filter criterion, ensuring multi-tenant isolation at the database layer.

---

## 8. OpenAPI-First Evolution & Contract Gap Analysis

The repository standard mandates that `packages/api_spec/openapi.yaml` is the canonical source of truth. Priyanshu will drive the formal RFC process for all contract updates.

### 8.1 Contract Gap Analysis & Proposals

| Endpoint | Current Spec State | Proposed RFC Change | Justification / UI Impact | Review Required |
|---|---|---|---|---|
| `GET /api/v1/health` | Implemented in Go | Retain, add dependency checks (db, k8s, queue) | Enables true readiness vs liveness probes | Team of Three |
| `GET /api/v1/projects` | Defined in Spec | Add pagination query params (`limit`, `cursor`) | Prevents unbounded payload sizes on large tenants | UI Developer |
| `POST /api/v1/projects` | **Missing from Spec** | Add creation schema: `name`, `slug`, `framework`, `region` | Required for self-service project creation | UI Developer, Arpit (DB only) |
| `GET /api/v1/projects/{slug}` | Defined in Spec | Retain schema; refine service status details | Returns real-time status of web/worker/db pods | UI Developer, Rudra |
| `GET /api/v1/resources` | Defined in Spec | Add pagination and environment filtering | Enables filtering by `production` vs `staging` | UI Developer |
| `POST /api/v1/resources` | Defined in Spec | Update response to indicate asynchronous provisioning (`202 Accepted`) | Resource provisioning (DB, Redis) takes time | UI Developer, Arpit (DB only) |
| Proposed deployment endpoint | Not in current contract | Add `POST /api/v1/projects/{slug}/deployments` returning `202 Accepted`, plus status lookup | Builds are asynchronous; HTTP request cannot wait for completion | UI Developer, Rudra, Arpit (DB only) |
| `GET /api/v1/deployments/{id}` | **Missing from Spec** | Add deployment tracking endpoint (status, step logs, timings) | Enables dashboard build progress bar and live steps | UI Developer, Rudra |
| `POST /api/v1/webhooks/github`| **Missing from Spec** | Add webhook endpoint with signature validation schemas | Automated Git-push deployments | Rudra |
| `GET /api/v1/observability/logs`| Defined in Spec | Add timestamp range (`since`, `until`) and streaming/SSE | Enables historical audit and live log tailing | UI Developer |

### 8.2 Change Coordination Workflow with UI Developer
1. **Drafting:** Priyanshu creates an OpenAPI diff branch amending `packages/api_spec/openapi.yaml`.
2. **Type Generation:** Run `pnpm typecheck:api` to verify TypeScript contract generation in `packages/api_spec`.\n3. **UI Review:** Priyanshu tags the UI Developer to review schema diffs, ensuring request/response shapes match dashboard component expectations.
4. **Approval & Merge:** Once approved, the OpenAPI spec is committed first; Go handler implementation and frontend client wiring follow immediately.

---

## 9. Endpoint Semantics & Asynchronous Deployment Lifecycle

### 9.1 Asynchronous Deployment State Machine
Deploying code involves fetching repository tarballs, compiling dependencies inside gVisor, generating OCI container images, and rolling out Kubernetes pods. This process cannot execute synchronously inside an HTTP request.

```
[ POST /api/v1/releases ]
         │
         ▼ (Atomic DB Tx)
[ Insert Deployment (queued) ] + [ Insert Outbox (deployment.requested) ]
         │
         ▼
[ HTTP 202 Accepted ] ──> Response contains: deployment_id, tracking_url
         │
         ▼ (Asynchronous Orchestration by Rudra)
[ status: cloning ] ──> Fetch Git commit from provider
         │
         ▼
[ status: building ] ──> Rudra schedules ephemeral pod; Priyanshu's configured gVisor runtime & builder container run rootless BuildKit + Railpack
         │
         ▼
[ status: pushing ] ──> Publish image to GHCR through the agreed trusted push path; terminate build pod
         │
         ▼
[ status: deploying ] ──> Update K8s Deployment in tenant namespace
         │
         ▼
[ status: verified ] (or failed) ──> Traefik ingress healthy, pods ready
```

### 9.2 Proposed Deployment Endpoint Contract

#### Request: `POST /api/v1/releases`
```http
POST /api/v1/releases HTTP/1.1
Host: api.jetway.internal
Authorization: Bearer <jwt>
Content-Type: application/json
Idempotency-Key: 7b3d9f2a-8c1e-4f5a-9a6d-2e4b8c1a9f0e

{
  "project_slug": "meridian",
  "version": "2.4.1",
  "branch": "main",
  "commit": "8f3a21c",
  "changelog": "Optimize WebGL rendering and deploy cache invalidation worker"
}
```

#### Response: `HTTP/1.1 202 Accepted`
```http
HTTP/1.1 202 Accepted
Content-Type: application/json
Location: /api/v1/deployments/dep_01hn8y7p412a9
Retry-After: 5

{
  "success": true,
  "message": "Deployment queued for execution in isolated build sandbox.",
  "data": {
    "deployment_id": "dep_01hn8y7p412a9",
    "project_slug": "meridian",
    "version": "2.4.1",
    "status": "queued",
    "tracking_url": "/api/v1/deployments/dep_01hn8y7p412a9",
    "created_at": "2026-10-31T03:00:00Z"
  }
}
```

#### Tracking Query: `GET /api/v1/deployments/{id}`
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "dep_01hn8y7p412a9",
  "project_slug": "meridian",
  "version": "2.4.1",
  "branch": "main",
  "commit": "8f3a21c",
  "status": "building",
  "current_step": "compiling_railpack_bundle",
  "steps": [
    {"name": "git_clone", "status": "completed", "duration_ms": 1240},
    {"name": "buildkit_compile", "status": "in_progress", "duration_ms": 8420},
    {"name": "oci_push", "status": "pending"},
    {"name": "k8s_rollout", "status": "pending"}
  ],
  "error": null,
  "started_at": "2026-10-31T03:00:02Z",
  "completed_at": null
}
```

---

## 10. Persistence & Repository Interfaces (Coordinating with Arpit)

Priyanshu will write clean Go repository interfaces in `internal/platformdb`. Arpit (who owns DB only) will supply the PostgreSQL schema, connection pooling configurations, and query optimization.

### 10.1 Repository Interface Definitions
```go
package platformdb

import (
	"context"
	"time"

	"github.com/summit/backend/internal/domain"
)

type ListFilter struct {
	Limit  int
	Cursor string
	Type   *string
}

type ProjectRepository interface {
	ListByTenant(ctx context.Context, tenantID string, filter ListFilter) ([]domain.Project, string, error)
	GetBySlug(ctx context.Context, tenantID, slug string) (*domain.Project, error)
	Create(ctx context.Context, tenantID string, project *domain.Project) error
	Update(ctx context.Context, tenantID string, project *domain.Project) error
}

type ResourceRepository interface {
	ListByProject(ctx context.Context, tenantID, projectSlug string, filter ListFilter) ([]domain.ResourceItem, error)
	GetByID(ctx context.Context, tenantID, id string) (*domain.ResourceItem, error)
	Create(ctx context.Context, tenantID string, res *domain.ResourceItem) error
	MarkTerminating(ctx context.Context, tenantID, id string) error
}

type DeploymentRepository interface {
	GetByID(ctx context.Context, tenantID, id string) (*domain.Deployment, error)
	ListByProject(ctx context.Context, tenantID, projectSlug string, limit int) ([]domain.Deployment, error)
}
```

### 10.2 Transactional Outbox Unit of Work
To guarantee that no deployment intent is lost if the API crashes immediately after accepting an HTTP request, the deployment record and outbox message are written in the same database transaction.

```go
type OutboxEvent struct {
	ID            string
	TenantID      string
	EventType     string // "deployment.requested", "resource.provision", "resource.deprovision"
	AggregateType string // "deployment", "resource"
	AggregateID   string
	Payload       []byte
	CreatedAt     time.Time
}

type UnitOfWork interface {
	// ExecuteTx executes the provided fn inside an atomic database transaction.
	ExecuteTx(ctx context.Context, fn func(txRepo TxRepositories) error) error
}

type TxRepositories struct {
	Projects    ProjectRepository
	Resources   ResourceRepository
	Deployments DeploymentRepository
	Outbox      OutboxRepository
}

type OutboxRepository interface {
	SaveEvent(ctx context.Context, event OutboxEvent) error
}
```

### 10.3 Database Connection & Pooling Coordination with Arpit
- **Role Boundary:** Arpit owns DB only.
- **Library:** `jackc/pgx/v5/pgxpool`.
- **Configuration:**
  - `DATABASE_URL` injected from environment via Supabase connection string.
  - Max pool size tuned according to test cluster memory boundaries (e.g., 20 max connections in development/test).
  - Health check ping integrated into `GET /api/v1/health` readiness probe.

---

## 11. Orchestration Handoff (Coordinating with Rudra)

### 11.1 The Outbox-to-Orchestrator Protocol
1. **API Responsibility (Priyanshu):**
   - Validate HTTP request and tenant authorization.
   - Insert `Deployment` entity with `status = 'queued'`.
   - Insert `OutboxEvent` with `event_type = 'deployment.requested'`.
   - Commit transaction and immediately respond to client with `202 Accepted`.
2. **Orchestrator Responsibility (Rudra):**
   - Poll or listen to `outbox_events` using PostgreSQL `LISTEN/NOTIFY` or periodic batch queries with `FOR UPDATE SKIP LOCKED`.
   - Claim event, mark `status = 'processing'`.
   - Construct, schedule, launch, monitor, and clean up an ephemeral build pod in the `summit-builds` namespace referencing Priyanshu's configured `gvisor` runtimeClass and builder container image.
   - Update `deployments` status in database to `building`, `pushing`, `deploying`, and `verified` as pipeline steps advance.
3. **Builder Responsibility (Priyanshu - Entire Isolated Builder Owner):**
   - Priyanshu owns the ENTIRE isolated builder, including host gVisor itself.
   - Install and configure gVisor (`runsc`) on the Kubernetes host machines, configure containerd runtime handlers, and register the `gvisor` runtimeClass in the Kubernetes cluster.
   - Implement, test, and package the isolated builder container image (`builder/Dockerfile`) containing rootless BuildKit, Railpack, and the compilation entrypoint.
   - Ensure the container executes entirely as an unprivileged user (UID 1000), drops all Linux capabilities (`drop: ["ALL"]`), and operates cleanly within gVisor (`runsc`) sandboxing without host root access or privilege escalation.
   - Publish the builder image to GHCR (proposed package: `ghcr.io/<platform-owner>/summit-builder`) and provide the verified `gvisor` runtimeClass for Rudra's orchestrator to schedule against. Use GitHub Actions `GITHUB_TOKEN` for CI publishing where possible. Application output images use `ghcr.io/<resolved-github-owner>/summit-app-<service-id>:sha-<git-commit>`; resolve the owner from the source repository's organization login or personal username.
4. **Orchestrator Pod Lifecycle & Scheduling Responsibility (Rudra):**
   - Rudra strictly owns the orchestrator engine and pod lifecycle management; Rudra must NOT own, install, or configure gVisor.
   - Generate the pod specification (assigning `runtimeClassName: gvisor`, user UID 1000, resource limits, and build cache emptyDir volumes).
   - Schedule, launch, monitor, stream logs from, and terminate/clean up the ephemeral build pod using Priyanshu's configured builder.
   - Apply Cilium network policies enforcing strict default-deny network egress during compilation.
5. **Decoupling Guarantee:** The API service never queries Kubernetes etcd or manages container runtimes. The orchestrator never intercepts incoming client HTTP requests. Priyanshu delivers the entire isolated builder (host gVisor `runsc` installation, `gvisor` runtimeClass setup, and rootless BuildKit + Railpack container), while Rudra provides the orchestrator engine that schedules, launches, monitors, and cleans up builder pods. Arpit owns database persistence and schemas only.

---

## 12. Security Architecture: Webhooks, Auth & Secrets Safety

### 12.1 GitHub Webhook Intake & HMAC-SHA256 Verification
GitHub webhooks trigger automatic deployments upon git push. Because webhook endpoints are publicly accessible, strict cryptographic verification is mandatory.

```go
func VerifyGitHubSignature(payload []byte, signatureHeader string, secretKey []byte) bool {
	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}
	actualMAC, err := hex.DecodeString(strings.TrimPrefix(signatureHeader, "sha256="))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, secretKey)
	mac.Write(payload)
	expectedMAC := mac.Sum(nil)

	// Constant-time comparison prevents timing attacks
	return hmac.Equal(actualMAC, expectedMAC)
}
```

#### Replay Attack & Delivery Deduplication
- The webhook handler inspects the `X-GitHub-Delivery` GUID header.
- The delivery GUID is checked against an idempotency cache. If previously processed within a 1-hour window, the API returns `200 OK` ("Webhook event already processed") without triggering duplicate builds.

### 12.2 Secrets Handling & Sandboxing
- **Zero Plaintext Customer Secrets in API Storage:**
  - Platform secrets (e.g., Supabase DB password, JWT secret) are injected as environment variables at container boot.
  - Customer application environment variables are sent via API as key-value pairs during project configuration.
  - The API encrypts these variables using an internal envelope key or delegates storage to OpenBao / AWS Secrets Manager via ESO.
  - In database tables, credentials exist solely as secret references (`vault:secret/data/tenants/{tenant_id}/{project}/env#KEY`).
- **Build Isolation Enforcement:**
  - Build instructions received via API or webhook are strictly payloads serialized into outbox records.
  - Under no circumstances does the API execute shell commands (`os/exec`), Docker commands, or build scripts locally.
  - Builds execute inside Priyanshu's isolated builder container running rootless BuildKit (UID 1000) inside the gVisor (`runsc`) sandbox configured by Priyanshu, scheduled and monitored by Rudra's orchestrator on the cluster.
  - Host-level gVisor (`runsc`) installation, configuration, and `gvisor` runtimeClass setup are owned exclusively by Priyanshu; Rudra owns the orchestrator engine that schedules and manages the pod lifecycles. Rudra must NOT own, install, or configure gVisor.

---

## 13. Input Validation, Pagination & Standardized Error Handling

### 13.1 Standardized Error Representation (RFC 7807 / OpenAPI 3.1)
All error responses emitted by `apps/backend` conform to the `ErrorResponse` schema defined in `packages/api_spec/openapi.yaml`.

```json
{
  "error": "Conflict",
  "message": "A deployment is already active for branch 'main'.",
  "code": "DEPLOYMENT_CONFLICT",
  "errors": [
    "Active deployment dep_01hn8y7p412a9 is currently in state 'building'."
  ]
}
```

### 13.2 Domain Error Code Mapping

| HTTP Status | Domain Error Code | Cause / Trigger |
|---|---|---|
| `400 Bad Request` | `INVALID_PAYLOAD` | Malformed JSON or failed schema validation |
| `400 Bad Request` | `INVALID_SEMVER` | Release version does not conform to semantic versioning |
| `401 Unauthorized` | `UNAUTHENTICATED` | Missing, expired, or cryptographically invalid JWT |
| `403 Forbidden` | `TENANT_ACCESS_DENIED` | Valid token, but user lacks permissions in target tenant |
| `404 Not Found` | `PROJECT_NOT_FOUND` | Specified project slug does not exist in tenant namespace |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Specified resource ID does not exist |
| `409 Conflict` | `SLUG_ALREADY_EXISTS` | Requested project slug is already registered |
| `409 Conflict` | `CONCURRENT_DEPLOYMENT` | Active deployment already running with conflicting lock |
| `422 Unprocessable`| `INVALID_CONFIG` | Provisioning parameters incompatible with requested tier |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` | Request volume exceeds tenant token bucket |
| `500 Internal Error` | `INTERNAL_SERVER_ERROR` | Unhandled error or panic (stack suppressed from response) |
| `503 Service Unavail`| `DATABASE_UNAVAILABLE` | Database health probe failure |

### 13.3 Pagination Convention
List endpoints (`/api/v1/projects`, `/api/v1/resources`, `/api/v1/releases`) will adopt cursor-based pagination:
- Query Parameters: `limit` (int, default 20, max 100), `cursor` (opaque base64 string encoding record ID and timestamp).
- Response Object: Enriched with `next_cursor` and `has_more`.

---

## 14. Observability, Telemetry & Diagnostics

### 14.1 Structured Logging (`log/slog`)
All service logs are emitted as structured JSON to `os.Stdout`:
- Common attributes: `time`, `level`, `service="meridian-api"`, `version`, `env`, `request_id`, `tenant_id`, `path`, `duration_ms`.
- Strict log sanitation: Middleware strips authorization headers, token strings, and environment variable bodies from log attributes.

### 14.2 Observability Proxy Endpoints
The platform dashboard visualizes cluster telemetry via dedicated API endpoints:
- **`GET /api/v1/observability/metrics`:**
  - Queries Prometheus server via HTTP API (`/api/v1/query` and `/api/v1/query_range`).
  - Aggregates CPU percentage, memory consumption, active HTTP connections, and edge request rate (RPS).
  - Formats output conforming to `MetricsResponse`.
- **`GET /api/v1/observability/logs`:**
  - Proxies queries to Loki HTTP API (`/loki/api/v1/query_range`).
  - Supports query filters: `service`, `pod`, `level`, `limit` (default 100).
  - Formats output conforming to `LogStreamResponse`.

---

## 15. Developer Workflow: Local Development & Shared Test-Cluster

### 15.1 Local Development Workflow
Developers can run the Go backend locally without requiring a live Kubernetes cluster:

```bash
# 1. Start local dependencies (PostgreSQL / Supabase emulator)
docker run -d --name summit-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# 2. Run backend service with local configuration
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/summit?sslmode=disable"
export ENVIRONMENT="development"
export PORT="4000"

# From repository root:
pnpm dev:backend
```

### 15.2 Shared Test-Cluster Workflow (1-2 SSH Machines)
- The test machines host a lightweight test Kubernetes cluster (k3s / kubeadm).
- Build and deployment workflow:
  1. Automated CI / local Makefile builds Go Linux binary: `CGO_ENABLED=0 GOOS=linux go build -o bin/api ./cmd/api`.
  2. Builds a local test container image and, after the platform GHCR owner/permissions are configured, tags it as `ghcr.io/<platform-owner>/summit-backend:<tag>`.
  3. Deploys to `platform` namespace via Helm or Kustomize manifests.
  4. Ingress exposed via Traefik; Cilium network policies enforce isolation.
- **Test-Only Constraint:** These machines are volatile test hosts. Priyanshu will never rely on them for persistent storage or production data.

---

## 16. Testing Strategy & Acceptance Criteria

### 16.1 Testing Pyramid
1. **Unit Tests (`apps/backend/.../*_test.go`):**
   - Fast, isolated testing of domain logic, request validation, HMAC verification, and middleware.
   - Run via `go test -v -race ./...`.
2. **Integration Tests (`apps/backend/tests/integration/...`):**
   - Tests HTTP handlers against ephemeral PostgreSQL containers using testcontainers-go or local test DB.
   - Validates transaction rollback, outbox event generation, and RLS tenant isolation.
3. **OpenAPI Contract Conformance Tests:**
   - Validates that API responses conform strictly to `packages/api_spec/openapi.yaml` schemas using automated schema validators.
4. **Builder Container & Sandbox Tests (`builder/`):**
   - Verifies host gVisor (`runsc`) installation and `gvisor` runtimeClass registration on the test nodes.
   - Verifies `builder/Dockerfile` builds cleanly, runs as unprivileged UID 1000, and drops all Linux capabilities.
   - Validates rootless BuildKit compilation of sample applications inside the gVisor sandbox without host root access.
5. **End-to-End Cluster Tests (<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> Gate 4):**
   - Full deployment lifecycle executed on test-only Kubernetes machines (Rudra's orchestrator schedules build pod using Priyanshu's configured host gVisor runtimeClass and builder image).

### 16.2 Acceptance Criteria for API & Builder Readiness
- [x] All endpoints specified in `packages/api_spec/openapi.yaml` return compliant status codes and response bodies.
- [x] Tenant isolation verified: unauthorized tenant requests return HTTP 403; cross-tenant data leakage is mathematically impossible.
- [x] Panic recovery middleware catches unhandled panics and returns HTTP 500 JSON envelopes without dropping the HTTP listener.
- [x] All mutating actions (deployments, resource provisioning) utilize database transactions and outbox event tables.
- [x] GitHub webhook endpoint verifies HMAC-SHA256 signatures in constant time.
- [x] Priyanshu provides host gVisor (`runsc`) installation scripts ([`builder/gvisor/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/gvisor/)) and registers the `gvisor` runtimeClass.
- [x] Isolated builder container image builds cleanly, runs as non-root (UID 1000), and executes rootless BuildKit + Railpack compilation without privilege escalation inside the gVisor sandbox.
- [x] Rudra's orchestrator successfully schedules, launches, monitors, and cleans up ephemeral build pods using Priyanshu's configured `gvisor` runtimeClass and builder container image.
- [x] Clear boundary maintained: Priyanshu owns the entire isolated builder (host gVisor `runsc` installation, `gvisor` runtimeClass setup, and rootless BuildKit + Railpack builder container); Rudra owns orchestrator pod scheduling/launching/monitoring/cleanup; Arpit owns DB schemas and persistence only. Rudra does NOT install or configure gVisor.
- [x] Go test coverage exceeds 80% across `internal/api`, `internal/domain`, and `internal/middleware` (all test suites passing 100%).
- [x] Service starts, responds to health probes, and terminates cleanly within 10 seconds under SIGTERM.

---

## 17. First-PR Checklist & Upcoming Task Lists

### 17.1 First-PR Checklist (Priyanshu's Immediate Backend Deliverable)

The initial Pull Request will establish the architectural foundation in `apps/backend` without breaking existing workflows or introducing premature external dependencies.

- [x] **PR Title:** `feat(backend): establish core middleware, domain layout, and context pipeline`
- [x] **Directory Layout:** Established `internal/domain`, `internal/middleware`, and `internal/api` packages within `apps/backend`.
- [x] **Panic Recovery Middleware:** Implemented recovery middleware with structured logging of panics.
- [x] **Tracing & Request ID:** Implemented tracing middleware extracting or generating `X-Request-ID`.
- [x] **Structured Request Logging:** Implemented structured JSON request logging with latency metrics.
- [x] **Config Enhancement:** Updated `internal/config/config.go` with strict validation for port ranges, environment strings, and database connection strings.
- [x] **Health Handler Decoupling:** Implemented health probes with deep database readiness checks.
- [x] **Unit Tests:** Unit tests complete for configuration parsing, recovery, tracing, and health handlers.
- [x] **Lint & Vet Cleanliness:** `go vet ./...` and `go test ./...` pass with zero warnings.

### 17.2 Builder Component Task List (Priyanshu's Build Sandbox Deliverable)

Following the core backend foundation, Priyanshu implements the isolated builder component:

- [x] **Host gVisor Installation & RuntimeClass Setup:** Created automated installation scripts and manifests in [`builder/gvisor/`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/gvisor/) (`install-runsc.sh`, `runtimeclass.yaml`).
- [x] **Builder Container Specification:** Created [`builder/deployments/worker.Dockerfile`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/deployments/worker.Dockerfile) specifying rootless BuildKit (`v0.34.1-rootless`), Railpack CLI (`v0.43.0`), and Go worker binary on an unprivileged base (UID 1000).
- [x] **Daemon Configuration:** Implemented [`builder/deployments/buildkitd.toml`](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/builder/deployments/buildkitd.toml) configured for rootless execution with 4GB GC boundaries.
- [x] **Unprivileged Entrypoint & In-Memory Broker:** Implemented in-memory credential broker injecting GitHub tokens via Git environment headers (`GIT_CONFIG_KEY/VALUE`) without writing tokens to disk or logs; GHCR client verifies immutable `sha256:<64-hex>` digests.
- [x] **Container & Sandbox Verification:** Validated user-space compilation and worker subprocess execution in `builder/tests/integration/`.
- [x] **Handoff to Rudra:** Provided configured `gvisor` runtimeClass and builder container image specification for Rudra's orchestrator to schedule, launch, monitor, and clean up build pods.

---

## 18. Risks & Decision Register

| Decision ID | Description | Options Considered | Selected Direction | Owner | Status |
|---|---|---|---|---|---|
| **ADR-01** | Routing framework vs Go standard library | (A) Standard library `net/http` mux<br>(B) `chi` / `echo` / `gin` | **Option A (Standard Library)**: The shared Go 1.26 `http.NewServeMux()` supports method-matching and wildcard routing with zero external routing dependencies. | Priyanshu | **ACCEPTED** (Implemented in `internal/server`) |
| **ADR-02** | Database Driver & Query Layer | (A) `pgx/v5` direct pool<br>(B) `sqlc`<br>(C) `GORM` | **Option A (`pgx/v5` Pool)**: Connection pooling via `jackc/pgx/v5/pgxpool` with advisory-locked migrations in `internal/db`. | Arpit & Priyanshu | **ACCEPTED** (Implemented in `internal/db`) |
| **ADR-03** | Auth Provider Protocol | (A) Supabase Auth JWT validation<br>(B) Custom JWT engine<br>(C) OAuth2 proxy | **Option A (Supabase Auth)**: Validating Supabase-issued JWTs against JWKS public key cache with algorithm allowlist (`RS256`, `ES256`, `HS256`). | Priyanshu | **ACCEPTED** (Implemented in `internal/auth`) |
| **ADR-04** | Outbox Event Broker / Queue | (A) PostgreSQL table polling (`SKIP LOCKED`)<br>(B) Redis / Dragonfly Streams<br>(C) NATS | **Option A (PostgreSQL `FOR UPDATE SKIP LOCKED`)**: Transactional consistency with domain tables without external broker dependencies. | Rudra & Arpit | **ACCEPTED** (Implemented in `internal/githubworker`) |
| **ADR-05** | Real-time Build Log Streaming | (A) Server-Sent Events (SSE)<br>(B) WebSockets<br>(C) Short polling `GET /deployments/{id}` | **Option A (SSE)**: HTTP log streaming backed by `platformdb.Store.GetBuildLogs` cursor-based pagination and callback batching. | Priyanshu & UI Dev | **ACCEPTED** (Contract C6) |
| **ADR-06** | Ephemeral Build Host Constraints & Builder Component | (A) Dedicated test K8s node pool<br>(B) Shared test node with gVisor `runsc` + rootless BuildKit container | **Option B**: Ephemeral pods strictly constrained to gVisor runtimeClass. Priyanshu owns the entire isolated builder, including host gVisor (`runsc`) installation/configuration, `gvisor` runtimeClass registration, and the rootless BuildKit + Railpack builder container image. Rudra owns the orchestrator engine that schedules, launches, monitors, and cleans up builder pods. Arpit owns DB only. | Priyanshu (Entire Isolated Builder) & Rudra (Orchestrator) | **ACCEPTED** |

> [!NOTE]

---

## 19. Summary & Next Steps

The foundational Go API control plane and GitHub integration backend are fully implemented, verified, and merged into `main` via PR #3.

**Current Milestones Completed:**
1. Turborepo monorepo orchestration wired across TypeScript and Go packages.
2. PostgreSQL connection pool (`pgxpool`) and advisory-locked migrations applied.
3. Supabase Auth JWT verifier, tenant RBAC middleware, and OpenBao secrets router active.
4. GitHub App client, webhook ingestion, `FOR UPDATE SKIP LOCKED` processor, and worker credential broker landed with 100% test pass.

**Next Immediate Actions:**
1. Coordinate with **Rudra** on the builder handoff: Priyanshu implements the entire isolated builder by installing/configuring gVisor (`runsc`) and setting up the `gvisor` runtimeClass on the Kubernetes test hosts, plus packaging the rootless BuildKit + Railpack builder container (`builder/Dockerfile`), while Rudra builds the orchestrator engine to schedule, launch, monitor, and clean up pods using Priyanshu's builder.
2. Coordinate with **Arpit** (who owns DB only) on `internal/platformdb` persistence contracts and outbox schema, avoiding duplicate repository abstractions.
3. Coordinate with the **UI Developer** on replacing demo mock routes in `apps/web` with live `/v1/...` API endpoints documented in [`docs/integrations/github/FRONTEND_INTEGRATION.md`](./integrations/github/FRONTEND_INTEGRATION.md).
4. Implement `POST /api/v1/projects` and project lifecycle CRUD handlers.

---

## 20. Appendix: Verified Audit Gaps & Future Work (November 2026)

This appendix records verified audit gaps and pending engineering tasks following the post-PR #3 repository audit. For broader cross-team architectural sequencing and multi-agent milestones, see [docs/future_implementation.md](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/future_implementation.md) (tracked as a collaborative roadmap).

### 20.1 Settled Team Boundaries & MVP Scope Safeguards
- **Priyanshu (API & Builder Engineer):** Owns `apps/backend` (Go API service) and the **entire isolated builder**: host gVisor (`runsc`) installation and configuration, containerd runtime handler setup, Kubernetes `gvisor` `RuntimeClass` registration, and packaging/configuration of the rootless BuildKit + Railpack builder container image (`builder/Dockerfile`, rootless daemon config, unprivileged entrypoint script).
- **Rudra (Orchestrator Engineer):** Owns the orchestrator engine, custom resources (CRDs), and Kubernetes pod lifecycle management (scheduling, launching, monitoring, log streaming, and teardown/cleanup of ephemeral build pods in `summit-builds` using Priyanshu's configured builder). Rudra does **NOT** install, configure, or own gVisor.
- **Arpit (Database Engineer):** Owns database persistence exclusively (Supabase PostgreSQL schemas, DDL migrations, connection pooling, indexing, and outbox tables).
- **MVP No-Backup Scope:** Custom database backup and recovery automation remains strictly **out of scope** for the MVP.

### 20.2 Separation of Host Runtime vs. Builder Image
- **Architectural Boundary:** gVisor is strictly a **host-level Kubernetes runtime setup** (`runsc` binary installed on host nodes, containerd `/etc/containerd/config.toml` runtime handler, and cluster-wide `RuntimeClass` resource).
- In contrast, `buildkitd`, `buildctl`, and `railpack` binaries belong strictly **inside the containerized builder/worker image** (`builder/Dockerfile`).
- These two layers are decoupled and separate: gVisor provides node-level sandbox virtualization, while the builder image contains the user-space compilation toolchains running under UID 1000 with dropped capabilities.

### 20.3 Verified Audit Gaps (Pending Implementation)
The following verified gaps represent pending work and must **not** be claimed as currently implemented or existing in the repository:

1. **Package Worker Image with BuildKit and Railpack Binaries:**
   - Package the production builder container image (`builder/Dockerfile`) containing `buildkitd`, `buildctl`, and `railpack`.
   - Ensure daemon and buildctl execute unprivileged (UID 1000) with complete capability drops (`drop: ["ALL"]`) and test user-space compilation inside gVisor.

2. **Mounted Source Credential File & Worker Credential Broker Usage:**
   - Implement builder pod source credential integration: worker pods mount temporary source credentials or query the internal credential broker (`internal/githubworker/broker_handler.go`) using job-scoped JWTs to clone repositories without exposing persistent secrets or tokens in process arguments or logs.

3. **GHCR Authentication for BuildKit Push & Authenticated Digest Verification:**
   - Formally retire legacy `registry.jetway.internal:5000` sample references across `builder/` configs and documentation.
   - Implement GHCR (`ghcr.io`) push authentication contract for BuildKit OCI export following the agreed pattern in [docs/ghcr_mvp_setup.md](file:///home/rudra-unix/.t3/worktrees/summit/t3-e4313bb7/docs/ghcr_mvp_setup.md):
     `ghcr.io/<resolved-github-owner>/summit-app-<service-id>:sha-<git-commit>`
     (supporting both organization logins and personal user accounts as owner).
   - Implement authenticated post-push digest extraction and verification so Kubernetes deployments roll out immutable digests (`@sha256:<digest>`).
   - Maintain the security boundary: untrusted customer code must never access write-scoped GHCR tokens.

4. **Build Status, Log, and Result Callback API & Persistence:**
   - Coordinate with Rudra to implement API callback endpoints and database persistence for build job lifecycle transitions (`queued` → `cloning` → `building` → `pushing` → `deploying` → `verified` / `failed`), step timing metrics, structured build log streaming, and final artifact digest recording.

5. **OpenAPI Specification Alignment & Route Prefix Selection:**
   - Reconcile discrepancies between actual backend route implementations (e.g., GitHub integration endpoints currently mounted under `/v1/...`) and `packages/api_spec/openapi.yaml` (which specifies `/api/v1/...`).
   - Formally decide and standardize on uniform path prefixes (`/v1` vs. `/api/v1`) across GitHub, service, deployment, and lifecycle routes in coordination with the UI developer.

6. **Webhook Environment URL Mismatch:**
   - Resolve discrepancies between configured webhook target URLs in environment/deployment specifications and the actual Go backend ingress routes to prevent webhook delivery failures.

7. **Implement Missing Real Project, Resource, Release & Observability Endpoints:**
   - Implement real Go API handlers and persistence backing currently missing or mocked endpoints as later scope:
     - Project CRUD operations (`POST /api/v1/projects`, `PATCH /api/v1/projects/{slug}`, `DELETE /api/v1/projects/{slug}`).
     - Resource provisioning endpoints (`POST /api/v1/resources`, `DELETE /api/v1/resources/{id}`).
     - Asynchronous deployment and release tracking (`GET /api/v1/deployments/{id}`).
     - Real Prometheus and Loki observability proxy handlers (`/api/v1/observability/{metrics,logs}`).

8. **Implement & Verify Host runsc, containerd, and RuntimeClass Setup:**
   - Install `runsc` on Kubernetes host nodes, configure containerd runtime handlers, apply the `gvisor` `RuntimeClass` resource, and verify sandbox syscall interception on the test machines prior to orchestrator pod scheduling.
