-- 0001_baseline.up.sql
-- Baseline schema for Summit PaaS control plane.
-- Creates core platform tables: organizations, users, memberships, projects,
-- environments, services, resources, secrets, deployments, builds, releases,
-- domains, metering, audit, and outbox.

-- ============================================================================
-- updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Organizations (Tenants)
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(63) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Users
-- Supabase Auth linkage: the id column matches the Supabase auth.users(id).
-- We do NOT add a foreign key to auth.users because this schema must apply
-- to plain PostgreSQL. The application layer ensures id consistency.
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Organization Memberships (RBAC)
-- ============================================================================
CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);

CREATE TRIGGER trg_org_memberships_updated_at
    BEFORE UPDATE ON organization_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Projects
-- ============================================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    slug VARCHAR(63) NOT NULL,
    name VARCHAR(255) NOT NULL,
    git_repository_url VARCHAR(512),
    git_default_branch VARCHAR(128) DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_project_slug UNIQUE (organization_id, slug)
);
CREATE INDEX idx_projects_org ON projects(organization_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Environments
-- ============================================================================
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(63) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('production', 'staging', 'preview')),
    is_ephemeral BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_project_env_name UNIQUE (project_id, name)
);
CREATE INDEX idx_environments_project ON environments(project_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_environments_updated_at
    BEFORE UPDATE ON environments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Services
-- ============================================================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(63) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('web', 'worker', 'cron')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_env_service_name UNIQUE (environment_id, name)
);
CREATE INDEX idx_services_environment ON services(environment_id);

CREATE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Service Resources
-- ============================================================================
CREATE TABLE service_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    cpu_request_millicores INT NOT NULL DEFAULT 100,
    cpu_limit_millicores INT NOT NULL DEFAULT 500,
    memory_request_mb INT NOT NULL DEFAULT 128,
    memory_limit_mb INT NOT NULL DEFAULT 512,
    min_replicas INT NOT NULL DEFAULT 1,
    max_replicas INT NOT NULL DEFAULT 5,
    port INT DEFAULT 8080,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_resource UNIQUE (service_id)
);

CREATE TRIGGER trg_service_resources_updated_at
    BEFORE UPDATE ON service_resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Secret References (pointers only, zero secret values)
-- ============================================================================
CREATE TABLE secret_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    provider VARCHAR(64) NOT NULL CHECK (provider IN ('openbao', 'aws_secrets_manager', 'kubernetes_secret')),
    provider_vault_path VARCHAR(512) NOT NULL,
    provider_version_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_env_secret_key UNIQUE (environment_id, key_name)
);
CREATE INDEX idx_secret_ref_env ON secret_references(environment_id);

CREATE TRIGGER trg_secret_references_updated_at
    BEFORE UPDATE ON secret_references
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Deployments
-- Deviation from baseline: added service_id, service_source_id, trigger_type,
-- trigger_event_id, ref, source_snapshot columns for GitHub integration.
-- service_source_id FK is added in 0002 after service_sources table is created.
-- ============================================================================
CREATE TYPE deployment_status AS ENUM (
    'pending', 'queued', 'building', 'deploying', 'active', 'superseded', 'failed', 'cancelled'
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES services(id),
    service_source_id UUID, -- FK added in 0002_github_integration
    git_commit_sha VARCHAR(40) NOT NULL,
    git_branch VARCHAR(128) NOT NULL,
    status deployment_status NOT NULL DEFAULT 'pending',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_event_id UUID,
    ref TEXT,
    source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_idempotency UNIQUE (project_id, idempotency_key)
);
CREATE INDEX idx_deployments_env_status ON deployments(environment_id, status);
CREATE INDEX idx_deployments_created ON deployments(created_at DESC);
CREATE INDEX idx_deployments_service ON deployments(service_id);

-- Partial unique index for webhook-triggered deployment idempotency
CREATE UNIQUE INDEX idx_deployments_trigger_event_service
    ON deployments(trigger_event_id, service_id)
    WHERE trigger_event_id IS NOT NULL;

CREATE TRIGGER trg_deployments_updated_at
    BEFORE UPDATE ON deployments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Build Jobs
-- This IS the durable build request (deviation from spec 6.7: no duplicate
-- build_requests table). The build_jobs table serves as both the build
-- execution record and the durable build request queue.
-- ============================================================================
CREATE TABLE build_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    service_source_id UUID,  -- FK added in 0002_github_integration
    repository_id UUID,      -- FK added in 0002_github_integration
    commit_sha TEXT,
    ref TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'running', 'succeeded', 'failed', 'cancelled')),
    builder_type VARCHAR(64) NOT NULL DEFAULT 'gvisor_rootless_buildkit',
    oci_image_digest VARCHAR(255),
    loki_stream_label VARCHAR(128),
    error_message TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_deployment_build UNIQUE (deployment_id)
);

CREATE TRIGGER trg_build_jobs_updated_at
    BEFORE UPDATE ON build_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Releases
-- ============================================================================
CREATE TABLE releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE RESTRICT,
    release_number INT NOT NULL,
    config_snapshot JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_env_release_num UNIQUE (environment_id, release_number)
);
CREATE INDEX idx_releases_env_active ON releases(environment_id) WHERE is_active = TRUE;

-- ============================================================================
-- Custom Domains
-- ============================================================================
CREATE TABLE custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    fqdn VARCHAR(255) NOT NULL UNIQUE,
    tls_secret_ref_id UUID REFERENCES secret_references(id),
    verification_token VARCHAR(128) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    routing_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_domains_env ON custom_domains(environment_id);

CREATE TRIGGER trg_custom_domains_updated_at
    BEFORE UPDATE ON custom_domains
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Metering Ledger (append-only)
-- ============================================================================
CREATE TABLE metering_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
    metric_type VARCHAR(64) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    idempotency_hash VARCHAR(64) NOT NULL UNIQUE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metering_org_window ON metering_ledger(organization_id, window_start, window_end);

-- ============================================================================
-- Audit Logs (immutable)
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON audit_logs(organization_id, created_at DESC);

-- ============================================================================
-- Transactional Outbox
-- ============================================================================
CREATE TYPE outbox_status AS ENUM ('pending', 'claimed', 'completed', 'failed');

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    locked_by VARCHAR(128),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);
CREATE INDEX idx_outbox_queue ON outbox_events(status, available_at, created_at)
    WHERE status IN ('pending', 'claimed');

CREATE TRIGGER trg_outbox_events_updated_at
    BEFORE UPDATE ON outbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
