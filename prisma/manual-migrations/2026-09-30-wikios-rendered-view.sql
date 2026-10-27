-- WikiOS plan 404: render each article once per revision, off the read path.
--
-- Hand-written, NOT applied by any script. The operator runs it once, BEFORE deploying the code:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-rendered-view.sql
--
-- "renderedView" holds the reader view bundle (transformed + sanitized body, infobox, notices, TOC)
-- that src/lib/wiki-os/services/render-service.ts builds from MediaWiki's action=parse output of the
-- article's own wikitext. "htmlSyncedAt" (existing column) is the freshness marker: a timestamp means
-- "renderedView matches the current wikitext", NULL means "stale, render me". "contentHtml" keeps the
-- raw MediaWiki HTML and is no longer cleared on an edit.
--
-- Statement 1 adds the column. Statement 2 marks every row that has no bundle stale, so each article
-- is rendered lazily by its first reader (or by the render queue) after the deploy; rows that already
-- have a bundle are left alone. Both statements are idempotent: the column is added only if missing,
-- and the UPDATE touches a row only while it has no bundle and a non-NULL "htmlSyncedAt", so a second
-- run updates 0 rows.

BEGIN;

ALTER TABLE wiki_articles ADD COLUMN IF NOT EXISTS "renderedView" jsonb;

UPDATE wiki_articles
   SET "htmlSyncedAt" = NULL
 WHERE "renderedView" IS NULL
   AND "htmlSyncedAt" IS NOT NULL;

COMMIT;
