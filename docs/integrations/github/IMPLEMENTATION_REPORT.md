# GitHub Integration Backend — Completion Report

**Document Version:** 1.0.0  
**Target Platform:** Summit PaaS Control Plane (`apps/backend`)  
**Specification:** [`GITHUB_INTEGRATION_BACKEND_SPEC.md`](./GITHUB_INTEGRATION_BACKEND_SPEC.md)  
**Status:** Implementation report updated for personal-user ownership

---

## 1. Executive Summary

This report documents the completed backend implementation for GitHub Integration in the Summit platform. The implementation adheres strictly to the architectural constraints:
- The Go API is the sole backend interface; Next.js and MCP are thin clients.
- Supabase Auth is the platform identity provider; GitHub login is decoupled from GitHub App repository access.
- All webhook deliveries are verified using raw-body HMAC-SHA256, deduplicated via PostgreSQL constraints, and processed asynchronously.
- Builds strictly bind to immutable commit SHAs.
- Build workers receive short-lived, repository-scoped installation tokens minted on demand via an internal credential broker; private keys and installation tokens are never persisted or returned to frontends.

---

## 2. Inventory of Files Created and Modified

### Database & Migrations
- `apps/backend/internal/db/migrations/0001_baseline.up.sql`: Personal-user-owned platform tables (`users`, `projects`, `services`, `deployments`, `build_jobs`, `outbox_events`, `audit_logs`).
- `apps/backend/internal/db/migrations/0002_github_integration.up.sql`: GitHub tables (`github_installations`, `github_installation_states`, `github_repositories`, `github_webhook_events`, `service_sources`, indexes, triggers).
- `apps/backend/internal/db/migrate.go`: Advisory-locked schema migration engine.
- `apps/backend/internal/db/pool.go`: PostgreSQL connection pool lifecycle manager.

### Core Domain Packages
- `apps/backend/internal/auth/`: Supabase JWT verification (`verifier.go`), user synchronization (`user.go`), and HTTP middleware (`middleware.go`).
- `apps/backend/internal/authz/`: Personal service ownership lookup (`authz.go`).
- `apps/backend/internal/audit/`: Audit logging with automated credential/token redaction (`audit.go`).
- `apps/backend/internal/secrets/`: OpenBao client (`openbao.go`) and multi-tier secret router (`router.go`) with dev env fallback.
- `apps/backend/internal/installstate/`: Cryptographic state generator and SHA-256 state hashing (`installstate.go`).
- `apps/backend/internal/sourcepath/`: Lexical path sanitizer guarding against traversal, absolute paths, and escaping symlinks (`sourcepath.go`).
- `apps/backend/internal/githubapp/`: GitHub App API client (`client.go`), RS256 App JWT minting (`jwt.go`), installation token minting, and GitHub REST API integration.
- `apps/backend/internal/githubwebhook/`: Raw HMAC-SHA256 verification (`signature.go`), bounded body reader (`body.go`), and event normalizer (`normalize.go`).
- `apps/backend/internal/githubapi/`:
  - `types.go`: Request/response DTOs and client interfaces.
  - `service.go`: Transactional installation, repository sync, service source, and deployment business logic.
  - `handlers.go`: HTTP route handlers mounting under `/v1/...`.
- `apps/backend/internal/githubworker/`:
  - `webhook_handler.go`: Webhook intake handler (`POST /v1/webhooks/github`).
  - `processor.go`: Asynchronous webhook event consumer with row locking (`FOR UPDATE SKIP LOCKED`), branch push matching, deployment/build transactional commit, and lifecycle actions.
  - `broker_handler.go`: Internal worker credential broker (`POST /internal/v1/build-requests/{build_request_id}/source-token`).
  - `worker.go`: Background worker loop.
  - `routes.go`: Route registration helper.
- `apps/backend/internal/httpx/`: Standard JSON error envelopes and response helpers.
- `apps/backend/internal/server/server.go`: HTTP multiplexer mounting health, public API, webhook, and internal worker endpoints.
- `apps/backend/cmd/api/main.go`: API entrypoint with graceful shutdown and background webhook worker.

---

## 3. Database Migrations & Schema

### Migrations
1. `0001_baseline.up.sql`: Sets up core tenancy, projects, services, deployments, build jobs, outbox, and audit logging.
2. `0002_github_integration.up.sql`: Adds integration-specific tables:
   - `github_installations`: `id`, `user_id`, `github_installation_id` (UNIQUE), `account_id`, `account_login`, `account_type`, `status`, `repository_selection`, `permissions`, `installed_at`, `last_synced_at`.
   - `github_installation_states`: `id`, `state_hash` (UNIQUE), `user_id`, `expires_at`, `consumed_at`.
   - `github_repositories`: `id`, `installation_id`, `github_repository_id` (UNIQUE), `owner_login`, `name`, `full_name`, `default_branch`, `private`, `archived`, `disabled`, `html_url`, `removed_at`.
   - `github_webhook_events`: `id`, `github_delivery_id` (UNIQUE), `event_type`, `action`, `payload`, `payload_sha256`, `processing_status`, `attempts`, `available_at`, `locked_until`, `locked_by`.
   - `service_sources`: `id`, `service_id` (UNIQUE), `repository_id`, `branch`, `root_directory`, `dockerfile_path`, `build_configuration`, `auto_deploy`, `source_status`, `disconnect_reason`, `last_seen_commit_sha`, `last_deployment_id`.

