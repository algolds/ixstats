-- Plan 446: Store every Exchange ₷ amount as integer cents (bigint).
-- Converts Exchange money columns from DOUBLE PRECISION (₷) to BIGINT (integer cents).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261109120000_exchange_integer_cents/migration.sql

BEGIN;

-- Phase A: ExchangeWallet & ExchangeTransaction
ALTER TABLE "exchange_wallets"
  ALTER COLUMN "sovereigns" DROP DEFAULT,
  ALTER COLUMN "sovereigns" TYPE bigint USING round("sovereigns" * 100)::bigint,
  ALTER COLUMN "sovereigns" SET DEFAULT 0,
  ALTER COLUMN "lifetimeEarned" DROP DEFAULT,
  ALTER COLUMN "lifetimeEarned" TYPE bigint USING round("lifetimeEarned" * 100)::bigint,
  ALTER COLUMN "lifetimeEarned" SET DEFAULT 0,
  ALTER COLUMN "lifetimeSpent" DROP DEFAULT,
  ALTER COLUMN "lifetimeSpent" TYPE bigint USING round("lifetimeSpent" * 100)::bigint,
  ALTER COLUMN "lifetimeSpent" SET DEFAULT 0;

ALTER TABLE "exchange_transactions"
  ALTER COLUMN "sovereigns" TYPE bigint USING round("sovereigns" * 100)::bigint,
  ALTER COLUMN "balanceAfter" TYPE bigint USING round("balanceAfter" * 100)::bigint;

-- Phase B Group 1: NationTreasury & NationTreasuryEntry
ALTER TABLE "exchange_nation_treasuries"
  ALTER COLUMN "balance" DROP DEFAULT,
  ALTER COLUMN "balance" TYPE bigint USING round("balance" * 100)::bigint,
  ALTER COLUMN "balance" SET DEFAULT 0,
  ALTER COLUMN "lifetimeStipend" DROP DEFAULT,
  ALTER COLUMN "lifetimeStipend" TYPE bigint USING round("lifetimeStipend" * 100)::bigint,
  ALTER COLUMN "lifetimeStipend" SET DEFAULT 0,
  ALTER COLUMN "lifetimeTaxEarned" DROP DEFAULT,
  ALTER COLUMN "lifetimeTaxEarned" TYPE bigint USING round("lifetimeTaxEarned" * 100)::bigint,
  ALTER COLUMN "lifetimeTaxEarned" SET DEFAULT 0,
  ALTER COLUMN "lifetimeTariffEarned" DROP DEFAULT,
  ALTER COLUMN "lifetimeTariffEarned" TYPE bigint USING round("lifetimeTariffEarned" * 100)::bigint,
  ALTER COLUMN "lifetimeTariffEarned" SET DEFAULT 0,
  ALTER COLUMN "lifetimeInterestEarned" DROP DEFAULT,
  ALTER COLUMN "lifetimeInterestEarned" TYPE bigint USING round("lifetimeInterestEarned" * 100)::bigint,
  ALTER COLUMN "lifetimeInterestEarned" SET DEFAULT 0,
  ALTER COLUMN "lifetimeSpent" DROP DEFAULT,
  ALTER COLUMN "lifetimeSpent" TYPE bigint USING round("lifetimeSpent" * 100)::bigint,
  ALTER COLUMN "lifetimeSpent" SET DEFAULT 0,
  ALTER COLUMN "companyCreditCap" DROP DEFAULT,
  ALTER COLUMN "companyCreditCap" TYPE bigint USING round("companyCreditCap" * 100)::bigint,
  ALTER COLUMN "companyCreditCap" SET DEFAULT 25000000;

ALTER TABLE "exchange_nation_treasury_entries"
  ALTER COLUMN "amount" TYPE bigint USING round("amount" * 100)::bigint,
  ALTER COLUMN "balanceAfter" TYPE bigint USING round("balanceAfter" * 100)::bigint;

