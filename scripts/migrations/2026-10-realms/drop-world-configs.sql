-- Realms (docs/architecture/realms-framework-spec.md; rose-garden runbook step 5a): the Prisma schema no longer has
-- world_configs (1 row) or territory_claims (0 rows). `db push` without --accept-data-loss stops on the non-empty
-- world_configs, so the runbook pushed by hand and answered yes; the deploy script's own push cannot answer. This drops
-- both instead, after the deploy's backup (which keeps the row) and before its push. The owner approved the drop
-- (runbook 5a). Idempotent: IF EXISTS, so a re-run changes nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realms/drop-world-configs.sql
--
-- Size first (read-only):
--   SELECT to_regclass('world_configs') IS NOT NULL, to_regclass('territory_claims') IS NOT NULL;

BEGIN;

DROP TABLE IF EXISTS "territory_claims" CASCADE;
DROP TABLE IF EXISTS "world_configs" CASCADE;

COMMIT;
