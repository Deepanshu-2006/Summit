# Summit monorepo

Summit is organized as a pnpm workspace for the Next.js UI and shared TypeScript packages, alongside a Go service for the backend. The OpenAPI document is the API contract shared by the UI and backend teams.

```text
apps/
  web/                 Next.js frontend
  backend/             Go API service
packages/
  api_spec/            OpenAPI 3.1 contract and TypeScript API models
docs/
  system_architechture.png
```

The OpenAPI file describes the intended HTTP API. A path in the spec does not mean the backend has implemented it yet; implementation status belongs in the relevant backend work.

The handed-off UI still contains Next.js route handlers and an in-memory Meridian demo store. Treat those as prototype behavior, not the platform API implementation. New backend endpoints belong in `apps/backend`; the UI can switch from its demo routes to the Go service as those endpoints are implemented.

## Requirements

- Node.js supported by Next.js 16
- pnpm 12.15.0 (declared in the root `package.json`)
- Go 1.23 or newer

## Install and run

Install the JavaScript workspace dependencies from the repository root:

```bash
pnpm install
```

Run the frontend and backend in separate terminals:

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
| `pnpm dev:web` | Start the Next.js frontend |
| `pnpm dev:backend` | Start the Go API service |
| `pnpm build` | Build JavaScript workspace packages and the Go service |
| `pnpm lint` | Lint JavaScript packages and run `go vet` on the backend |
| `pnpm typecheck` | Type-check JavaScript/TypeScript workspace packages |
| `pnpm typecheck:web` | Type-check the frontend |
| `pnpm typecheck:api` | Type-check the shared API package |

Go-only code changes can also be checked from the repository root with `go -C apps/backend vet ./...` and built with `go -C apps/backend build ./...`.

## API contract workflow

Edit `packages/api_spec/openapi.yaml` first when changing an HTTP endpoint, request, response, or error shape. Coordinate the contract change with both teams, then update the Go handler and frontend client to match. The OpenAPI document is the source of truth; generated clients or server stubs should be added only when the team chooses and maintains a generation workflow.

## Ownership

- `apps/web`: frontend UI and API client integration.
- `apps/backend`: Go control-plane API implementation.
- `packages/api_spec`: versioned API contract and shared TypeScript types.
- `docs`: architecture references.

Keep credentials in local environment files. Commit only safe placeholders such as `.env.example`.
