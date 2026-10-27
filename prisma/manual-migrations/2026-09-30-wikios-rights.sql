-- Plan 409: MediaWiki-style rights model for WikiOS (groups, page protection, blocks).
-- Hand-applied by the operator (psql -f), never by db:push/db:migrate. Idempotent: safe to run twice.
-- Adds three tables; touches no existing table or row.

BEGIN;

CREATE TABLE IF NOT EXISTS "wiki_user_groups" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT,
  "wikiUsername" TEXT,
  "group"        TEXT         NOT NULL,
  "expiresAt"    TIMESTAMP(3),
  "addedById"    TEXT,
  "source"       TEXT         NOT NULL DEFAULT 'wikios',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wiki_user_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_user_groups_userId_group_key" ON "wiki_user_groups" ("userId", "group");
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_user_groups_wikiUsername_group_key" ON "wiki_user_groups" ("wikiUsername", "group");
CREATE INDEX IF NOT EXISTS "wiki_user_groups_group_idx" ON "wiki_user_groups" ("group");

CREATE TABLE IF NOT EXISTS "wiki_restrictions" (
  "id"        TEXT         NOT NULL,
  "source"    TEXT         NOT NULL DEFAULT 'ixwiki',
  "title"     TEXT         NOT NULL,
  "action"    TEXT         NOT NULL,
  "level"     TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "cascade"   BOOLEAN      NOT NULL DEFAULT false,
  "setById"   TEXT,
  "reason"    VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wiki_restrictions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_restrictions_source_title_action_key" ON "wiki_restrictions" ("source", "title", "action");

CREATE TABLE IF NOT EXISTS "wiki_blocks" (
  "id"            TEXT         NOT NULL,
  "userId"        TEXT,
  "wikiUsername"  TEXT,
  "reason"        VARCHAR(500),
  "expiresAt"     TIMESTAMP(3),
  "allowUserTalk" BOOLEAN      NOT NULL DEFAULT true,
  "blockedById"   TEXT,
  "source"        TEXT         NOT NULL DEFAULT 'wikios',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wiki_blocks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wiki_blocks_userId_idx" ON "wiki_blocks" ("userId");
CREATE INDEX IF NOT EXISTS "wiki_blocks_wikiUsername_idx" ON "wiki_blocks" ("wikiUsername");

COMMIT;

-- Plan 409 (security review): who confirmed a wiki link, and the wiki account's age and edits at proof time.
BEGIN;

ALTER TABLE "wiki_account_links" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
ALTER TABLE "wiki_account_links" ADD COLUMN IF NOT EXISTS "mwRegisteredAt" TIMESTAMP(3);
ALTER TABLE "wiki_account_links" ADD COLUMN IF NOT EXISTS "mwEditCount" INTEGER;

COMMIT;

-- Plan 409 (security review): pages whose protection was only ever recorded as the legacy
-- wiki_articles."protectionLevel" (the XML import used to write nothing else) get the edit restriction the
-- rights engine enforces. Any value other than ALL counts (SYSOP, PROTECTED and unknown values as sysop,
-- AUTOCONFIRMED as autoconfirmed: fail closed); a protection that has expired is skipped. A restriction
-- that already exists is left alone, so this can be run again.
BEGIN;

INSERT INTO "wiki_restrictions" ("id", "source", "title", "action", "level", "expiresAt", "cascade", "reason", "createdAt")
SELECT
  gen_random_uuid()::text,
  a."source",
  a."title",
  'edit',
  CASE a."protectionLevel" WHEN 'AUTOCONFIRMED' THEN 'autoconfirmed' ELSE 'sysop' END,
  a."protectionExpiry",
  false,
  'Backfilled from the page''s protection level',
  CURRENT_TIMESTAMP
FROM "wiki_articles" a
WHERE a."protectionLevel" <> 'ALL'
  AND (a."protectionExpiry" IS NULL OR a."protectionExpiry" > CURRENT_TIMESTAMP)
ON CONFLICT ("source", "title", "action") DO NOTHING;

COMMIT;
