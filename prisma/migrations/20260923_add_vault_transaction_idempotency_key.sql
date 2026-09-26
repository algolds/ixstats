-- Plan 328: idempotency key for vault ledger rows (passive-income payouts).
-- Additive, nullable; existing rows stay NULL. Operator review required before applying.
-- On a large table prefer running the index statement separately as
--   CREATE UNIQUE INDEX CONCURRENTLY ... (cannot run inside a transaction block).
ALTER TABLE "vault_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "vault_transactions_idempotencyKey_key"
  ON "vault_transactions"("idempotencyKey");
