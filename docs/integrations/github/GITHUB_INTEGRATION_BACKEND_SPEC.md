# GitHub Integration Backend --- Implementation Specification

**Document type:** Agent execution specification\
**Scope:** Backend implementation only\
**Platform:** Go control-plane API, PostgreSQL, Supabase Auth, GitHub
App, OpenBao, asynchronous build worker\
**Schema baseline:** Platform PostgreSQL Data Model V3 supplied by the
team\
**Status:** Implementation target\
**Out of scope:** Next.js UI implementation, MCP server implementation,
CLI implementation, browser components, design work

------------------------------------------------------------------------

# 0. Instructions to the implementation agent

You are implementing the complete backend foundation for GitHub
integration in an existing PaaS platform.

Treat this document as an implementation contract, not as a high-level
design suggestion. Inspect the existing repository and current database
schema before changing anything. Preserve established project
conventions where they do not conflict with this specification.

## Non-negotiable architectural philosophy

1.  **The Go API is the sole platform-facing backend interface.**
2.  Next.js and MCP are thin clients of the Go API. They must not
    implement GitHub App credentials, GitHub API calls, webhook
    verification, repository authorization, source selection rules or
    build triggering themselves.
3.  **Do not implement frontend code.** Do not modify Next.js
    pages/components, MCP tools, browser flows or CLI code. This task
    provides backend capabilities and a frontend integration guide.
4.  **Supabase Auth is the platform identity provider.** The Go API
    validates Supabase access tokens and performs platform
    authorization. Do not implement password auth, custom login OAuth,
    refresh-token storage or a second identity system.
5.  **GitHub App installation is separate from GitHub login.** Supabase
    GitHub OAuth, if enabled, authenticates a person. It does not grant
    this platform repository access. Repository access is through the
    platform's GitHub App.
6.  The platform database is the source of truth for platform resources
    and integration state.
7.  GitHub webhooks are untrusted, at-least-once, potentially duplicated
    and potentially out of order. Verify, persist, deduplicate and
    process asynchronously.
8.  Builds must use an exact commit SHA. Never build from a mutable
    branch name without resolving it to a commit first.
9.  The API owns authorization and integration policy. The builder owns
    source checkout and build execution. The API must not perform
    long-running source clones or builds in HTTP handlers.
10. Never expose GitHub App private keys, installation access tokens,
    Supabase service-role keys or OpenBao credentials to frontends or
    customer workloads.
11. All integration operations must be tenant-scoped, auditable,
    idempotent where applicable and safe to retry.
12. If a required existing contract differs from this specification,
    document the difference and propose the smallest compatible
    adjustment. Do not silently redesign unrelated platform modules.

## Required final output from the implementation agent

After implementation, write a detailed completion report at:

``` text
docs/integrations/github/IMPLEMENTATION_REPORT.md
```

Also write the frontend consumption guide at:

``` text
docs/integrations/github/FRONTEND_INTEGRATION.md
```

The completion report must list:

-   Every file created, modified or deleted.
-   Every database migration and schema change.
-   Every API endpoint implemented, including method, path,
    authentication, request and response.
-   Every webhook event supported.
-   GitHub App permissions and webhook subscriptions expected.
-   Secret/configuration variables and where they must be stored.
-   How to configure Supabase Auth and GitHub App settings.
-   How to run migrations, start services and test locally.
-   Automated tests added and their results.
-   Known limitations, deferred work and security considerations.
-   Any deviations from this specification, with reasons.

The frontend guide must explain exactly how Next.js and MCP can use the
backend capabilities without implementing GitHub logic themselves.
Include example HTTP requests, response types, error handling, auth
requirements and end-to-end flow sequences. Do not write frontend
implementation code.

Do not declare the task complete if migrations, tests, webhook
verification or the end-to-end GitHub-to-build handoff are missing.

------------------------------------------------------------------------

# 1. Objective and definition of success

Implement a complete backend GitHub integration that allows an
authenticated platform user to:

1.  Start installation of the platform's GitHub App on a GitHub user or
    organization account.
2.  Associate that GitHub App installation with a platform organization.
3.  List repositories available through the installation.
4.  Connect a repository and branch to an application service.
5.  Configure its build context and optional Dockerfile path.
6.  Receive GitHub webhook deliveries securely.
7.  Detect relevant pushes and installation/repository permission
    changes.
8.  Resolve the exact pushed commit and determine which connected
    services should build.
9.  Persist a deployment and build request transactionally.
10. Dispatch a durable build request to Member 4's build worker.
11. Provide status and source metadata through the Go API.
12. Disconnect, suspend or revoke integrations safely.
13. Audit all relevant user and system actions.

The primary end-to-end success scenario is:

``` text
Authenticated platform user
        |
        v
Go API creates GitHub App installation state
        |
        v
User installs platform GitHub App on GitHub
        |
        v
GitHub redirects to Go API callback
        |
        v
Go API validates state and installation
        |
        v
Installation linked to platform organization
        |
        v
Frontend requests available repositories from Go API
        |
        v
User connects repository/branch to a service
        |
        v
GitHub push webhook reaches Go API
        |
        v
Signature verification + delivery deduplication
        |
        v
Webhook event persisted and queued
        |
        v
Go API integration processor resolves matching service sources
        |
        v
Deployment + build request + outbox event committed
        |
        v
Build worker receives request
        |
        v
Worker obtains short-lived installation token
        |
        v
Worker clones exact commit SHA and builds
```

The frontend never calls GitHub APIs directly for platform repository
integration.

------------------------------------------------------------------------

# 2. System boundaries and responsibilities

## 2.1 Go API --- GitHub integration module

The Go API owns:

-   Supabase JWT verification middleware integration.
-   Platform user and organization authorization.
-   GitHub App installation initiation and callback.
-   Installation-to-platform-organization association.
-   GitHub API client using the App private key.
-   Short-lived installation token generation.
-   Repository discovery and synchronization.
-   Service source association and configuration.
-   GitHub webhook signature verification.
-   Webhook delivery deduplication and persistence.
-   Webhook event normalization and asynchronous processing.
-   Branch/ref matching and deployment intent creation.
-   Build request/outbox persistence.
-   Integration disconnection, suspension and revocation.
-   Audit events and safe integration status responses.
-   Internal credential/token access for authorized build workers.

## 2.2 Build worker --- Member 4

The build worker owns:

-   Receiving durable build requests.
-   Obtaining short-lived GitHub installation tokens through the
    approved internal mechanism.
-   Cloning the exact repository and commit SHA.
-   Handling private repository checkout.
-   Invoking Railpack and BuildKit.
-   Publishing image artifacts and immutable digests.
-   Reporting build lifecycle events/status.
-   Cleaning source workspaces and credentials.

The build worker must not independently decide which platform services
are connected to a repository or which branch pushes should trigger
deployments. That policy belongs to the API integration module.

## 2.3 Next.js and MCP --- explicitly out of scope

They will eventually call the Go API for:

-   Starting installation.
-   Reading installation state.
-   Listing installations and repositories.
-   Connecting a repository to a service.
-   Updating source configuration.
-   Disconnecting a source.
-   Inspecting GitHub integration status.
-   Reading source/deployment/build status.

They must not:

-   Store GitHub App private keys.
-   Generate GitHub App JWTs.
-   Create installation access tokens.
-   Call GitHub's installation/repository APIs for platform
    functionality.
-   Receive or verify webhooks.
-   Decide which commits trigger builds.
-   Directly publish build jobs.
-   Store installation access tokens.

------------------------------------------------------------------------

# 3. Identity, Supabase Auth and authorization

## 3.1 Supabase Auth is authoritative for authentication

The Go API must accept Supabase access tokens as bearer tokens.

For every user-authenticated request:

1.  Extract the bearer token.
2.  Validate its signature using the configured Supabase JWT
    verification mechanism/JWKS.
3.  Validate issuer, expiry and expected audience/claims according to
    the project's Supabase configuration.
