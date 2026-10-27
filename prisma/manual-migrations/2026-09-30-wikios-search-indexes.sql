-- WikiOS plan 413 (item 2): indexes for the native search.
--
--   * title typeahead: a trigram GIN index on lower(title) (similarity, and LIKE '%x%' on 3+ characters)
--     and a prefix btree on lower(title) (LIKE 'x%' on any length);
--   * full text: a stored tsvector over title (weight A), summary (B) and the first 20,000 characters
--     of the wikitext (C), with a GIN index. The search reads it with websearch_to_tsquery; nothing
--     computes a tsvector per row per query any more.
--
-- Idempotent: safe to run more than once. Apply with:  psql <database> -f <this file>
--
-- Before it is applied the app keeps working: the first search that meets the missing column or
-- extension logs one warning and answers from the old queries, and tries the new ones again after a
-- few minutes.
--
-- The column is a plain tsvector that a BEFORE trigger keeps current, not a GENERATED column: Prisma
-- 6.19 reads a generation expression as a default, and since the schema knows the column as
-- `searchVector Unsupported("tsvector")?` (no default), every `prisma db push` tried to drop it and
-- Postgres refused (`is a generated column`), stopping the deploy. Prisma never reads triggers, so the
-- push now finds nothing to change. An earlier run of this file left a generated column: the first
-- block turns it into a plain one in place, keeping its values. A push that ran before this file left
-- a plain, empty column, which the backfill below fills.
--
-- THE BACKFILL REWRITES the rows that have no vector yet (a tsvector for each, under row locks): run
-- it in a quiet moment on a large table. Creating the indexes afterwards can run CONCURRENTLY if the
-- lock matters (not inside a transaction block; psql -f runs each statement on its own, so the
-- statements below are fine as they stand).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'wiki_articles'
      AND column_name = 'searchVector'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE wiki_articles ALTER COLUMN "searchVector" DROP EXPRESSION;
  END IF;
END
$$;

ALTER TABLE wiki_articles ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

CREATE OR REPLACE FUNCTION wiki_articles_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(NEW.wikitext, ''), 20000)), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_articles_search_vector ON wiki_articles;
CREATE TRIGGER wiki_articles_search_vector
  BEFORE INSERT OR UPDATE OF title, summary, wikitext ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION wiki_articles_search_vector();

UPDATE wiki_articles SET "searchVector" =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(wikitext, ''), 20000)), 'C')
  WHERE "searchVector" IS NULL;

CREATE INDEX IF NOT EXISTS wiki_articles_search_vector_idx
  ON wiki_articles USING gin ("searchVector");

CREATE INDEX IF NOT EXISTS wiki_articles_title_lower_trgm_idx
  ON wiki_articles USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS wiki_articles_title_lower_prefix_idx
  ON wiki_articles (lower(title) text_pattern_ops);
