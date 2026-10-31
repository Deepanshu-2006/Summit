# Platform Database Implementation Plan: Supabase Postgres & Control Plane State

> **Current ownership model:** Summit control-plane records belong directly to
> personal users. The current migrations do not create Summit organizations or
> organization memberships. GitHub accounts may still be GitHub organizations.

- **Document Path:** `docs/implementation_arpit.md`
- **Owner:** Arpit (Platform Database Engineer - Persistence, Schema & Interfaces)
- **Collaborators:** Priyanshu (API Platform & Isolated Builder Engineer - gVisor host setup, runtimeClass, rootless BuildKit + Railpack), Rudra (Orchestrator & K8s Operator Engineer - pod scheduling, launching, monitoring, cleanup), Frontend Developer (UI / Next.js)
- **Target Subsystem:** Control Plane Platform Persistence Layer (`apps/backend/internal/platformdb` and `apps/backend/internal/db`)
- **System Architecture Context:** Architecture reference [`docs/system_architechture.png`](../docs/system_architechture.png)
- **Status:** ACTIVE / CORE MIGRATIONS & SCHEMA IMPLEMENTED (PR #3 MERGED)

---

## 1. Executive Summary & Scope

This document defines the database architecture and persistence implementation plan for the Summit Jetway developer platform. The architecture identifies Supabase Postgres as the platform metadata database. The database stores platform metadata, personal-user ownership, deployment lifecycle state, resource topology, and durable metering records.

### 1.1 In-Scope (Arpit Ownership)
Arpit owns platform persistence, schema design, and database access interfaces only:
- **Control Plane State Architecture:** Logical schema design, personal-user ownership, index optimization, and relational constraints for users, projects, environments, services, deployments, releases, domains, and audit trails.
- **Transactional Outbox Engine:** A durable PostgreSQL-backed outbox pattern supporting atomic HTTP request mutations and concurrent worker claims via `FOR UPDATE SKIP LOCKED`.
- **Database Access Layer (`apps/backend/internal/db`):** Safe, idiomatic Go repository interfaces, connection pooling via `pgx/v5` (`pgxpool`), transaction lifecycle management, and typed query abstractions consumed by Priyanshu (API) and Rudra (Orchestrator).
- **Migration & Evolution Framework:** Zero-downtime, expand/contract migration tooling decision workflow, automated local/CI testing via ephemeral containers, and rollback verification.
- **Durable Metering Ledger:** Append-only, idempotent usage event storage distinct from ephemeral operational metric scrapers.

### 1.2 Non-Goals & Strict System Boundaries
- **Tenant Application Databases:** Per-tenant databases (e.g., PostgreSQL, MySQL, Redis instances provisioned via Kubernetes PVCs in tenant namespaces `tenant-<slug>`) are isolated application workloads managed by Rudra's Kubernetes Operator. They are **never** hosted in or conflated with the platform metadata database.
- **Secret Value Storage:** The platform database **never stores secret values, API keys, private certificates, or database credentials** in plaintext or ciphertext. It stores exclusively immutable secret pointers and reference metadata (OpenBao paths, AWS Secrets Manager ARNs, Kubernetes Secret names). Values are resolved dynamically at runtime by External Secrets Operator (ESO) and injected directly into tenant namespaces.
- **High-Frequency Observability Metrics & Raw Logs:** Real-time container CPU/memory telemetry and application container logs belong in Prometheus and Fluent Bit / Loki. The platform database stores only durable, reconciled billing events and immutable audit logs.
- **Ad-Hoc Operator DB Access:** The Kubernetes Operator must never run arbitrary unindexed SQL or schema alterations. All persistence access occurs via typed Go contracts in `apps/backend/internal/db` or secure, audited internal control plane APIs.

---

## 2. Current Baseline & Architecture Alignment

### 2.1 Monorepo Reality Check
An inspection of the workspace confirms the current baseline:
- **`apps/backend`:** Fully integrated with `jackc/pgx/v5/pgxpool` in `internal/db/pool.go`. Schema migrations are governed by the advisory-locked migration engine in `internal/db/migrate.go` and CLI `cmd/migrate/main.go`. Two production migrations are committed and active:
  - `0001_baseline.up.sql`: Personal-user-owned core tables (`users`, `projects`, `environments`, `services`, `service_resources`, `secret_references`, `deployments`, `build_jobs`, `releases`, `outbox_events`, `custom_domains`, `metering_ledger`, and `audit_logs`).
  - `0002_github_integration.up.sql`: `github_installations`, `github_installation_states`, `github_repositories`, `github_webhook_events`, and `service_sources`, with `deployments.git_commit_sha` widened to `VARCHAR(64)` for full Git SHA-256 support.
- **Test Harness:** Dedicated schema-isolated PostgreSQL test runner in `internal/testutil/db.go` verifies migrations and query execution against local `postgres:16-alpine` containers.
- **`packages/api_spec/openapi.yaml`:** OpenAPI 3.1 contract containing endpoints for projects, resources, releases, and observability.
- **`apps/web`:** Next.js 16 frontend containing a temporary client-side demo store. Frontend mutation flows will wire to the real Go API once public project creation endpoints land.
- **`docs/system_architechture.png`:** The reference topology specifies:
  - Supabase Postgres for platform metadata.
  - An asynchronous Job Queue connecting the API to the Go Operator and Custom Resource Definitions (CRDs).
  - Per-tenant Kubernetes namespaces containing Web, Worker, and DB PVC workloads.
  - OpenBao synchronized to AWS Secrets Manager via External Secrets Operator (ESO).
  - Ephemeral rootless BuildKit + Railpack running in gVisor sandboxes pushing to an OCI registry (entire isolated builder including gVisor host `runsc` installation/configuration, Kubernetes `runtimeClass` setup, and rootless BuildKit + Railpack builder image/configuration/integration owned by Priyanshu; orchestrator and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder owned by Rudra; platform DB/persistence/schema/interfaces owned by Arpit).
  - Traefik ingress controller and Cilium CNI for networking and tenant network policies.
  - 1-2 SSH machines acting strictly as **test-only** Kubernetes nodes.

---

## 3. Architecture Assumptions & Unresolved Decisions

Before laying down table DDL, the three backend engineers must resolve key architectural assumptions:

```
+---------------------------------------------------------------------------------------------------+
|                                  CONTROL PLANE METADATA BOUNDARY                                  |
|                                                                                                   |
    |   +--------------------+       Shared Go persistence        +---------------------------------+   |
    |   |   apps/backend     | <================================> |   K8s Controller / Operator     |   |
|   |   (Priyanshu)      |                                    |   (Rudra)                       |   |
|   +--------------------+                                    +---------------------------------+   |
|             |                                                               |                     |
|             | pgxpool                                                       | pgxpool             |
|             v                                                               v                     |
|   +-------------------------------------------------------------------------------------------+   |
|   |                                SUPABASE POSTGRES (PLATFORM DB)                            |   |
|   |  - Personal Users & Projects                  - Deployments, Builds & Releases             |   |
|   |  - Projects & Workload Specs                 - Transactional Outbox (Job Queue)           |   |
|   |  - Secret Metadata (Pointers/ARNs Only)      - Metering Ledger & Audit Trail              |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                         Provisions & Reconciles Workload Isolation
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                  TENANT RUNTIME BOUNDARY (KUBERNETES)                             |
|                                                                                                   |
|   +---------------------------------------+   +-----------------------------------------------+   |
|   | Namespace: tenant-acme-prod           |   | Namespace: tenant-globex-staging              |   |
|   | - Web Pods (Traefik Ingress)          |   | - Web Pods (Traefik Ingress)                  |   |
|   | - Worker Pods                         |   | - Worker Pods                                 |   |
|   | - Tenant DB PVC (PostgreSQL/Redis)    |   | - Tenant DB PVC (PostgreSQL/Redis)            |   |
|   | - K8s Secrets (Injected from ESO)     |   | - K8s Secrets (Injected from ESO)             |   |
|   | - Cilium Network Policy Isolation     |   | - Cilium Network Policy Isolation             |   |
|   +---------------------------------------+   +-----------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
```

### 3.1 Platform DB vs. Tenant DB Boundary Matrix

| Dimension | Platform Metadata DB (Supabase Postgres) | Tenant Workload DBs (Per-Tenant PVCs) |
| :--- | :--- | :--- |
| **Owner** | Arpit (Platform Database Engineer - Persistence/Schema/Interfaces Only) | Tenant User Applications (Managed by Rudra Operator) |
| **Location** | Managed Supabase Postgres Instance | Ephemeral / Persistent Pods in `tenant-<org>-<env>` |
| **Data Stored** | Personal user ownership, Git repos, build metadata, deployment state, outbox jobs, secret pointers, billing ledger | End-user tables, customer application business data, session state |
| **Network Access** | Control plane only (`apps/backend`, internal worker pool) | In-cluster service mesh, tenant ingress via Traefik |
| **Secret Storage** | OpenBao paths and AWS Secrets Manager ARNs only | Injected environment variables via External Secrets Operator |
| **Failure Domain** | Global control plane outage (blocks new deploys/logins) | Localized tenant outage (isolated by Cilium network policies) |

### 3.2 Unresolved Decisions Log

1. **Authentication Provider & Identity Authority:**
   - *Option A:* Supabase Auth (built-in JWT, sets `auth.uid()`, native RLS integration).
   - *Option B:* Managed Better Auth / OIDC (external IdP issuing JWTs validated by Go middleware).
   - *Database Impact:* Determines whether the `users` table is managed via Postgres foreign keys to `auth.users` or maintained in an application-level `public.users` schema.
2. **Asynchronous Coordination: DB Outbox vs. Standalone Broker:**
   - *Option A:* Transactional Outbox inside Supabase Postgres using `FOR UPDATE SKIP LOCKED`.
   - *Option B:* Standalone message broker (Redis / RabbitMQ / NATS JetStream).
   - *Database Impact:* If Option A is chosen, the database manages queue lifecycle and retention. Arpit strongly recommends Option A for Phase 1 to eliminate external broker operational overhead and guarantee ACID transactions between HTTP requests and message dispatch.
3. **Secret Storage Invariant:**
   - Platform database columns must be typed strictly as `secret_references` (`provider`, `vault_path`, `arn`, `version`). No column shall accept or return secret values.

### 3.3 Cross-plan proposals (pending shared approval)

The detailed schema and SQL below are design candidates, not approved requirements. Align these decisions with Priyanshu's and Rudra's plans before implementing migrations:

- **Identity provider:** choose at Gate 1. Supabase Auth is only an option; using Supabase Postgres does not select an auth provider. Enforce tenant scope in repository queries. Decide whether RLS is also required and verify it with the actual database role and connection mode.
- **Deployment API contract:** propose `POST /api/v1/projects/{slug}/deployments` returning `202 Accepted` only after deployment and dispatch intent commit atomically, with a deployment ID and `Location: /api/v1/deployments/{id}`. Add the status endpoint to OpenAPI after Gate 2 approval; preserve `/releases` for release history unless team/UI review selects another mapping.
- **Lifecycle vocabulary:** shared proposal is `queued → building → image_ready → deploying → health_checking → running`, terminal `failed` / `cancelled`, and retry attempt metadata. Final states, transitions, and database representation require Gate 2 approval.
- **Outbox and package boundary:** PostgreSQL outbox is the recommended Phase 1 option, pending approval. If selected, Arpit owns schema, migrations, and shared Go contracts under `apps/backend/internal/platformdb`; API and orchestrator consume those contracts. Avoid a second competing repository abstraction.
- **Build subsystem ownership:** Priyanshu owns the ENTIRE isolated builder subsystem, including gVisor (`runsc`) host installation/configuration and `runtimeClass` setup on Kubernetes hosts, plus rootless BuildKit + Railpack builder image, configuration, and integration; Rudra does NOT own, install, or configure gVisor, but owns the orchestrator and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder; Arpit owns platform DB/persistence/schema/interfaces only.
- **Provider limits and operations:** verify migration tooling, connection/pool settings, and HA against the actual Supabase plan and test setup.

---

## 4. Shared Backend Collaboration Gates

<span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>
The following four cross-cutting gates require explicit, synchronous sign-off from Priyanshu (API), Rudra (Orchestrator), and Arpit (Database), with coordination from the UI developer on contract visibility:

### Gate 1: Personal User Identity and Isolation Boundary
- **Objective:** Establish how the authenticated user owns projects and their resource trees.
- **Priyanshu (API):** Extracts user identity from JWT and checks resource ownership in Go handlers.
- **Rudra (Orchestrator):** Maps each personal user's workloads to Kubernetes namespaces and applies Cilium isolation policies.
- **Arpit (Database):** Stores `user_id` on owned records and enforces ownership across project relationships with foreign keys.
- **UI Coordination:** Uses the authenticated user's projects without organization switching.

### Gate 2: Deployment Lifecycle + Persistence/Outbox + API Response Contract / Retries / Idempotency
- **Objective:** Establish the atomic deployment creation protocol, outbox event schema, and worker reconciliation state machine.
- **Priyanshu (API & Builder):** Accepts `POST /api/v1/projects/{slug}/deployments` with client-provided `Idempotency-Key`; writes deployment record and outbox event in a single transaction; owns the ENTIRE isolated builder subsystem (gVisor `runsc` host installation/configuration, Kubernetes `runtimeClass` setup, and rootless BuildKit + Railpack builder image/configuration/integration).
- **Rudra (Orchestrator):** Worker daemon claims events via `FOR UPDATE SKIP LOCKED`, manages orchestrator state reconciliation and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder, updates execution state (does not own, install, or configure gVisor).
- **Arpit (Database):** Designs `deployments`, `build_jobs`, `releases`, and `outbox_events` tables with state machine enums, retry counters, and lock leases (DB/persistence/schema/interfaces only).
- **UI Coordination:** Real-time polling or SSE/WebSocket event contracts for deployment terminal states and build logs.

### Gate 3: Test-Cluster / Build Isolation / CRDs / Registry / Ingress / Network / Secrets Conventions
- **Objective:** Unify naming, resource limits, and secret referencing across test Kubernetes hosts.
- **Priyanshu (API & Builder):** Exposes resource quotas and environment variable CRUD (pointers only); packages rootless BuildKit + Railpack builder image and installs/configures gVisor (`runsc`) and `runtimeClass` across Kubernetes hosts.
- **Rudra (Orchestrator):** Implements CRDs for `TenantApp`, deploys Traefik IngressRoutes, configures ESO sync to OpenBao, and handles Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder (does NOT install or configure gVisor).
- **MVP OCI Registry Direction:** Use GHCR (`ghcr.io`) as the external image registry rather than deploying a registry service in the test cluster. Rudra owns cluster pull configuration, Priyanshu owns builder image publishing integration, and Arpit persists image references/digests only (never credentials). See [`ghcr_mvp_setup.md`](./ghcr_mvp_setup.md); the publish credential boundary still needs agreement.
- **Arpit (Database):** Provides metadata schema for provisioned resources, custom domains, and secret reference mappings (zero secret values) — DB/persistence/schema/interfaces only.
- **UI Coordination:** Displays build logs, custom domain verification DNS records, and environment variable keys (with masked values).

### Gate 4: End-to-End Acceptance on Test-Only Machines with Migration / Security Review
- **Objective:** Execute live smoke testing on the 1-2 SSH test nodes verifying migrations, failover, and deployment execution.
- **Priyanshu (API & Builder):** Verifies end-to-end HTTP request flows against deployed test workloads and validates the entire isolated builder stack (gVisor `runsc` host runtime, `runtimeClass`, rootless BuildKit, and Railpack image generation).
- **Rudra (Orchestrator):** Verifies orchestrator reconciliation, Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder, and network isolation between tenant namespaces.
- **Arpit (Database):** Executes forward and rollback migrations against Supabase Postgres, validates connection pooling limits, and audits query performance (DB/persistence/schema/interfaces only).
- **UI Coordination:** Frontend end-to-end integration test validating end-user flow against the real API.

---

## 5. Conceptual Entity Map & Relational Schemas

Entities use UUID primary keys generated by PostgreSQL. Projects and their resource hierarchy belong to a personal user.

```
+-------------------------------------------------------------------------------------------------+
|                                    ENTITY RELATIONSHIP DIAGRAM                                  |
|                                                                                                 |
|   +-----------------------+           1:N           +---------------------------------------+   |
|   |         users         | ----------------------> |                projects               |   |
|   +-----------------------+                         +---------------------------------------+   |
|               |                                                                                 |
|       +-------+-------+                                                                         |
|       | 1:N           | 1:N                                                                     |
|       v               v                                                                         |
|   +---------------+ +-----------------------+       1:N       +-----------------------------+   |
|   |  environments | |  secret_references    | --------------> |       service_env_links     |   |
|   +---------------+ +-----------------------+                 +-----------------------------+   |
|       |                                                                     ^                   |
|       | 1:N                                                                 | N:1               |
|       v                                                                     |                   |
|   +---------------+       1:N       +-----------------------+               |                   |
|   |   services    | --------------> | service_resources     | --------------+                   |
|   +---------------+                 +-----------------------+                                   |
|       |                                                                                         |
|       | 1:N                                                                                     |
|       v                                                                                         |
|   +---------------+       1:1       +-----------------------+       1:N       +-------------+   |
|   |  deployments  | --------------> |      build_jobs       | --------------> |  releases   |   |
|   +---------------+                 +-----------------------+                 +-------------+   |
|       |                                                                             |           |
|       | 1:1                                                                         | 1:N       |
|       v                                                                             v           |
|   +---------------+                                                   +---------------------+   |
|   | outbox_events |                                                   |   custom_domains    |   |
|   +---------------+                                                   +---------------------+   |
+-------------------------------------------------------------------------------------------------+
```

### 5.1 Personal User Identity
```sql
-- User IDs match Supabase Auth auth.users IDs.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 Projects, Environments & Git Repositories
```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(63) NOT NULL,
    name VARCHAR(255) NOT NULL,
    git_repository_url VARCHAR(512),
    git_default_branch VARCHAR(128) DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_user_project_slug UNIQUE (user_id, slug)
);
CREATE INDEX idx_projects_user ON projects(user_id) WHERE deleted_at IS NULL;

