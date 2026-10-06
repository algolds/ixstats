/**
 * native-search-service.ts — WikiOS PostgreSQL search
 *
 * Typeahead (`spotlightSearch`): title prefix, then title contains, then trigram similarity, in one
 * indexed query that reads no wikitext (<2 ms).
 * Full text (`fulltextSearch`): the stored `searchVector` (title A, summary B, the start of the
 * wikitext C) read with websearch_to_tsquery, ranked with ts_rank_cd, snippets from ts_headline. A
 * query typed plainly (no quotes, `or` or `-word`) also matches its last word as a prefix, so a
 * reader who has typed "Pela" finds Pelaxia.
 *
 * Both need prisma/manual-migrations/2026-09-30-wikios-search-indexes.sql. Until the operator has
 * applied it a search meets "column/function does not exist", logs one warning and answers from the
 * old slow queries; it tries the indexed ones again every few minutes.
 */

import { db } from "~/server/db";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import { resolveStoredImageUrl } from "../transformers/image-url";
import { cleanWikiMarkup } from "../transformers/wikitext-parser";
import { toArticleSlug } from "./domain-types";

const SNIPPET_FALLBACK = "WikiOS article entry.";

/**
 * Search snippets are PLAIN TEXT: clients render them as text, never as HTML. Markup, templates and
 * tags are stripped here, and `<`/`>` are dropped so not even a truncated tag survives.
 */
function toSnippetText(raw: string | null | undefined, maxLength: number): string {
  return cleanWikiMarkup(raw, maxLength).replace(/[<>]/g, "");
}

function buildSnippet(
  summary: string | null | undefined,
  wikitext: string | null | undefined
): string {
  return toSnippetText(summary, 300) || toSnippetText(wikitext, 160) || SNIPPET_FALLBACK;
}

/** The wikitext around the first occurrence of `query`, or its opening when the query is not in it. */
function matchWindow(wikitext: string, query: string): string {
  const idx = wikitext.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return wikitext.substring(0, 160);
  const start = Math.max(0, idx - 40);
  const end = Math.min(wikitext.length, idx + 120);
  return wikitext.substring(start, end);
}

/** ts_headline brackets what matched with these; they are turned into ranges before anything leaves here. */
const HIT_START = "«";
const HIT_END = "»";
/** Characters of a headline kept for a result. */
const HEADLINE_LENGTH = 300;

/** A character range `[start, end)` of a snippet that matched the query. */
export type SnippetRange = [start: number, end: number];

/**
 * A snippet and the ranges of it that matched. `raw` is a ts_headline result with its hits between
 * « and »: the text is cleaned of wikitext first (the markers survive that), then the markers are
 * taken out and their positions kept, so a range always lies in the text the client shows.
 * A marker the cleaning separated from its partner (a link target it dropped) is ignored.
 */
export function toMarkedSnippet(
  raw: string | null | undefined,
  maxLength = HEADLINE_LENGTH
): { text: string; ranges: SnippetRange[] } {
  const cleaned = toSnippetText(raw, maxLength);
  let text = "";
  let open: number | null = null;
  const ranges: SnippetRange[] = [];
  for (const char of cleaned) {
    if (char === HIT_START) {
      open ??= text.length;
    } else if (char === HIT_END) {
      if (open !== null && text.length > open) ranges.push([open, text.length]);
      open = null;
    } else {
      text += char;
    }
  }
  if (open !== null && text.length > open) ranges.push([open, text.length]);
  return { text, ranges };
}

export interface SearchOptions {
  query: string;
  source?: string;
  limit?: number;
  offset?: number;
  mode?: "spotlight" | "fulltext";
}

export interface SearchResultItem {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  /** The parts of `snippet` that matched the query (full-text search only), as character ranges. */
  snippetRanges: SnippetRange[];
  readingTime: number;
  leadImageUrl?: string | null;
  matchType: "title_exact" | "title_fuzzy" | "content";
  similarityScore: number;
}

// ─── Missing-index fallback ───────────────────────────────────────

/** How long a search stays on the old queries after the indexes turned out to be missing. */
const INDEX_RETRY_MS = 5 * 60 * 1000;
let indexMissingSince: number | null = null;

