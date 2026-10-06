/**
 * pg-search.ts — ixwiki title, full-text and template search.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { NativeSearchService } from "~/lib/wiki-os/core";
import type { WikiSearchResult } from "./types";

export async function ixwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  try {
    const results = await NativeSearchService.spotlightSearch(query, "ixwiki", limit);
    return results.map((r, idx) => ({
      title: r.title,
      pageId: idx + 1,
      length: r.snippet?.length || 0,
    }));
  } catch {
    return [];
  }
}

interface FullTextSearchResult {
  results: Array<{
    title: string;
    namespace: number;
    snippet: string;
    size: number;
    wordCount: number;
    timestamp: string;
    thumbnail?: string | null;
  }>;
  totalHits: number;
}

export async function ixwikiFullTextSearch(
  query: string,
  limit: number = 20,
  _offset: number = 0,
  _namespace?: number
): Promise<FullTextSearchResult> {
  try {
    const res: any = await NativeSearchService.fulltextSearch(query, "ixwiki", limit);
    return {
      results: (res.results || []).map((r: any) => ({
        title: r.title,
        namespace: r.namespace ?? 0,
        snippet: r.snippet || "",
        size: r.size || 0,
        wordCount: r.wordCount || 0,
        timestamp: r.timestamp || new Date().toISOString(),
        thumbnail: r.thumbnail ?? null,
      })),
      totalHits: res.total || res.totalHits || (res.results || []).length,
    };
  } catch {
    return { results: [], totalHits: 0 };
  }
}

export async function ixwikiSearchTemplates(query: string, limit: number = 10): Promise<string[]> {
  try {
    const templates = await (db as any).wikiTemplate.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
      },
      take: limit,
      select: { name: true },
    });
    if (templates.length > 0) return templates.map((t: any) => t.name);

    const articles = await (db as any).wikiArticle.findMany({
      where: {
        source: "ixwiki",
        status: "PUBLISHED",
        namespace: 10,
        title: { contains: query, mode: "insensitive" },
      },
      take: limit,
      select: { title: true },
    });
    return articles.map((a: any) => a.title.replace(/^Template:/i, ""));
  } catch {
    return [];
  }
}
