# Go API Control Plane Implementation Plan

**Owner:** Priyanshu (API Engineer)  
**Collaborators:** Rudra (Orchestrator Engineer), Arpit (Database Engineer), UI Developer (Frontend / Dashboard Owner)  
**Target Component:** `apps/backend` (Go 1.23 service)  
**API Contract:** `packages/api_spec/openapi.yaml` (OpenAPI 3.1)  
**Status:** DRAFT / PROPOSAL FOR BACKEND REVIEW  
**Date:** October 2026  

---

## 1. Executive Summary & Context

The Summit Jetway platform is an edge-native developer platform and PaaS control plane. The system architecture (`docs/system_architechture.png`) comprises a central `platform` control-plane namespace containing the Go API service, an administrative dashboard (`apps/web`), a Supabase PostgreSQL platform database, a transactional job queue/outbox, and a Go-based Kubernetes operator/orchestrator managing Custom Resource Definitions (CRDs). Customer builds are executed inside an ephemeral, sandboxed gVisor (`runsc`) pool using rootless BuildKit and Railpack to build OCI images, which are pushed to an internal registry before the build pod is terminated. Tenant workloads, persistent volumes, and databases execute within isolated tenant namespaces protected by Cilium network policies and Traefik ingress routing.

This document serves as the definitive, actionable implementation plan for **Priyanshu** (API Engineer). It defines how the Go HTTP control plane in `apps/backend` will evolve from its current minimal scaffold into a robust, high-performance, and secure API service.

---

## 2. Role, Scope & Non-Goals

### 2.1 Owner Role & Core Responsibilities
- **Owner:** Priyanshu (API Engineer).
- **Core Scope:**
  - Architecture, design, and implementation of the Go HTTP service within `apps/backend`.
  - HTTP routing, request deserialization, payload validation, and response serialization.
  - Core HTTP middleware pipeline: authentication verification, tenant extraction, request tracing (`X-Request-ID`), structured logging (`log/slog`), panic recovery, rate limiting, and CORS.
  - Contract lifecycle management: driving the OpenAPI-first evolution in `packages/api_spec/openapi.yaml` in lockstep with the UI developer.
  - Clean repository abstraction interfaces (`internal/platformdb`) coordinating with Arpit on Supabase PostgreSQL persistence models.
  - Orchestration dispatch abstraction (`internal/orchestrator` / transactional outbox) coordinating with Rudra on asynchronous build and deployment lifecycles.
  - External webhook intake and security (GitHub HMAC-SHA256 signature verification and replay prevention).
  - Telemetry read APIs: exposing aggregated Prometheus metrics and Loki structured log streams to the frontend dashboard.
  - API automated test suites (unit, integration, and contract tests).

### 2.2 Cross-Functional Teammates & Interfaces
- **Arpit (Database Engineer):** Owns Supabase Postgres schemas, DDL migrations, connection pooling (`pgxpool`), database indexing, transaction semantics, and Row-Level Security (RLS) policies. Priyanshu consumes repository interfaces implemented or reviewed by Arpit.
- **Rudra (Orchestrator Engineer):** Owns the Kubernetes controller/operator, custom resources (`CRDs`), the gVisor ephemeral build sandbox pool, rootless BuildKit integration, Traefik ingress routing configurations, and Cilium network policies. Priyanshu hands off intent via the database outbox and reads status without directly coupling HTTP requests to K8s API server load.
- **UI Developer (Frontend Owner):** Owns `apps/web` (Next.js dashboard). Priyanshu coordinates all breaking changes, schema additions, error envelopes, and polling/streaming mechanisms against `packages/api_spec/openapi.yaml`.

### 2.3 Explicit Non-Goals for the API Service
- **No Direct Container/Build Execution:** Customer builds must NEVER run inside the control-plane Go process or on the bare host. All build executions are strictly delegated to Rudra's sandboxed gVisor pool.
- **No Direct Kubernetes API Mutation in HTTP Handlers:** HTTP handlers must not issue synchronous `client-go` create/update calls against Kubernetes etcd. State changes are persisted to the platform database and picked up by Rudra's reconciliation loop.
- **No Plaintext Secret Storage:** The API service must never persist or log raw customer secrets (database passwords, API tokens, webhook secrets). Plaintext secrets are brokered via OpenBao and AWS Secrets Manager using the External Secrets Operator (ESO).
- **No Monorepo Split:** The Go service remains inside `apps/backend` within the existing repository structure.

