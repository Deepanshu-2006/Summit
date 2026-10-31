-- 0002_github_integration.up.sql
-- GitHub integration tables per spec sections 6.2-6.6 and 6.9.

-- ============================================================================
-- GitHub Installations (spec 6.2)
-- ============================================================================
CREATE TABLE github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    github_installation_id BIGINT NOT NULL UNIQUE,
    account_id BIGINT NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked', 'disconnected', 'error')),
    repository_selection TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    suspended_at TIMESTAMPTZ,
    suspended_by_github BOOLEAN NOT NULL DEFAULT FALSE,
    installed_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_github_installations_org ON github_installations(organization_id);

CREATE TRIGGER trg_github_installations_updated_at
    BEFORE UPDATE ON github_installations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- GitHub Installation States (spec 6.3)
-- Supports secure, single-use installation initiation/callback.
-- Only a cryptographic hash of the opaque state is stored.
-- ============================================================================
CREATE TABLE github_installation_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_github_installation_states_expires ON github_installation_states(expires_at);

-- ============================================================================
-- GitHub Repositories (spec 6.4)
-- ============================================================================
CREATE TABLE github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_github_repositories_installation ON github_repositories(installation_id);

CREATE TRIGGER trg_github_repositories_updated_at
    BEFORE UPDATE ON github_repositories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- GitHub Webhook Events (spec 6.5)
-- ============================================================================
CREATE TABLE github_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_delivery_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    action TEXT,
    github_installation_id BIGINT,
    github_repository_id BIGINT,
    payload JSONB NOT NULL,
    payload_sha256 TEXT NOT NULL,
    processing_status TEXT NOT NULL CHECK (processing_status IN ('received', 'queued', 'processing', 'processed', 'ignored', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    locked_by TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT
);
CREATE INDEX idx_github_webhook_events_status ON github_webhook_events(processing_status, received_at);
CREATE INDEX idx_github_webhook_events_repo ON github_webhook_events(github_repository_id, received_at);

-- ============================================================================
-- Service Sources (spec 6.6)
-- ============================================================================
CREATE TABLE service_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id),
    repository_id UUID NOT NULL REFERENCES github_repositories(id),
    branch TEXT NOT NULL,
    root_directory TEXT NOT NULL DEFAULT '.',
    dockerfile_path TEXT,
    build_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_deploy BOOLEAN NOT NULL DEFAULT TRUE,
    source_status TEXT NOT NULL DEFAULT 'active' CHECK (source_status IN ('active', 'disconnected', 'blocked')),
    disconnect_reason TEXT,
    last_seen_commit_sha TEXT,
    last_deployment_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_source UNIQUE (service_id)
);
CREATE INDEX idx_service_sources_repo_branch ON service_sources(repository_id, branch, auto_deploy);

CREATE TRIGGER trg_service_sources_updated_at
    BEFORE UPDATE ON service_sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ALTER deployments: add FK for service_source_id
-- ============================================================================
ALTER TABLE deployments
    ADD CONSTRAINT fk_deployments_service_source
    FOREIGN KEY (service_source_id) REFERENCES service_sources(id) ON DELETE SET NULL;

-- ============================================================================
-- ALTER build_jobs: add FKs for service_source_id and repository_id
-- ============================================================================
ALTER TABLE build_jobs
    ADD CONSTRAINT fk_build_jobs_service_source
    FOREIGN KEY (service_source_id) REFERENCES service_sources(id);

ALTER TABLE build_jobs
    ADD CONSTRAINT fk_build_jobs_repository
    FOREIGN KEY (repository_id) REFERENCES github_repositories(id);

-- ============================================================================
-- Additional indexes per spec 6.9
-- ============================================================================
CREATE INDEX idx_build_jobs_status ON build_jobs(status);
CREATE INDEX idx_service_sources_status ON service_sources(source_status);

-- ============================================================================
-- Widen deployments.git_commit_sha to VARCHAR(64) for Git SHA-256 compatibility
-- ============================================================================
ALTER TABLE deployments
    ALTER COLUMN git_commit_sha TYPE VARCHAR(64);