/** What the migration creates: the column, the pg_trgm extension and its functions, the indexes. */
const MIGRATION_OBJECTS =
  /searchVector|pg_trgm|gin_trgm_ops|similarity|operator does not exist:.*%|wiki_articles_(?:search_vector|title_lower_trgm|title_lower_prefix)_idx/i;

/**
 * Postgres says the column, function, operator or extension of the new queries is not there: one of
 * the migration's own objects. A missing table, or anything else, is a real fault and is not hidden.
 */
function isMissingIndexError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/does not exist/i.test(error.message) || /Code: `42(703|883|704)`/.test(error.message)) &&
    MIGRATION_OBJECTS.test(error.message)
  );
}

/**
 * Runs `indexed`; when the migration has not been applied yet, logs it once and answers with
 * `legacy` until the next retry. Any other error is the caller's.
 */
async function withSearchIndex<T>(indexed: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  if (indexMissingSince === null || Date.now() - indexMissingSince >= INDEX_RETRY_MS) {
    try {
      const result = await indexed();
      indexMissingSince = null;
      return result;
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      if (indexMissingSince === null) {
        console.warn(
          "[WikiOS:search] search indexes are missing; using the slow queries. Apply " +
            "prisma/manual-migrations/2026-09-30-wikios-search-indexes.sql.",
          error
        );
      }
      indexMissingSince = Date.now();
    }
  }
  return legacy();
}

// ─── Typeahead ────────────────────────────────────────────────────

interface TypeaheadRow {
  id: string;
  title: string;
  summary: string | null;
  readingTime: number | null;
  leadImageUrl: string | null;
  /** 0 exact title, 1 title prefix, 2 title contains, 3 similar title */
  tier: number;
  similarity: number;
}

/**
 * Lines up, in one query: exact title, titles that start with the text, titles that contain it
 * (3+ characters: the trigram index serves LIKE '%x%'), then similar titles (pg_trgm's `%`, its
 * similarity threshold being 0.3). $3 is the text, $4 its LIKE prefix pattern, $5 its LIKE
 * contains pattern or NULL, $6 the limit.
 */
const TYPEAHEAD_SQL = `
  SELECT id, title, summary, "readingTime", "leadImageUrl",
    CASE
      WHEN lower(title) = lower($3::text) THEN 0
      WHEN lower(title) LIKE lower($4::text) THEN 1
      WHEN $5::text IS NOT NULL AND lower(title) LIKE lower($5::text) THEN 2
      ELSE 3
    END AS tier,
    similarity(lower(title), lower($3::text)) AS similarity
  FROM wiki_articles
  WHERE source = $1
    AND status = 'PUBLISHED'
    AND namespace = $2::int
    AND (
      lower(title) LIKE lower($4::text)
      OR lower(title) % lower($3::text)
      OR ($5::text IS NOT NULL AND lower(title) LIKE lower($5::text))
    )
  ORDER BY tier, similarity DESC, length(title), title
  LIMIT $6::int`;

/** Postgres text cannot hold a NUL character: a query with one is a 500 from the driver, so it is dropped. */
const withoutNul = (query: string): string => query.replaceAll("\u0000", "");

/** The query as text to match titles with: spaces for underscores, one space between words. */
const normalizeQuery = (query: string): string =>
  withoutNul(query).replace(/_/g, " ").replace(/\s+/g, " ").trim();

/** `value` as the literal part of a LIKE pattern. */
const likeLiteral = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

/** What a typeahead query for `trimmed` looks in: Template:, Category: and User: pages have their own prefix. */
function typeaheadNamespace(trimmed: string): number {
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("template:")) return 10;
  if (lower.startsWith("category:")) return 14;
  if (lower.startsWith("user:")) return 2;
  return 0;
}

const TYPEAHEAD_MATCH: Record<number, { matchType: SearchResultItem["matchType"]; score: number }> =
  {
    0: { matchType: "title_exact", score: 1.0 },
    1: { matchType: "title_fuzzy", score: 0.8 },
    2: { matchType: "title_fuzzy", score: 0.5 },
  };

function toTypeaheadItem(row: TypeaheadRow): SearchResultItem {
  const match = TYPEAHEAD_MATCH[Number(row.tier)] ?? {
    matchType: "title_fuzzy" as const,
    score: Number(row.similarity),
  };
  return {
    id: row.id,
    slug: toArticleSlug(row.title),
    title: row.title,
    snippet: buildSnippet(row.summary, null),
    snippetRanges: [],
    readingTime: row.readingTime || 1,
    leadImageUrl: resolveStoredImageUrl(row.leadImageUrl),
    matchType: match.matchType,
    similarityScore: match.score,
  };
}

