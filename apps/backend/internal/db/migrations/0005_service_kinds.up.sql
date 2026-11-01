-- 0005_service_kinds.up.sql
-- Canvas service kinds (web, worker, image, postgres, redis; cron stays) and
-- build-less deployments. The runner only applies *.up.sql, so there is no
-- down file. No backup, snapshot, or retention columns.

-- ============================================================================
-- services.type: keep web/worker/cron, add image and managed addons.
-- ============================================================================
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;

DO $$
DECLARE
    cname TEXT;
BEGIN
    SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.oid = 'services'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%''web''%''worker''%''cron''%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%image%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE services DROP CONSTRAINT IF EXISTS %I', cname);
    END IF;
END $$;

ALTER TABLE services
    ADD CONSTRAINT services_type_check
    CHECK (type IN ('web', 'worker', 'cron', 'image', 'postgres', 'redis'));

-- ============================================================================
-- User-supplied image reference (tag or digest). Resolution happens on deploy.
-- ============================================================================
CREATE TABLE service_image_sources (
    service_id UUID PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_service_image_sources_updated_at
    BEFORE UPDATE ON service_image_sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Managed postgres/redis. storage_mb is the volume size. No backup settings.
-- ============================================================================
CREATE TABLE service_addons (
    service_id UUID PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    engine TEXT NOT NULL CHECK (engine IN ('postgres', 'redis')),
    version TEXT NOT NULL,
    storage_mb INT NOT NULL DEFAULT 1024,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_service_addons_updated_at
    BEFORE UPDATE ON service_addons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Build-less deployments (image, postgres, redis) have no git revision and no
-- build_jobs row. trigger_type stays 'manual'. Existing rows keep their SHAs.
-- ============================================================================
ALTER TABLE deployments ALTER COLUMN git_commit_sha DROP NOT NULL;
ALTER TABLE deployments ALTER COLUMN git_branch DROP NOT NULL;

-- ============================================================================
-- RLS: accessed through the Go services only, never the Supabase Data API.
-- ============================================================================
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['service_image_sources', 'service_addons'] LOOP
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