---

## 4. Implemented API Endpoints

### 4.1 GitHub App Installation & Synchronization
- `POST /v1/github/installations`:
  - Auth: Supabase Bearer token; creates state owned by the authenticated user.
  - Response: `201 Created` with `installation_url` and `state_expires_at`.
- `GET /v1/integrations/github/callback`:
  - Auth: Public browser redirect with query params (`installation_id`, `state`, `setup_action`).
  - Behavior: Validates state, consumes atomically, verifies GitHub installation, upserts installation & repos, audits, redirects browser to frontend return URL.
- `GET /v1/github/installations`:
  - Auth: Supabase Bearer token; lists only the authenticated user's installations.
  - Response: `200 OK` list of installations (no secrets).
- `GET /v1/github/installations/{installation_id}`:
  - Auth: Supabase Bearer token; installation must belong to the authenticated user.
  - Response: `200 OK` installation detail.
- `DELETE /v1/github/installations/{installation_id}`:
  - Auth: Supabase Bearer token; installation must belong to the authenticated user.
  - Behavior: Marks installation disconnected, disconnects dependent service sources, writes audit record.
- `GET /v1/github/installations/{installation_id}/repositories`:
  - Auth: Supabase Bearer token; installation must belong to the authenticated user.
  - Response: `200 OK` paginated repositories list.
- `POST /v1/github/installations/{installation_id}/sync`:
  - Auth: Supabase Bearer token; installation must belong to the authenticated user.
  - Behavior: Refreshes repositories from GitHub REST API, marks removed repos, disconnects orphaned sources.

### 4.2 Service Source & Deployments
- `PUT /v1/services/{service_id}/source`:
  - Auth: Supabase Bearer token (`owner`, `admin`, or `member`).
  - Request: `{repository_id, branch, root_directory, dockerfile_path, auto_deploy}`.
  - Validation: Verifies repository belongs to an active installation owned by the service's user; validates paths.
  - Response: `200 OK` service source configuration.
- `GET /v1/services/{service_id}/source`:
  - Auth: Supabase Bearer token.
  - Response: `200 OK` connected source configuration and repository metadata.
- `PATCH /v1/services/{service_id}/source`:
  - Auth: Supabase Bearer token.
  - Request: Partial updates to `branch`, `root_directory`, `dockerfile_path`, `auto_deploy`.
- `DELETE /v1/services/{service_id}/source`:
  - Auth: Supabase Bearer token.
  - Behavior: Marks source disconnected (`source_status='disconnected'`).
- `POST /v1/services/{service_id}/deployments`:
  - Auth: Supabase Bearer token.
  - Request: `{source: {ref: "refs/heads/main"}, reason: "manual"}`.
  - Behavior: Resolves ref to exact commit SHA via GitHub API, checks idempotency key, persists `deployments`, `build_jobs`, and outbox `deployment.build.requested` record.

### 4.3 Webhook Intake
- `POST /v1/webhooks/github`:
  - Auth: Raw HMAC-SHA256 signature (`X-Hub-Signature-256`).
  - Behavior: Checks duplicate delivery ID; persists event to `github_webhook_events` as `received`; returns `200 OK`.

### 4.4 Worker Credential Broker (Internal)
- `POST /internal/v1/build-requests/{build_request_id}/source-token`:
  - Auth: M2M Bearer credential (`WORKER_JWT_SECRET`).
  - Behavior: Verifies build job eligibility, verifies active installation, mints short-lived repository-scoped token via GitHub App client, audits token issuance without logging value, returns `{token, expires_at, repository: {clone_url, commit_sha}}`.

---

## 5. Webhook Events Supported

- **`push`**:
  - Filters out deleted branch refs, tag refs, zero-SHAs, and suspended installations.
  - Matches active `service_sources` where `auto_deploy = true`.
  - Transactionally creates `deployments`, `build_jobs`, and outbox events (`deployment.build.requested`) with idempotency key `gh-push:{delivery_id}:{service_id}`.
- **`installation`**:
  - `created` / `unsuspend`: Restores installation status to `active`.
  - `deleted`: Sets installation to `revoked`, marks dependent sources disconnected (`github_app_uninstalled`).
  - `suspend`: Sets installation to `suspended`, blocks dependent sources (`github_app_suspended`).
