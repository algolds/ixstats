-- Vault collectathon hub (docs/specs/2026-10-14-vault-collectathon-hub-design.md). Hand-written and idempotent: safe to
-- re-run. Run it right after the Atlas Studio SQL and before `db push`.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261024120000_vault_hub/migration.sql

-- When the country was first owned (real time, for the achievement floors).
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "ownedSince" TIMESTAMP(3);

-- Lorewards identity: one card per (entry, edition).
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "lorewardEntryId" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "lorewardEdition" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "cards_lorewardEntryId_lorewardEdition_key"
  ON "cards" ("lorewardEntryId", "lorewardEdition");

-- The national issue IxCredits award is metagame-only now (the column is removed with its code).
ALTER TABLE "national_issues" DROP COLUMN IF EXISTS "ixCreditsAwarded";

-- The Cards nav tab moved to the Vault hub: drop its stored visibility so the default applies.
DELETE FROM "SystemConfig" WHERE "key" = 'showCardsTab';
