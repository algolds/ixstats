-- MyCountry "First steps" card (docs/specs/2026-10-15-country-builder-editor-redesign-design.md, after founding): when
-- the owner hid the card for the nation. Nullable and additive, so `db push` adds it as well; this file is idempotent
-- and safe to re-run by hand. Covered by `db push`, with no data step: scripts/deploy-production.sh does not run it
-- (its additive step and push add the column):
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261025120000_mycountry_first_steps/migration.sql

ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "firstStepsDismissedAt" TIMESTAMP(3);
