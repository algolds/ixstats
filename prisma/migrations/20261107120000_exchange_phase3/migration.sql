-- Exchange Phase 3 (docs/specs/2026-11-01-exchange-phase-3-design.md, schema section). Realm-scoped companies, sectors and
-- contracts, nation treasuries with an audit ledger, the share buy order book, and shareholder governance. Hand-written
-- and idempotent: safe to re-run, and a no-op on a database that already has it. It creates what the Prisma schema
-- declares, so the `db push` around it changes nothing here. It is one transaction, so a failure changes nothing.
--
-- Existing rows are backfilled by the column defaults ("default" realm, balanced pricing, software_media sub-industry),
-- so no UPDATE is needed. The new unique indexes are created before the old ones are dropped, so a populated table is
-- never left without a uniqueness guard.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261107120000_exchange_phase3/migration.sql

BEGIN;

-- Company: realm scope, HQ nation, sub-industry, credit line, last trade, last tick P&L, distress window.
ALTER TABLE "exchange_companies" ADD COLUMN IF NOT EXISTS "realmId" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS "subIndustryKey" TEXT NOT NULL DEFAULT 'software_media',
ADD COLUMN IF NOT EXISTS "hqCountryId" TEXT,
ADD COLUMN IF NOT EXISTS "pricingStrategy" TEXT NOT NULL DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS "lobbyBuffType" TEXT,
ADD COLUMN IF NOT EXISTS "lobbyBuffUntilIxTime" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "creditDrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditRating" TEXT NOT NULL DEFAULT 'A',
ADD COLUMN IF NOT EXISTS "lastTradePrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lastTradeIxTime" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lastTickRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastTickExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastTickTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastTickNetIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "distressedSinceIxTime" DOUBLE PRECISION;

-- Sector indices and positions: realm scope and the Realm's macro GDP weight.
ALTER TABLE "exchange_sector_indices" ADD COLUMN IF NOT EXISTS "realmId" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS "macroWeight" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "exchange_sector_index_history" ADD COLUMN IF NOT EXISTS "realmId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "exchange_sector_positions" ADD COLUMN IF NOT EXISTS "realmId" TEXT NOT NULL DEFAULT 'default';

-- Contract: realm scope, linked Directive or National Issue, and the cross-border tariff.
ALTER TABLE "exchange_contracts" ADD COLUMN IF NOT EXISTS "realmId" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS "linkedDirectiveId" TEXT,
ADD COLUMN IF NOT EXISTS "linkedIssueId" TEXT,
ADD COLUMN IF NOT EXISTS "tariffRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tariffPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "exchange_nation_treasuries" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL DEFAULT 'default',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeStipend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeTaxEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeTariffEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeInterestEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "corporateGdpShift" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastStipendIxTime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_nation_treasuries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exchange_nation_treasury_entries" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "ixTime" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_nation_treasury_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exchange_share_buy_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "sharesOrdered" INTEGER NOT NULL,
    "maxPricePerShare" DOUBLE PRECISION NOT NULL,
    "escrow" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdIxTime" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_share_buy_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exchange_company_proposals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "proposerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sharesFor" INTEGER NOT NULL DEFAULT 0,
    "sharesAgainst" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleShares" INTEGER NOT NULL,
    "expiresIxTime" DOUBLE PRECISION NOT NULL,
    "resolvedIxTime" DOUBLE PRECISION,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_company_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exchange_company_votes" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "support" BOOLEAN NOT NULL,
    "shares" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_company_votes_pkey" PRIMARY KEY ("id")
);

-- New unique indexes first: the old ones are dropped only once their replacements exist.
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_companies_realmId_name_key" ON "exchange_companies"("realmId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_sector_indices_realmId_sectorKey_key" ON "exchange_sector_indices"("realmId", "sectorKey");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_sector_positions_ownerUserId_realmId_sectorKey_key" ON "exchange_sector_positions"("ownerUserId", "realmId", "sectorKey");

DROP INDEX IF EXISTS "exchange_companies_name_key";
DROP INDEX IF EXISTS "exchange_sector_indices_sectorKey_key";
DROP INDEX IF EXISTS "exchange_sector_positions_ownerUserId_sectorKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_nation_treasuries_countryId_key" ON "exchange_nation_treasuries"("countryId");
CREATE INDEX IF NOT EXISTS "exchange_nation_treasuries_realmId_idx" ON "exchange_nation_treasuries"("realmId");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_nation_treasury_entries_idempotencyKey_key" ON "exchange_nation_treasury_entries"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "exchange_nation_treasury_entries_countryId_createdAt_idx" ON "exchange_nation_treasury_entries"("countryId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_share_buy_orders_idempotencyKey_key" ON "exchange_share_buy_orders"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "exchange_share_buy_orders_companyId_status_idx" ON "exchange_share_buy_orders"("companyId", "status");
CREATE INDEX IF NOT EXISTS "exchange_share_buy_orders_buyerUserId_idx" ON "exchange_share_buy_orders"("buyerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_company_proposals_idempotencyKey_key" ON "exchange_company_proposals"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "exchange_company_proposals_companyId_status_idx" ON "exchange_company_proposals"("companyId", "status");
CREATE INDEX IF NOT EXISTS "exchange_company_votes_voterUserId_idx" ON "exchange_company_votes"("voterUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_company_votes_proposalId_voterUserId_key" ON "exchange_company_votes"("proposalId", "voterUserId");
CREATE INDEX IF NOT EXISTS "exchange_companies_realmId_status_idx" ON "exchange_companies"("realmId", "status");
CREATE INDEX IF NOT EXISTS "exchange_companies_hqCountryId_idx" ON "exchange_companies"("hqCountryId");
CREATE INDEX IF NOT EXISTS "exchange_sector_index_history_realmId_idx" ON "exchange_sector_index_history"("realmId");
CREATE INDEX IF NOT EXISTS "exchange_contracts_realmId_status_idx" ON "exchange_contracts"("realmId", "status");

-- Foreign keys for the two new tables that point at an existing table (Company, CompanyProposal). The rest of the
-- new columns (realmId, countryId, buyerUserId, proposerUserId, voterUserId) are plain strings with no foreign key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_share_buy_orders_companyId_fkey') THEN
    ALTER TABLE "exchange_share_buy_orders" ADD CONSTRAINT "exchange_share_buy_orders_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "exchange_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_company_proposals_companyId_fkey') THEN
    ALTER TABLE "exchange_company_proposals" ADD CONSTRAINT "exchange_company_proposals_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "exchange_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_company_votes_proposalId_fkey') THEN
    ALTER TABLE "exchange_company_votes" ADD CONSTRAINT "exchange_company_votes_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "exchange_company_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
