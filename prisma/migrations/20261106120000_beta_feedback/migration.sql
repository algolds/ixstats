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

-- Founding members: users credited in the realm header, set by site staff. A credit only: nothing reads this table for
-- permissions. A realm's founders go with the realm.
CREATE TABLE IF NOT EXISTS "realm_founders" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realm_founders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "realm_founders_realmId_userId_key" ON "realm_founders" ("realmId", "userId");

CREATE INDEX IF NOT EXISTS "realm_founders_userId_idx" ON "realm_founders" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'realm_founders_realmId_fkey') THEN
    ALTER TABLE "realm_founders" ADD CONSTRAINT "realm_founders_realmId_fkey"
      FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
