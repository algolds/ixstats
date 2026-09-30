-- WikiOS plan 403: one MediaWiki-canonical identity per title.
--
-- Hand-applied by the operator (never by db:push / db:migrate); idempotent, safe to re-run.
-- Back up wiki_articles first:  pg_dump -t wiki_articles ixstats > wiki_articles.sql
-- Preview what it will touch:   bun scripts/audit/wikios-title-duplicates.ts
--
-- It brings existing wiki_articles rows in line with canonicalizeTitle()
-- (src/lib/wiki-os/core/title.ts), for rows where that is unambiguous:
--   1. namespace / "namespacePrefix" follow the title's namespace prefix (known prefixes only).
--   2. Main-namespace titles: underscores become spaces, whitespace is collapsed, the first
--      letter is upper-cased. A row is renamed ONLY when no row with the target title exists and
--      no other row is about to take the same target; everything else is a collision.
--   3. slug = lower(replace(title, ' ', '_')) for every row that differs.
-- Collisions (and any row this file leaves non-canonical) are listed by the SELECT at the end:
-- merge those by hand (keep the row you want, move its revisions, delete the other).
--
-- Table wiki_articles is @@map'd from model WikiArticle; its columns are not mapped, so
-- "namespacePrefix" is camelCase.

BEGIN;

-- 1. Namespace and prefix from the title prefix. `match_name` is the lower-case spelling MediaWiki
--    accepts (aliases included: Image, Project); `canonical` is what "namespacePrefix" stores.
UPDATE wiki_articles AS a
SET    namespace = k.id,
       "namespacePrefix" = k.canonical
FROM   (VALUES
         ('media', -2, 'Media'),
         ('special', -1, 'Special'),
         ('talk', 1, 'Talk'),
         ('user', 2, 'User'),
         ('user talk', 3, 'User talk'),
         ('project', 4, 'IxWiki'),
         ('ixwiki', 4, 'IxWiki'),
         ('project talk', 5, 'IxWiki talk'),
         ('ixwiki talk', 5, 'IxWiki talk'),
         ('file', 6, 'File'),
         ('image', 6, 'File'),
         ('file talk', 7, 'File talk'),
         ('image talk', 7, 'File talk'),
         ('mediawiki', 8, 'MediaWiki'),
         ('mediawiki talk', 9, 'MediaWiki talk'),
         ('template', 10, 'Template'),
         ('template talk', 11, 'Template talk'),
         ('help', 12, 'Help'),
         ('help talk', 13, 'Help talk'),
         ('category', 14, 'Category'),
         ('category talk', 15, 'Category talk'),
         ('widget', 274, 'Widget'),
         ('widget talk', 275, 'Widget talk'),
         ('module', 828, 'Module'),
         ('module talk', 829, 'Module talk'),
         ('gadget', 2300, 'Gadget'),
         ('gadget talk', 2301, 'Gadget talk'),
         ('gadget definition', 2302, 'Gadget definition'),
         ('gadget definition talk', 2303, 'Gadget definition talk'),
         ('topic', 2600, 'Topic')
       ) AS k(match_name, id, canonical)
WHERE  position(':' IN a.title) > 1
  AND  lower(btrim(replace(split_part(a.title, ':', 1), '_', ' '))) = k.match_name
  AND  (a.namespace IS DISTINCT FROM k.id OR a."namespacePrefix" IS DISTINCT FROM k.canonical);

-- 2. Main-namespace titles to canonical form, only where that cannot collide.
WITH normalized AS (
  SELECT s.id,
         s.source,
         s.title,
         CASE WHEN length(upper(left(s.t, 1))) = 1 THEN upper(left(s.t, 1)) ELSE left(s.t, 1) END
           || substr(s.t, 2) AS new_title
  FROM (
    SELECT id,
           source,
           title,
           btrim(regexp_replace(replace(title, '_', ' '), '\s+', ' ', 'g')) AS t
    FROM   wiki_articles
    WHERE  namespace = 0
  ) AS s
  WHERE  s.t <> ''
),
changing AS (
  SELECT id,
         source,
         new_title,
         count(*) OVER (PARTITION BY source, new_title) AS rows_with_target
  FROM   normalized
  WHERE  new_title <> title
)
UPDATE wiki_articles AS a
SET    title = c.new_title
FROM   changing AS c
WHERE  a.id = c.id
  AND  c.rows_with_target = 1
  AND  NOT EXISTS (
         SELECT 1 FROM wiki_articles AS other
         WHERE  other.source = c.source AND other.title = c.new_title
       );

-- 3. Slug follows the title (toArticleSlug: lower-case, spaces as underscores).
UPDATE wiki_articles
SET    slug = lower(replace(title, ' ', '_'))
WHERE  slug IS DISTINCT FROM lower(replace(title, ' ', '_'));

COMMIT;

-- Collisions for the operator: several main-namespace rows that are the same page once
-- canonicalized (e.g. "foo bar" and "Foo bar"). Nothing above touched these.
WITH normalized AS (
  SELECT s.id,
         s.source,
         s.title,
         s."updatedAt",
         CASE WHEN length(upper(left(s.t, 1))) = 1 THEN upper(left(s.t, 1)) ELSE left(s.t, 1) END
           || substr(s.t, 2) AS canonical_title
  FROM (
    SELECT id,
           source,
           title,
           "updatedAt",
           btrim(regexp_replace(replace(title, '_', ' '), '\s+', ' ', 'g')) AS t
    FROM   wiki_articles
    WHERE  namespace = 0
  ) AS s
  WHERE  s.t <> ''
)
SELECT source,
       canonical_title,
       array_agg(title ORDER BY "updatedAt" DESC) AS titles,
       array_agg(id    ORDER BY "updatedAt" DESC) AS ids
FROM   normalized
GROUP  BY source, canonical_title
HAVING count(*) > 1
ORDER  BY source, canonical_title;
