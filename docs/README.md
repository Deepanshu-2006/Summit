# Summit Documentation Index & Architecture Map

Welcome to the central documentation index for the **Summit** (Jetway) edge-native Developer Platform-as-a-Service (PaaS) control plane.

---

## 1. System Architecture Overview

Summit connects developer Git workflows to Kubernetes execution for user-owned projects.

![System Architecture](./system_architechture.png)

### Key Architectural Tenets
- **User-Owned Projects:** Supabase Auth identifies the user who owns each project. Platform access is scoped through `user_id` and `project_id`; GitHub identity remains separate from Summit login.
- **Transactional Outbox Dispatch:** Asynchronous build, deploy, and infrastructure provisioning operations are committed transactionally to `outbox_events` and consumed via PostgreSQL row-locking (`FOR UPDATE SKIP LOCKED`).
- **Untrusted Code Containment:** All customer code compilation runs exclusively inside ephemeral **gVisor (`runsc`)** sandbox pods using **rootless BuildKit** and **Railpack**. Priyanshu owns the builder and host gVisor setup; Rudra owns pod scheduling and lifecycle.
- **MVP OCI Registry:** GHCR (`ghcr.io`) is the proposed external registry, avoiding an in-cluster registry service on the test hosts. The source repository owner selects the image namespace and push identity; this registry rule does not change Summit's user-owned project model. See [`ghcr_mvp_setup.md`](./ghcr_mvp_setup.md); visibility and push authentication still need confirmation.
- **Zero Secrets in Platform DB:** Secret values are never stored in plaintext or ciphertext in the platform database; External Secrets Operator (ESO) and OpenBao synchronize credentials into user-scoped Kubernetes namespaces.

---

## 2. Core Implementation Plans

The [Managed Agents Subsystem Specification](./managed-agents-spec.md) defines the draft Go/Rivet/Pi Durable integration, user-owned records, sandbox boundary, runtime contracts, and recovery acceptance checks.

The complete slide-by-slide presentation deck and pitch preparation suite is available at **[`docs/presentation/00_INDEX_AND_DECK_OUTLINE.md`](./presentation/00_INDEX_AND_DECK_OUTLINE.md)**.

The control plane is divided into three primary engineering domains with explicit ownership boundaries:

| Engineer / Role | Subsystem & Scope | Target Implementation Doc | Current Status |
|---|---|---|---|
| **Priyanshu**<br>*(API & Builder Engineer)* | Go HTTP control plane, REST endpoints, middleware, GitHub integration, and the complete isolated builder (host gVisor setup, rootless BuildKit, Railpack, and builder image) | [`docs/implementation_priyanshu.md`](./implementation_priyanshu.md) | **ACTIVE**<br>API foundation and GitHub integration merged; builder remains |
| **Arpit**<br>*(Platform Database Engineer)* | Supabase Postgres platform persistence, relational schemas, migrations, advisory locks, connection pooling (`pgxpool`), and transactional outbox | [`docs/implementation_arpit.md`](./implementation_arpit.md) | **ACTIVE**<br>Migrations 0001–0004 and the outbox schema are in the repository; application to a target database is environment-specific |
| **Rudra**<br>*(Orchestrator & Cluster Controller)* | Outbox reconciler, Kubernetes scheduling and build pod lifecycle, CRDs, Cilium network policies, Traefik ingress, and ESO; uses Priyanshu's configured builder/runtime | [`docs/implementation_rudra.md`](./implementation_rudra.md) | **ACTIVE**<br>Build-event queue and workload reconciliation code are present; managed-agent event handling remains |

---

## 3. GitHub Integration Backend Suite

The complete backend specification, frontend integration contracts, and verification reports for the GitHub integration:

- **[`docs/integrations/github/GITHUB_INTEGRATION_BACKEND_SPEC.md`](./integrations/github/GITHUB_INTEGRATION_BACKEND_SPEC.md):** Canonical 7-phase technical specification covering the data model, security boundaries, GitHub App client, raw HMAC webhook processing, build worker credential broker, and error taxonomy.
- **[`docs/integrations/github/FRONTEND_INTEGRATION.md`](./integrations/github/FRONTEND_INTEGRATION.md):** Frontend and MCP integration guide containing sequence diagrams, HTTP contract definitions, curl payloads, error codes, and tool schemas.
- **[`docs/integrations/github/IMPLEMENTATION_REPORT.md`](./integrations/github/IMPLEMENTATION_REPORT.md):** Complete implementation verification report documenting the 15 backend packages, 9 atomic conventional commits, multi-agent review resolutions, and 100% passing test coverage.

---

## 4. API Specification & Contract

- **`packages/api_spec/openapi.yaml`:** Authoritative OpenAPI 3.1 specification for the platform REST API.
- **`packages/api_spec/`:** TypeScript types compiled from the specification for consume by `apps/web`.

## 5. MVP OCI Registry

- [`ghcr_mvp_setup.md`](./ghcr_mvp_setup.md): GHCR application image naming, owner resolution, pull authentication, cluster setup, and the open trusted-push credential decision.

---

## 6. Repository Subsystem & Package Map