4.  Extract the authenticated Supabase user UUID from `sub`.
5.  Resolve the corresponding platform `public.users` row.
6.  Load organization membership/role when an organization resource is
    accessed.
7.  Authorize the specific action against the organization and resource.
8.  Record actor identity in audit events for mutations.

Do not trust `user_id`, `organization_id`, `role`, `installation_id` or
permissions in the request body without independently checking them.

Do not use the Supabase service-role key as a general-purpose user
authorization bypass. If the Go API needs privileged Supabase
administration for a specific operation, isolate it behind a narrowly
scoped server-side service and document why it is required. Normal
application data access should use the platform database connection and
explicit authorization.

## 3.2 GitHub login is not repository authorization

The platform may use GitHub as a Supabase Auth OAuth provider. This is
only a login identity.

Do not use a GitHub OAuth access token from Supabase user metadata to
clone repositories or manage installations. Do not assume it has the
right permissions or lifetime.

The platform GitHub App is the sole supported mechanism for repository
integration in this implementation.

## 3.3 Organization permissions

Implement a central authorization function/policy rather than scattering
role comparisons across handlers.

Initial roles:

  -------------------------------------------------------------------------
  Role        Install GitHub           List   Connect/update     Disconnect
                    App/link   repositories           source         source
                installation                                 
  ----------- -------------- -------------- ---------------- --------------
  `owner`                Yes            Yes              Yes            Yes

  `admin`                Yes            Yes              Yes            Yes

  `member`     No by default            Yes  Yes, if service        Yes, if
                                             edit permission   service edit
                                                  is granted  permission is
                                                                    granted

  `viewer`                No   Yes, subject               No             No
                              to visibility                  
  -------------------------------------------------------------------------

The implementation must use the project's existing membership/permission
conventions if they are more granular. Do not introduce a parallel RBAC
system just for GitHub.

An installation is associated with a platform organization. Only members
with the required organization permission can list or manage its
repositories.

A service source can only be connected if the authenticated user can
edit that service and the installation belongs to the same platform
organization as the service's project.

## 3.4 Machine-to-machine authentication

Build workers must authenticate to internal API operations using a
dedicated service identity, workload identity or narrowly scoped
internal credential. Do not accept a user Supabase token as the worker's
only authentication mechanism.

Internal operations must be network-restricted and authenticated. A
random shared header with no rotation or audit is insufficient.

------------------------------------------------------------------------

# 4. GitHub App configuration

## 4.1 Create a GitHub App

The operator must create a GitHub App in GitHub Developer Settings and
configure its App ID, client ID/secret only if needed for a separately
justified OAuth use, private key and webhook secret.

The implementation must not require GitHub OAuth App credentials for
repository integration.

Required App settings:

-   App name and slug.
-   Homepage URL.
-   Setup URL or installation callback URL pointing to the Go API.
-   Webhook URL pointing to the Go API.
-   Webhook secret.
-   Private key.
-   App ID.
-   Installation permissions.
-   Webhook subscriptions.
-   User authorization callback/state behavior as required by the chosen
    installation flow.

Use a distinct callback path for the GitHub App installation flow, not
the Supabase login callback.

## 4.2 Minimum initial permissions

Use the minimum permissions required for the first implementation.

Recommended initial repository permissions:

  Permission   Access      Reason
  ------------ ----------- ----------------------------------------------
  Metadata     Read-only   Identify repositories and installation scope
  Contents     Read-only   Clone/read repository source

Recommended organization/account permissions: none unless a concrete
feature requires them.

Do not request write permissions for source checkout.

Webhook subscriptions:

-   `push`
-   `installation`
-   `installation_repositories`

Add `repository` or `check_suite` subscriptions only if an implemented
feature requires them. Do not subscribe speculatively.

If pull-request previews are later added, define the required event
subscriptions and permission changes in a separate design decision.

## 4.3 Installation URL and callback flow

The Go API should generate the installation URL using the configured
GitHub App slug and a single-use state value.

Example shape:

``` text
https://github.com/apps/{APP_SLUG}/installations/new?state={OPAQUE_STATE}
```

Use GitHub's documented GitHub App installation URL behavior. Do not
handcraft undocumented callback assumptions.

The backend must:

1.  Require a valid Supabase-authenticated user to initiate
    installation.
2.  Require organization-level installation permission.
3.  Generate a cryptographically random, unguessable state.
4.  Persist a hash of the state, not necessarily the raw value.
5.  Bind state to user ID and platform organization ID.
6.  Give state a short expiration, recommended 10 minutes.
7.  Make state single-use.
8.  Return the installation URL to the caller.
9.  Receive GitHub's installation callback.
10. Validate state, expiry, unused status and initiating user/org
    association.
11. Validate the installation ID against GitHub using an
    App-authenticated API request.
12. Verify the installation account and permissions.
13. Persist installation metadata and organization association
    transactionally.
14. Mark state consumed.
15. Redirect to a configured frontend return URL containing only a safe
    status/reference, never credentials or tokens.

If GitHub sends `setup_action=update`, handle it as an existing
installation update, not a new installation. If the installation is
cancelled or state is missing/invalid/expired, fail safely and redirect
with a non-sensitive error code if a configured frontend return path is
available.

Do not accept an arbitrary redirect URL from a query parameter. Use a
configured allowlisted frontend origin/path to prevent open redirects.

## 4.4 Installation-to-organization model

For V1, enforce one platform organization association per GitHub App
installation. This keeps repository authorization and billing ownership
understandable.

If product requirements later demand sharing a single GitHub
installation across multiple platform organizations, migrate to a
separate many-to-many association table. Do not accidentally permit
multiple organizations to claim the same installation now.

When a user installs the app on a GitHub personal account, record
account type as `User`. For a GitHub organization, record
`Organization`.

The GitHub account login/name is display metadata, not an authorization
principal.

------------------------------------------------------------------------

# 5. GitHub App credentials and secret management

## 5.1 Required secrets

At minimum:

``` text
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_PRIVATE_KEY_OPENBAO_PATH
GITHUB_WEBHOOK_SECRET_OPENBAO_PATH
GITHUB_INSTALLATION_CALLBACK_URL
GITHUB_WEBHOOK_URL
PLATFORM_FRONTEND_BASE_URL
PLATFORM_PUBLIC_API_BASE_URL
```

If the chosen App installation flow requires a client ID/secret,
document the exact reason and store them in OpenBao. Do not add OAuth
App secrets by default.

The actual private key and webhook secret must be stored in OpenBao, not
in:

-   Git.
-   `.env.example` with real values.
-   PostgreSQL.
-   Browser environment variables.
-   Build arguments.
-   Container image layers.
-   Logs.
-   API responses.

Environment variables may contain OpenBao paths or non-secret
identifiers. Production workloads should obtain secret values through
the platform's approved OpenBao integration.

## 5.2 App JWT generation

The Go API's GitHub App client must:

-   Create a GitHub App JWT signed with RS256 using the private key.
-   Use the App ID as issuer.
-   Use a short lifetime within GitHub's supported limits; target no
    more than 9 minutes.
-   Set issued-at with a small clock-skew allowance.
-   Never expose the JWT to frontends.
-   Cache only as long as safely valid if caching is implemented.
-   Avoid logging JWTs or private key material.

## 5.3 Installation access tokens

Generate installation access tokens on demand using the App JWT.

-   Request only required repository permissions.
-   Restrict to selected repository IDs where supported and appropriate.
-   Respect token expiration returned by GitHub.
-   Do not persist plaintext installation tokens in PostgreSQL.
-   Do not return tokens to Next.js or MCP.
-   Prefer in-memory short-lived caching with expiry and
    installation/repository scope.
-   Ensure concurrent refreshes do not create token storms.
-   Never log Authorization headers.