---

## 3. Current Repository Baseline & Audit

### 3.1 Existing Repository State
An inspection of the workspace reveals:
- **`apps/backend`:**
  - Defined as Go module `github.com/summit/backend` (Go 1.23).
  - Uses strictly standard library dependencies (`net/http`, `log/slog`, `os/signal`, `time`).
  - `cmd/api/main.go`: Initializes logging, loads environment configuration, boots the HTTP server, and traps `SIGINT`/`SIGTERM` with a 10-second graceful shutdown timeout.
  - `internal/config/config.go`: Parses `PORT` (default `4000`), `HOST`, `SERVICE_NAME` (`meridian-api`), `SERVICE_VERSION` (`1.0.0`), `REGION` (`cdg-1 (Paris)`), `EDGE_ROUTING` (`anycast`), and `ENVIRONMENT`.
  - `internal/health/handler.go`: Implements `GET /api/v1/health` and `GET /health` responding with `HealthResponse`.
  - `internal/server/server.go`: Sets up `http.ServeMux`, wraps it with basic CORS (`*`) and debug logging middleware.
  - **Status:** Functional health check scaffold only. No database connection, no authentication, no project/release/resource endpoints implemented.
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
- **Dispatch and persistence:** a PostgreSQL transactional outbox is the recommended Phase 1 option, not a settled fact. If approved, Arpit owns its schema and shared Go persistence contracts under `apps/backend/internal/platformdb`; Priyanshu and Rudra consume those contracts. Do not create competing `internal/platformdb` and `internal/platformdb` abstractions.
- **Infrastructure details:** exact providers, queue technology, schema/migration tools, leases, retention, backup/PITR support, and resource limits remain decisions until verified against selected services and the test cluster. The architecture diagram does not establish those implementation details.

To guarantee operational alignment across the platform, the following four architecture gates are shared across all three backend owners (Priyanshu, Rudra, and Arpit). Each gate requires joint sign-off before implementation or promotion.

---

### Gate 1: Tenant/Auth Identity and Isolation Boundary
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Define the end-to-end identity propagation model from the HTTP request down to database queries and Kubernetes tenant namespaces.
  - Standardize authentication and tenant context after selecting an identity provider; validate its signed tokens and resolve membership/role server-side.
  - Establish database tenant isolation: Arpit configures Row-Level Security (RLS) policies or strict `tenant_id` foreign key tenancy in Supabase PostgreSQL; Priyanshu ensures every repository call injects verified tenant context.
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
  - Evaluate and, if approved, establish a PostgreSQL transactional outbox: Priyanshu writes deployment records and outbox events in one transaction; Arpit owns its schema and concurrency design; Rudra consumes dispatch events and schedules reconciliation.
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
  - Enforce build sandbox constraints: Customer code builds execute exclusively within ephemeral gVisor (`runsc`) pods via rootless BuildKit + Railpack, pushing to an in-cluster OCI registry, with immediate pod destruction upon completion. No build steps may execute inside the API service container.
  - Ingress & Network isolation: Rudra configures Traefik ingress controller routing and Cilium network policies. Priyanshu defines required routing rules for custom tenant domains and platform API routing.
  - Secrets Management conventions: Integration of OpenBao & AWS Secrets Manager via External Secrets Operator (ESO). The API stores only secret references/metadata in Postgres; Rudra synchronizes secret values directly into tenant Kubernetes secrets.
- **Required Deliverables:**
  1. Test cluster deployment manifest and namespace layout documentation.
  2. Verified gVisor runtime configuration and non-root BuildKit profile.
  3. Secret reference exchange contract between API and Orchestrator.

---

### Gate 4: End-to-End Acceptance on Test-Only Machines with Migration/Security Review
<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>