-- Phase B Group 2: Company & CompanyValueHistory
ALTER TABLE "exchange_companies"
  ALTER COLUMN "capital" DROP DEFAULT,
  ALTER COLUMN "capital" TYPE bigint USING round("capital" * 100)::bigint,
  ALTER COLUMN "capital" SET DEFAULT 0,
  ALTER COLUMN "fairValue" DROP DEFAULT,
  ALTER COLUMN "fairValue" TYPE bigint USING round("fairValue" * 100)::bigint,
  ALTER COLUMN "fairValue" SET DEFAULT 0,
  ALTER COLUMN "contractsWonValue" DROP DEFAULT,
  ALTER COLUMN "contractsWonValue" TYPE bigint USING round("contractsWonValue" * 100)::bigint,
  ALTER COLUMN "contractsWonValue" SET DEFAULT 0,
  ALTER COLUMN "decisionValue" DROP DEFAULT,
  ALTER COLUMN "decisionValue" TYPE bigint USING round("decisionValue" * 100)::bigint,
  ALTER COLUMN "decisionValue" SET DEFAULT 0,
  ALTER COLUMN "creditDrawn" DROP DEFAULT,
  ALTER COLUMN "creditDrawn" TYPE bigint USING round("creditDrawn" * 100)::bigint,
  ALTER COLUMN "creditDrawn" SET DEFAULT 0,
  ALTER COLUMN "lastTradePrice" TYPE bigint USING round("lastTradePrice" * 100)::bigint,
  ALTER COLUMN "lastTickRevenue" DROP DEFAULT,
  ALTER COLUMN "lastTickRevenue" TYPE bigint USING round("lastTickRevenue" * 100)::bigint,
  ALTER COLUMN "lastTickRevenue" SET DEFAULT 0,
  ALTER COLUMN "lastTickExpenses" DROP DEFAULT,
  ALTER COLUMN "lastTickExpenses" TYPE bigint USING round("lastTickExpenses" * 100)::bigint,
  ALTER COLUMN "lastTickExpenses" SET DEFAULT 0,
  ALTER COLUMN "lastTickTax" DROP DEFAULT,
  ALTER COLUMN "lastTickTax" TYPE bigint USING round("lastTickTax" * 100)::bigint,
  ALTER COLUMN "lastTickTax" SET DEFAULT 0,
  ALTER COLUMN "lastTickNetIncome" DROP DEFAULT,
  ALTER COLUMN "lastTickNetIncome" TYPE bigint USING round("lastTickNetIncome" * 100)::bigint,
  ALTER COLUMN "lastTickNetIncome" SET DEFAULT 0;

ALTER TABLE "exchange_company_value_history"
  ALTER COLUMN "fairValue" TYPE bigint USING round("fairValue" * 100)::bigint;

-- Phase B Group 3: ShareIssuance, ShareListing, CompanyDividend, Shareholding, ShareBuyOrder
ALTER TABLE "exchange_share_issuances"
  ALTER COLUMN "pricePerShare" TYPE bigint USING round("pricePerShare" * 100)::bigint;

ALTER TABLE "exchange_share_listings"
  ALTER COLUMN "pricePerShare" TYPE bigint USING round("pricePerShare" * 100)::bigint;

ALTER TABLE "exchange_company_dividends"
  ALTER COLUMN "declared" TYPE bigint USING round("declared" * 100)::bigint,
  ALTER COLUMN "amount" TYPE bigint USING round("amount" * 100)::bigint;

ALTER TABLE "exchange_shareholdings"
  ALTER COLUMN "avgCost" DROP DEFAULT,
  ALTER COLUMN "avgCost" TYPE bigint USING round("avgCost" * 100)::bigint,
  ALTER COLUMN "avgCost" SET DEFAULT 0;

ALTER TABLE "exchange_share_buy_orders"
  ALTER COLUMN "maxPricePerShare" TYPE bigint USING round("maxPricePerShare" * 100)::bigint,
  ALTER COLUMN "escrow" TYPE bigint USING round("escrow" * 100)::bigint;

-- Phase B Group 4: NationBond, BondHolding, BondListing
ALTER TABLE "exchange_nation_bonds"
  ALTER COLUMN "faceValue" DROP DEFAULT,
  ALTER COLUMN "faceValue" TYPE bigint USING round("faceValue" * 100)::bigint,
  ALTER COLUMN "faceValue" SET DEFAULT 10000,
  ALTER COLUMN "lastTradePrice" TYPE bigint USING round("lastTradePrice" * 100)::bigint;

ALTER TABLE "exchange_bond_holdings"
  ALTER COLUMN "avgCost" DROP DEFAULT,
  ALTER COLUMN "avgCost" TYPE bigint USING round("avgCost" * 100)::bigint,
  ALTER COLUMN "avgCost" SET DEFAULT 0;

ALTER TABLE "exchange_bond_listings"
  ALTER COLUMN "pricePerUnit" TYPE bigint USING round("pricePerUnit" * 100)::bigint;

COMMIT;
