# Summit Jetway PaaS Monorepo

Enterprise multi-package monorepo for the Summit & Jetway Developer Platform, integrating an editorial Next.js frontend, an OpenAPI-standardized contract layer, and a dedicated backend service.

```
.
├── apps/
│   ├── web/                    # Next.js 16 (Turbopack + Tailwind v4) Frontend
│   └── backend/                # Fastify + TypeScript PaaS Control Plane API
├── packages/
│   └── api_spec/               # OpenAPI 3.1.0 Contract & Shared TypeScript Types
├── docs/                       # System Architecture & Topology Diagrams
├── pnpm-workspace.yaml         # PNPM Workspace Configuration
└── package.json                # Root Workspace Scripts
```

---

## Workspace Structure & Team Ownership

### 1. `apps/web` (Frontend Application)
- **Framework**: Next.js 16.4.3, React 19, Tailwind CSS v4, Motion, Three.js
- **Responsibility**: Houses the interactive marketing experience, isometric WebGL construction canvas, API sandbox, and live pipeline monitors.
- **Contract Integration**: Consumes `@summit/api-spec` workspace types for zero-drift API models.
- **Run Locally**:
  ```bash
  pnpm dev:web
  # or from apps/web: pnpm dev (runs on http://localhost:3000)
  ```

### 2. `apps/backend` (Backend Platform Service)
- **Framework**: Fastify 5 + TypeScript + CORS
- **Responsibility**: Implements the Kubernetes control plane endpoints, resource provisioning, build queue, and Prometheus/Loki observability APIs as defined in [system_architechture.png](docs/system_architechture.png).
- **Interactive OpenAPI Spec**: Exposes `/openapi.yaml` and handles all `/api/v1/*` contracts.
- **Run Locally**:
  ```bash
  pnpm dev:backend
  # or from apps/backend: pnpm dev (runs on http://localhost:4000)
  ```

### 3. `packages/api_spec` (OpenAPI Contract & Shared Types)
- **Standard**: OpenAPI 3.1.0 specification (`openapi.yaml`).
- **Exports**: Strongly-typed TypeScript interfaces (`HealthResponse`, `Project`, `ResourceItem`, `ReleaseItem`, `MetricsResponse`, etc.) shared across both frontend and backend.
- **Build / Check**:
  ```bash
  pnpm --filter @summit/api-spec build
  ```

---

## Getting Started

### Prerequisites
- Node.js `>= 20` (Node 24 recommended via `mise`)
- PNPM `>= 12.15.0`

### Installation
Install workspace dependencies:
```bash
pnpm install
```

### Development
Run all services concurrently:
```bash
pnpm dev:all
```
Or run individually:
```bash
pnpm dev:web       # Frontend at http://localhost:3000
pnpm dev:backend   # Backend at http://localhost:4000
```

### Production Build
Build all apps and packages in topological order:
```bash
pnpm build
```

---

## API & OpenAPI Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Cluster heartbeat, uptime, and edge routing region |
| `/api/v1/projects` | `GET` | List provisioned projects |
| `/api/v1/projects/:slug` | `GET` | Real-time operational topology & service health |
| `/api/v1/resources` | `GET`, `POST` | Infrastructure provisioning (Postgres, Key-Value, S3, SSL) |
| `/api/v1/releases` | `GET`, `POST` | Release trigger with semver verification & deployment state |
| `/api/v1/observability/metrics` | `GET` | Prometheus cluster telemetry (CPU, RAM, RPS) |
| `/api/v1/observability/logs` | `GET` | Grafana Loki structured log stream |
| `/openapi.yaml` | `GET` | Full raw OpenAPI 3.1.0 specification |
