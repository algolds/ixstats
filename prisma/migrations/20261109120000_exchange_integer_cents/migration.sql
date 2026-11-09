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

COMMIT;
