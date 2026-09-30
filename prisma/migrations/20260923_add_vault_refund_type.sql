-- Add REFUND to VaultTransactionType (plan 327). Additive and safe.
-- vault_transactions.type is TEXT in the Prisma schema; this only keeps the
-- legacy Postgres enum type (if it still exists) in sync with the TS enum.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VaultTransactionType') THEN
    ALTER TYPE "VaultTransactionType" ADD VALUE IF NOT EXISTS 'REFUND';
  END IF;
END $$;