The build worker should obtain a token only for the
installation/repositories required by its build. If token minting is
centralized in the API, expose an internal authenticated endpoint or
credential-broker interface that returns a short-lived token only to the
authorized build job. If the worker signs App JWTs itself, it needs
access to the App private key; prefer not to distribute that key to
every worker.

Recommended V1: centralize private-key access and installation token
minting in the Go API integration module. The worker requests a
short-lived repository-scoped token using an authenticated job identity
and build request ID. The API verifies that the job is valid and that
the requested repository belongs to the installation associated with the
build.

The token must be held only in memory for the duration needed to clone.
Do not pass it through event payloads, persist it in build records or
expose it to application containers.

------------------------------------------------------------------------

# 6. Database schema changes

Inspect the actual V3 migration/schema in the repository before
implementation. The diagram is the conceptual baseline; actual SQL is
authoritative.

Use the existing naming conventions. The table names below are uppercase
conceptual names; use the repository's established lowercase naming if
that is its convention.

## 6.1 Existing `USER`

With Supabase Auth:

``` text
public.users
- id UUID PRIMARY KEY REFERENCES auth.users(id)
- email TEXT nullable/cached
- name TEXT nullable
- avatar_url TEXT nullable
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

Remove `identity_provider_id` if it exists. Supabase owns provider
identity mappings. Do not create password or refresh-token columns.

Ensure user profile provisioning is reliable. Choose one strategy:

-   A database trigger on `auth.users` that creates/updates
    `public.users`, with safe error handling; or
-   An idempotent authenticated Go API upsert, with a recovery mechanism
    for users whose profile row was not created.

Document the selected strategy. Do not leave the system dependent on a
best-effort frontend insert.

## 6.2 Add `github_installation`

Recommended fields:

``` sql
CREATE TABLE github_installations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    github_installation_id BIGINT NOT NULL UNIQUE,
    account_id BIGINT NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
    status TEXT NOT NULL,
    repository_selection TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    suspended_at TIMESTAMPTZ,
    suspended_by_github BOOLEAN NOT NULL DEFAULT FALSE,
    installed_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Allowed status values should be documented, at minimum:

``` text
active
suspended
revoked
disconnected
error
```

Use `UNIQUE(github_installation_id)` to enforce the V1
one-platform-organization association.

## 6.3 Add `github_installation_states`

This table supports secure, single-use installation initiation/callback.