-- Environments (production, staging, preview-pr-12)
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(63) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('production', 'staging', 'preview')),
    is_ephemeral BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_project_env_name UNIQUE (project_id, name)
);
CREATE INDEX idx_environments_project ON environments(project_id) WHERE deleted_at IS NULL;
```

### 5.3 Workload Services & Compute Specifications
```sql
-- Workload Services (web, worker, cron)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(63) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('web', 'worker', 'cron')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_env_service_name UNIQUE (environment_id, name)
);

-- Service Resource Specs (CPU/Memory/Scaling limits for K8s)
CREATE TABLE service_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    cpu_request_millicores INT NOT NULL DEFAULT 100,
    cpu_limit_millicores INT NOT NULL DEFAULT 500,
    memory_request_mb INT NOT NULL DEFAULT 128,
    memory_limit_mb INT NOT NULL DEFAULT 512,
    min_replicas INT NOT NULL DEFAULT 1,
    max_replicas INT NOT NULL DEFAULT 5,
    port INT DEFAULT 8080,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_resource UNIQUE (service_id)
);
```

### 5.4 Secret References (POINTERS ONLY - ZERO VALUES)
```sql
-- Secret References: Strictly metadata and external vault pointers
CREATE TABLE secret_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    provider VARCHAR(64) NOT NULL CHECK (provider IN ('openbao', 'aws_secrets_manager', 'kubernetes_secret')),
    provider_vault_path VARCHAR(512) NOT NULL,
    provider_version_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_env_secret_key UNIQUE (environment_id, key_name)
);
CREATE INDEX idx_secret_ref_env ON secret_references(environment_id);
```

### 5.5 Deployments, Builds, Releases & Outbox Engine
```sql
-- Deployments State Machine
CREATE TYPE deployment_status AS ENUM (
    'pending', 'queued', 'building', 'deploying', 'active', 'superseded', 'failed', 'cancelled'
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    git_commit_sha VARCHAR(40) NOT NULL,
    git_branch VARCHAR(128) NOT NULL,
    status deployment_status NOT NULL DEFAULT 'pending',
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_idempotency UNIQUE (project_id, idempotency_key)
);
CREATE INDEX idx_deployments_env_status ON deployments(environment_id, status);
CREATE INDEX idx_deployments_created ON deployments(created_at DESC);

