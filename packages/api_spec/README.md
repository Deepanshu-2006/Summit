# @summit/api-spec

The canonical OpenAPI 3.1 specification and shared TypeScript API contracts for the Summit platform monorepo.

## Role & Monorepo Architecture

`@summit/api-spec` is the central contract package connecting the monorepo's two core application layers:

- **Frontend (`apps/web`)**: Next.js application consuming shared TypeScript types and integrating with the control plane APIs.
- **Backend (`apps/backend`)**: Go service where the platform's control plane endpoints will be implemented against this contract.

> **Contract-First Source of Truth**: `openapi.yaml` in this package is the canonical source of truth for all HTTP API definitions, request payloads, response envelopes, query/path parameters, and status codes. Any API change must begin with an update to `openapi.yaml`.

## Specification vs. Implementation Status

The presence of an endpoint, operation, or schema in `openapi.yaml` defines the **agreed API contract** across teams. It does **not** denote that the endpoint is currently implemented by the Go backend. Implementation tracking, handler readiness, and service features belong strictly to the `apps/backend` service lifecycle and tasks.

## Package Structure

```text
packages/api_spec/
├── openapi.yaml      # Canonical OpenAPI 3.1.0 contract
├── src/
│   └── index.ts      # TypeScript interfaces aligned 1:1 with openapi.yaml
├── dist/             # Compiled JavaScript and TypeScript declarations (.d.ts)
├── package.json      # Package exports and build scripts
├── tsconfig.json     # TypeScript compiler configuration
└── README.md         # Package documentation and integration guide
```

## Cross-Package Integration

### 1. Next.js Frontend (`apps/web`)

The Next.js frontend imports models directly from `@summit/api-spec`:

```typescript
import type {
  Project,
  ProjectListResponse,
  ResourceItem,
  CreateResourceRequest,
  ReleaseItem,
  MetricsResponse,
  ErrorResponse,
} from "@summit/api-spec";
```

### 2. Go Backend Service (`apps/backend`)

The Go backend uses `packages/api_spec/openapi.yaml` as the authoritative specification:
- Handler routing and request/response models in Go correspond to the operation IDs and schemas specified in `openapi.yaml`.
- Go OpenAPI tools (such as `ogen`, `oapi-codegen`, or schema validation middleware) can reference `packages/api_spec/openapi.yaml` directly to generate server scaffolding or validation types.

## Available Endpoints Summary

All endpoints follow the `/api/v1` prefix:

| Tag | Method | Path | Operation ID | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/v1/health` | `getHealth` | Service heartbeat, routing region, uptime |
| **Projects** | `GET` | `/api/v1/projects` | `listProjects` | List provisioned tenant projects |
| **Projects** | `GET` | `/api/v1/projects/{slug}` | `getProjectBySlug` | Real-time project topology & service health |
| **Resources** | `GET` | `/api/v1/resources` | `listResources` | Inventory of provisioned infrastructure resources |
| **Resources** | `POST` | `/api/v1/resources` | `createResource` | Provision databases, caches, buckets, SSL certificates |
| **Resources** | `GET` | `/api/v1/resources/{id}` | `getResourceById` | Retrieve single infrastructure resource details |
| **Resources** | `DELETE` | `/api/v1/resources/{id}` | `deleteResource` | Queue resource for deprovisioning |
| **Releases** | `GET` | `/api/v1/releases` | `listReleases` | Historical deployment releases & pipeline states |
| **Releases** | `POST` | `/api/v1/releases` | `createRelease` | Trigger release deployment to edge mesh |
| **Observability** | `GET` | `/api/v1/observability/metrics` | `getMetrics` | Prometheus cluster telemetry (CPU, memory, RPS) |
| **Observability** | `GET` | `/api/v1/observability/logs` | `getLogs` | Stream structured logs from pods and edge routers |

## Scripts

From repository root:
```bash
# Build the TypeScript declaration files and JavaScript bundle
pnpm --filter @summit/api-spec build

# Typecheck the package
pnpm --filter @summit/api-spec typecheck
```

Or from `packages/api_spec`:
```bash
pnpm build
pnpm typecheck
```
