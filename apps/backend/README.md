# Summit Backend Service

Go backend control-plane service and worker engine for the Summit PaaS platform.

## Overview

The service provides a Go HTTP control plane documented by the monorepo's canonical OpenAPI 3.1 contract (`packages/api_spec/openapi.yaml`) and current GitHub integration guide (`docs/integrations/github/FRONTEND_INTEGRATION.md`). It uses standard-library HTTP routing, structured logging (`log/slog`), PostgreSQL persistence with advisory-locked migrations (`jackc/pgx/v5`), Supabase JWT verification, personal-user ownership checks, OpenBao secrets routing, and asynchronous webhook processing.

The service is also the `@summit/backend` pnpm workspace package. Its `package.json` exposes `dev`, `build`, `lint`, and `test` scripts to Turborepo; `go.mod` remains the only Go module definition.

## Directory Layout

```text
apps/backend/
├── cmd/
│   ├── api/
│   │   └── main.go           # Application entrypoint & worker lifecycle spawner
│   └── migrate/
│       └── main.go           # Standalone advisory-locked database migration CLI
├── internal/
│   ├── audit/                # Redacted audit logging publisher
│   ├── auth/                 # Supabase JWT verifier (JWKS / HS256) & user synchronizer
│   ├── authz/                # Multi-tenant RBAC permission matrix & middleware
│   ├── config/               # Environment configuration with production safety checks
│   ├── db/                   # pgxpool connection manager & advisory-locked migration runner
│   │   └── migrations/       # SQL migrations (0001_baseline, 0002_github_integration)
│   ├── githubapi/            # REST API handlers for installations, repositories & sources
│   ├── githubapp/            # GitHub App REST client, RS256 JWT, token cache & invalidator
│   ├── githubwebhook/        # Raw HMAC-SHA256 signature verifier & payload normalizer
│   ├── githubworker/         # Async SKIP LOCKED poller & worker credential broker
│   ├── health/               # Health telemetry & liveness probe handlers
│   ├── httpx/                # RFC 7807 standard JSON error envelopes & response helpers
│   ├── installstate/         # Single-use CSRF installation state generator & SHA-256 verifier
│   ├── secrets/              # OpenBao AppRole client & multi-tier secrets router
│   ├── server/               # HTTP router multiplexer, CORS, & graceful shutdown
│   ├── sourcepath/           # Lexical path traversal sanitizer & branch/SHA validator
│   └── testutil/             # Schema-isolated PostgreSQL test database runner
├── bin/                      # Local build output (gitignored)
├── go.mod                    # Go 1.23 module definition
├── go.sum                    # Checksums for Go dependencies
├── package.json              # Turborepo task adapter
└── README.md                 # Service documentation
```

## Configuration

Runtime behavior is configured via environment variables with safe defaults:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP listen port |
| `HOST` | `""` | Listen host / IP (empty listens on all interfaces) |
| `DATABASE_URL` | `postgres://...` | PostgreSQL connection string (`pgxpool`) |
| `TEST_DATABASE_URL` | `""` | Optional database URL for running DB integration tests |
| `ENVIRONMENT` | `development` | Deployment environment (`development`, `staging`, `production`) |
| `SUPABASE_URL` | `""` | Supabase project URL (used for fetching JWKS keys) |
| `SUPABASE_JWT_SECRET` | `""` | Supabase HMAC-SHA256 fallback secret |
| `OPENBAO_ADDR` | `""` | OpenBao / Vault server address |
| `OPENBAO_ROLE_ID` | `""` | OpenBao AppRole Role ID |
| `OPENBAO_SECRET_ID` | `""` | OpenBao AppRole Secret ID |
| `GITHUB_APP_ID` | `0` | GitHub App numeric Application ID |
| `GITHUB_APP_PRIVATE_KEY` | `""` | PEM-encoded RSA private key for GitHub App JWT signing |
| `GITHUB_WEBHOOK_SECRET` | `""` | Secret used to verify `X-Hub-Signature-256` webhook headers |
| `WORKER_JWT_SECRET` | `""` | Secret for authenticating internal build worker token broker calls |

> [!NOTE]
> In `development`, secrets fall back to local environment variables if OpenBao is unreachable. In `production`, fallback is strictly disabled to prevent insecure execution.

## Development & Build Commands

Run the service locally:

```bash
# From workspace root, through Turborepo:
pnpm dev:backend

# Or directly from apps/backend:
go run ./cmd/api
```

Run database migrations:

```bash
go run ./cmd/migrate
```

Build the service binaries to `apps/backend/bin/`:

```bash
# From workspace root, through Turborepo:
pnpm build:backend

# Or from apps/backend:
go build -o bin/api ./cmd/api
go build -o bin/migrate ./cmd/migrate
```

Run static analysis:

```bash
# From workspace root, through Turborepo:
pnpm lint:backend

# Or from apps/backend:
go vet ./...
```

Run tests:

```bash
# Unit tests across all packages:
pnpm test:backend

# Or with database integration tests against a local PostgreSQL container:
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/summit_test?sslmode=disable" go test -v -count=1 ./...
```

## Implemented Endpoints

### 1. Health & Telemetry
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET`, `HEAD` | `/api/v1/health` | Public | System health, heartbeat, and routing telemetry |
| `GET`, `HEAD` | `/health` | Public | Liveness probe alias |

### 2. GitHub App Integration (`/v1/...`)
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/v1/github/installations` | Bearer (authenticated user) | Generate installation URL with single-use cryptographic state |
| `GET` | `/v1/integrations/github/callback` | Public redirect | Complete OAuth callback handshake and initiate repository sync |
| `GET` | `/v1/github/installations` | Bearer (installation owner) | List the authenticated user's GitHub installations |
| `GET` | `/v1/github/installations/{id}` | Bearer (installation owner) | Get installation details |
| `DELETE` | `/v1/github/installations/{id}` | Bearer (installation owner) | Disconnect installation and cascade disconnect service sources |
| `GET` | `/v1/github/installations/{id}/repositories` | Bearer (installation owner) | List authorized repositories with pagination |
| `POST` | `/v1/github/installations/{id}/sync` | Bearer (installation owner) | Trigger immediate repository re-synchronization |
| `PUT` | `/v1/services/{service_id}/source` | Bearer (service owner) | Connect repository/branch to service (`web` or `worker`) |
| `GET` | `/v1/services/{service_id}/source` | Bearer (service owner) | Get configured service source repository and branch |
| `PATCH` | `/v1/services/{service_id}/source` | Bearer (service owner) | Update branch, build directory, or auto-deploy toggle |
| `DELETE` | `/v1/services/{service_id}/source` | Bearer (service owner) | Disconnect source repository from service |
| `POST` | `/v1/services/{service_id}/deployments` | Bearer (service owner) | Trigger manual deployment resolving ref to exact commit SHA |

### 3. Webhooks & Internal Worker Broker
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/v1/webhooks/github` | Raw HMAC (`X-Hub-Signature-256`) | Webhook intake with deduplication on `X-GitHub-Delivery` |
| `POST` | `/internal/v1/build-requests/{id}/source-token` | M2M Bearer (`WORKER_JWT_SECRET`) | Issue short-lived repository clone token to build workers |
