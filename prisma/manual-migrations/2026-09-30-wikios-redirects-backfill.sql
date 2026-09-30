-- WikiOS plan 402: backfill wiki_articles."redirectTargetSlug" / "redirectTargetFragment".
--
-- Hand-written, NOT applied by any script. The operator runs it once:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-redirects-backfill.sql
--
-- Schema is unchanged (the columns exist). From this plan on the app writes both columns on every
-- save and every MediaWiki inbound sync, so this file only catches up rows written before. The app
-- also self-heals each row on its next save/sync, and the reader canonicalizes the column value
-- when it follows a redirect, so an approximation here is harmless.
--
-- What it stores: "redirectTargetSlug" holds the target's canonical TITLE (the column name is
-- historical), "redirectTargetFragment" the text after "#" (underscores as spaces) or NULL. The
-- title is derived the way src/lib/wiki-os/core/redirect.ts does it: only a page whose text STARTS
-- with #REDIRECT (after whitespace) is a redirect; the target is the first [[link]], minus a leading
-- ":", a "|label" and a "#fragment"; underscores become spaces, whitespace collapses, the first
-- character is upper-cased. It does not canonicalize a namespace prefix ("user:foo" stays as typed
-- apart from the first letter) -- that is what the app does on the next save/sync.
-- Rows the page-move feature wrote (a lower-case slug in "redirectTargetSlug") are rewritten to the
-- title here too, because their wikitext is a real #REDIRECT.
--
-- Idempotent: the UPDATE only touches a row whose stored pair differs from the pair derived from its
-- wikitext (IS DISTINCT FROM), and a second run derives the same pair from the same wikitext, so it
-- updates 0 rows. Rows whose wikitext is not a redirect, or whose target is empty, are never touched.
-- Only source = 'ixwiki' rows: another wiki's titles are not canonicalized with IxWiki's namespaces.

BEGIN;

WITH raw AS (
  SELECT
    id,
    substring(wikitext from '(?i)^\s*#redirect\s*:?\s*\[\[\s*:?([^\]|#]*)') AS target,
    substring(wikitext from '(?i)^\s*#redirect\s*:?\s*\[\[[^\]|#]*#([^\]|]*)') AS fragment
  FROM wiki_articles
  WHERE source = 'ixwiki'
    AND wikitext ~* '^\s*#redirect\s*:?\s*\[\['
),
clean AS (
  SELECT
    id,
    btrim(regexp_replace(replace(target, '_', ' '), '\s+', ' ', 'g')) AS target,
    nullif(btrim(regexp_replace(replace(fragment, '_', ' '), '\s+', ' ', 'g')), '') AS fragment
  FROM raw
),
derived AS (
  SELECT id, upper(left(target, 1)) || substr(target, 2) AS target, fragment
  FROM clean
  WHERE target <> ''
)
UPDATE wiki_articles AS a
SET "redirectTargetSlug" = d.target,
    "redirectTargetFragment" = d.fragment
FROM derived AS d
WHERE a.id = d.id
  AND (a."redirectTargetSlug" IS DISTINCT FROM d.target
    OR a."redirectTargetFragment" IS DISTINCT FROM d.fragment);

COMMIT;