-- Build Jobs (entire isolated builder including gVisor runsc host installation/config, runtimeClass, and rootless BuildKit + Railpack owned by Priyanshu; orchestrator and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder owned by Rudra; DB/persistence/schema/interfaces owned by Arpit)
CREATE TABLE build_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    builder_type VARCHAR(64) NOT NULL DEFAULT 'gvisor_rootless_buildkit',
    oci_image_digest VARCHAR(255),
    loki_stream_label VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_deployment_build UNIQUE (deployment_id)
);

-- Releases (Atomic Rollout & Historical Ledger)
CREATE TABLE releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE RESTRICT,
    release_number INT NOT NULL,
    config_snapshot JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_env_release_num UNIQUE (environment_id, release_number)
);
CREATE INDEX idx_releases_env_active ON releases(environment_id) WHERE is_active = TRUE;

-- Transactional Outbox Engine
CREATE TYPE outbox_status AS ENUM ('pending', 'claimed', 'completed', 'failed');

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,     -- 'deployment', 'service', 'secret'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,         -- 'deployment.requested', 'build.completed'
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    locked_until TIMESTAMPTZ,
    locked_by VARCHAR(128),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX idx_outbox_queue ON outbox_events(status, locked_until)
    WHERE status IN ('pending', 'claimed');
