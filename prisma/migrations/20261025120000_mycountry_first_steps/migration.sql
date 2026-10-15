-- MyCountry "First steps" card (docs/specs/2026-10-15-country-builder-editor-redesign-design.md, after founding): when
-- the owner hid the card for the nation. Nullable and additive, so `db push` adds it as well; this file is idempotent
-- and safe to re-run by hand:
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261025120000_mycountry_first_steps/migration.sql

ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "firstStepsDismissedAt" TIMESTAMP(3);
