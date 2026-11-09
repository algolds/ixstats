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

COMMIT;
