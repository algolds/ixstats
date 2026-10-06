-- WikiOS plan 407: the outbound mirror's durable outbox (WikiOS -> classic MediaWiki).
--
-- Hand-written, NOT applied by any script. The operator runs it once, BEFORE deploying the code:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-mirror-outbox.sql
--
-- What it adds (nothing existing is changed, dropped or back-filled):
--   wiki_mirror_jobs   one row per WikiOS write that classic MediaWiki must receive: a saved revision, a move, a
--                      delete, an undelete or a protection. The row is inserted in the same transaction as the
--                      change itself, so a committed edit always has its job; the `wiki-mirror` cron job (and an
--                      in-process kick after a save) applies the jobs in order per title (state: pending | running
--                      | done | dead | discarded; a job is retried with backoff and goes `dead` after 8 failures,
--                      which an administrator requeues or discards from the WikiOS settings panel; a discarded job
--                      is a dead job given up on, kept and counted apart from the done ones). `state` is plain
--                      TEXT, so a new state needs no DDL.
--
-- Also, once deployed (not part of this SQL):
--   * add `wiki-mirror` to CRON_ENABLED_JOBS (src/server/cron/jobs.ts; every minute, the in-process run that follows a
--     save needs no setting) and set WIKIOS_MEDIAWIKI_BOT_USER / WIKIOS_MEDIAWIKI_BOT_TOKEN: the old default
--     account is gone, and without the pair every job fails (the admin panel says so);
--   * the WikiOSMirror account needs, besides edit/bot/import/importupload, the rights `move`, `move-subpages`,
--     `suppressredirect`, `delete`, `undelete` and `protect` (group `wikios-mirror`) and, on its bot password, the
--     grants `delete` and `protect` (the move rights come with `createeditmovepage`); otherwise the page-operation
--     jobs end up dead with `permissiondenied`.
--
-- Jobs that were still in the old in-memory export queue when the previous release stopped are lost with it (the
-- queue was never persisted). To mirror the pages that were edited in WikiOS but never reached MediaWiki, let an
-- administrator re-save them, or push them with an XML import.
--
-- Idempotent: every statement is IF NOT EXISTS, so a second run changes nothing. The names are the ones
-- `prisma generate` expects for prisma/schema/wiki.prisma (model WikiMirrorJob).

BEGIN;

CREATE TABLE IF NOT EXISTS "wiki_mirror_jobs" (
  "id"            TEXT          NOT NULL,
  "source"        TEXT          NOT NULL DEFAULT 'ixwiki',
  "kind"          TEXT          NOT NULL,
  "title"         TEXT          NOT NULL,
  "articleId"     TEXT,
  "revisionId"    TEXT,
  "logId"         TEXT,
  "payload"       JSONB,
  "state"         TEXT          NOT NULL DEFAULT 'pending',
  "attempts"      INTEGER       NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError"     VARCHAR(2000),
  "mwRevId"       INTEGER,
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "wiki_mirror_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wiki_mirror_jobs_state_nextAttemptAt_idx"
  ON "wiki_mirror_jobs" ("state", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "wiki_mirror_jobs_source_title_createdAt_idx"
  ON "wiki_mirror_jobs" ("source", "title", "createdAt");

COMMIT;
