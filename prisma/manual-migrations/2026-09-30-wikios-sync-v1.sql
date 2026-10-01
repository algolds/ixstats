-- WikiOS plan 406: inbound sync v1 (fast-forward or park, derived link data, transclusion invalidation).
--
-- Hand-written, NOT applied by any script. The operator runs it once, BEFORE deploying the code:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-sync-v1.sql
--
-- What it adds (nothing is dropped, rewritten or back-filled; existing rows get the defaults below):
--   wiki_revisions."parked", "parkReason"  a MediaWiki edit that was not made on top of WikiOS's head is stored
--                                          as a parked (non-current) revision; every "latest revision" query
--                                          filters parked rows out. Existing rows: false / NULL.
--   wiki_articles."displayTitle", "pageProps"  {{DISPLAYTITLE}} (sanitized HTML) and the page properties MediaWiki
--                                          reports for the last render. NULL until the article is rendered again.
--   wiki_categories."hidden"               MediaWiki's __HIDDENCAT__ flag, set from renders. Existing rows: false.
--   wiki_logs."mwLogId" (unique)           the MediaWiki log id of an event the inbound sync applied, so an event is
--                                          applied once (looked up by index, not by a scan of the JSON params).
--                                          Rows WikiOS wrote itself: NULL.
--   wiki_template_links, wiki_image_links  what an article transcludes / uses, replaced as a set after each render.
--                                          Empty until articles are rendered again (the render queue and the
--                                          wiki-render-stale job fill them; mark articles stale to speed that up:
--                                          UPDATE wiki_articles SET "htmlSyncedAt" = NULL WHERE source = 'ixwiki';).
--
-- Idempotent: every statement is IF NOT EXISTS (the two foreign keys are guarded by a catalog lookup), so a second
-- run changes nothing. The names are the ones `prisma generate` expects for prisma/schema/wiki.prisma.

BEGIN;

ALTER TABLE "wiki_revisions"
  ADD COLUMN IF NOT EXISTS "parked"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parkReason" TEXT;
CREATE INDEX IF NOT EXISTS "wiki_revisions_articleId_parked_createdAt_idx"
  ON "wiki_revisions" ("articleId", "parked", "createdAt");

ALTER TABLE "wiki_articles"
  ADD COLUMN IF NOT EXISTS "displayTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "pageProps"    JSONB;

ALTER TABLE "wiki_categories"
  ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "wiki_logs" ADD COLUMN IF NOT EXISTS "mwLogId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_logs_mwLogId_key" ON "wiki_logs" ("mwLogId");

CREATE TABLE IF NOT EXISTS "wiki_template_links" (
  "id"            TEXT NOT NULL,
  "articleId"     TEXT NOT NULL,
  "templateTitle" TEXT NOT NULL,
  CONSTRAINT "wiki_template_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_template_links_articleId_templateTitle_key"
  ON "wiki_template_links" ("articleId", "templateTitle");
CREATE INDEX IF NOT EXISTS "wiki_template_links_templateTitle_idx"
  ON "wiki_template_links" ("templateTitle");

CREATE TABLE IF NOT EXISTS "wiki_image_links" (
  "id"        TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "fileName"  TEXT NOT NULL,
  CONSTRAINT "wiki_image_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_image_links_articleId_fileName_key"
  ON "wiki_image_links" ("articleId", "fileName");
CREATE INDEX IF NOT EXISTS "wiki_image_links_fileName_idx"
  ON "wiki_image_links" ("fileName");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_template_links_articleId_fkey') THEN
    ALTER TABLE "wiki_template_links"
      ADD CONSTRAINT "wiki_template_links_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "wiki_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_image_links_articleId_fkey') THEN
    ALTER TABLE "wiki_image_links"
      ADD CONSTRAINT "wiki_image_links_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "wiki_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
