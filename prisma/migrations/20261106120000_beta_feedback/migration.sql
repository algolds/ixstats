-- Beta tester feedback features (docs/superpowers/plans/2026-10-29-beta-feedback-features.md). One file for the whole
-- batch: each task adds its own section below. Hand-written and idempotent: safe to re-run, and a no-op on a database
-- that already has it. It creates what the Prisma schema declares, so the `db push` around it changes nothing here. It
-- is one transaction, so a failure changes nothing (prisma db execute already runs a file as one; BEGIN and COMMIT make
-- psql do the same).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261106120000_beta_feedback/migration.sql

BEGIN;

-- Stash for sister-wiki pages: a stash item records the wiki its page is on, and the same title once per wiki is allowed.
-- Every existing item is an IxWiki page, which is the column's default. The new key is strictly weaker than the old one
-- (it only adds a column), so no existing row can violate it.
ALTER TABLE "lore_stash_items" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ixwiki';

-- Prisma creates the old key as a unique index; a database built by hand may hold it as a constraint.
ALTER TABLE "lore_stash_items" DROP CONSTRAINT IF EXISTS "lore_stash_items_stashId_contentType_pageTitle_key";
DROP INDEX IF EXISTS "lore_stash_items_stashId_contentType_pageTitle_key";

CREATE UNIQUE INDEX IF NOT EXISTS "lore_stash_items_stashId_contentType_source_pageTitle_key"
  ON "lore_stash_items" ("stashId", "contentType", "source", "pageTitle");

-- Drag to reorder accounts: the owner's order among their ThinkPages accounts. Null until they reorder; null sorts last.
ALTER TABLE "ThinkpagesAccount" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;

CREATE INDEX IF NOT EXISTS "ThinkpagesAccount_clerkUserId_sortOrder_idx"
  ON "ThinkpagesAccount" ("clerkUserId", "sortOrder");

COMMIT;
