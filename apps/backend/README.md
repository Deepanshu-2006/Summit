# Summit Backend Service

Go backend service scaffold for the Summit / Jetway PaaS Control Plane.

## Overview

The service provides a minimal, idiomatic Go HTTP foundation aligned with the monorepo's canonical OpenAPI 3.1 contract (`packages/api_spec/openapi.yaml`). It uses the Go standard library for routing, structured logging (`log/slog`), and graceful shutdown, with no third-party dependencies.

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
├── go.mod                    # Go module definition
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
# From workspace root:
pnpm dev:backend

# Or directly from apps/backend:
go run ./cmd/api
```

Build the service binary:

```bash
# From workspace root:
pnpm build:backend

# Or from apps/backend:
go build ./...
```

Run static analysis:

```bash
# From workspace root:
pnpm lint:backend

# Or from apps/backend:
go vet ./...
```

## Endpoints

| Method | Path | Description | Spec Ref |
|---|---|---|---|
| `GET`, `HEAD` | `/api/v1/health` | System health, heartbeat, and routing telemetry | `#/components/schemas/HealthResponse` |
| `GET`, `HEAD` | `/health` | Cluster heartbeat / liveness probe alias | `#/components/schemas/HealthResponse` |
| `OPTIONS` | `/*` | CORS preflight responder | - |
