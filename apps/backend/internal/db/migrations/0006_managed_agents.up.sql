-- 0006_managed_agents.up.sql
-- Managed agents schema: definitions, immutable revisions, deployments, sessions.
-- Preserves personal user ownership model (users own projects; projects own agents).

-- ============================================================================
-- Enums for agent deployments and sessions
-- ============================================================================
CREATE TYPE agent_deployment_status AS ENUM (
    'provisioning', 'active', 'draining', 'read_only', 'failed', 'terminated'
);

CREATE TYPE agent_session_status AS ENUM (
    'provisioning', 'active', 'read_only', 'purge_pending', 'purged', 'failed'
);

-- ============================================================================
-- Agents (definitions)
-- ============================================================================
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_revision_id UUID,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_agent_project_owner FOREIGN KEY (project_id, user_id)
        REFERENCES projects (id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_agent_project UNIQUE (id, project_id),
    CONSTRAINT uq_agent_project_idempotency UNIQUE (project_id, idempotency_key)
);

CREATE UNIQUE INDEX uq_agent_project_name ON agents (project_id, name)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_project ON agents (project_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_user ON agents (user_id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Agent Revisions (immutable configuration)
-- ============================================================================
CREATE TABLE agent_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    config JSONB NOT NULL,
    config_hash VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_revision_number UNIQUE (agent_id, revision_number),
    CONSTRAINT uq_agent_revision_idempotency UNIQUE (agent_id, idempotency_key),
    CONSTRAINT uq_agent_revision_agent UNIQUE (id, agent_id)
);

CREATE INDEX idx_agent_revisions_agent ON agent_revisions (agent_id, revision_number DESC);

-- Composite foreign key from agents.current_revision_id back to agent_revisions
ALTER TABLE agents
    ADD CONSTRAINT fk_agent_current_revision
    FOREIGN KEY (current_revision_id, id)
    REFERENCES agent_revisions (id, agent_id)
    ON DELETE RESTRICT;

-- ============================================================================
-- Agent Deployments
-- ============================================================================
CREATE TABLE agent_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    agent_revision_id UUID NOT NULL,
    project_id UUID NOT NULL,
    environment_id UUID NOT NULL,
    deployment_number INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    supersedes_deployment_id UUID REFERENCES agent_deployments (id) ON DELETE SET NULL,
    runtime_version VARCHAR(64) NOT NULL DEFAULT 'v1',
    status agent_deployment_status NOT NULL DEFAULT 'provisioning',
    status_reason TEXT,
    delete_requested_at TIMESTAMPTZ,
    purge_after TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_agent_deployment_agent FOREIGN KEY (agent_id, project_id)
        REFERENCES agents (id, project_id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_deployment_revision FOREIGN KEY (agent_revision_id, agent_id)
        REFERENCES agent_revisions (id, agent_id) ON DELETE RESTRICT,
    CONSTRAINT fk_agent_deployment_environment FOREIGN KEY (environment_id, project_id)
        REFERENCES environments (id, project_id) ON DELETE RESTRICT,
    CONSTRAINT uq_agent_deployment_id_agent UNIQUE (id, agent_id),
    CONSTRAINT uq_agent_deployment_idempotency UNIQUE (agent_id, environment_id, idempotency_key),
    CONSTRAINT uq_agent_deployment_number UNIQUE (agent_id, environment_id, deployment_number)
);

CREATE UNIQUE INDEX uq_agent_deployment_active ON agent_deployments (agent_id, environment_id)
    WHERE status = 'active';
CREATE INDEX idx_agent_deployments_agent_env ON agent_deployments (agent_id, environment_id, created_at DESC);
CREATE INDEX idx_agent_deployments_project ON agent_deployments (project_id);

CREATE TRIGGER trg_agent_deployments_updated_at
    BEFORE UPDATE ON agent_deployments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Agent Sessions
-- ============================================================================
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES agent_deployments (id) ON DELETE CASCADE,
    pi_conversation_id VARCHAR(128),
    actor_key_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    status agent_session_status NOT NULL DEFAULT 'provisioning',
    status_reason TEXT,
    created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delete_requested_at TIMESTAMPTZ,
    purge_after TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_session_deployment_id UNIQUE (id, deployment_id),
    CONSTRAINT uq_agent_session_idempotency UNIQUE (deployment_id, idempotency_key)
);

CREATE UNIQUE INDEX uq_agent_session_pi_conv ON agent_sessions (deployment_id, pi_conversation_id)
    WHERE pi_conversation_id IS NOT NULL;
CREATE INDEX idx_agent_sessions_deployment ON agent_sessions (deployment_id, created_at DESC);

CREATE TRIGGER trg_agent_sessions_updated_at
    BEFORE UPDATE ON agent_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'agents', 'agent_revisions', 'agent_deployments', 'agent_sessions'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
        IF to_regrole('anon') IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
        END IF;
        IF to_regrole('authenticated') IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', table_name);
        END IF;
    END LOOP;
END;
$$;
