-- WikiOS follow-up F5: backfill wiki_revisions."parentRevisionId".
--
-- Hand-written, NOT applied by any script. The operator runs it once:
--   psql <database> -f prisma/manual-migrations/2026-10-01-wikios-revision-parents.sql
--
-- Schema is unchanged (the column exists). Until now nothing wrote it: every imported revision (XML import, the
-- inbound sync) and every WikiOS save left it NULL, so the user-contributions fallback (`isNew: !parentRevisionId`)
-- showed every one of them as the creation of its page. From this change on the app sets it on every save
-- (the live revision the save was made on top of), on every import and on the inbound sync's echoes
-- (src/lib/wiki-os/core/revision-parents.ts, the same rule as below), and the inbound sync's parked revisions record
-- the head they did not fit on. This file only catches up the rows written before.
--
-- The rule: within one page (articleId), take the LIVE revisions (parked = false) in the order readers use for a
-- page's history, "createdAt" then "id", and give each the one before it as its parent. The page's first live
-- revision keeps NULL (it IS the creation). A parked revision (a MediaWiki edit that never went live) is skipped on
-- both sides: it is never a parent, and this file leaves its own column alone.
--
-- Idempotent: only rows whose "parentRevisionId" IS NULL and that HAVE a previous live revision are touched, and what
-- they are given is a function of the page's rows alone, so a second run finds nothing left to set (0 rows). A parent
-- that is already set (by the app, or by an earlier run) is never changed. Rows inserted later than the run are the
-- app's to fill, which it does.
--
-- Single statement, atomic. On a large table it holds row locks on the rows it updates only for its own duration.

BEGIN;

UPDATE wiki_revisions AS r
SET "parentRevisionId" = chain."previousId"
FROM (
  SELECT "id",
         lag("id") OVER (PARTITION BY "articleId" ORDER BY "createdAt", "id") AS "previousId"
  FROM wiki_revisions
  WHERE "parked" = false
) AS chain
WHERE r."id" = chain."id"
  AND r."parentRevisionId" IS NULL
  AND chain."previousId" IS NOT NULL;

COMMIT;