``` sql
CREATE TABLE github_installation_states (
    id UUID PRIMARY KEY,
    state_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Store only a cryptographic hash of the opaque state. Expired and
consumed records can be periodically cleaned up after an audit-safe
retention period.

## 6.4 Add `github_repositories`

``` sql
CREATE TABLE github_repositories (
    id UUID PRIMARY KEY,
    installation_id UUID NOT NULL REFERENCES github_installations(id),
    github_repository_id BIGINT NOT NULL UNIQUE,
    owner_login TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    default_branch TEXT,
    private BOOLEAN NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    html_url TEXT,
    pushed_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Repository IDs are GitHub's numeric immutable IDs, not names. Names and
owner login can change. Use the GitHub repository ID as the durable
identity.

On repository rename/transfer, update display metadata by ID. Do not
create a second repository row.

## 6.5 Add `github_webhook_events`

``` sql
CREATE TABLE github_webhook_events (
    id UUID PRIMARY KEY,
    github_delivery_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    action TEXT,
    github_installation_id BIGINT,
    github_repository_id BIGINT,
    payload JSONB NOT NULL,
    payload_sha256 TEXT NOT NULL,
    processing_status TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT
);
```

Store only the normalized/minimum payload fields needed for processing,
or store a redacted payload with a strict retention policy. Avoid
retaining unnecessary personal data.

Processing statuses:

``` text
received
queued
processing
processed
ignored
failed
```

Use `github_delivery_id` uniqueness for delivery deduplication. Persist
the event before returning HTTP 2xx.

## 6.6 Modify `service_source`

The existing `SERVICE_SOURCE` table has a repository identifier, branch
and root directory. Update it to reference the platform's
`github_repositories` row.

Recommended fields:

``` sql
CREATE TABLE service_sources (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id),
    repository_id UUID NOT NULL REFERENCES github_repositories(id),
    branch TEXT NOT NULL,
    root_directory TEXT NOT NULL DEFAULT '.',
    dockerfile_path TEXT,
    build_configuration JSONB NOT NULL DEFAULT '{}',
    auto_deploy BOOLEAN NOT NULL DEFAULT TRUE,
    source_status TEXT NOT NULL DEFAULT 'active',
    last_seen_commit_sha TEXT,
    last_deployment_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(service_id)
);
```

If V3 already has `service_sources`, migrate it in place. Do not drop
and recreate data.

V1 policy: one active source association per application service. If the
product requires multiple source configurations per service later,
revise the uniqueness constraint deliberately.

Validate that the service and repository's installation belong to the
same platform organization. This must be enforced in backend business
logic and, where practical, database constraints/transactional checks.

`root_directory` must be normalized and validated as a relative path
within the repository. Reject absolute paths, traversal (`..`) and paths
escaping the checkout. Validate Dockerfile path using the same rule.

## 6.7 Add `build_requests` only if existing `BUILD_RUN` cannot represent the queue

Prefer reusing the existing deployment/build model and transactional
outbox. Do not duplicate state unnecessarily.

If a distinct durable request table is needed:

``` text
build_requests
- id UUID PK
- deployment_id UUID FK
- service_source_id UUID FK
- repository_id UUID FK
- commit_sha TEXT
- ref TEXT
- status TEXT
- requested_at TIMESTAMPTZ
- dispatched_at TIMESTAMPTZ nullable
- created_at TIMESTAMPTZ
```

A request must point to an exact commit SHA before the builder starts.
The outbox event should reference this durable record.

## 6.8 Outbox

If the platform does not already have a transactional outbox, add one:

``` text
outbox_events
- id UUID PK
- event_type TEXT
- aggregate_type TEXT
- aggregate_id UUID
- payload JSONB
- created_at TIMESTAMPTZ
- published_at TIMESTAMPTZ nullable
- attempts INTEGER
- last_error TEXT nullable
```

Use a dispatcher with row locking/`SKIP LOCKED` or the project's
established equivalent. Ensure a crash between publish and marking
published cannot cause lost work; duplicate delivery must be safe.

## 6.9 Constraints and indexes

Add, at minimum:

-   Unique `github_installation_id`.
-   Unique `github_repository_id`.
-   Unique `github_delivery_id`.
-   Unique `state_hash`.
-   Unique `service_id` on service source for V1.
-   Index installations by `organization_id`.
-   Index repositories by `installation_id`.
-   Index service sources by `repository_id, branch, auto_deploy`.
-   Index webhook events by `processing_status, received_at`.
-   Index webhook events by `github_repository_id, received_at`.
-   Index outbox events by unpublished status/time.
-   Index relevant foreign keys.
-   Index `services.environment_id` and hierarchy lookup paths if not
    already present.

Add `updated_at` maintenance consistently, using the repository's
established trigger or application-layer pattern.

## 6.10 Row-level security

If Supabase RLS is enabled on platform tables, define policies
deliberately. The Go API may connect using a backend database role, but
it must still enforce platform authorization. Do not assume RLS
automatically protects service-role/backend access.

Do not expose GitHub integration tables directly to the Supabase anon
key. Frontends should use the Go API for these operations.

------------------------------------------------------------------------

# 7. Backend API contract

All public endpoints use `/v1`. User endpoints require a valid Supabase
bearer token. The API derives the actor from the token, never from
request body identity fields.

The examples below are normative starting contracts. Match existing API
response conventions if already established, while preserving semantics.

## 7.1 Start GitHub App installation

``` http
POST /v1/organizations/{organization_id}/github/installations
Authorization: Bearer <supabase_access_token>
Idempotency-Key: <opaque-key>
Content-Type: application/json
```

Request:

``` json
{}
```

Response `201 Created`:

``` json
{
  "installation_url": "https://github.com/apps/example/installations/new?state=...",
  "state_expires_at": "2026-10-31T12:10:00Z"
}
```

Behavior:

-   Authenticate Supabase user.
-   Authorize organization installation permission.
-   Create single-use state bound to user and organization.
-   Return installation URL.
-   Do not create an installation database row until callback is
    validated.

## 7.2 GitHub App installation callback

``` http
GET /v1/integrations/github/callback?installation_id=123&setup_action=install&state=...
```

This is a browser redirect endpoint, not a JSON API endpoint. It is
unauthenticated at the HTTP bearer layer because GitHub redirects the
browser, but the opaque state must authenticate the initiation context.

Behavior:

-   Validate state hash, expiry and unused status.
-   Load initiating user and organization from state.
-   Validate GitHub installation through GitHub App API.
-   Verify installation account and permissions.
-   Upsert installation metadata.
-   Synchronize repositories.
-   Consume state atomically.
-   Write audit event.
-   Redirect to configured frontend integration return path with a
    non-sensitive result code and integration identifier only.

Never include installation tokens, App JWTs, private key data or raw
state in the final redirect URL.

If `setup_action=update`, update the existing installation. If
`setup_action=install`, create/link the installation subject to
uniqueness. Handle missing installation ID, cancelled flow, invalid
state, expired state and duplicate callback safely.

## 7.3 List installations

``` http
GET /v1/organizations/{organization_id}/github/installations
Authorization: Bearer <token>
```

Response:

``` json
{
  "data": [
    {
      "id": "platform-installation-uuid",
      "github_account": {
        "login": "example-org",
        "type": "Organization"
      },
      "status": "active",
      "repository_selection": "selected",
      "last_synced_at": "2026-10-31T12:00:00Z"
    }
  ],
  "next_cursor": null
}
```

Never return credentials or token material.

## 7.4 Get installation

``` http
GET /v1/organizations/{organization_id}/github/installations/{installation_id}
```

Return account metadata, status, repository count, last sync time and
safe permission metadata.

## 7.5 List repositories

``` http
GET /v1/organizations/{organization_id}/github/installations/{installation_id}/repositories?cursor=...
```

Response:

``` json
{
  "data": [
    {
      "id": "platform-repository-uuid",
      "github_repository_id": 123456,
      "owner": "example-org",
      "name": "my-app",
      "full_name": "example-org/my-app",
      "default_branch": "main",
      "private": true,
      "archived": false,
      "html_url": "https://github.com/example-org/my-app"
    }
  ],
  "next_cursor": null
}
```

Behavior:

-   Authorize organization membership and installation ownership.
-   Return synchronized platform repository records.
-   Support explicit refresh/sync when required.
-   Use stable platform repository UUIDs in public API paths.
-   Never return GitHub installation tokens.

If repository synchronization is asynchronous or rate-limited, expose
sync status and last-synced timestamp rather than pretending the data is
current.

## 7.6 Trigger repository synchronization

``` http
POST /v1/organizations/{organization_id}/github/installations/{installation_id}/sync
Authorization: Bearer <token>
Idempotency-Key: <key>
```

Response:

``` json
{
  "sync_id": "uuid",
  "status": "queued"
}
```

Repository sync should paginate through GitHub's installation
repositories API, upsert by GitHub repository ID and update last-synced
metadata.

## 7.7 Connect repository to a service

``` http
PUT /v1/services/{service_id}/source
Authorization: Bearer <token>
Idempotency-Key: <key>
Content-Type: application/json
```

Request:

``` json
{
  "repository_id": "platform-repository-uuid",
  "branch": "main",
  "root_directory": ".",
  "dockerfile_path": null,
  "build_configuration": {},
  "auto_deploy": true
}
```

Response:

``` json
{
  "id": "service-source-uuid",
  "service_id": "service-uuid",
  "repository": {
    "id": "platform-repository-uuid",
    "full_name": "example-org/my-app"
  },
  "branch": "main",
  "root_directory": ".",
  "dockerfile_path": null,
  "auto_deploy": true,
  "source_status": "active",
  "last_seen_commit_sha": null
}
```

Validation:

-   Service exists and is an application/worker type supported by source
    builds.
-   Caller can edit the service.
-   Repository belongs to an active GitHub installation linked to the
    same platform organization.
-   Installation is not suspended/revoked.
-   Branch name is valid.
-   Root directory and Dockerfile path are safe relative paths.
-   One source association per service in V1.
-   Source association is persisted transactionally.
-   Write audit event.

Do not create a deployment merely because the repository is connected
unless an explicit `deploy_on_connect` option is added and documented.
Default behavior should be to connect source first; the frontend can
separately request an initial deployment. If automatic first deployment
is desired, make it an explicit request field and apply idempotency.

## 7.8 Get service source

``` http
GET /v1/services/{service_id}/source
Authorization: Bearer <token>
```

Return source configuration and safe repository metadata. Do not expose
installation tokens or internal credential references.

## 7.9 Update service source

``` http
PATCH /v1/services/{service_id}/source
Authorization: Bearer <token>
```

Allow updating:

-   branch
-   root directory
-   Dockerfile path
-   build configuration
-   auto-deploy flag

Changing repository should use an explicit validated operation. Ensure a
source change does not race with already queued builds; queued builds
must retain a snapshot of repository ID, branch, commit SHA and source
configuration.

## 7.10 Disconnect service source

``` http
DELETE /v1/services/{service_id}/source
Authorization: Bearer <token>
```

Behavior:

-   Authorize service edit.
-   Mark/delete source association according to existing soft-delete
    convention.
-   Prevent new webhook-triggered builds for it.
-   Do not delete deployment history or images.
-   Do not delete the GitHub App installation.
-   Audit the operation.

## 7.11 Manual deployment from connected source

If a deployment endpoint already exists, extend it. Otherwise:

``` http
POST /v1/services/{service_id}/deployments
Authorization: Bearer <token>
Idempotency-Key: <key>
```

Request:

``` json
{
  "source": {
    "ref": "refs/heads/main"
  },
  "reason": "manual"
}
```

The API must resolve the ref to a commit SHA through the GitHub App
integration before creating a build request. Persist the exact SHA and
source configuration snapshot. Return the deployment ID and `queued`
status.

Do not accept a caller-provided arbitrary clone URL or installation
token.

## 7.12 Disconnect installation

``` http
DELETE /v1/organizations/{organization_id}/github/installations/{installation_id}
Authorization: Bearer <token>
```

Behavior:

-   Require organization owner/admin permission.
-   Mark platform association disconnected.
-   Stop new builds from the installation.
-   Mark dependent service sources disconnected or blocked.
-   Revoke/expire local token caches.
-   Do not attempt to uninstall the GitHub App from GitHub unless a
    supported, explicitly confirmed uninstall operation is implemented.
-   Preserve deployment history and audit events.

------------------------------------------------------------------------

# 8. GitHub webhook implementation

## 8.1 Endpoint and verification

``` http
POST /v1/webhooks/github
```

This endpoint is public and does not use Supabase bearer authentication.
Its authentication is GitHub's webhook HMAC signature.

Required headers:

-   `X-Hub-Signature-256`
-   `X-GitHub-Delivery`
-   `X-GitHub-Event`
-   `Content-Type`

Implementation requirements:

1.  Read the raw request body with a strict maximum size.
2.  Compute HMAC-SHA256 using the webhook secret.
3.  Compare signatures using constant-time comparison.
4.  Reject missing/malformed/invalid signatures with HTTP 401/403.
5.  Validate delivery ID and event header.
6.  Parse only after signature verification.
7.  Normalize the event.
8.  Persist delivery and outbox record transactionally.
9.  Return HTTP 2xx promptly after durable persistence.
10. Process asynchronously.

Do not decode and re-encode JSON before HMAC verification. Verify the
exact raw bytes GitHub sent.

Recommended body size limit should be configurable and documented.
Reject oversized bodies safely.

## 8.2 Delivery deduplication

Use `X-GitHub-Delivery` as the unique delivery identifier.

On duplicate delivery:

-   Do not create a second logical event.
-   Do not create a second deployment/build.
-   Return 2xx if the original delivery is already durably recorded.
-   Record duplicate metrics/logs without logging sensitive payloads.

Use a database unique constraint as the final deduplication authority;
an in-memory cache is insufficient.

## 8.3 Events to support

### `push`

Relevant fields:

-   repository ID and full name.
-   installation ID.
-   ref.
-   `after` commit SHA.
-   `before` commit SHA.
-   `deleted`.
-   sender metadata if needed for audit.

Processing:

-   Ignore deleted branch refs.
-   Ignore tag refs unless tag deployment is explicitly implemented.
-   Find active service sources matching installation/repository/branch
    and `auto_deploy=true`.
-   If no sources match, mark event ignored.
-   Resolve exact `after` SHA.
-   Create one deployment per matching service, with an immutable
    source/config snapshot.
-   Persist build request/outbox event in the same transaction.
-   Do not build a commit if `after` is all zeroes.
-   Handle force-pushes by building the new head commit; do not assume
    `before` is an ancestor.
-   If multiple services use the same repository/branch, create one
    build per service unless a future artifact-sharing design is
    explicitly implemented.

### `installation`

Support actions:

-   `created`
-   `deleted`
-   `suspend`
-   `unsuspend`
-   `new_permissions_accepted` if delivered for the configured App/API
    behavior.

Processing:

-   `created`: validate installation and sync repositories.
-   `deleted`: mark installation revoked/disconnected, block source
    builds and mark dependent sources disconnected.
-   `suspend`: mark suspended and block new token minting/builds.
-   `unsuspend`: validate installation and restore active status, then
    sync repositories.
-   permission changes: refresh permission metadata and verify required
    permissions remain available.

### `installation_repositories`

Support actions:

-   `added`
-   `removed`

Processing:

-   Upsert newly available repositories.
-   Mark removed repositories unavailable/removed.
-   Prevent new builds from removed repositories.
-   Mark connected service sources as blocked/disconnected and expose a
    clear reason.
-   Do not erase historical deployments.

## 8.4 Webhook ordering and race conditions

GitHub may deliver events out of order. The processor must not rely
solely on event arrival order.

For a push:

-   Use the commit SHA in the signed event payload as the requested
    build commit.
-   Before dispatch, confirm the installation and repository are still
    active.
-   Confirm the service source still matches the repository/branch and
    remains auto-deploy enabled.
-   Snapshot source configuration at deployment creation.
-   If a newer push has already created a deployment, do not silently
    overwrite the older deployment record. Both can exist; the runtime
    controller can apply a documented supersession policy.
-   A deployment must remain traceable to its originating webhook
    delivery.

## 8.5 Webhook failure behavior

-   Invalid signature: reject; do not persist as trusted event.
-   Unsupported event/action: persist minimal metadata as ignored or
    safely acknowledge with an observability counter.
-   Database unavailable before durable persistence: return a retryable
    5xx so GitHub can redeliver.
-   Duplicate delivery: return 2xx.
-   Downstream worker failure after persistence: retry from durable
    queue/outbox; do not ask GitHub to redeliver.
-   Poison event: mark failed after bounded retries, preserve diagnostic
    metadata and expose operational alert.

------------------------------------------------------------------------

# 9. Webhook processing and deployment creation

Implement a dedicated integration processor or worker within the
existing event-worker/API worker process. Do not do build orchestration
inside the webhook HTTP handler.

## 9.1 Processing algorithm for a push

1.  Claim an unprocessed webhook event using safe row locking.
2.  Parse normalized payload.
3.  Resolve `github_installations` by GitHub installation ID.
4.  Verify installation status is active.
5.  Resolve repository by immutable GitHub repository ID.
6.  Verify repository belongs to the installation.
7.  Ignore deleted refs and unsupported ref types.
8.  Parse branch from `refs/heads/<branch>` safely.
9.  Find matching active service sources with `auto_deploy=true`.
10. For each match, validate service/environment is deployable.
11. Create deployment with `queued` status.
12. Snapshot:
    -   platform repository ID and GitHub repository ID;
    -   commit SHA;
    -   branch/ref;
    -   root directory;
    -   Dockerfile path;
    -   build configuration;
    -   source association ID;
    -   originating webhook event ID.
13. Create `BUILD_RUN` or durable build request.
14. Insert `deployment.build.requested` into outbox in the same
    transaction.
15. Mark webhook event processed.
16. Dispatcher publishes the outbox event.
17. Build worker consumes it idempotently.

If any one service's deployment creation fails, define whether the event
should partially succeed or be retried as a unit. Prefer per-service
transactional handling with an idempotency key derived from webhook
delivery ID + service ID, so one failed service does not block all other
services connected to the same repository.

## 9.2 Deployment idempotency

Create a uniqueness/idempotency strategy so replaying a webhook cannot
create duplicate deployments. For example:

-   Store `trigger_event_id` and `service_id` on deployment or a
    deployment trigger table.
-   Enforce unique `(trigger_event_id, service_id)` for
    webhook-triggered deployments.
-   Use a deterministic idempotency key for the build request.

Do not rely on checking in application code alone without a database
constraint.

## 9.3 Outbox event payload

`deployment.build.requested`:

``` json
{
  "event_id": "uuid",
  "deployment_id": "uuid",
  "build_run_id": "uuid",
  "service_id": "uuid",
  "service_source_id": "uuid",
  "organization_id": "uuid",
  "project_id": "uuid",
  "environment_id": "uuid",
  "repository": {
    "platform_repository_id": "uuid",
    "github_repository_id": 123456,
    "full_name": "example-org/my-app"
  },
  "source": {
    "branch": "main",
    "ref": "refs/heads/main",
    "commit_sha": "abc123",
    "root_directory": ".",
    "dockerfile_path": null
  },
  "build_configuration": {},
  "trigger": {
    "type": "github_push",
    "webhook_event_id": "uuid"
  }
}
```

Never include GitHub tokens or private key material in the event.

------------------------------------------------------------------------

# 10. Build worker credential handoff

The worker needs repository access but must not receive a long-lived
credential.

Implement one of these designs and document the chosen option:

## Preferred V1 --- Credential broker in Go API

1.  Build worker receives a valid build request.
2.  Worker authenticates using its service identity.
3.  Worker requests a repository-scoped installation token for the build
    request.
4.  Go API validates:
    -   worker identity;
    -   build request exists and is in an eligible state;
    -   build request references the repository;
    -   repository belongs to the expected active installation;
    -   installation is not suspended/revoked;
    -   requested permissions are read-only and minimal.
5.  Go API mints a short-lived installation token.
6.  API returns token over authenticated internal transport.
7.  Worker uses token only to clone the repository.
8.  Worker discards it from memory after checkout.
9.  Worker never writes it to logs, build arguments, image layers or
    persistent build records.

Internal endpoint example:

``` http
POST /internal/v1/build-requests/{build_request_id}/source-token
Authorization: Bearer <worker-service-credential>
```

Response:

``` json
{
  "token": "<short-lived-token>",
  "expires_at": "2026-10-31T12:30:00Z",
  "repository": {
    "clone_url": "https://github.com/example-org/my-app.git",
    "commit_sha": "abc123"
  }
}
```

The token response is internal-only and must never be accessible through
public user routes. Ensure logs and tracing redact this response.

The endpoint must not accept an arbitrary repository ID or clone URL
from the worker; derive repository identity from the persisted build
request.

## Alternative --- Worker-owned GitHub App client

Only use this if there is a strong operational reason. The private key
must be accessible through OpenBao workload identity, and worker
permissions must be tightly scoped. Do not copy the private key into
every worker image or Kubernetes Secret shared across namespaces.

------------------------------------------------------------------------

# 11. Repository synchronization and lifecycle

## 11.1 Initial synchronization

After installation callback validation:

-   Fetch installation metadata from GitHub.
-   Fetch all accessible repositories with pagination.
-   Upsert repositories by GitHub repository ID.
-   Persist repository selection and permission metadata.
-   Mark sync timestamp.
-   Handle partial API failure without falsely marking sync complete.

## 11.2 Periodic reconciliation

Implement a configurable periodic sync as a safety net, not as a
replacement for webhooks.

-   Reconcile active installations.
-   Refresh repository metadata.
-   Detect repository removals/renames.
-   Verify installation status and permissions.
-   Avoid excessive GitHub API calls.
-   Apply jitter and rate-limit handling.
-   Record sync outcome and next retry.

## 11.3 Repository removal

When a repository is removed from an installation:

-   Mark repository unavailable.
-   Prevent new builds.
-   Mark dependent sources blocked/disconnected with a reason.
-   Do not delete source records or deployment history.
-   Surface the state through the API.

## 11.4 Installation deletion/suspension

When the App is suspended or uninstalled:

-   Block token minting.
-   Block new webhook-triggered builds.
-   Mark installation state.
-   Update dependent sources.
-   Preserve historical resources.
-   Emit platform events and audit records.
-   Notify connected services through state exposed by API.

Already-running builds should follow a documented policy. Recommended:
if source checkout has not started, cancel/block; if a token is already
issued, allow the current short-lived token to expire and avoid starting
further source operations. Do not revoke unrelated installations.

------------------------------------------------------------------------

# 12. GitHub API client implementation

Build a dedicated Go package around GitHub App authentication and API
operations. Avoid scattering direct HTTP calls across handlers.

Suggested interface:

``` go
type GitHubAppClient interface {
    CreateInstallationToken(
        ctx context.Context,
        installationID int64,
        repositoryIDs []int64,
        permissions map[string]string,
    ) (InstallationToken, error)

    GetInstallation(
        ctx context.Context,
        installationID int64,
    ) (Installation, error)

    ListInstallationRepositories(
        ctx context.Context,
        installationID int64,
        page int,
        perPage int,
    ) (RepositoryPage, error)

    GetRepository(
        ctx context.Context,
        owner string,
        repo string,
    ) (Repository, error)

    GetCommit(
        ctx context.Context,
        owner string,
        repo string,
        ref string,
    ) (Commit, error)
}
```

The exact SDK/library choice should be evaluated against maintenance,
API coverage and testability. If using raw HTTP, centralize:

-   base URL and API version headers;
-   request IDs;
-   timeouts;
-   retries;
-   rate-limit handling;
-   pagination;
-   error parsing;
-   response-size limits;
-   redaction.

## 12.1 Rate limits and retries

-   Respect GitHub rate-limit headers and `Retry-After`.
-   Use exponential backoff with jitter for transient 5xx and network
    failures.
-   Do not retry 401/403 blindly; distinguish revoked permissions,
    suspension and rate limits.
-   Handle secondary rate limits.
-   Bound retries and record retry status.
-   Do not make GitHub API calls in a user-facing request if the
    operation can be queued.

## 12.2 API versioning

Set a documented GitHub REST API version header supported by the chosen
integration. Keep the version configurable through a
constant/configuration value and cover it in tests. Do not scatter API
version strings through the code.

------------------------------------------------------------------------

# 13. Suggested Go package structure

Adapt to the existing Go layout rather than creating duplicate modules.

``` text
services/api/internal/github/
├── app/
│   ├── config.go
│   ├── jwt.go
│   ├── client.go
│   ├── installation_tokens.go
│   └── permissions.go
├── installations/
│   ├── service.go
│   ├── repository.go
│   ├── handler.go
│   ├── callback.go
│   ├── state.go
│   └── sync.go
├── repositories/
│   ├── service.go
│   ├── repository.go
│   ├── handler.go
│   └── validation.go
├── sources/
│   ├── service.go
│   ├── repository.go
│   ├── handler.go
│   └── config.go
├── webhooks/
│   ├── handler.go
│   ├── signature.go
│   ├── normalize.go
│   ├── repository.go
│   └── processor.go
├── builds/
│   ├── trigger.go
│   └── credential_broker.go
└── errors.go
```

Suggested API route registration:

``` text
/v1/organizations/:organization_id/github/installations
/v1/organizations/:organization_id/github/installations/:installation_id
/v1/organizations/:organization_id/github/installations/:installation_id/repositories
/v1/organizations/:organization_id/github/installations/:installation_id/sync

/v1/integrations/github/callback

/v1/services/:service_id/source
/v1/services/:service_id/deployments

/v1/webhooks/github

/internal/v1/build-requests/:build_request_id/source-token
```

The internal route must use separate service authentication middleware
and network policy.

------------------------------------------------------------------------

# 14. Error model

Use stable machine-readable error codes.

Recommended codes:

``` text
GITHUB_APP_NOT_CONFIGURED
GITHUB_INSTALLATION_STATE_EXPIRED
GITHUB_INSTALLATION_STATE_INVALID
GITHUB_INSTALLATION_NOT_FOUND
GITHUB_INSTALLATION_NOT_ACTIVE
GITHUB_INSTALLATION_ALREADY_LINKED
GITHUB_INSTALLATION_PERMISSION_MISSING
GITHUB_REPOSITORY_NOT_FOUND
GITHUB_REPOSITORY_NOT_ACCESSIBLE
GITHUB_REPOSITORY_REMOVED
GITHUB_SOURCE_ALREADY_CONFIGURED
GITHUB_SOURCE_INVALID_BRANCH
GITHUB_WEBHOOK_SIGNATURE_INVALID
GITHUB_WEBHOOK_DELIVERY_DUPLICATE
GITHUB_API_RATE_LIMITED
GITHUB_API_UNAVAILABLE
SERVICE_SOURCE_NOT_FOUND
SERVICE_SOURCE_INVALID_PATH
BUILD_REQUEST_NOT_FOUND
BUILD_REQUEST_NOT_AUTHORIZED
```

Do not leak private key, token, webhook secret, raw GitHub authorization
response or internal stack traces in public error messages.

For GitHub upstream failures, return an appropriate platform error and
request ID. Preserve detailed sanitized diagnostics in server logs.

------------------------------------------------------------------------

# 15. Security requirements

These are release-blocking.

## 15.1 Authentication and authorization

-   Validate Supabase JWT signature, issuer and expiry.
-   Resolve platform identity from verified subject.
-   Verify organization membership for every installation/repository
    endpoint.
-   Verify service ownership and edit permission before source changes.
-   Verify installation belongs to the service's organization.
-   Do not trust IDs or roles supplied by caller.
-   Separate user and worker identities.
-   Audit sensitive mutations.

## 15.2 Webhook security

-   Verify HMAC-SHA256 against raw body.
-   Constant-time signature comparison.
-   Strict body size limit.
-   Unique delivery ID.
-   Persist before acknowledgement.
-   Do not accept Supabase user bearer tokens as webhook authentication.
-   Do not expose webhook secret or verification internals.
-   Add rate limiting and observability without breaking legitimate
    GitHub delivery retries.

## 15.3 Credential security

-   Store App private key and webhook secret in OpenBao.
-   Do not persist installation access tokens.
-   Do not log credentials.
-   Redact token responses in logs, traces and errors.
-   Keep tokens out of event payloads and database rows.
-   Limit installation token repository scope.
-   Rotate App private key/webhook secret with a documented procedure.
-   Avoid broad Kubernetes Secret distribution.

## 15.4 Path and source validation

-   Normalize repository root and Dockerfile paths.
-   Reject absolute paths and traversal.
-   Never execute shell commands using untrusted branch/repository
    strings without safe argument handling.
-   Use repository numeric ID for identity.
-   Treat repository names, commit messages, branch names and webhook
    payload strings as untrusted data.
-   Do not interpolate untrusted values into SQL or shell commands.

## 15.5 Tenant isolation

-   Every GitHub installation belongs to a platform organization.
-   Every service source belongs to a service under a
    project/environment/organization.
-   Validate the complete relationship before association or build.
-   Worker credential broker verifies the persisted build request's full
    ownership chain.
-   Telemetry/logs from GitHub integration do not leak other tenants'
    repository metadata.

## 15.6 Audit

Record at least:

-   Installation initiation.
-   Installation linked/updated.
-   Repository sync.
-   Source connected/updated/disconnected.
-   Manual deployment requested.
-   Installation suspended/revoked.
-   Repository access removed.
-   Webhook-triggered deployment created.
-   Worker token issued (record metadata, never token value).

------------------------------------------------------------------------

# 16. Observability and operational behavior

Add structured logs and metrics for:

-   Installation callback success/failure.
-   Installation state count by status.
-   Repository sync duration/result/repository count.
-   GitHub API request latency/status/rate limit.
-   Webhook receipt count by event type.
-   Signature failures.
-   Duplicate deliveries.
-   Webhook processing lag.
-   Webhook processing failures/retries.
-   Matching service-source count.
-   Build requests generated from pushes.
-   Token broker requests/success/failure.
-   Suspended/revoked installation build blocks.

Use request IDs, webhook delivery IDs and platform resource IDs for
correlation. Do not use tokens, private keys, emails or raw sensitive
payloads as metric labels.

Create alerts/runbook guidance for:

-   Webhook processing queue stuck.
-   Repeated signature failures.
-   GitHub API rate-limit exhaustion.
-   Installation token minting failures.
-   Repository sync stale for active installations.
-   Outbox backlog.
-   Build requests not consumed.

------------------------------------------------------------------------

# 17. Testing specification

The implementation is not complete without automated tests.

## 17.1 Unit tests

Test:

-   Supabase JWT validation behavior at middleware boundary (mock
    JWKS/provider as appropriate).
-   Organization authorization.
-   Installation state generation/hash/expiry/single-use.
-   GitHub App JWT claims/signing behavior.
-   Installation token request construction.
-   Repository pagination.
-   Webhook signature verification.
-   Malformed signature/body handling.
-   Webhook normalization.
-   Branch/ref parsing.
-   Root directory and Dockerfile path validation.
-   Event-to-source matching.
-   Deployment idempotency key generation.
-   Error mapping and redaction.

## 17.2 Database integration tests

Test:

-   Installation uniqueness.
-   State cannot be consumed twice.
-   Repository upsert by immutable GitHub ID.
-   Duplicate webhook delivery constraint.
-   One service source per service in V1.
-   Source association cannot cross organizations.
-   Repeated webhook processing cannot create duplicate deployments.
-   Outbox event and deployment are committed atomically.
-   Installation suspension blocks token issuance/build requests.
-   Repository removal blocks new builds without deleting history.

## 17.3 Webhook tests

Use realistic fixture payloads for:

-   `push`.
-   `installation.created`.
-   `installation.deleted`.
-   `installation.suspend`.
-   `installation.unsuspend`.
-   `installation_repositories.added`.
-   `installation_repositories.removed`.

Test valid signature, invalid signature, missing headers, duplicate
delivery, oversized body, malformed JSON and database outage.

Never use a live production webhook secret in tests.

## 17.4 GitHub API tests

Use an HTTP test server or mock transport. Do not make unit tests depend
on live GitHub.

Test:

-   App JWT authentication.
-   Installation token minting.
-   Repository pagination.
-   API rate limiting.
-   transient errors and retries.
-   revoked installation.
-   missing permissions.
-   repository not found.
-   renamed repository metadata.
-   installation suspended.

Provide an optional manual sandbox test using a dedicated test GitHub
App and test repository.

## 17.5 End-to-end acceptance tests

At minimum, automate or document a reproducible sandbox test:

1.  Create Supabase test user.
2.  Create platform organization and project.
3.  Install test GitHub App on a test GitHub organization/repository.
4.  Verify callback links installation to platform organization.
5.  List repositories through Go API.
6.  Connect repository to a service.
7.  Push a commit to configured branch.
8.  Deliver webhook to Go API.
9.  Verify webhook signature and persistence.
10. Verify exactly one deployment/build request is created.
11. Verify build worker obtains a scoped short-lived token.
12. Verify worker clones exact commit SHA.
13. Verify build worker reports build outcome.
14. Verify disconnecting source prevents subsequent push builds.
15. Verify uninstalling/suspending the GitHub App blocks new builds.

The test should assert the exact commit SHA in the persisted build
request and build logs/metadata.

------------------------------------------------------------------------

# 18. Local development and configuration

Provide a documented local development setup.

Required configuration values (names may be adapted to repository
conventions):

``` dotenv
SUPABASE_URL=
SUPABASE_JWKS_URL=
SUPABASE_JWT_ISSUER=
SUPABASE_JWT_AUDIENCE=

GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY_OPENBAO_PATH=
GITHUB_WEBHOOK_SECRET_OPENBAO_PATH=
GITHUB_INSTALLATION_CALLBACK_URL=
GITHUB_WEBHOOK_URL=
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_API_VERSION=

PLATFORM_FRONTEND_BASE_URL=
PLATFORM_PUBLIC_API_BASE_URL=

OPENBAO_ADDR=
OPENBAO_AUTH_ROLE=
OPENBAO_GITHUB_PRIVATE_KEY_PATH=
OPENBAO_GITHUB_WEBHOOK_SECRET_PATH=
```

Do not assume every value must be a literal environment variable. Prefer
configuration that references OpenBao paths and obtains actual secret
values through the approved secret mechanism.

Provide:

-   `.env.example` with placeholders only.
-   Local Supabase setup or documented remote development Supabase
    project configuration.
-   Test GitHub App creation guide.
-   Webhook tunneling guide for local development.
-   Migration command.
-   API startup command.
-   Worker startup command.
-   Webhook fixture/replay command.
-   Test commands.

The local webhook tunnel must point to the Go API's webhook route. Do
not point GitHub directly at a Next.js route.

------------------------------------------------------------------------

# 19. Implementation phases and completion gates

Implement in the following order. Do not begin by wiring the frontend.

## Phase 0 --- Repository reconnaissance

-   Inspect current Go API structure.
-   Inspect current SQL migrations and actual V3 schema.
-   Inspect Supabase Auth configuration.
-   Inspect current event/outbox mechanism.
-   Inspect build worker request format.
-   Identify existing auth middleware and RBAC.
-   Produce a short implementation plan identifying files/modules to
    reuse.

**Gate:** No duplicate identity, event or service-source system will be
created.

## Phase 1 --- Schema and configuration

-   Add migrations for installation, state, repository and webhook
    records.
-   Modify service source schema.
-   Add required indexes and constraints.
-   Add configuration loading and OpenBao secret retrieval.
-   Add seed/test support.

**Gate:** Migrations apply cleanly to a fresh database and upgrade a
database containing V3 data without data loss.

## Phase 2 --- GitHub App client and installation lifecycle

-   Implement App JWT signing.
-   Implement installation token minting.
-   Implement installation initiation endpoint.
-   Implement callback/state validation.
-   Verify installation through GitHub API.
-   Persist installation and synchronize repositories.

**Gate:** A sandbox GitHub App can be installed and linked to a platform
organization end to end.

## Phase 3 --- Repository and service source APIs

-   List installations.
-   List repositories.
-   Synchronize repositories.
-   Connect repository to service.
-   Get/update/disconnect service source.
-   Enforce organization/service ownership.
-   Add audit events.

**Gate:** A platform user can connect a private test repository to a
service without frontend-specific backend logic.

## Phase 4 --- Webhooks and durable event processing

-   Implement raw-body signature verification.
-   Persist/deduplicate webhook events.
-   Implement installation and repository lifecycle events.
-   Implement push normalization and branch matching.
-   Create deployment/build records and outbox events transactionally.
-   Add retry and poison-event behavior.

**Gate:** A test push creates exactly one durable build request per
matching service.

## Phase 5 --- Build worker integration and credential broker

-   Implement worker service identity.
-   Implement internal build-token broker.
-   Verify build request ownership and repository association.
-   Return a short-lived installation token.
-   Integrate exact commit checkout.
-   Ensure credentials are not persisted or logged.
-   Test worker retries and token expiry.

**Gate:** Worker clones the correct private repository commit without
any long-lived credential in its database, event payload or image.

## Phase 6 --- Revocation, reliability and hardening

-   Installation suspension/deletion.
-   Repository removal.
-   Periodic repository sync.
-   GitHub rate-limit handling.
-   Retry/backoff.
-   Audit and metrics.
-   Security tests.
-   End-to-end sandbox test.

**Gate:** Access removal prevents new builds and historical
deployment/source records remain auditable.

## Phase 7 --- Documentation and handoff

Write both required documents:

-   `docs/integrations/github/IMPLEMENTATION_REPORT.md`
-   `docs/integrations/github/FRONTEND_INTEGRATION.md`

Include actual implemented endpoint paths and schemas, not just copied
examples from this specification.

**Gate:** Another engineer can configure the GitHub App, run the backend
and integrate Next.js/MCP using only the handoff documents and API
specification.

------------------------------------------------------------------------

# 20. Frontend integration contract --- documentation only

Do not implement the frontend. Ensure the backend is straightforward to
consume.

The frontend guide must document these flows.

## 20.1 Install GitHub App

``` text
Next.js obtains Supabase session
    |
    v
POST Go API /v1/organizations/{org_id}/github/installations
    |
    v
Go API returns installation_url
    |
    v
Next.js redirects browser to installation_url
    |
    v
GitHub redirects browser to Go API callback
    |
    v
Go API validates and persists installation
    |
    v
Go API redirects to configured frontend return URL
    |
    v
Next.js refreshes installation list from Go API
```

The frontend does not handle the GitHub App private key, webhook secret,
App JWT or installation access token.

## 20.2 Repository selection

``` text
Next.js
  -> GET installations
  -> GET repositories for selected installation
  -> PUT service source with platform repository UUID, branch and build paths
  -> GET service source to confirm persisted state
```

The UI should use the platform repository UUID, not the GitHub numeric
ID, for normal resource operations.

## 20.3 Disconnect

``` text
Next.js
  -> DELETE service source
  -> GET service source / status
```

Disconnecting a source must not uninstall the GitHub App.

## 20.4 MCP consumption

MCP tools should be thin wrappers around the same public Go API:

-   `list_github_installations`
-   `list_github_repositories`
-   `connect_github_repository`
-   `get_service_source`
-   `update_service_source`
-   `disconnect_service_source`
-   `trigger_deployment`

MCP must use the authenticated principal's scope and must not have
direct GitHub App credentials. The backend remains responsible for all
validation and authorization.

Do not create a second set of GitHub integration business rules in MCP.

## 20.5 Frontend API client expectations

Document:

-   Base URL and `/v1` version.
-   Supabase access-token bearer authentication.
-   Required organization/service identifiers.
-   Request and response JSON schemas.
-   Pagination behavior.
-   Error codes.
-   Installation callback/return behavior.
-   How the frontend refreshes state after callback.
-   How it observes deployment/build status.
-   Which fields are safe to display.
-   Which fields are never returned because they are secret.

------------------------------------------------------------------------

# 21. Final acceptance checklist

The implementation agent must mark each item only after verifying it.

## Configuration and identity

-   [ ] Supabase JWT validation is implemented in Go API.
-   [ ] Platform user resolution uses Supabase user UUID.
-   [ ] Organization-level authorization is enforced.
-   [ ] No custom login OAuth/password system was added.
-   [ ] GitHub login and GitHub App integration are kept separate.

## GitHub App installation

-   [ ] App JWT generation works.
-   [ ] Private key is retrieved from OpenBao.
-   [ ] Installation URL/state flow works.
-   [ ] State is bound to user and organization.
-   [ ] State is single-use and expires.
-   [ ] Callback validates installation with GitHub.
-   [ ] Installation metadata is persisted.
-   [ ] Repository synchronization works.

## Repository and service source

-   [ ] Repository IDs use immutable GitHub numeric IDs.
-   [ ] Repository listing is tenant-authorized.
-   [ ] Source association validates organization ownership.
-   [ ] Branch/root/Dockerfile configuration is validated.
-   [ ] Source update/disconnect works.
-   [ ] Repository rename/removal is handled.

## Webhooks and builds

-   [ ] Raw-body HMAC verification works.
-   [ ] Delivery deduplication is database-enforced.
-   [ ] Webhook is persisted before acknowledgement.
-   [ ] Push branch matching works.
-   [ ] Deleted branches/tags are handled safely.
-   [ ] Exactly one deployment is created per matching service and
    delivery.
-   [ ] Deployment/build request/outbox persistence is transactional.
-   [ ] Build request contains exact commit SHA.
-   [ ] Worker obtains a short-lived repository-scoped token.
-   [ ] Token is not persisted, logged or sent to frontends.
-   [ ] Worker clones exact commit.

## Lifecycle and security

-   [ ] Installation suspension blocks new builds.
-   [ ] Installation deletion/revocation blocks new builds.
-   [ ] Repository removal blocks new builds.
-   [ ] GitHub rate limits and transient errors are handled.
-   [ ] Audit events are recorded.
-   [ ] Logs and metrics do not leak secrets.
-   [ ] Tenant isolation tests pass.
-   [ ] End-to-end sandbox test passes.

## Handoff

-   [ ] `IMPLEMENTATION_REPORT.md` exists and is accurate.
-   [ ] `FRONTEND_INTEGRATION.md` exists and is accurate.
-   [ ] OpenAPI specification includes all public endpoints.
-   [ ] Internal worker contract is documented separately.
-   [ ] Configuration and setup guide is complete.
-   [ ] Known limitations and deferred features are documented.

------------------------------------------------------------------------

# 22. Explicit non-goals

Do not implement these as part of this task:

-   Next.js UI pages or components.
-   MCP server tools or prompts.
-   CLI. 
-   GitHub login through a custom OAuth flow.
-   Pull request preview deployments.
-   GitHub Checks write permissions or status publishing.
-   GitLab/Bitbucket integrations.
-   Arbitrary Git URLs or personal access token repository connections.
-   Automatic deployments from tags unless separately specified.
-   Organization-wide GitHub policy management.
-   Build execution inside the Go API.
-   Agent-based GitHub repository administration.
-   Frontend state management or UI event streaming components.

The backend may expose stable APIs and events that enable future
frontend work, but must not implement frontend code.

------------------------------------------------------------------------

# 23. Final instruction to the implementation agent

Implement the complete backend integration in the existing repository.
First inspect the repository and schema, then make a concrete plan, then
execute the phases in order.

Prioritize correctness, security, idempotency, recoverability and clean
API boundaries over the shortest implementation.

Do not stop after creating database tables or mock endpoints. The
required result is a working sandbox integration: a user authenticated
through Supabase can install the GitHub App for a platform organization,
list repositories, connect a repository to a service, push a commit,
have the Go API verify and process the webhook, create exactly one
durable build request per matching service, and allow the build worker
to obtain a short-lived scoped token and clone the exact commit.

Do not implement Next.js or MCP frontend functionality. Instead, produce
the two detailed handoff documents with the actual endpoints,
request/response schemas, authentication rules, configuration and usage
sequences so those frontends can be implemented as thin wrappers over
the Go API.

At completion, report what was implemented, what tests were run and
passed, any deviations, and anything that remains incomplete. Never
claim a test passed unless it was actually executed.
