-- 0004_runtime_lifecycle.up.sql
-- Runtime lifecycle persistence for the MVP build -> deploy loop
-- (docs/mvp_runtime_contracts.md C2, C6, C7).
--
-- Down-migration decision (docs/implementation_arpit.md A.3): the runner in
-- internal/db/migrate.go is intentionally forward-only (*.up.sql). Schema
-- changes follow expand/contract, and every change in this file is additive
-- (new nullable columns, new tables, new indexes, one new constraint added
-- NOT VALID then validated). Rolling back means restoring from backup or
-- shipping a new forward migration, not running a .down.sql.

-- ============================================================================
-- deployments: runtime lifecycle columns
-- ============================================================================
ALTER TABLE deployments
    ADD COLUMN cancel_requested_at TIMESTAMPTZ,
    ADD COLUMN image_ref TEXT,          -- full ref: <repo>@sha256:<digest>
    ADD COLUMN public_url TEXT,
    ADD COLUMN status_reason TEXT,
    ADD COLUMN started_at TIMESTAMPTZ,  -- set when the deployment leaves 'queued'
    ADD COLUMN finished_at TIMESTAMPTZ; -- set on failed / cancelled / superseded

-- Orchestrator monitor: scan only in-flight deployments.
CREATE INDEX idx_deployments_in_flight ON deployments (created_at)
    WHERE status IN ('queued', 'building', 'image_ready', 'deploying', 'health_checking');

-- Latest 'running' deployment per service (supersede lookup on promotion).
CREATE INDEX idx_deployments_service_running ON deployments (service_id)
    WHERE status = 'running';

-- ============================================================================
-- Audit fix A.2 #2: a deployment's service must belong to its environment.
-- NOT VALID + VALIDATE keeps the lock short and is safe on existing rows.
-- (service_id is nullable; MATCH SIMPLE skips the check when it is NULL.)
-- ============================================================================
ALTER TABLE services
    ADD CONSTRAINT uq_service_environment UNIQUE (id, environment_id);

ALTER TABLE deployments
    ADD CONSTRAINT fk_deployment_service_environment
    FOREIGN KEY (service_id, environment_id)
    REFERENCES services (id, environment_id) ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE deployments VALIDATE CONSTRAINT fk_deployment_service_environment;

-- ============================================================================
-- build_jobs: runtime tracking
-- (image digest is stored in the existing oci_image_digest column)
-- ============================================================================
ALTER TABLE build_jobs
    ADD COLUMN attempt_id UUID,
    ADD COLUMN pod_name TEXT,
    ADD COLUMN image_repository TEXT,
    ADD COLUMN image_tag TEXT,
    ADD COLUMN current_stage TEXT,
    ADD COLUMN last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN timeout_seconds INT;

-- ============================================================================
-- releases: at most one release per deployment (makes promotion idempotent)
-- ============================================================================
CREATE UNIQUE INDEX uq_releases_deployment ON releases (deployment_id);

-- ============================================================================
-- deployment_events: append-only state transition history
-- ============================================================================
CREATE TABLE deployment_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    from_status deployment_status,  -- NULL for the creation event
    to_status deployment_status NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deployment_events_deployment ON deployment_events (deployment_id, created_at);

-- ============================================================================
-- build_job_events: stage/status updates reported by the builder
-- (POST /internal/v1/builds/{id}/status), idempotent on sequence.
-- ============================================================================
CREATE TABLE build_job_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_job_id UUID NOT NULL REFERENCES build_jobs(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_build_job_event_sequence UNIQUE (build_job_id, sequence)
);

-- ============================================================================
-- build_job_logs: build log lines kept in Postgres for the MVP so the API can
-- serve them. Message length is capped in the repository layer, not here.
-- sequence is the builder-reported sequence and is deliberately NOT unique;
-- ordering for readers is the identity id (insertion order).
-- ============================================================================
CREATE TABLE build_job_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_job_id UUID NOT NULL REFERENCES build_jobs(id) ON DELETE CASCADE,
    sequence BIGINT,
    stream TEXT NOT NULL DEFAULT 'stdout',
    level TEXT NOT NULL DEFAULT 'info',
    stage TEXT,
    message TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_build_job_logs_job ON build_job_logs (build_job_id, id);

-- ============================================================================
-- RLS: accessed through the Go services only, never the Supabase Data API.
-- ============================================================================
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'deployment_events', 'build_job_events', 'build_job_logs'
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
