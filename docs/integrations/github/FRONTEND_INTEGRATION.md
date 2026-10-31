# GitHub Integration — Frontend & MCP Integration Guide

**Target Audience:** Next.js UI Developers & MCP Server Integrators  
**Backend Platform:** Go API (`apps/backend`)  
**Base URL:** `http://localhost:4000` (or `PLATFORM_PUBLIC_API_BASE_URL`)  
**API Version:** `/v1`

---

## 1. Architectural Principles

1. **Thin Client Philosophy:** The frontend (Next.js) and MCP servers must **never** call GitHub REST/GraphQL APIs directly for platform repository integration. All interactions go through the Go API.
2. **Zero Credentials on Clients:** Next.js and MCP must never store GitHub App private keys, App JWTs, webhook secrets, or installation access tokens.
3. **Authentication:** All user endpoints require a Supabase Auth access token in the `Authorization: Bearer <token>` header.
4. **Stable Platform Identifiers:** Resource operations use platform UUIDs (`installation_id`, `repository_id`, `service_id`), not GitHub's internal numeric IDs.

---

## 2. End-to-End User Journeys

### 2.1 Installing the GitHub App on an Organization

```text
Next.js (authenticated) 
  │ 
  │ 1. POST /v1/github/installations
  ▼
Go API (creates single-use state in DB)
  │
  │ Returns: { installation_url, state_expires_at }
  ▼
Next.js redirects user browser window to installation_url
  │
  │ User completes GitHub App installation flow on GitHub
  ▼
GitHub redirects browser to Go API callback:
  GET /v1/integrations/github/callback?installation_id=...&state=...
  │
  │ Go API validates state, links installation, synchronizes repositories
  ▼
Go API redirects browser back to Next.js:
  GET https://app.summit.dev/settings/github/callback?status=success&installation_id={uuid}
  │
  ▼
Next.js returns to the new-project flow and refreshes the installation and repository lists
```

#### Step 1: Initiate Installation Request
```http
POST /v1/github/installations
Authorization: Bearer <supabase_token>
Content-Type: application/json
```

**Response (`201 Created`):**
```json
{
  "installation_url": "https://github.com/apps/summit-platform/installations/new?state=c336b9f4296...",
  "state_expires_at": "2026-10-31T08:20:00Z"
}
```

#### Step 2: Handle Frontend Return Callback
Next.js handles `/settings/github/callback`, redirects back to the new-project page,
and reopens the repository selector. The selector reloads the user's installations
and repository records through the backend.

---

### 2.2 Selecting Repositories and Connecting to a Service

The frontend transport and typed integration functions are in
`apps/web/lib/github-integration.ts`. They call the Go API through the
same-origin `/api/platform/*` proxy, which forwards the Supabase access token
and reads `PLATFORM_PUBLIC_API_BASE_URL` on the server. The client functions
list the authenticated user's web/worker services, list installations, load
all repository cursor pages, start/refresh an installation, connect a repo,
read back the saved source, and disconnect it. They do not call GitHub APIs.


```text
Next.js
  │
  ├─► 1. GET /v1/github/installations
  │      Returns list of linked installations
  │
  ├─► 2. POST /v1/github/installations/{inst_id}/sync
  │      Upserts complete repository records through the existing paginated sync path
  │
  ├─► 3. GET /v1/github/installations/{inst_id}/repositories
  │      Returns synchronized database rows and their Summit UUIDs
  │
  ├─► 4. GET /v1/services
  │      Lists this user's web and worker services
  │
  └─► 5. PUT /v1/services/{service_id}/source
         Connects the repository, branch, and build settings to the service
```

#### Step 1: Sync and List Accessible Repositories
The frontend calls the backend sync endpoint before listing repositories. The
backend fetches every GitHub App installation page and upserts records by the
stable GitHub repository ID. The list endpoint then returns database UUIDs; the
browser never calls GitHub's REST API directly.

```http
POST /v1/github/installations/a01b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d/sync
Authorization: Bearer <supabase_token>
```

```http
```http
GET /v1/github/installations/a01b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d/repositories
Authorization: Bearer <supabase_token>
```

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "e5b7a123-4567-89ab-cdef-0123456789ab",
      "owner": "acme-corp",
      "name": "web-frontend",
      "full_name": "acme-corp/web-frontend",
      "default_branch": "main",
      "private": true,
      "html_url": "https://github.com/acme-corp/web-frontend"
    }
  ],
  "next_cursor": null
}
```

#### Step 2: Connect Repository to an Owned Service
The frontend first loads `GET /v1/services` and requires the user to choose one
of their web or worker services. The backend verifies both service ownership
and that the selected repository belongs to an active GitHub App installation
owned by that same user before it upserts `service_sources`.

