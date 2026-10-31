# Summit monorepo

Summit is organized as a Turborepo monorepo. pnpm manages the JavaScript/TypeScript workspace and dependencies, while Turborepo orchestrates build, lint, typecheck, test, and dev tasks across the Next.js UI, shared TypeScript packages, and the Go backend. The Go service remains a single Go module under `apps/backend`; a small workspace package exposes its commands to Turborepo.

```text
apps/
  web/                 Next.js frontend
  backend/             Go API service and Turbo task adapter
packages/
  api_spec/            OpenAPI 3.1 contract and TypeScript API models
docs/
  system_architechture.png
turbo.json             Turborepo task graph and cache configuration
```

The OpenAPI file describes the intended HTTP API. A path in the spec does not mean the backend has implemented it yet; implementation status belongs in the relevant backend work.

The handed-off UI still contains Next.js route handlers and an in-memory Meridian demo store. Treat those as prototype behavior, not the platform API implementation. New backend endpoints belong in `apps/backend`; the UI can switch from its demo routes to the Go service as those endpoints are implemented.

## Requirements

- Node.js supported by Next.js 16
- pnpm 12.15.0 (declared in the root `package.json`)
- Go 1.23 or newer
- Turborepo is installed as a root dev dependency by `pnpm install`; no global install is required

## Install and run

Install the JavaScript workspace dependencies from the repository root:

```bash
pnpm install
```

Run the frontend and backend together:

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:web
```

```bash
pnpm dev:backend
```

The frontend runs at `http://localhost:3000`. The backend listens on its configured local address; see `apps/backend/README.md` for its port and environment settings.

## Workspace commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js frontend and Go API service |
| `pnpm dev:web` | Start only the Next.js frontend |
| `pnpm dev:backend` | Start only the Go API service |
| `pnpm build` | Build JavaScript workspace packages and the Go service |
| `pnpm build:backend` | Build only the Go service |
| `pnpm lint` | Lint JavaScript packages and run `go vet` on the backend |
| `pnpm lint:backend` | Run `go vet` on the backend only |
| `pnpm typecheck` | Type-check JavaScript/TypeScript workspace packages |
| `pnpm typecheck:web` | Type-check the frontend |
| `pnpm typecheck:api` | Type-check the shared API package |
| `pnpm test` | Run Go tests and any future JavaScript test suites |
| `pnpm test:backend` | Run Go tests only |

Go-only code changes can also be checked from the repository root with `go -C apps/backend vet ./...` and built with `go -C apps/backend build ./...`.

## Task orchestration

Turborepo reads `turbo.json` and runs each package's `package.json` scripts. The Go backend participates through `apps/backend/package.json`, which delegates to the Go toolchain. `go.mod` remains the only Go module definition; Turborepo does not replace Go modules or `go test`.

- `build` depends on dependencies' build tasks, so `@summit/api-spec` is compiled before `apps/web` builds or type-checks.
- `dev` and `typecheck` also depend on dependency builds. A clean checkout can run `pnpm dev` or `pnpm typecheck` without manually building `@summit/api-spec` first.
- Cached outputs include `.next`, `dist`, and `apps/backend/bin`. The local cache lives in `.turbo/`.
- Run a subset with filters, for example `pnpm exec turbo run build --filter=@summit/web` or `pnpm exec turbo run test --filter=@summit/backend`.

## API contract workflow

Edit `packages/api_spec/openapi.yaml` first when changing an HTTP endpoint, request, response, or error shape. Coordinate the contract change with both teams, then update the Go handler and frontend client to match. The OpenAPI document is the source of truth; generated clients or server stubs should be added only when the team chooses and maintains a generation workflow.

## Ownership

- `apps/web`: frontend UI and API client integration.
- `apps/backend`: Go control-plane API implementation and its Turbo task adapter.
- `packages/api_spec`: versioned API contract and shared TypeScript types.
- `turbo.json` and the root `package.json`: workspace task orchestration.
- `docs`: architecture references.

Keep credentials in local environment files. Commit only safe placeholders such as `.env.example`.
