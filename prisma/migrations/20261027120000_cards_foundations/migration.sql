-- Cards refresh, Phase 1: the additive part (docs/specs/2026-10-15-cards-refresh-design.md §5.5 step 2). Hand-written
-- and idempotent. Safe while today's code runs: it only adds what that code ignores, so the owner can apply it any
-- time before the maintenance window. In the window: scripts/cards/backfill-cards-refresh.ts --apply, then
-- 20261027120001_cards_foundations_constraints. Everything here is in the Prisma schema too.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261027120000_cards_foundations/migration.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardFinish') THEN
    CREATE TYPE "CardFinish" AS ENUM ('STANDARD', 'FOIL', 'HOLO', 'SERIALISED');
  END IF;
END $$;

-- System realms (nationstates, iiwiki, althistory) are card shelves: the backfill seeds and flags them.
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Every card's home realm (nullable until the backfill fills it; the constraints make it required) and bound flag.
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "realmId" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "isBound" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "cards_realmId_idx" ON "cards"("realmId");

-- Each copy's finish.
ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "finish" "CardFinish" NOT NULL DEFAULT 'STANDARD';

-- The NS import ledger: one row per (NS card, season, importing nation), ever.
CREATE TABLE IF NOT EXISTS "ns_import_ledger" (
    "id" TEXT NOT NULL,
    "nsCardId" INTEGER NOT NULL,
    "nsSeason" INTEGER NOT NULL,
    "nation" TEXT NOT NULL,
    "userId" TEXT,
    "ownershipId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ns_import_ledger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ns_import_ledger_nsCardId_nsSeason_nation_key"
  ON "ns_import_ledger"("nsCardId", "nsSeason", "nation");
CREATE INDEX IF NOT EXISTS "ns_import_ledger_userId_idx" ON "ns_import_ledger"("userId");