```http
PUT /v1/services/d290f1ee-6c54-4b01-90e6-d701748f0851/source
Authorization: Bearer <supabase_token>
Content-Type: application/json

{
  "repository_id": "e5b7a123-4567-89ab-cdef-0123456789ab",
  "branch": "main",
  "root_directory": ".",
  "dockerfile_path": null,
  "build_configuration": {
    "build_command": "pnpm build"
  },
  "auto_deploy": true
}
```

**Response (`200 OK`):**
```json
{
  "id": "f8a12345-bcde-f012-3456-789abcdef012",
  "service_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "repository": {
    "id": "e5b7a123-4567-89ab-cdef-0123456789ab",
    "full_name": "acme-corp/web-frontend"
  },
  "branch": "main",
  "root_directory": ".",
  "dockerfile_path": null,
  "auto_deploy": true,
  "source_status": "active",
  "last_seen_commit_sha": null
}
```

---

### 2.3 Triggering a Manual Deployment

To trigger a deployment on demand without waiting for a git push:

```http
POST /v1/services/d290f1ee-6c54-4b01-90e6-d701748f0851/deployments
Authorization: Bearer <supabase_token>
Idempotency-Key: manual-deploy-20261031-01
Content-Type: application/json

{
  "source": {
    "ref": "refs/heads/main"
  },
  "reason": "manual"
}
```

**Response (`201 Created`):**
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "project_id": "8a1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a",
  "environment_id": "7a1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6b",
  "service_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "git_commit_sha": "7b3dcb6d8a1deb4d3b7d4bad9bdd2b0d7b3dcb6a",
  "git_branch": "main",
  "status": "queued",
  "created_at": "2026-10-31T08:25:00Z"
}
```

---

### 2.4 Disconnecting a Source or Revoking Installation

- **Disconnect Service Source:** `DELETE /v1/services/{service_id}/source`
  - Stops future auto-deployments for that service.
  - Does NOT delete deployment history or revoke the GitHub App installation.
- **Disconnect Installation:** `DELETE /v1/github/installations/{installation_id}`
  - Requires the authenticated user to own the installation.
  - Marks the installation disconnected and marks all connected service sources as `disconnected`.

---

## 3. MCP Server Tool Reference

MCP servers should expose the following tool definitions calling the Go API:

```json
[
  {
    "name": "list_github_installations",
    "description": "List GitHub App installations linked to the authenticated personal user.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "list_github_repositories",
    "description": "List synchronized repositories available from a GitHub App installation.",
    "parameters": {
      "type": "object",
      "properties": {
        "installation_id": { "type": "string", "format": "uuid" }
      },
      "required": ["installation_id"]
    }
  },
  {
    "name": "connect_github_repository",
    "description": "Connect a GitHub repository and branch to a platform application service.",
    "parameters": {
      "type": "object",
      "properties": {
        "service_id": { "type": "string", "format": "uuid" },
        "repository_id": { "type": "string", "format": "uuid" },
        "branch": { "type": "string" },
        "root_directory": { "type": "string", "default": "." },
        "dockerfile_path": { "type": "string" },
        "auto_deploy": { "type": "boolean", "default": true }
      },
      "required": ["service_id", "repository_id", "branch"]
    }
  },
  {
    "name": "trigger_service_deployment",
    "description": "Trigger a deployment from the connected GitHub source.",
    "parameters": {
      "type": "object",
      "properties": {
        "service_id": { "type": "string", "format": "uuid" },
        "ref": { "type": "string", "default": "refs/heads/main" }
      },
      "required": ["service_id"]
    }
  }
]
```

---

## 4. Standard Error Codes

The API returns standard JSON error responses:
```json
{
  "error": {
    "code": "GITHUB_REPOSITORY_NOT_FOUND",
    "message": "Repository not found or does not belong to the organization",
    "details": {}
  }
}
```

| Error Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Supabase Bearer token |
| `FORBIDDEN` | 403 | Authenticated user is not authorized to access the requested resource |
| `GITHUB_INSTALLATION_NOT_FOUND` | 404 | Installation ID does not exist for the authenticated user |
| `GITHUB_REPOSITORY_NOT_FOUND` | 404 | Repository ID not found |
| `SERVICE_SOURCE_NOT_FOUND` | 404 | No source connected to service |
| `SERVICE_SOURCE_INVALID_PATH` | 400 | Root directory or Dockerfile path contains path traversal (`..`) or invalid characters |
| `GITHUB_SOURCE_INVALID_BRANCH` | 400 | Branch name is empty or invalid git ref format |
| `CONFLICT` | 409 | Idempotency collision or resource already configured |
