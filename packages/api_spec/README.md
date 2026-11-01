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

Paths are the Go backend's own (the Next.js proxy maps `/api/platform/v1/*` to `/v1/*`). Every `/v1` route needs a Supabase Bearer token and is scoped to the authenticated user.

| Tag | Method | Path | Operation ID | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/v1/health` | `getHealth` | Service heartbeat, routing region, uptime |
| **Authentication** | `POST` | `/v1/auth/profile` | `syncAuthenticatedUserProfile` | Upsert the caller's profile |
| **Projects** | `GET` | `/v1/projects` | `listProjects` | Paginated projects with service count and latest deployment |
| **Projects** | `POST` | `/v1/projects` | `createProject` | Create a project (slug derived from name if omitted) |
| **Projects** | `GET` | `/v1/projects/{project_id}` | `getProject` | Project with environments and services |
| **Projects** | `PATCH` | `/v1/projects/{project_id}` | `updateProject` | Rename a project |
| **Projects** | `DELETE` | `/v1/projects/{project_id}` | `deleteProject` | Soft-delete a project |
| **Projects** | `POST` | `/v1/projects/{project_id}/services` | `createProjectService` | Create a web or worker service |
| **Deployments** | `GET` | `/v1/projects/{project_id}/deployments` | `listProjectDeployments` | Paginated deployment history, newest first |
| **Deployments** | `GET` | `/v1/deployments/{deployment_id}` | `getDeployment` | Deployment with build job and events |
| **Deployments** | `POST` | `/v1/deployments/{deployment_id}/cancel` | `cancelDeployment` | Request cancellation of an in-flight deployment |
| **Deployments** | `GET` | `/v1/deployments/{deployment_id}/logs` | `listDeploymentLogs` | Build log lines, cursor-paginated by `after` |
| **Services** | `GET` | `/v1/services` | `listServices` | Flat list of deployable services |
| **Services** | `POST` | `/v1/services/{service_id}/deployments` | `createManualDeployment` | Trigger a manual deploy |

GitHub installation and service-source routes (`/v1/github/*`, `/v1/services/{service_id}/source`) are served by the backend but not yet described here.

## Scripts

From repository root:
```bash
# Build the TypeScript declaration files and JavaScript bundle
pnpm --filter @summit/api-spec build

# Typecheck the package
pnpm --filter @summit/api-spec typecheck

# Typecheck only the contract package through Turborepo
pnpm typecheck:api
```

Or from `packages/api_spec`:
```bash
pnpm build
pnpm typecheck
```

Turborepo runs this package's `build` task before `apps/web` builds or type-checks, because `apps/web` depends on `@summit/api-spec`. A clean checkout therefore does not need a manual build step before `pnpm dev` or `pnpm typecheck`.