/** The old typeahead: Prisma `contains` over titles, newest first. Reads no wikitext either. */
async function legacyTypeahead(
  text: string,
  source: string,
  namespace: number,
  limit: number
): Promise<SearchResultItem[]> {
  const articles = await db.wikiArticle.findMany({
    where: {
      source,
      status: "PUBLISHED",
      namespace,
      OR: [
        { title: { startsWith: text, mode: "insensitive" } },
        { title: { startsWith: toArticleSlug(text), mode: "insensitive" } },
        { title: { contains: text, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, summary: true, readingTime: true, leadImageUrl: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  return articles.map((a) => {
    const lowerTitle = a.title.toLowerCase();
    const lowerText = text.toLowerCase();
    const isExact = lowerTitle === lowerText;
    const isPrefix = lowerTitle.startsWith(lowerText);
    return toTypeaheadItem({
      ...a,
      tier: isExact ? 0 : isPrefix ? 1 : 2,
      similarity: 0,
    });
  });
}

// ─── Full text ────────────────────────────────────────────────────

interface FulltextRow {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  readingTime: number | null;
  leadImageUrl: string | null;
  rank: number;
  headline: string | null;
}

/**
 * The query: what the reader typed, read by websearch_to_tsquery; when it was typed plainly, its last
 * word as a prefix too (`prefixParam` holds that word, bare letters and digits, or NULL).
 */
const tsquery = (prefixParam: number): string => `(
    CASE WHEN $${prefixParam}::text IS NULL
      THEN websearch_to_tsquery('english', $1::text)
      ELSE websearch_to_tsquery('english', $1::text) && to_tsquery('english', $${prefixParam}::text || ':*')
    END)`;

/**
 * Lines that are template or table structure, not prose: `| garrison = 5000` parameters, `{{Infobox`
 * openers, `}}` closers, `|-` and `!` table rows. Postgres's regex engine is automaton-based: linear
 * in the text, and it runs only for the rows of the returned page.
 */
const STRUCTURE_LINE = String.raw`^[ \t]*[|!{}][^\n]*(\n|$)`;

/**
 * One page of hits, ranked, then the headline of just those rows (ts_headline is the expensive
 * part). The headline comes from the summary when the summary has the words, else from the first
 * 5,000 characters of the prose of the first 20,000 (the part the vector covers) of the wikitext,
 * with its template-parameter and table lines taken out; « » already in the text are removed so
 * every marker is ts_headline's.
 * $1 the query text, $2 source, $3 namespace, $4 limit, $5 offset, $6 the prefix word or NULL.
 */
const FULLTEXT_SQL = `
  WITH q AS (SELECT ${tsquery(6)} AS query),
  hits AS (
    SELECT a.id, a."updatedAt", ts_rank_cd(a."searchVector", q.query, 32) AS rank
    FROM wiki_articles a CROSS JOIN q
    WHERE a.source = $2
      AND a.status = 'PUBLISHED'
      AND a.namespace = $3::int
      AND a."searchVector" @@ q.query
    ORDER BY rank DESC, a."updatedAt" DESC
    LIMIT $4::int OFFSET $5::int
  )
  SELECT a.id, a.title, a.slug, a.summary, a."readingTime", a."leadImageUrl", h.rank,
    ts_headline(
      'english',
      translate(
        CASE
          WHEN to_tsvector('english', coalesce(a.summary, '')) @@ q.query THEN a.summary
          ELSE left(regexp_replace(left(a.wikitext, 20000), '${STRUCTURE_LINE}', '', 'gn'), 5000)
        END,
        '«»', ''
      ),
      q.query,
      'StartSel=«, StopSel=», MaxWords=35, MinWords=15, MaxFragments=1'
    ) AS headline
  FROM hits h
  JOIN wiki_articles a ON a.id = h.id
  CROSS JOIN q
  ORDER BY h.rank DESC, h."updatedAt" DESC`;

/** How many articles match, for the result count. $1 the query text, $2 source, $3 namespace, $4 the prefix word or NULL. */
const FULLTEXT_COUNT_SQL = `
  SELECT count(*)::int AS total
  FROM wiki_articles a
  WHERE a.source = $2
    AND a.status = 'PUBLISHED'
    AND a.namespace = $3::int
    AND a."searchVector" @@ ${tsquery(4)}`;

/** Websearch syntax typed on purpose: a quoted phrase, `or`, `-word`. Such a query is read as it is. */
const WEBSEARCH_SYNTAX = /"|(?:^|\s)-\S|\bor\b/i;

/**
 * Splits a query for Postgres: `text` for websearch_to_tsquery and, for a plainly typed one, `prefix`,
 * its last word (letters and digits only, so it is safe inside to_tsquery), which `text` then lacks.
 */
function toSearchTerms(query: string): { text: string; prefix: string | null } {
  if (WEBSEARCH_SYNTAX.test(query)) return { text: query, prefix: null };
  const last = query.match(/[\p{L}\p{N}]+/gu)?.at(-1);
  if (!last) return { text: query, prefix: null };
  return { text: query.slice(0, query.lastIndexOf(last)), prefix: last };
}

function toFulltextItem(row: FulltextRow): SearchResultItem {
  const { text, ranges } = toMarkedSnippet(row.headline);
  const rank = Number(row.rank || 0);
  return {
    id: row.id,
    slug: row.slug || toArticleSlug(row.title),
    title: row.title,
    snippet: text || buildSnippet(row.summary, null),
    snippetRanges: text ? ranges : [],
    readingTime: row.readingTime || 1,
    leadImageUrl: resolveStoredImageUrl(row.leadImageUrl),
    matchType: rank > 0.3 ? "title_exact" : "content",
    similarityScore: Math.min(1.0, Math.max(0.1, rank || 0.5)),
  };
}

async function indexedFulltext(
  query: string,
  source: string,
  limit: number,
  offset: number,
  namespace: number
): Promise<{ results: SearchResultItem[]; total: number }> {
  const { text, prefix } = toSearchTerms(query);
  const [rows, counts] = await Promise.all([
    db.$queryRawUnsafe<FulltextRow[]>(FULLTEXT_SQL, text, source, namespace, limit, offset, prefix),
    db.$queryRawUnsafe<Array<{ total: number }>>(
      FULLTEXT_COUNT_SQL,
      text,
      source,
      namespace,
      prefix
    ),
  ]);
  return { results: rows.map(toFulltextItem), total: Number(counts[0]?.total ?? 0) };
}

/** The old full-text search: `contains` over titles and every wikitext. Slow; the fallback only. */
async function legacyFulltext(
  query: string,
  source: string,
  limit: number,
  offset: number,
  namespace: number
): Promise<{ results: SearchResultItem[]; total: number }> {
  const where = {
    source,
    status: "PUBLISHED",
    namespace,
    OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { wikitext: { contains: query, mode: "insensitive" as const } },
    ],
  };
  const [articles, total] = await Promise.all([
    db.wikiArticle.findMany({
      where,
      select: {
        id: true,
        title: true,
        wikitext: true,
        summary: true,
        readingTime: true,
        leadImageUrl: true,
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: "desc" },
    }),
    db.wikiArticle.count({ where }),
  ]);

  const results: SearchResultItem[] = articles.map((a) => ({
    id: a.id,
    slug: toArticleSlug(a.title),
    title: a.title,
    snippet: buildSnippet(a.summary, a.wikitext ? matchWindow(a.wikitext, query) : null),
    snippetRanges: [],
    readingTime: a.readingTime || 1,
    leadImageUrl: resolveStoredImageUrl(a.leadImageUrl),
    matchType: a.title.toLowerCase().includes(query.toLowerCase()) ? "title_fuzzy" : "content",
    similarityScore: 0.7,
  }));
  return { results, total };
}

export class NativeSearchService {
  /**
   * Title typeahead: prefix, contains and trigram similarity on the title, at most `limit` rows
   * of id, title, summary and lead image (never the wikitext).
   */
  static async spotlightSearch(
    query: string,
    source = "ixwiki",
    limit = 10
  ): Promise<SearchResultItem[]> {
    const text = normalizeQuery(query);
    if (!text) return [];
    const namespace = typeaheadNamespace(text);

    return withSearchIndex(
      async () =>
        (
          await db.$queryRawUnsafe<TypeaheadRow[]>(
            TYPEAHEAD_SQL,
            source,
            namespace,
            text,
            `${likeLiteral(text)}%`,
            text.length >= 3 ? `%${likeLiteral(text)}%` : null,
            limit
          )
        ).map(toTypeaheadItem),
      () => legacyTypeahead(text, source, namespace, limit)
    );
  }

  /**
   * Full-text search over the stored search vector: websearch syntax (quotes, `or`, `-word`), the
   * last word of a plainly typed query matching as a prefix, ranked, with the matching part of the
   * text as the snippet and the hits as character ranges. `total` counts every match, not the page.
   */
  static async fulltextSearch(
    query: string,
    source = "ixwiki",
    limit = 20,
    offset = 0,
    namespace = 0
  ): Promise<{ results: SearchResultItem[]; total: number }> {
    const trimmed = withoutNul(query).trim();
    if (!trimmed) return { results: [], total: 0 };
    // Before the WikiOS v1 cutover the search-index migration may not have run, and `db push` alone leaves
    // `searchVector` an empty plain column that matches nothing (no error to fall back on): the old query answers.
    if (!isWikiosV1Enabled()) return legacyFulltext(trimmed, source, limit, offset, namespace);

    return withSearchIndex(
      () => indexedFulltext(trimmed, source, limit, offset, namespace),
      () => legacyFulltext(trimmed, source, limit, offset, namespace)
    );
  }
}

/**
 * Extracts a clean introductory plain-text snippet from wikitext.
 */
import { extractIntroFromWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
export { extractIntroFromWikitext };

/**
 * Retrieves summary/intro for an article from PostgreSQL (a sister wiki's page falls back to its own wiki).
 */
export async function getArticleSummaryFromShadow(
  title: string,
  source = "ixwiki"
): Promise<{ title: string; intro: string; leadImageUrl?: string | null }> {
  // `title` arrives already URL-decoded (a "%" in it is part of the title): never decode again.
  const cleanTitle = title.replace(/_/g, " ").trim();
  try {
    const slug = toArticleSlug(cleanTitle);
    const article = await db.wikiArticle.findFirst({
      where: {
        source,
        status: "PUBLISHED",
        OR: [
          { slug },
          { title: { equals: cleanTitle, mode: "insensitive" } },
          { title: { equals: slug, mode: "insensitive" } },
          { title: { equals: cleanTitle.replace(/_/g, " "), mode: "insensitive" } },
        ],
      },
      select: {
        title: true,
        summary: true,
        wikitext: true,
      },
    });

    if (article?.summary || article?.wikitext) {
      const intro = article.summary || extractIntroFromWikitext(article.wikitext);
      return {
        title: article.title || cleanTitle,
        intro,
        leadImageUrl: null,
      };
    }
  } catch {
    // Postgres table column not present yet or read-only shadow miss — fall through
  }

  // Fallback to the bridge (PostgreSQL for IxWiki, HTTP for a sister wiki)
  try {
    const { getArticleWikitext } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
    const res = await getArticleWikitext(cleanTitle, source as any);
    if (res?.wikitext) {
      return {
        title: res.title || cleanTitle,
        intro: extractIntroFromWikitext(res.wikitext),
        leadImageUrl: null,
      };
    }
  } catch (err) {
    console.error("[SearchService] Bridge intro fallback error:", err);
  }

  return {
    title: cleanTitle,
    intro: "",
    leadImageUrl: null,
  };
}

/**
 * Fast shadow search helper for backward compatibility.
 */
export async function searchShadowArticles(
  query: string,
  limit = 10,
  source = "ixwiki"
): Promise<Array<{ title: string; snippet: string }>> {
  const results = await NativeSearchService.spotlightSearch(query, source, limit);
  return results.map((r) => ({
    title: r.title,
    snippet: r.snippet,
  }));
}

/**
 * Top-level wiki search function.
 */
export async function searchWiki(
  query: string,
  source: string = "ixwiki",
  categoryFilter?: string | number,
  limit: number = 10
): Promise<Array<{ title: string; snippet: string }>> {
  const effectiveLimit = typeof categoryFilter === "number" ? categoryFilter : limit;
  return searchShadowArticles(query, effectiveLimit, source);
}
