-- WikiOS data safety (docs/superpowers/plans/2026-10-24-wikios-data-safety.md, A5): the inbound sync's dead letters. An
-- inbound step (a classic recent change or log event) that fails is counted here; after five failed cycles it is
-- quarantined and the cycle's high-water mark moves past it, so one bad step cannot stall the sync. Its payload stays
-- for an administrator to retry it. Hand-written and idempotent: safe to re-run, and a no-op on a database that already
-- has it. It creates what the Prisma schema declares, so the `db push` around it changes nothing here. It is one
-- transaction, so a failure changes nothing.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261105120001_wikios_sync_dead_letters/migration.sql

BEGIN;

CREATE TABLE IF NOT EXISTS "wiki_sync_dead_letters" (
    "id" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mark" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(2000),
    "quarantinedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wiki_sync_dead_letters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_sync_dead_letters_stepKey_key" ON "wiki_sync_dead_letters"("stepKey");
CREATE INDEX IF NOT EXISTS "wiki_sync_dead_letters_quarantinedAt_idx" ON "wiki_sync_dead_letters"("quarantinedAt");

COMMIT;