```

### 5.6 Networking, Routing & Ingress
```sql
CREATE TABLE custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    fqdn VARCHAR(255) NOT NULL UNIQUE,
    tls_secret_ref_id UUID REFERENCES secret_references(id),
    verification_token VARCHAR(128) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    routing_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_custom_domains_env ON custom_domains(environment_id);
```

### 5.7 Metering Ledger & Audit Records
```sql
-- Durable, Append-Only Usage Ledger (Financial/Billing Invariant)
CREATE TABLE metering_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    metric_type VARCHAR(64) NOT NULL,       -- 'vcpu_seconds', 'memory_byte_seconds', 'build_minutes'
    quantity NUMERIC(18, 4) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    idempotency_hash VARCHAR(64) NOT NULL UNIQUE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metering_user_window ON metering_ledger(user_id, window_start, window_end);

-- Immutable Security & Compliance Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,           -- 'project.create', 'secret.rotate', 'deployment.trigger'
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
```

---

## 6. Schema & Migration Tooling Decision Workflow

To maintain neutrality across backend engineering, Arpit will execute a decision matrix without prematurely introducing unvetted third-party Go dependencies into [`go.mod`](../apps/backend/go.mod).

### 6.1 Tooling Candidate Matrix

| Evaluated Tool | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **`pressly/goose`** | Pure Go library, embeddable in binary, supports forward/backward migrations in raw SQL, programmatic Go API for integration testing | Minimal automated drift detection | **Top Candidate (Preferred)** |
| **`golang-migrate/migrate`** | Broad database driver support, battle-tested CLI | Programmatic API has awkward error handling, heavy external driver imports | Viable alternative |
| **`pgroll`** | Native support for zero-downtime expand/contract schema changes | Extra complexity, requires dedicated schema proxy layer | Overkill for Phase 1 |
| **`sqlc`** | Generates type-safe Go structs and queries directly from raw SQL | Query compiler only, requires separate migration runner | Recommended for query generation alongside Goose |

### 6.2 Decision Process & Evaluation Criteria
1. **Migration Isolation:** Migrations must run via an explicit CLI tool (`goose up`) in CI/CD and programmatically during Go automated integration tests (`testcontainers-go`).
2. **Advisory Locking:** The runner must acquire a PostgreSQL advisory lock (`pg_advisory_lock`) during migration runs to prevent race conditions during multi-replica control plane startups.
3. **Expand/Contract Discipline:** Destructive schema alterations (e.g., dropping columns, changing types) are prohibited in single-step migrations. Every schema evolution follows:
   - *Expand Phase:* Add nullable column or new table. Deploy code reading/writing to both.
   - *Backfill Phase:* Asynchronous batch data migration.
   - *Contract Phase:* Add `NOT NULL` constraint, deprecate old column, drop old column in subsequent release.

---

## 7. Go Repository Architecture: `apps/backend/internal/platformdb`

Arpit will introduce the persistence package into `apps/backend/internal/platformdb`. This package provides domain-oriented interfaces to decouple database execution from HTTP handlers (Priyanshu) and reconciliation loops (Rudra).

```
apps/backend/internal/platformdb/
├── platformdb.go         # DB interface, pool initialization, transaction runner
├── config.go             # Database connection configuration & pool tuning
├── tx.go                 # Atomic Unit of Work & Transaction management
├── outbox.go             # Transactional Outbox publisher and consumer (SKIP LOCKED)
├── deployments.go        # Deployment and Release repository contracts & SQL
├── projects.go           # Tenant, Project, and Environment repository
├── secrets.go            # Secret reference metadata repository (Pointers only)
├── metering.go           # Append-only usage ledger repository
└── mocks/                # Mock implementations for unit tests in API and Orchestrator
```

### 7.1 Proposed Core Interfaces

```go
package platformdb

