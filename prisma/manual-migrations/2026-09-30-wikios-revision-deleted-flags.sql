-- WikiOS plan 408: remember which parts of a revision MediaWiki has deleted (revision deletion).
--
-- A dump marks them with deleted="deleted" on <text>, <comment> and <contributor>. The XML importer
-- sets these flags from it and the exporter writes the markers back, so hidden text, summaries
-- and authors stay hidden through an export and re-import. A row with "textDeleted" has "" as its
-- wikitext and is never filled from a later dump (a stale dump must not resurrect hidden text).
--
-- Idempotent: safe to run more than once. Apply with:  psql <database> -f <this file>
-- Existing rows get false: nothing back-fills them (no earlier import carried the markers).
-- Apply 2026-09-30-wikios-revision-sha1.sql too: the importer and exporter need both.

ALTER TABLE wiki_revisions
  ADD COLUMN IF NOT EXISTS "textDeleted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "commentDeleted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "userDeleted" boolean NOT NULL DEFAULT false;
