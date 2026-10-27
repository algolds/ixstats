-- Plan 410: the MediaWiki-compatible api.php served by WikiOS.
-- Hand-applied by the operator (psql -f), never by db:push/db:migrate. Idempotent: safe to run twice.
--
-- 1. Bot passwords and their sessions (two new tables).
-- 2. Integer ids for api.php, which speaks MediaWiki's integers while WikiOS keys rows by cuid:
--      wiki_articles."pageId"  (api.php `pageid`)
--      wiki_revisions."revId"  (api.php `revid`, `parentid`, `newrevid`)
--      wiki_logs."logId"       (api.php `logid`)
--    A row that came from MediaWiki keeps MediaWiki's own number (mwPageId / mwRevId), so an id a bot
--    saw on classic MediaWiki still means the same page or revision here. Every other row takes the
--    next number of a sequence that starts at 1,000,000,001 (articles, revisions) or 1 (logs), far above
--    any MediaWiki id. A BEFORE INSERT trigger assigns the id, so no application code has to; an id,
--    once assigned, never changes (stamping mwRevId on a native revision later does not renumber it).
--    Uniqueness is per `source`, because iiwiki/althistory rows keep their own MediaWiki numbers.

BEGIN;

-- 1. Bot passwords ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "wiki_bot_passwords" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "appId"        TEXT         NOT NULL,
  "passwordHash" TEXT         NOT NULL,
  "grants"       TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "restrictions" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"   TIMESTAMP(3),
  CONSTRAINT "wiki_bot_passwords_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_bot_passwords_userId_appId_key" ON "wiki_bot_passwords" ("userId", "appId");
CREATE INDEX IF NOT EXISTS "wiki_bot_passwords_userId_idx" ON "wiki_bot_passwords" ("userId");

CREATE TABLE IF NOT EXISTS "wiki_api_sessions" (
  "id"            TEXT         NOT NULL,
  "botPasswordId" TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wiki_api_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wiki_api_sessions_botPasswordId_idx" ON "wiki_api_sessions" ("botPasswordId");
CREATE INDEX IF NOT EXISTS "wiki_api_sessions_userId_idx" ON "wiki_api_sessions" ("userId");
CREATE INDEX IF NOT EXISTS "wiki_api_sessions_expiresAt_idx" ON "wiki_api_sessions" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wiki_api_sessions_botPasswordId_fkey'
  ) THEN
    ALTER TABLE "wiki_api_sessions"
      ADD CONSTRAINT "wiki_api_sessions_botPasswordId_fkey"
      FOREIGN KEY ("botPasswordId") REFERENCES "wiki_bot_passwords" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2a. Page ids ----------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS wiki_articles_pageid_seq AS integer START WITH 1000000001 MAXVALUE 2147483647;

ALTER TABLE "wiki_articles" ADD COLUMN IF NOT EXISTS "pageId" INTEGER;

-- MediaWiki's page_id where the page has one and it is the first page of its source to claim it ...
UPDATE "wiki_articles" a
SET "pageId" = a."mwPageId"
FROM (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY source, "mwPageId" ORDER BY "createdAt", id) AS rn
    FROM "wiki_articles"
    WHERE "mwPageId" IS NOT NULL AND "pageId" IS NULL
  ) ranked
  WHERE rn = 1
) first_claim
WHERE a.id = first_claim.id
  AND NOT EXISTS (
    SELECT 1 FROM "wiki_articles" b WHERE b.source = a.source AND b."pageId" = a."mwPageId"
  );

-- ... and the next sequence number for every other page, oldest first.
UPDATE "wiki_articles" a
SET "pageId" = n.next_id
FROM (
  SELECT id, nextval('wiki_articles_pageid_seq')::integer AS next_id
  FROM (SELECT id FROM "wiki_articles" WHERE "pageId" IS NULL ORDER BY "createdAt", id) pending
) n
WHERE a.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_articles_source_pageId_key" ON "wiki_articles" ("source", "pageId");

CREATE OR REPLACE FUNCTION wiki_articles_assign_page_id() RETURNS trigger AS $$
BEGIN
  IF NEW."pageId" IS NULL THEN
    IF NEW."mwPageId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "wiki_articles" b WHERE b.source = NEW.source AND b."pageId" = NEW."mwPageId"
    ) THEN
      NEW."pageId" := NEW."mwPageId";
    ELSE
      NEW."pageId" := nextval('wiki_articles_pageid_seq')::integer;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_articles_assign_page_id_trg ON "wiki_articles";
CREATE TRIGGER wiki_articles_assign_page_id_trg
  BEFORE INSERT ON "wiki_articles"
  FOR EACH ROW EXECUTE FUNCTION wiki_articles_assign_page_id();

-- 2b. Revision ids ------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS wiki_revisions_revid_seq AS integer START WITH 1000000001 MAXVALUE 2147483647;

ALTER TABLE "wiki_revisions" ADD COLUMN IF NOT EXISTS "revId" INTEGER;

-- (source, mwRevId) is already unique, so MediaWiki's rev_id is a safe revId.
UPDATE "wiki_revisions" SET "revId" = "mwRevId" WHERE "revId" IS NULL AND "mwRevId" IS NOT NULL;

UPDATE "wiki_revisions" r
SET "revId" = n.next_id
FROM (
  SELECT id, nextval('wiki_revisions_revid_seq')::integer AS next_id
  FROM (SELECT id FROM "wiki_revisions" WHERE "revId" IS NULL ORDER BY "createdAt", id) pending
) n
WHERE r.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_revisions_source_revId_key" ON "wiki_revisions" ("source", "revId");

CREATE OR REPLACE FUNCTION wiki_revisions_assign_rev_id() RETURNS trigger AS $$
BEGIN
  IF NEW."revId" IS NULL THEN
    IF NEW."mwRevId" IS NOT NULL THEN
      NEW."revId" := NEW."mwRevId";
    ELSE
      NEW."revId" := nextval('wiki_revisions_revid_seq')::integer;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_revisions_assign_rev_id_trg ON "wiki_revisions";
CREATE TRIGGER wiki_revisions_assign_rev_id_trg
  BEFORE INSERT ON "wiki_revisions"
  FOR EACH ROW EXECUTE FUNCTION wiki_revisions_assign_rev_id();

-- 2c. Log ids -----------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS wiki_logs_logid_seq AS integer START WITH 1 MAXVALUE 2147483647;

ALTER TABLE "wiki_logs" ADD COLUMN IF NOT EXISTS "logId" INTEGER;

UPDATE "wiki_logs" l
SET "logId" = n.next_id
FROM (
  SELECT id, nextval('wiki_logs_logid_seq')::integer AS next_id
  FROM (SELECT id FROM "wiki_logs" WHERE "logId" IS NULL ORDER BY "createdAt", id) pending
) n
WHERE l.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_logs_logId_key" ON "wiki_logs" ("logId");

CREATE OR REPLACE FUNCTION wiki_logs_assign_log_id() RETURNS trigger AS $$
BEGIN
  IF NEW."logId" IS NULL THEN
    NEW."logId" := nextval('wiki_logs_logid_seq')::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_logs_assign_log_id_trg ON "wiki_logs";
CREATE TRIGGER wiki_logs_assign_log_id_trg
  BEFORE INSERT ON "wiki_logs"
  FOR EACH ROW EXECUTE FUNCTION wiki_logs_assign_log_id();

COMMIT;