- **Scope & Objectives:**
  - Execute end-to-end platform validation on the test-only Kubernetes machines before any production rollout.
  - Workflow under test: Developer pushes commit / triggers deploy via API &rarr; API validates auth, writes deployment & outbox record &rarr; Orchestrator claims outbox event &rarr; Ephemeral gVisor worker builds OCI image &rarr; Image pushed to registry &rarr; Tenant deployment updated in tenant namespace &rarr; Traefik ingress routes traffic &rarr; Cilium enforces network boundary &rarr; Metrics/logs emitted to Prometheus/Loki &rarr; API streams logs/metrics back to dashboard.
  - Comprehensive Database Migration & Rollback Review: Validate Arpit’s forward and rollback migrations against populated test datasets without service interruption.
  - Security Penetration & Compliance Review: Verify non-root enforcement, gVisor syscall filtering, egress firewalls, lack of secret leakage in logs, and tenant isolation integrity.
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
│   ├── repository/                     # Persistence Abstraction Interfaces (Coordinated with Arpit)
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
```

### Package Boundary Rules
1. `internal/domain` has **zero external dependencies** and does not import `net/http` or database drivers.
2. `internal/api` depends only on `internal/domain`, `internal/platformdb`, and standard library HTTP packages.
3. `internal/platformdb` declares pure Go interfaces for database operations; concrete PostgreSQL implementations (`pgxpool`) are injected at `cmd/api/main.go`.
4. `internal/orchestrator` declares event publishing interfaces; the HTTP handlers never directly call Kubernetes client libraries.

---

## 6. Phased Implementation Roadmap & Deliverables

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Foundations & Contract Realignment (Priyanshu + UI Dev + Arpit + Rudra)       │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Core Middleware, Tenant Context & Security Infrastructure (Priyanshu)         │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 1: Tenant & Auth Isolation)                     │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Persistence Abstractions & Core CRUD Endpoints (Priyanshu + Arpit)            │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Asynchronous Deployment Pipeline & Orchestrator Outbox (Priyanshu + Rudra)    │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 2: Deployment & Outbox Lifecycle)                 │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Webhook Ingress, Secret Safety & Observability Streams (Priyanshu)            │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 3: Test Cluster, Ingress & Secrets)                │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Test-Cluster Integration, Hardening & Acceptance (Priyanshu + Rudra + Arpit)  │
│ └── <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> (Shared Gate 4: End-to-End Acceptance on Test Cluster)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 0: Foundations, Contract Realignment & Tooling
- **Owner:** Priyanshu
- **Collaborators:** UI Developer, Arpit, Rudra
- **Deliverables:**
  1. **OpenAPI 3.1 Spec RFC:** Propose contract amendments in `packages/api_spec/openapi.yaml` covering missing routes (project creation, deployment status, GitHub webhook) and submit for UI Developer review.
  2. **Go Module Dependencies:** Initialize `go.sum` with necessary foundational libraries:
     - Router/HTTP: Go 1.23 `net/http` standard library enhanced pattern matching.
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
- **Collaborators:** Arpit (Database Engineer), UI Developer
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

### Phase 3: Asynchronous Deployment Pipeline & Orchestrator Outbox
- **Owner:** Priyanshu
- **Collaborators:** Rudra (Orchestrator Engineer), Arpit (Database Engineer)
- **Shared Gate Alignment:** <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> **Gate 2 (Deployment Lifecycle & Outbox Contract)**
- **Deliverables:**
  1. `internal/platformdb/outbox.go`: Transactional unit-of-work interface executing deployment record creation and outbox event insertion atomically.
  2. `internal/middleware/idempotency.go`: Validates `Idempotency-Key` header, caching execution states to prevent duplicate triggering of builds.
  3. `internal/api/release_handler.go`:
     - `POST /api/v1/releases`: Accepts build request, validates branch/commit/version, inserts outbox record, and returns `202 Accepted` with tracking URL.
     - `GET /api/v1/releases`: Lists historical releases for the tenant.
     - `GET /api/v1/deployments/{id}` (New Contract): Returns real-time deployment status (`queued`, `building`, etc.), step timestamps, and error summaries read from database.
  4. **Failure Recovery:** Standardized error mapping when database transaction or outbox write fails.

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
  4. Conduct joint E2E deployment test: trigger commit &rarr; gVisor build &rarr; tenant rollout &rarr; log streaming.
  5. Security and vulnerability audit: confirm no control-plane container escape vectors, non-root execution, and strict Cilium network isolation.

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
- If no valid JWT is supplied &rarr; return HTTP `401 Unauthorized`.
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
| `POST /api/v1/projects` | **Missing from Spec** | Add creation schema: `name`, `slug`, `framework`, `region` | Required for self-service project creation | UI Developer, Arpit |
| `GET /api/v1/projects/{slug}` | Defined in Spec | Retain schema; refine service status details | Returns real-time status of web/worker/db pods | UI Developer, Rudra |
| `GET /api/v1/resources` | Defined in Spec | Add pagination and environment filtering | Enables filtering by `production` vs `staging` | UI Developer |
| `POST /api/v1/resources` | Defined in Spec | Update response to indicate asynchronous provisioning (`202 Accepted`) | Resource provisioning (DB, Redis) takes time | UI Developer, Arpit |
| Proposed deployment endpoint | Not in current contract | Add `POST /api/v1/projects/{slug}/deployments` returning `202 Accepted`, plus status lookup | Builds are asynchronous; HTTP request cannot wait for completion | UI Developer, Rudra, Arpit |
| `GET /api/v1/deployments/{id}` | **Missing from Spec** | Add deployment tracking endpoint (status, step logs, timings) | Enables dashboard build progress bar and live steps | UI Developer, Rudra |
| `POST /api/v1/webhooks/github`| **Missing from Spec** | Add webhook endpoint with signature validation schemas | Automated Git-push deployments | Rudra |
| `GET /api/v1/observability/logs`| Defined in Spec | Add timestamp range (`since`, `until`) and streaming/SSE | Enables historical audit and live log tailing | UI Developer |

### 8.2 Change Coordination Workflow with UI Developer
1. **Drafting:** Priyanshu creates an OpenAPI diff branch amending `packages/api_spec/openapi.yaml`.
2. **Type Generation:** Run `pnpm typecheck:api` to verify TypeScript contract generation in `packages/api_spec`.
3. **UI Review:** Priyanshu tags the UI Developer to review schema diffs, ensuring request/response shapes match dashboard component expectations.
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
[ status: building ] ──> Ephemeral gVisor Pod runs rootless BuildKit + Railpack
         │
         ▼
[ status: pushing ] ──> Push image to internal OCI registry; terminate build pod
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

Priyanshu will write clean Go repository interfaces in `internal/platformdb`. Arpit will supply the PostgreSQL schema, connection pooling configurations, and query optimization.

### 10.1 Repository Interface Definitions
```go
package repository

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
   - Launch ephemeral gVisor build pod with rootless BuildKit.
   - Update `deployments` status in database to `building`, `pushing`, `deploying`, and `verified` as pipeline steps advance.
