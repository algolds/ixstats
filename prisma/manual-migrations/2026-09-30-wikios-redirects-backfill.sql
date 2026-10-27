-- WikiOS plan 402: backfill wiki_articles."redirectTargetSlug" / "redirectTargetFragment".
--
-- Hand-written, NOT applied by any script. The operator runs it once:
--   psql <database> -f prisma/manual-migrations/2026-09-30-wikios-redirects-backfill.sql
--
-- Schema is unchanged (the columns exist). From this plan on the app writes both columns on every
-- save and every MediaWiki inbound sync, and the reader follows a redirect from the page's
-- wikitext (the columns are a cache), so this file only catches up rows written before. The app
-- also self-heals each row on its next save/sync, and canonicalizes the column value whenever it
-- reads it, so an approximation here is harmless.
--
-- What it stores: "redirectTargetSlug" holds the target's canonical TITLE (the column name is
-- historical), "redirectTargetFragment" the text after "#" (underscores as spaces) or NULL.
--
-- UPDATE 1 sets both columns for every IxWiki page that is a redirect, derived the way
-- src/lib/wiki-os/core/redirect.ts does it. A redirect is a page whose text, after ASCII
-- whitespace (space, tab, CR, LF), STARTS with #REDIRECT (any case), an optional ":", then a
-- [[link]] that closes with "]]" on the same line. The target is the link up to the first "|" (or
-- the first "]]"), minus a leading ":" and a "#fragment"; underscores become spaces, whitespace
-- collapses, the first character is upper-cased. Not derived here (left to the app's next
-- save/sync): a target with a percent escape (%41), or with any of [ { } < >, because the app
-- decodes or refuses those; and a namespace prefix is not canonicalized ("user:foo" stays as typed
-- apart from its first letter). Rows the page-move feature wrote (a lower-case slug in
-- "redirectTargetSlug") are rewritten to the title here, because their wikitext is a real redirect.
--
-- UPDATE 2 clears both columns on every IxWiki page whose text is NOT a redirect (same shape test
-- as above) but has a non-NULL column: a stale value from an edit that turned a redirect back into
-- an article, which would hide the article from reports that filter on "redirectTargetSlug" IS NULL.
--
-- Idempotent, in both statements. UPDATE 1 touches a row only when its stored pair differs
-- (IS DISTINCT FROM) from the pair derived from its wikitext; the derivation is a pure function of
-- the wikitext, so a second run derives the same pair and updates 0 rows. UPDATE 2 touches a row
-- only while a column is non-NULL and leaves both NULL, so a second run updates 0 rows. The two
-- never interfere: UPDATE 1 only sees redirect-shaped rows and UPDATE 2 only others.
-- Only source = 'ixwiki' rows: another wiki's titles are not canonicalized with IxWiki's namespaces.

BEGIN;

WITH parsed AS (
  SELECT
    id,
    substring(
      wikitext from
      '(?i)^[ \t\r\n]*#redirect[ \t\r\n]*(?::[ \t\r\n]*)?\[\[([^\]|\n]*)(?:\|[^\n]*)?\]\]'
    ) AS link
  FROM wiki_articles
  WHERE source = 'ixwiki'
    AND wikitext ~* '^[ \t\r\n]*#redirect'
),
usable AS (
  SELECT id, link
  FROM parsed
  WHERE link IS NOT NULL
    AND link !~ '%[0-9A-Fa-f]{2}'
    AND link !~ '[\[{}<>]'
),
cleaned AS (
  SELECT
    id,
    btrim(regexp_replace(
      replace(regexp_replace(btrim(split_part(link, '#', 1)), '^:', ''), '_', ' '),
      '\s+', ' ', 'g'
    )) AS target,
    CASE WHEN position('#' in link) > 0 THEN
      nullif(btrim(regexp_replace(
        replace(substr(link, position('#' in link) + 1), '_', ' '),
        '\s+', ' ', 'g'
      )), '')
    END AS fragment
  FROM usable
),
derived AS (
  SELECT id, upper(left(target, 1)) || substr(target, 2) AS target, fragment
  FROM cleaned
  WHERE target <> ''
)
UPDATE wiki_articles AS a
SET "redirectTargetSlug" = d.target,
    "redirectTargetFragment" = d.fragment
FROM derived AS d
WHERE a.id = d.id
  AND (a."redirectTargetSlug" IS DISTINCT FROM d.target
    OR a."redirectTargetFragment" IS DISTINCT FROM d.fragment);

UPDATE wiki_articles
SET "redirectTargetSlug" = NULL,
    "redirectTargetFragment" = NULL
WHERE source = 'ixwiki'
  AND ("redirectTargetSlug" IS NOT NULL OR "redirectTargetFragment" IS NOT NULL)
  AND wikitext !~* '^[ \t\r\n]*#redirect[ \t\r\n]*(?::[ \t\r\n]*)?\[\[[^\]|\n]*(?:\|[^\n]*)?\]\]';

COMMIT;
