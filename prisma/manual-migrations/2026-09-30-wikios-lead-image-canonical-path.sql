-- WikiOS plan 418 (D2): lead images are stored as the canonical path "/images/<shard>/<File>".
--
-- Hand-written, NOT applied by any script. OPTIONAL: the code reads both forms (`resolveStoredImageUrl` passes a
-- row written before through unchanged), so nothing breaks if this is never run. Run it once, after deploying the
-- code, to make the stored lead images independent of the host, the image proxy and the base path they were
-- written under:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-lead-image-canonical-path.sql
--
-- What it rewrites: wiki_articles."leadImageUrl" values that name a file under the wiki's MD5 shard directory, in
-- any of the forms they were written in, to the path from "/images/" on:
--   https://ixwiki.com/images/8/8c/Flag.png                                -> /images/8/8c/Flag.png
--   /api/mediawiki/ixwiki/images/8/8c/Flag.png                             -> /images/8/8c/Flag.png
--   /projects/ixstats/api/mediawiki/ixwiki/images/8/8c/Flag.png            -> /images/8/8c/Flag.png
-- What it leaves alone: values already canonical, thumbnails ("/images/thumb/..."), Commons and other hosts'
-- URLs, and NULLs.
--
-- Preview what would change (changes nothing):
--   SELECT "title", "leadImageUrl" FROM wiki_articles
--   WHERE "leadImageUrl" ~ '/images/[0-9a-f]/[0-9a-f]{2}/' AND "leadImageUrl" NOT LIKE '/images/%' LIMIT 50;
--
-- Idempotent: a rewritten row is canonical, so the WHERE clause no longer matches it; a second run changes nothing.

BEGIN;

UPDATE wiki_articles
SET "leadImageUrl" = substring("leadImageUrl" from '(/images/[0-9a-f]/[0-9a-f]{2}/[^?#]+)')
WHERE "leadImageUrl" ~ '/images/[0-9a-f]/[0-9a-f]{2}/'
  AND "leadImageUrl" NOT LIKE '/images/%'
  AND "leadImageUrl" !~ '/images/thumb/'
  AND "leadImageUrl" !~ 'wikimedia|wikipedia|/commons/';

COMMIT;