3. **Decoupling Guarantee:** The API service never queries Kubernetes etcd or manages container runtimes. The orchestrator never intercepts incoming client HTTP requests.

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
  2. Builds test container image: `podman build -t registry.test.internal/summit/backend:latest -f apps/backend/Dockerfile .`
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
4. **End-to-End Cluster Tests (<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span> Gate 4):**
   - Full deployment lifecycle executed on test-only Kubernetes machines.

### 16.2 Acceptance Criteria for API Readiness
- [ ] All endpoints specified in `packages/api_spec/openapi.yaml` return compliant status codes and response bodies.
- [ ] Tenant isolation verified: unauthorized tenant requests return HTTP 403; cross-tenant data leakage is mathematically impossible.
- [ ] Panic recovery middleware catches unhandled panics and returns HTTP 500 JSON envelopes without dropping the HTTP listener.
- [ ] All mutating actions (deployments, resource provisioning) utilize database transactions and outbox event tables.
- [ ] GitHub webhook endpoint verifies HMAC-SHA256 signatures in constant time.
- [ ] Go test coverage exceeds 80% across `internal/api`, `internal/domain`, and `internal/middleware`.
- [ ] Service starts, responds to health probes, and terminates cleanly within 10 seconds under SIGTERM.

---

## 17. First-PR Checklist (Priyanshu's Immediate Deliverable)

