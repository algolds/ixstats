-- WikiOS plan 411: native uploads (WikiOS holds the bytes first, the mirror puts them in MediaWiki).
--
-- Hand-written, NOT applied by any script. The operator runs it once, BEFORE deploying the code:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-uploads.sql
--
-- What it adds (nothing existing is changed, dropped or back-filled):
--   wiki_assets.sha1   the SHA-1 of the file's CONTENT in MediaWiki's base 36 (31 characters, zero-padded: `img_sha1`).
--                      It names the file in the staging directory (WIKIOS_UPLOAD_DIR) and finds duplicates. NULL for
--                      every asset that was registered from MediaWiki's own files and never uploaded through WikiOS.
--                      `md5Hash` keeps meaning what it always meant: the MD5 of the file NAME (the shard path).
--                      Deliberately NOT unique: the same bytes may be uploaded under two names when the uploader accepts
--                      the "duplicate" warning, and a unique key would turn that into an error.
--
-- The new mirror job kind `upload` needs no DDL: `wiki_mirror_jobs.kind` is plain TEXT.
--
-- Also, once deployed (not part of this SQL):
--   * create the staging directory on the WikiOS host and set WIKIOS_UPLOAD_DIR (default `<app>/.wikios-uploads`;
--     the runbook uses /ixwiki/shared/wikios-uploads). It must be writable by WikiOS and is part of the backups
--     until every upload has been mirrored (the admin panel's pending `upload` jobs say which are still waiting);
--   * the mirror account needs the `upload` and `reupload` rights (group `wikios-mirror`) and its bot password the
--     grants `uploadfile` and `uploadeditmovefile` (docs/operations/wikios-v1-cutover.md, section 3).
--
-- Idempotent: every statement is IF NOT EXISTS, so a second run changes nothing. The names are the ones
-- `prisma generate` expects for prisma/schema/wiki.prisma (model WikiAsset).

BEGIN;

ALTER TABLE "wiki_assets" ADD COLUMN IF NOT EXISTS "sha1" TEXT;

CREATE INDEX IF NOT EXISTS "wiki_assets_sha1_idx" ON "wiki_assets" ("sha1");

COMMIT;
