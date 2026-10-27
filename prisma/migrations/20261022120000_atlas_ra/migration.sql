-- Atlas Release A (docs/specs/2026-10-11-atlas-release-a-world-creation-design.md). Hand-written and idempotent: safe
-- to re-run, and a no-op on a database that already has it.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261022120000_atlas_ra/migration.sql

-- `worldgen`: the nation slot was made by the world generator (the `world` map import), so its figures come from the
-- generated map and the realm's nation growth table never overwrites them. `claimable` is false for a slot nobody may
-- claim (scenery): claims, open-nation counts and realm listings skip it. Both default as the Prisma schema does.
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "worldgen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "claimable" BOOLEAN NOT NULL DEFAULT true;