- **`installation_repositories`**:
  - `added`: Upserts newly authorized repositories.
  - `removed`: Marks repositories as `removed_at = now()`, blocks dependent sources (`github_repository_removed`).

---

## 6. GitHub App Permissions & Webhook Subscriptions

### Permissions
- **Repository Metadata:** `Read-only` (Identify repositories and installation scope).
- **Repository Contents:** `Read-only` (Source checkout and commit SHA resolution).
- **Organization/Account:** `None` (Zero organization-level read/write permissions required).

### Webhook Subscriptions
- `push`
- `installation`
- `installation_repositories`

---

## 7. Secrets and Configuration

| Variable | Recommended Storage | Purpose |
|---|---|---|
| `GITHUB_APP_ID` | Environment / Config | Numeric GitHub App ID |
| `GITHUB_APP_SLUG` | Environment / Config | GitHub App slug for installation URLs |
| `GITHUB_APP_PRIVATE_KEY_OPENBAO_PATH` | OpenBao | Path to RSA private key (PEM) |
| `GITHUB_WEBHOOK_SECRET_OPENBAO_PATH` | OpenBao | Path to webhook HMAC secret |
| `WORKER_JWT_SECRET_OPENBAO_PATH` | OpenBao | Path to M2M worker shared secret / JWT key |
| `SUPABASE_JWKS_URL` | Environment / Config | Supabase Auth JWKS endpoint for token validation |
| `SUPABASE_JWT_ISSUER` | Environment / Config | Supabase Auth issuer URL |
| `PLATFORM_FRONTEND_BASE_URL` | Environment / Config | Base URL for post-installation redirects |
| `DATABASE_URL` | Environment | PostgreSQL connection pool URL |

In local development, the secret router automatically supports fallback to environment variables (`GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `WORKER_JWT_SECRET`).

---

## 8. Automated Test Results

All packages pass 100% clean across unit and integration tests:

```text
ok   github.com/summit/backend/internal/audit          (0.003s)
ok   github.com/summit/backend/internal/auth           (0.082s)
ok   github.com/summit/backend/internal/authz          (0.003s)
ok   github.com/summit/backend/internal/config         (0.003s)
ok   github.com/summit/backend/internal/db             (0.003s)
ok   github.com/summit/backend/internal/githubapi      (0.004s)
ok   github.com/summit/backend/internal/githubapp      (3.121s)
ok   github.com/summit/backend/internal/githubwebhook  (0.004s)
ok   github.com/summit/backend/internal/githubworker   (0.004s)
ok   github.com/summit/backend/internal/httpx          (0.010s)
ok   github.com/summit/backend/internal/installstate   (0.011s)
ok   github.com/summit/backend/internal/secrets        (0.005s)
ok   github.com/summit/backend/internal/server         (0.003s)
ok   github.com/summit/backend/internal/sourcepath     (0.003s)
ok   github.com/summit/backend/internal/testutil       (0.003s)
```

---

## 9. Security Considerations & Deviations

1. **Exact Commit SHA Binding:** The API strictly enforces that build requests cannot be triggered from mutable refs; refs are resolved to immutable commit SHAs before persistence. Full SHA hashes (including 64-character Git SHA-256) are preserved without truncation, with `deployments.git_commit_sha` widened to `VARCHAR(64)` in migration 0002.
2. **Path Sanitization:** Root directory and Dockerfile paths are strictly validated through `sourcepath`, disallowing `..`, `/`, and null bytes.
3. **Delivery Deduplication:** Webhooks are deduplicated at the PostgreSQL constraint level (`UNIQUE(github_delivery_id)`).
4. **Token Cache Invalidation:** `githubapp.Client` supports explicit cache invalidation (`InvalidateInstallationTokens`) invoked upon installation disconnection, suspension, or deletion.
5. **Deviation Note (Spec 6.7):** Instead of maintaining a separate duplicate `build_requests` table, the existing baseline `build_jobs` table is used as the durable build request queue, eliminating redundant state while preserving all required fields (`service_source_id`, `repository_id`, `commit_sha`, `ref`, `status`).

---

## 10. Multi-Agent Review Resolutions

Following multi-agent review across Standards, Spec Compliance, and Security axes, the following enhancements were applied and verified:
- **Standards:** Decoupled `githubapi.Handler` using a consumer-defined `ServiceAPI` interface; fixed private key error wrapping with `%w` in `githubapp.Client`; changed `ErrSecretNotFound` to use `errors.New`.
- **Spec Compliance:** Widened `deployments.git_commit_sha` to `VARCHAR(64)` and removed 40-character truncation in `CreateManualDeployment`; added `services.type` validation in `PutServiceSource` ensuring only `web` and `worker` services can bind source repositories; added token cache invalidation on disconnect/suspension; added `new_permissions_accepted` and automatic repo sync on `created`/`unsuspend` webhook events.
- **Security:** Verified zero secrets logged or persisted; all 5 Section 15 security areas passing.