```text
Summit Monorepo (Turborepo 2.11+)
├── apps/
│   ├── backend/                              # Go 1.26 API Control Plane, Orchestrator & Worker Engine
│   │   ├── cmd/
│   │   │   ├── api/                          # Server executable & background worker spawner
│   │   │   ├── orchestrator/                 # Outbox and Kubernetes orchestration daemon
│   │   │   └── migrate/                      # Advisory-locked database migration CLI
│   │   └── internal/
│   │       ├── audit/                        # Redacted audit event logger
│   │       ├── auth/                         # Supabase JWT verifier (JWKS / HS256) & user sync
│   │       ├── authz/                        # User/project authorization middleware and permission matrix
│   │       ├── config/                       # Environment configuration parser
│   │       ├── db/                           # pgxpool lifecycle & schema migration runner
│   │       │   └── migrations/               # 0001 through 0004 platform schema migrations
│   │       ├── githubapi/                    # HTTP handlers: installations, repos, sources, deploys
│   │       ├── githubapp/                    # GitHub App REST client, RS256 JWT, token cache
│   │       ├── githubwebhook/                # Raw HMAC-SHA256 verifier & event normalizer
│   │       ├── githubworker/                 # Async SKIP LOCKED poller & worker credential broker
│   │       ├── orchestrator/                  # Outbox worker, build lifecycle, monitor, and reconciliation loops
│   │       ├── platformdb/                    # User-scoped PostgreSQL persistence for projects and deployments
│   │       ├── health/                       # Health check endpoints
│   │       ├── httpx/                        # RFC 7807 JSON error envelopes & response helpers
│   │       ├── installstate/                 # Single-use CSRF/state generator & SHA-256 verifier
│   │       ├── secrets/                      # OpenBao AppRole client & multi-tier secrets router
│   │       ├── server/                       # HTTP multiplexer & graceful shutdown handler
│   │       ├── sourcepath/                   # Path traversal & root directory sanitizer
│   │       └── testutil/                     # Isolated schema test database runner
│   └── web/                                  # Next.js 16 Console Dashboard (Prototype Mocks)
├── docs/                                     # Architecture & Implementation Plans
│   ├── integrations/github/                  # GitHub Integration spec, frontend guide & report
│   ├── implementation_arpit.md               # Arpit: Database & Outbox Plan
│   ├── implementation_priyanshu.md           # Priyanshu: Go API Control Plane Plan
│   ├── implementation_rudra.md               # Rudra: Orchestrator & Kubernetes Engine Plan
│   ├── managed-agents-spec.md                 # User-owned Go/Rivet/Pi Durable subsystem proposal
│   ├── adr/0001-shared-managed-agent-runtime.md # Shared runtime decision and Gate 1 conditions
│   ├── ghcr_mvp_setup.md                     # Proposed external OCI registry setup for MVP
│   └── system_architechture.png              # System Architecture Diagram
├── packages/
│   └── api_spec/                             # OpenAPI 3.1 Contract & Generated TypeScript types
├── poc-managed-agents/                       # Partial Gate 1 Rivet/Pi Durable feasibility PoC
├── turbo.json                                # Turborepo pipeline configuration
├── package.json                              # Workspace root scripts & dependency definitions
└── CONTEXT.md                                # Summit domain and managed-agent glossary
```

---

## 7. Current Implementation Status Matrix

| Subsystem | Area | Current State | Target Owner | References |
|---|---|---|---|---|
| **Monorepo** | Turborepo Pipeline | **Complete** (forced production build, lint, typecheck, and backend tests passed in this review) | Team | [`turbo.json`](../turbo.json) |
| **API** | Health Probes | **Complete** (`/api/v1/health`, `/health`) | Priyanshu | [`internal/health`](../apps/backend/internal/health) |
| **API / Auth** | Supabase JWT & RBAC | **Complete** (JWKS caching, algorithm allowlists, RBAC) | Priyanshu | [`internal/auth`](../apps/backend/internal/auth) |
| **API / GitHub** | Installations & Repos | **Complete** (OAuth callback, repo sync, sources, deploys) | Priyanshu | [`internal/githubapi`](../apps/backend/internal/githubapi) |
| **Webhooks** | Ingestion & Queue | **Complete** (Raw HMAC, deduplication, `SKIP LOCKED` worker) | Priyanshu | [`internal/githubworker`](../apps/backend/internal/githubworker) |
| **Security** | Secrets Management | **Complete** (OpenBao AppRole, dev fallback controls) | Priyanshu / Arpit | [`internal/secrets`](../apps/backend/internal/secrets) |
| **Security** | Kubernetes NetworkPolicy | **Standard NetworkPolicy enforcement verified on the local Kind 1.37 kindnet cluster** (denied ingress blocked; explicit source allow succeeded) | Rudra | [`internal/cluster/addons`](../apps/backend/internal/cluster/addons), [`mvp_runtime_contracts.md`](./mvp_runtime_contracts.md) |
| **Database** | Migrations & Pool | **Implemented** (migrations `0001`–`0005`, pgxpool, advisory-locked migration runner) | Arpit | [`internal/db`](../apps/backend/internal/db) |
| **Orchestrator** | Worker Broker | **Implemented** (Job-scoped JWT authentication on broker endpoint) | Priyanshu / Rudra | [`internal/githubworker`](../apps/backend/internal/githubworker) |
| **Orchestrator** | Outbox Reconciler | **Implemented** for build/deployment events; verify behavior with configured callbacks and the target cluster | Rudra | [`docs/implementation_rudra.md`](./implementation_rudra.md) |
| **Builder / Orchestrator** | gVisor Build Workloads | **Implemented; live GitHub-to-GHCR build and digest deployment flow remains to be demonstrated** | Priyanshu / Rudra | [`docs/implementation_priyanshu.md`](./implementation_priyanshu.md), [`docs/implementation_rudra.md`](./implementation_rudra.md) |
| **Registry** | OCI image storage | **GHCR is wired as the MVP registry target; authenticated push and digest deployment remain unverified end to end** | Rudra / Priyanshu | [`ghcr_mvp_setup.md`](./ghcr_mvp_setup.md) |
| **Frontend** | Console Dashboard | **Integrated with backend project, deployment, and source APIs; workspace quality checks are tracked by their command results** | UI Developer | [`apps/web`](../apps/web) |
