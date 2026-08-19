// src/lib/wiki-os/search-service.ts
// High-performance search and summary extraction backed by PostgreSQL WikiArticle shadow store.

import { db } from "~/server/db";
import type { WikiSource } from "~/lib/wiki-os/config";
import { getArticleWikitextShadow } from "~/lib/wiki-os/article-store";

export interface SearchResultItem {
  readonly title: string;
  readonly snippet?: string;
  readonly score?: number;
  readonly source: WikiSource;
}

/**
 * Fast search over local PostgreSQL WikiArticle shadow store.
 * Uses case-insensitive prefix and fuzzy title matching.
 */
export async function searchShadowArticles(
  query: string,
  limit = 10,
  source: WikiSource = "ixwiki"
): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim().replace(/_/g, " ");
  if (!cleanQuery) return [];

  const norm = cleanQuery.replace(/ /g, "_");

  try {
    const rows = await db.wikiArticle.findMany({
      where: {
        source,
        OR: [
          { title: { startsWith: norm, mode: "insensitive" } },
          { title: { contains: norm, mode: "insensitive" } },
          { wikitext: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      select: {
        title: true,
        wikitext: true,
      },
      take: limit * 2,
    });

    const lowerQuery = cleanQuery.toLowerCase();
    const scored = rows.map((r) => {
      const displayTitle = r.title.replace(/_/g, " ");
      const lowerTitle = displayTitle.toLowerCase();

      let score = 0.2;
      if (lowerTitle === lowerQuery) {
        score = 1.0;
      } else if (lowerTitle.startsWith(lowerQuery)) {
        score = 0.8;
      } else if (lowerTitle.includes(lowerQuery)) {
        score = 0.5;
      }

      return {
        title: displayTitle,
        snippet: extractIntroFromWikitext(r.wikitext).slice(0, 150),
        score,
        source,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (err) {
    console.warn("[SearchService] Shadow search query failed:", err);
    return [];
  }
}

/**
 * Extract the first clean prose paragraph from wikitext (no infoboxes, comments, or headers).
 */
export function extractIntroFromWikitext(wikitext: string): string {
  if (!wikitext) return "";

  // 1. Remove comments
  let clean = wikitext.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Remove infoboxes & nested templates (handles double braces)
  let prev = "";
  while (prev !== clean) {
    prev = clean;
    clean = clean.replace(/\{\{[^{}]*\}\}/g, "");
  }

  // 3. Remove tables
  clean = clean.replace(/\{\|[\s\S]*?\|\}/g, "");

  // 4. Split into paragraphs and find the first non-empty, non-header paragraph
  const lines = clean.split(/\n\s*\n/);
  for (const paragraph of lines) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("=") || trimmed.startsWith("[[Category:") || trimmed.startsWith("__")) {
      continue;
    }

    // Strip wikitext formatting: links [[Target|Text]] -> Text, [[Target]] -> Target
    let text = trimmed
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/<ref[\s\S]*?<\/ref>/gi, "")
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text.length > 20) {
      return text;
    }
  }

  return "";
}

/**
 * Get quick article summary/intro from shadow store in <3ms.
 */
export async function getArticleSummaryFromShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<{ title: string; intro: string; found: boolean }> {
  const norm = title.replace(/ /g, "_");
  const shadow = await getArticleWikitextShadow(norm, source);

  if (!shadow || !shadow.wikitext) {
    return { title, intro: "", found: false };
  }

  const intro = extractIntroFromWikitext(shadow.wikitext);
  return {
    title: title.replace(/_/g, " "),
    intro,
    found: true,
  };
}
