-- WikiOS plan 408: store MediaWiki's revision hash on every WikiRevision.
--
-- `sha1` is the base-36 SHA-1 of the revision's wikitext (31 characters, zero-padded), exactly the
-- `rev_sha1` MediaWiki exports. The XML importer uses it, with the revision's timestamp, to match
-- a WikiOS revision that has no `mwRevId` to the same revision in a dump (idempotent re-import).
--
-- Idempotent: safe to run more than once. Apply with:  psql <database> -f <this file>
-- Existing rows keep sha1 = NULL (nothing back-fills it); the importer fills it as it meets them.

ALTER TABLE wiki_revisions ADD COLUMN IF NOT EXISTS sha1 text;

CREATE INDEX IF NOT EXISTS "wiki_revisions_articleId_sha1_idx" ON wiki_revisions ("articleId", sha1);
