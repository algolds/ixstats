-- WikiOS plan 413 (item 2): indexes for the native search.
--
--   * title typeahead: a trigram GIN index on lower(title) (similarity, and LIKE '%x%' on 3+ characters)
--     and a prefix btree on lower(title) (LIKE 'x%' on any length);
--   * full text: a stored, generated tsvector over title (weight A), summary (B) and the first
--     20,000 characters of the wikitext (C), with a GIN index. The search reads it with
--     websearch_to_tsquery; nothing computes a tsvector per row per query any more.
--
-- Idempotent: safe to run more than once. Apply with:  psql <database> -f <this file>
--
-- Before it is applied the app keeps working: the first search that meets the missing column or
-- extension logs one warning and answers from the old queries, and tries the new ones again after a
-- few minutes.
--
-- ADDING THE COLUMN REWRITES wiki_articles (it computes a tsvector for every row, and takes an
-- ACCESS EXCLUSIVE lock while it does): run it in a quiet moment. Creating the indexes afterwards
-- can run CONCURRENTLY if the lock matters (not inside a transaction block; psql -f runs each
-- statement on its own, so the statements below are fine as they stand).
--
-- `prisma db push` knows the column as `searchVector Unsupported("tsvector")?`. If a push ran
-- BEFORE this file, it created a plain, empty tsvector column; the first statement below drops that
-- one so the generated column can replace it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'wiki_articles'
      AND column_name = 'searchVector'
      AND is_generated <> 'ALWAYS'
  ) THEN
    ALTER TABLE wiki_articles DROP COLUMN "searchVector";
  END IF;
END
$$;

ALTER TABLE wiki_articles
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(wikitext, ''), 20000)), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS wiki_articles_search_vector_idx
  ON wiki_articles USING gin ("searchVector");

CREATE INDEX IF NOT EXISTS wiki_articles_title_lower_trgm_idx
  ON wiki_articles USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS wiki_articles_title_lower_prefix_idx
  ON wiki_articles (lower(title) text_pattern_ops);