The initial Pull Request will establish the architectural foundation in `apps/backend` without breaking existing workflows or introducing premature external dependencies.

- [ ] **PR Title:** `feat(backend): establish core middleware, domain layout, and context pipeline`
- [ ] **Directory Layout:** Create `internal/domain`, `internal/middleware`, and `internal/api` packages within `apps/backend`.
- [ ] **Panic Recovery Middleware:** Implement `internal/middleware/recovery.go` with structured logging of panics.
- [ ] **Tracing & Request ID:** Implement `internal/middleware/tracing.go` extracting or generating `X-Request-ID`.
- [ ] **Structured Request Logging:** Implement `internal/middleware/logger.go` emitting JSON logs with execution latency.
- [ ] **Config Enhancement:** Update `internal/config/config.go` with strict validation for port ranges, environment strings, and database connection strings.
- [ ] **Health Handler Decoupling:** Refactor `internal/health/handler.go` into `internal/api/health_handler.go`.
- [ ] **Unit Tests:** Add unit tests for configuration parsing, recovery middleware, tracing middleware, and health handler.
- [ ] **Lint & Vet Cleanliness:** Ensure `pnpm lint` (`go -C apps/backend vet ./...`) and `pnpm build` pass with zero warnings.

---

## 18. Risks & Decision Register

Decisions not currently established by the repository baseline remain explicitly **OPEN** and will be finalized through the joint Backend Review.

| Decision ID | Description | Options Considered | Recommended Direction | Owner | Status |
|---|---|---|---|---|---|
| **ADR-01** | Routing framework vs Go 1.23 standard library | (A) Standard library `net/http` mux<br>(B) `chi` / `echo` / `gin` | **Option A (Standard Library)**: Go 1.23 mux supports methods and wildcard path routing (`GET /api/v1/projects/{slug}`) with zero external dependencies. | Priyanshu | **PROPOSED** |
| **ADR-02** | Database Driver & Query Layer | (A) `pgx/v5` direct pool<br>(B) `sqlc`<br>(C) `GORM` | **Option B (`sqlc` over `pgx`)**: Type-safe Go code generated directly from Arpit's raw SQL migrations. | Arpit & Priyanshu | **OPEN** |
| **ADR-03** | Auth Provider Protocol | (A) Supabase Auth JWT validation<br>(B) Custom JWT engine<br>(C) OAuth2 proxy | **Option A (Supabase Auth)**: Validating Supabase-issued JWTs against JWKS public key cache in middleware. | Priyanshu | **PROPOSED** |
| **ADR-04** | Outbox Event Broker / Queue | (A) PostgreSQL table polling (`SKIP LOCKED`)<br>(B) Redis / Dragonfly Streams<br>(C) NATS | **Option A initially**: Simplest transactional guarantees with Supabase Postgres; migrate to NATS if volume exceeds 500 events/sec. | Rudra & Arpit | **OPEN** |
| **ADR-05** | Real-time Build Log Streaming | (A) Server-Sent Events (SSE)<br>(B) WebSockets<br>(C) Short polling `GET /deployments/{id}` | **Option A (SSE)**: Simpler HTTP/2 streaming over Traefik; falls back to polling if client connection drops. | Priyanshu & UI Dev | **OPEN** |
| **ADR-06** | Ephemeral Build Host Constraints | (A) Dedicated test K8s node pool<br>(B) Shared test node with gVisor `runsc` | **Option B**: Ephemeral pods strictly constrained to gVisor runtimeClass to protect test host integrity. | Rudra | **PROPOSED** |

---

## 19. Summary & Next Steps

This plan provides a complete, sequenced, and standalone blueprint for Priyanshu to construct the Go API control plane. 

**Immediate Actions:**
1. Review this document with **Rudra** (Orchestrator) and **Arpit** (Database) to validate the four shared architecture gates (<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>).
2. Present the OpenAPI RFC and contract gap proposals to the **UI Developer** for frontend dashboard alignment.
3. Execute the **First-PR Checklist** to establish the core middleware and domain structures in `apps/backend`.
