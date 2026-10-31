-- 0003_deployment_lifecycle_states.up.sql
-- Extends deployment_status with the MVP runtime lifecycle states
-- (docs/mvp_runtime_contracts.md C2):
--   queued -> building -> image_ready -> deploying -> health_checking -> running
-- The legacy values 'pending' and 'active' stay in the type for compatibility.
--
-- Kept in its own migration file: a value added with ALTER TYPE ... ADD VALUE
-- cannot be used in the same transaction that added it, and the migration
-- runner executes each file in one transaction. Anything that references the
-- new values (indexes, defaults, data) lives in 0004 or later.

ALTER TYPE deployment_status ADD VALUE IF NOT EXISTS 'image_ready' AFTER 'building';
ALTER TYPE deployment_status ADD VALUE IF NOT EXISTS 'health_checking' AFTER 'deploying';
ALTER TYPE deployment_status ADD VALUE IF NOT EXISTS 'running' AFTER 'health_checking';
