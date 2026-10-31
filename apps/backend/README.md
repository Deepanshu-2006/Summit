# Summit Backend Service

Go backend service scaffold for the Summit / Jetway PaaS Control Plane.

## Overview

The service provides a minimal, idiomatic Go HTTP foundation aligned with the monorepo's canonical OpenAPI 3.1 contract (`packages/api_spec/openapi.yaml`). It uses the Go standard library for routing, structured logging (`log/slog`), and graceful shutdown, with no third-party dependencies.

The service is also the `@summit/backend` pnpm workspace package. Its `package.json` exposes `dev`, `build`, `lint`, and `test` scripts to Turborepo; the Go module remains the only Go dependency definition.

## Directory Layout

```text
apps/backend/
├── cmd/
│   └── api/
│       └── main.go           # Executable entrypoint & signal handling
├── internal/
│   ├── config/
│   │   └── config.go         # Environment-based configuration with safe defaults
│   ├── health/
│   │   └── handler.go        # OpenAPI-compliant health endpoint handler
│   └── server/
│       └── server.go         # HTTP server, routing, CORS, and graceful shutdown
├── bin/                      # Local build output (gitignored)
├── go.mod                    # Go module definition
├── package.json              # Turborepo task adapter
└── README.md                 # Service documentation
```

## Configuration

Runtime behavior is configured via environment variables with safe defaults:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP listen port |
| `HOST` | `""` | Listen host / IP (empty listens on all interfaces) |
| `SERVICE_NAME` | `meridian-api` | Service name in health response |
| `SERVICE_VERSION` | `1.0.0` | Service version in health response |
| `REGION` | `cdg-1 (Paris)` | Edge region reported in health telemetry |
| `EDGE_ROUTING` | `anycast` | Edge routing policy reported in health response |
| `ENVIRONMENT` | `development` | Deployment environment (`development`, `staging`, `production`) |

## Development & Build Commands

Run the service locally:

```bash
# From workspace root, through Turborepo:
pnpm dev:backend

# From workspace root, scoped directly to the package:
pnpm --filter @summit/backend dev

# Or directly from apps/backend:
go run ./cmd/api
```

Build the service binary to `apps/backend/bin/api`:

```bash
# From workspace root, through Turborepo:
pnpm build:backend

# Or from apps/backend:
go build -o bin/api ./cmd/api
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
# From workspace root, through Turborepo:
pnpm test:backend

# Or from apps/backend:
go test ./...
```

## Endpoints

| Method | Path | Description | Spec Ref |
|---|---|---|---|
| `GET`, `HEAD` | `/api/v1/health` | System health, heartbeat, and routing telemetry | `#/components/schemas/HealthResponse` |
| `GET`, `HEAD` | `/health` | Cluster heartbeat / liveness probe alias | `#/components/schemas/HealthResponse` |
| `OPTIONS` | `/*` | CORS preflight responder | - |
