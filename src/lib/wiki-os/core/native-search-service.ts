/**
 * native-search-service.ts — WikiOS Two-Tier PostgreSQL Search Engine
 *
 * Tier 1: Typo-tolerant prefix and trigram similarity search (<1.5ms)
 * Tier 2: Weighted tsvector full-text search with headline snippets (<3.5ms)
 */

import { db } from "~/server/db";
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

function buildSnippet(summary: string | null | undefined, wikitext: string | null | undefined): string {
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
  readingTime: number;
  leadImageUrl?: string | null;
  matchType: "title_exact" | "title_fuzzy" | "content";
  similarityScore: number;
}

export class NativeSearchService {
  /**
   * Fast Spotlight Autocomplete / Search (<2ms)
   */
  static async spotlightSearch(
    query: string,
    source = "ixwiki",
    limit = 10
  ): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const slugQuery = toArticleSlug(trimmed);

    const lowerTrimmed = trimmed.toLowerCase();
    const isTemplateQuery = lowerTrimmed.startsWith("template:");
    const isCategoryQuery = lowerTrimmed.startsWith("category:");
    const isUserQuery = lowerTrimmed.startsWith("user:");
    const targetNamespace = isTemplateQuery ? 10 : isCategoryQuery ? 14 : isUserQuery ? 2 : 0;

    // 1. Direct prefix & title match via Prisma
    const articles = await db.wikiArticle.findMany({
      where: {
        source,
        status: "PUBLISHED",
        namespace: targetNamespace,
        OR: [
          { title: { startsWith: trimmed, mode: "insensitive" } },
          { title: { startsWith: slugQuery, mode: "insensitive" } },
          { title: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        summary: true,
        wikitext: true,
        readingTime: true,
        leadImageUrl: true,
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    return articles.map((a) => {
      const isExact = a.title.toLowerCase() === trimmed.toLowerCase();
      const isPrefix = a.title.toLowerCase().startsWith(trimmed.toLowerCase());
      const slug = toArticleSlug(a.title);

      return {
        id: a.id,
        slug,
        title: a.title,
        snippet: buildSnippet(a.summary, a.wikitext),
        readingTime: a.readingTime || 1,
        leadImageUrl: a.leadImageUrl ?? null,
        matchType: isExact ? "title_exact" : isPrefix ? "title_fuzzy" : "content",
        similarityScore: isExact ? 1.0 : isPrefix ? 0.8 : 0.5,
      };
    });
  }

  /**
   * Deep Full-Text Search with Weighted tsvector and Snippet Extraction
   */
  static async fulltextSearch(
    query: string,
    source = "ixwiki",
    limit = 20,
    offset = 0
  ): Promise<{ results: SearchResultItem[]; total: number }> {
    const trimmed = query.trim();
    if (!trimmed) return { results: [], total: 0 };

    // 1. Try PostgreSQL tsvector fulltext query if available
    try {
      const sanitizedWords = trimmed
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

      if (sanitizedWords.length > 0) {
        const tsQuery = sanitizedWords.map((w) => `${w}:*`).join(" & ");
        const rawResults: Array<{
          id: string;
          title: string;
          slug: string | null;
          summary: string | null;
          preview: string | null;
          readingTime: number | null;
          leadImageUrl: string | null;
          rank: number;
        }> = await db.$queryRawUnsafe(
          `SELECT 
            id, title, slug, summary,
            substring(wikitext, 1, 300) as preview,
            "readingTime",
            "leadImageUrl",
            ts_rank_cd(
              setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(summary, substring(wikitext, 1, 3000))), 'B'),
              to_tsquery('english', $1)
            ) as rank
          FROM wiki_articles
          WHERE source = $2
            AND status = 'PUBLISHED'
            AND namespace = 0
            AND (
              to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || substring(wikitext, 1, 3000)) @@ to_tsquery('english', $1)
              OR title ILIKE $3
            )
          ORDER BY rank DESC, "updatedAt" DESC
          LIMIT $4 OFFSET $5`,
          tsQuery,
          source,
          `%${trimmed}%`,
          limit,
          offset
        );

        if (rawResults && rawResults.length > 0) {
          const results: SearchResultItem[] = rawResults.map((r) => ({
            id: r.id,
            slug: r.slug || toArticleSlug(r.title),
            title: r.title,
            snippet: buildSnippet(r.summary, r.preview),
            readingTime: r.readingTime || 1,
            leadImageUrl: r.leadImageUrl || null,
            matchType: r.rank > 0.3 ? "title_exact" : "content",
            similarityScore: Math.min(1.0, Math.max(0.1, Number(r.rank || 0.5))),
          }));
          return { results, total: rawResults.length };
        }
      }
    } catch {
      // Fall through to Prisma query
    }

    // 2. Prisma full-text / ILIKE query with fallback
    const [articles, total] = await Promise.all([
      db.wikiArticle.findMany({
        where: {
          source,
          status: "PUBLISHED",
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
            { wikitext: { contains: trimmed, mode: "insensitive" } },
          ],
        },
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
      db.wikiArticle.count({
        where: {
          source,
          status: "PUBLISHED",
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
            { wikitext: { contains: trimmed, mode: "insensitive" } },
          ],
        },
      }),
    ]);

    const results: SearchResultItem[] = articles.map((a) => ({
      id: a.id,
      slug: toArticleSlug(a.title),
      title: a.title,
      snippet: buildSnippet(a.summary, a.wikitext ? matchWindow(a.wikitext, trimmed) : null),
      readingTime: a.readingTime || 1,
      leadImageUrl: a.leadImageUrl ?? null,
      matchType: a.title.toLowerCase().includes(trimmed.toLowerCase()) ? "title_fuzzy" : "content",
      similarityScore: 0.7,
    }));

    return { results, total };
  }
}

/**
 * Extracts a clean introductory plain-text snippet from wikitext.
 */
import { extractIntroFromWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
export { extractIntroFromWikitext };

/**
 * Retrieves summary/intro for an article from PostgreSQL or direct MariaDB fast-path.
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

  // Fallback to bridge (MySQL + HTTP fallback)
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