import (
	"context"
	"time"
	"github.com/google/uuid"
)

// UnitOfWork abstracts database operations within a single ACID transaction.
type UnitOfWork interface {
	Projects() ProjectRepository
	Deployments() DeploymentRepository
	Outbox() OutboxRepository
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

// DBClient represents the high-level persistence engine.
type DBClient interface {
	BeginTx(ctx context.Context) (UnitOfWork, error)
	Projects() ProjectRepository
	Deployments() DeploymentRepository
	Outbox() OutboxRepository
	Metering() MeteringRepository
	Ping(ctx context.Context) error
	Close()
}

// DeploymentRepository consumed by Priyanshu (API) and Rudra (Orchestrator)
type DeploymentRepository interface {
	Create(ctx context.Context, dep *Deployment) error
	GetByID(ctx context.Context, id uuid.UUID) (*Deployment, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status DeploymentStatus, errMsg *string) error
	GetActiveRelease(ctx context.Context, envID uuid.UUID) (*Release, error)
	PromoteRelease(ctx context.Context, release *Release) error
}

// OutboxRepository drives the asynchronous job queue
type OutboxRepository interface {
	Publish(ctx context.Context, event *OutboxEvent) error
	ClaimPendingEvents(ctx context.Context, limit int, lockDuration time.Duration, workerID string) ([]*OutboxEvent, error)
	AckEvent(ctx context.Context, eventID uuid.UUID) error
	NackEvent(ctx context.Context, eventID uuid.UUID, retryCount int, lastErr string) error
}
```

---

## 8. Transaction Boundaries & Outbox Worker Pattern

### 8.1 API Request Atomic Boundary (Priyanshu Hand-off)
When an API user triggers a deployment via `POST /api/v1/projects/{slug}/deployments`:
1. The API handler calls `platformdb.BeginTx(ctx)`.
2. Within the transaction:
   - An idempotency record is verified against `(project_id, idempotency_key)`.
   - The `deployments` record is inserted with the Gate 2-approved initial state (proposed: `queued`).
   - An `outbox_events` record is inserted with `event_type = 'deployment.requested'`.
3. The transaction commits.
4. **Proposed response:** return HTTP `202 Accepted` only after the deployment and outbox event are durably committed. No deployment can be accepted without its dispatch intent when the outbox design is approved.

### 8.2 Worker Claim Pattern (Rudra Hand-off)
The orchestrator background worker pool claims events using standard PostgreSQL row-level locks without blocking concurrent workers (Rudra owns orchestrator reconciliation and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder; Priyanshu owns the entire isolated builder including gVisor `runsc` host installation/configuration, Kubernetes `runtimeClass` setup, and rootless BuildKit + Railpack builder image/configuration/integration; Arpit owns DB/persistence/schema/interfaces only):

```sql
-- Concurrent Safe Worker Claim Query
WITH claimable AS (
    SELECT id
    FROM outbox_events
    WHERE status = 'pending'
       OR (status = 'claimed' AND locked_until < NOW())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT $1
)
UPDATE outbox_events
SET status = 'claimed',
    locked_until = NOW() + $2::interval,
    locked_by = $3,
    retry_count = retry_count + 1
FROM claimable
WHERE outbox_events.id = claimable.id
RETURNING outbox_events.*;
```

### 8.3 Idempotency & Conflict Resolution
- **Client Idempotency:** The unique constraint on `deployments(project_id, idempotency_key)` guarantees that network retries by clients return the existing deployment record without re-enqueueing duplicate builds.
- **Worker Leases:** The `locked_until` lease prevents duplicate worker executions. If a worker crashes, the event becomes eligible for re-claim after the lease expires. Poison pills are moved to `status = 'failed'` once `retry_count >= max_retries`.

---

## 9. Postgres Connection Management & Local/CI Parity

### 9.1 Driver Choice & Connection Pool Tuning
- **Driver:** Native `github.com/jackc/pgx/v5/pgxpool` provides superior performance, prepared statement caching, and deep support for PostgreSQL types.
- **Supabase Connection Modes:**
  - *Transaction Pooler (Port 6543 via Supavisor / PgBouncer):* Used by stateless HTTP API replicas in `apps/backend` to support hundreds of concurrent API connections without overloading Postgres backend processes.
  - *Session / Direct Connection (Port 5432):* Used exclusively by the migration runner (`goose`) and worker outbox consumer requiring advisory locks and `LISTEN/NOTIFY`.

### 9.2 Pool Sizing Configuration
```go
// Recommended production pool configuration
cfg, _ := pgxpool.ParseConfig(connString)
cfg.MaxConns = 25
cfg.MinConns = 5
cfg.MaxConnLifetime = 30 * time.Minute
cfg.MaxConnIdleTime = 5 * time.Minute
cfg.HealthCheckPeriod = 1 * time.Minute
```

### 9.3 Environment Parity Matrix

| Environment | Database Target | Connection String Source | Migration Execution |
| :--- | :--- | :--- | :--- |
| **Local Dev** | Docker Compose PostgreSQL 16 | `DATABASE_URL` in local `.env` | Manual CLI (`make db-migrate`) |
| **CI Pipeline** | GitHub Actions Service Container / `testcontainers-go` | Ephemeral dynamic localhost URL | Automated pre-test step |
| **Test Cluster** | Supabase Postgres (Dedicated Dev Project) | K8s Secret injected via ESO | CI Deployment CD step |
| **Production** | Supabase Postgres (availability/topology to be verified against selected plan) | AWS Secrets Manager via ESO (candidate) | Dedicated release pipeline gate |

---

## 10. Personal User Ownership and Database Access

The Go API is the public data access layer for control-plane records. It derives the owner from the verified Supabase user and checks that owner before reading or changing projects and their resources. The database stores personal ownership with `user_id` and uses composite foreign keys where a child record must remain under the same project owner.

The migrations enable RLS on control-plane tables and revoke grants from Supabase's `anon` and `authenticated` Data API roles. Browser clients call the Go API rather than querying these tables directly. The API and background workers use a privileged server-side database role, so they can operate with RLS enabled while applying ownership checks in application code.

## 11. Durability & Recovery Policy (MVP Scope)

Custom database backup and recovery automation is out of scope for this MVP.

---

## 12. Metering & Billing Ledger Semantics

Operational metrics collected by Prometheus and Loki are ephemeral and subject to scraping loss or downsampling. They **must never be used directly as financial accounting ledgers**.

### 12.1 Durable Usage Ledger Semantics
- **Reconciliation Engine:** A scheduled background reconciler reads aggregated consumption from Prometheus / metrics-server, converts it into typed, immutable usage records (`vcpu_seconds`, `memory_byte_seconds`, `build_minutes`, `egress_bytes`), and inserts them into `metering_ledger`.
- **Idempotency Invariant:** Every ledger record contains a SHA-256 hash derived from `(user_id, project_id, metric_type, window_start, window_end)`. Duplicate reconciliation runs trigger `ON CONFLICT (idempotency_hash) DO NOTHING`.
- **Immutability:** The `metering_ledger` table is strictly append-only. `UPDATE` and `DELETE` permissions are revoked for all application users. Corrections are recorded as compensating negative entries.

---

## 13. Testing Strategy & Acceptance Criteria

### 13.1 Testing Levels
1. **Unit Tests (Mocked DB):** Priyanshu and Rudra use generated mocks of `platformdb.DBClient` to test API handlers and reconciler logic without database dependencies.
2. **Integration Tests (`testcontainers-go`):** Automated Go integration tests in `apps/backend/internal/platformdb` that spin up a real PostgreSQL 16 container, apply all Goose migrations, and verify:
   - Foreign key cascading and deletion constraints.
   - Outbox concurrent claim locks using `FOR UPDATE SKIP LOCKED`.
   - Personal-user query isolation and RLS boundaries.
   - Idempotency key conflict handling.
3. **Migration Regression Tests:** CI pipeline executes `goose up` followed immediately by `goose down` and `goose up` to verify bidirectional migration safety.

### 13.2 Acceptance Criteria
- [ ] Database package builds cleanly with the shared Go 1.26 toolchain and `pgx/v5`.
- [ ] Schema applies successfully from scratch with zero errors or unindexed foreign keys.
- [ ] Outbox table successfully handles 50 concurrent worker claims without lock deadlocks or duplicate event processing.
- [ ] Unit and integration test suite achieves $>85\%$ code coverage across `platformdb`.

---

## 14. Phased Implementation Roadmap & Cross-Owner Handoffs

```
==================================================================================================
PHASE 0: Foundations & Tooling Agreement (Week 1)
--------------------------------------------------------------------------------------------------
[Arpit] Select migration tool (Goose); setup local Docker Compose Postgres; create baseline schema (DB/persistence/schema/interfaces only).
[Shared Gate 1] <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: Finalize Auth & Tenant boundary spec.

==================================================================================================
PHASE 1: Personal User Ownership, Projects & Go Repository (Weeks 2-3)
--------------------------------------------------------------------------------------------------
[Arpit] Implement personal-user-owned `users`, `projects`, `environments` tables & `platformdb` package.
[Priyanshu Handoff] Deliver `platformdb.ProjectRepository` for API CRUD endpoints.
[UI Coordination] Coordinate personal project list response contract.

==================================================================================================
PHASE 2: Deployments, Releases & Outbox Engine (Weeks 4-5)
--------------------------------------------------------------------------------------------------
[Arpit] Implement `deployments`, `releases`, `build_jobs`, and `outbox_events` tables with locks (DB/persistence/schema/interfaces only).
[Shared Gate 2] <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: Deployment lifecycle & outbox contract (Priyanshu owns the ENTIRE isolated builder including gVisor runsc host installation/configuration, runtimeClass setup, and rootless BuildKit + Railpack builder; Rudra owns orchestrator and Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder; Arpit owns DB/persistence/schema/interfaces only).
[Priyanshu Handoff] API writes deployment + outbox event in atomic transaction; delivers configured isolated builder image, gVisor (runsc) host setup, and runtimeClass.
[Rudra Handoff] Orchestrator consumes outbox queue via FOR UPDATE SKIP LOCKED and manages Kubernetes scheduling/launching/monitoring/cleanup of builder pods.

==================================================================================================
PHASE 3: Resource Specs & Secret Pointers (Weeks 6-7)
--------------------------------------------------------------------------------------------------
[Arpit] Implement `services`, `service_resources`, and `secret_references` (Pointers only; DB/persistence/schema/interfaces only).
[Shared Gate 3] <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: K8s CRD, ESO sync & secret pointer conventions (Priyanshu's gVisor/runtimeClass host setup & builder integration; Rudra's pod scheduling/monitoring/cleanup).
[Rudra Handoff] Operator reads service resource specs to generate Kubernetes CRDs and manages Kubernetes scheduling/launching/monitoring/cleanup of pods using Priyanshu's configured builder.

==================================================================================================
PHASE 4: Metering Ledger, Audit Logs & Production Hardening (Weeks 8-9)
--------------------------------------------------------------------------------------------------
[Arpit] Implement `metering_ledger`, `audit_logs`, Supabase connection pooling & RLS policies.
[Priyanshu Handoff] Expose billing usage and audit log query APIs.

==================================================================================================
PHASE 5: End-to-End Acceptance & Test Cluster Verification (Week 10)
--------------------------------------------------------------------------------------------------
[Shared Gate 4] <span style="color:#7C3AED"><strong>TEAM OF THREE REQUIRED</strong></span>: Test-cluster deployment & end-to-end verification.
==================================================================================================
```

---

## 15. First-PR Checklist (Arpit Action Plan)

This checklist defines the exact scope of Arpit's initial pull request:

- [x] **Repository Structure:**
  - Database package established in `apps/backend/internal/db`.
  - Migrations established in `apps/backend/internal/db/migrations`.
- [x] **Dependency Evaluation & Installation:**
  - Introduced `github.com/jackc/pgx/v5` and `github.com/google/uuid` to `apps/backend/go.mod`.
  - Built programmatic PostgreSQL advisory-locked migration runner (`internal/db/migrate.go`) and CLI (`cmd/migrate/main.go`).
- [x] **Initial Migration (`0001_baseline.up.sql` & `0002_github_integration.up.sql`):**
  - Implemented personal `users` and user-owned `projects`.
  - Implemented `projects` and `environments`.
  - Implemented `services`, `service_resources`, `secret_references`, `deployments`, `build_jobs`, `releases`, `outbox_events`, `custom_domains`, `metering_ledger`, `audit_logs`.
  - Implemented GitHub integration tables: `github_installations`, `github_installation_states`, `github_repositories`, `github_webhook_events`, `service_sources`.
  - Widened `deployments.git_commit_sha` to `VARCHAR(64)` for Git SHA-256 support.
- [x] **Connection Engine (`apps/backend/internal/db/pool.go`):**
  - Implemented `NewPool(ctx context.Context, config Config) (*pgxpool.Pool, error)`.
  - Configured connection limits, max conn idle time, and health pings.
- [x] **Automated Tests & Harness:**
  - Implemented schema-isolated PostgreSQL test runner in `apps/backend/internal/testutil/db.go`.
- [ ] **Next Milestone (Arpit Action Plan):**
  - Implement typed query repository interfaces consumed by API handlers (`internal/platformdb`).
  - Wire database pool ping into `GET /api/v1/health` deep readiness check.

---

## 16. Risks & Decision Register

| Risk / Decision ID | Description | Severity | Mitigation Strategy | Decision Owner |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-DB-01** | Connection exhaustion during high API traffic spikes on Supabase | High | Route stateless API traffic through Supavisor/PgBouncer transaction pooler (port 6543); cap backend `MaxConns` to 25 per replica. | Arpit |
| **RISK-DB-02** | Accidental secret exposure in platform metadata database | Critical | Strict code review and database check constraints preventing plaintext values; schema strictly typed as external vault pointers. | Arpit & Priyanshu |
| **RISK-DB-03** | Worker deadlocks during high-throughput outbox event claims | High | Enforce `FOR UPDATE SKIP LOCKED` and deterministic query sorting by `created_at ASC`. | Arpit & Rudra |
| **RISK-DB-04** | Schema drift between local development and Supabase production | Medium | CI pipeline validates all migrations against a clean PostgreSQL container before PR merges. | Arpit |
| **RISK-DB-05** | API contract drift impacting frontend UI data fetching | Medium | UI developer included in API contract sign-off; OpenAPI spec updated prior to schema changes. | Priyanshu & UI Developer |

---

*End of Implementation Plan — Awaiting Shared Gate 1 Sign-Off.*
