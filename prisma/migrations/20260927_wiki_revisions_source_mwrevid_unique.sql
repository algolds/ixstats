-- Plan 339 Step 2d: WikiRevision @@unique([source, mwRevId]) (was @@index).
-- OPERATOR-APPLIED. Never run by an executor. Take a backup first (bun run db:backup).
-- Run step 1 and review the counts BEFORE step 2. Apply before any `db push` of this schema:
-- the push would otherwise fail (or offer data loss) creating the unique index over duplicates.
--
-- Rows with mwRevId = NULL (native WikiOS edits, and the duplicates the old recentchanges cron
-- wrote without mwRevId) are not touched: Postgres allows many NULLs under a unique index.

-- 1. How many duplicate (source, mwRevId) rows would be deleted?
SELECT count(*) FROM wiki_revisions a
WHERE a."mwRevId" IS NOT NULL AND EXISTS (
  SELECT 1 FROM wiki_revisions b
  WHERE b.source = a.source AND b."mwRevId" = a."mwRevId"
    AND (b."createdAt", b.id) < (a."createdAt", a.id));

-- 1b. Are any of those referenced as a parent revision? Expect 0; if not 0, stop and re-point
--     those parentRevisionId values to the surviving row first.
SELECT count(*) FROM wiki_revisions p WHERE p."parentRevisionId" IN (
  SELECT a.id FROM wiki_revisions a JOIN wiki_revisions b
    ON b.source = a.source AND b."mwRevId" = a."mwRevId"
    AND (b."createdAt", b.id) < (a."createdAt", a.id));

-- 2. Dedupe: keep the earliest row per (source, mwRevId); delete the later duplicates.
DELETE FROM wiki_revisions a USING wiki_revisions b
WHERE a."mwRevId" IS NOT NULL AND b.source = a.source AND b."mwRevId" = a."mwRevId"
  AND (b."createdAt", b.id) < (a."createdAt", a.id);

-- 3. Replace the plain index with the unique index (name matches Prisma's @@unique default).
DROP INDEX IF EXISTS "wiki_revisions_source_mwRevId_idx";
CREATE UNIQUE INDEX "wiki_revisions_source_mwRevId_key" ON wiki_revisions (source, "mwRevId");
