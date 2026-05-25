// src/lib/wiki-recentchanges-service.ts
// Fetches recent changes from the MediaWiki API for the unified activity hub.

import { MEDIAWIKI_CONFIG } from "~/lib/mediawiki-config";

export interface WikiRecentChange {
  type: string; // "edit" | "new" | "log"
  ns: number;
  title: string;
  user: string;
  timestamp: string; // ISO 8601
  comment: string;
  minor: boolean;
  newlen: number;
  oldlen: number;
}

export interface WikiTrendingPage {
  title: string;
  url: string;
  editCount: number;
  uniqueEditors: number;
  totalBytesChanged: number;
  latestEdit: Date;
  isNew: boolean;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cached: { data: WikiRecentChange[]; fetchedAt: number } | null = null;

/**
 * Fetch recent major edits from IxWiki (filters out minor edits and bot edits).
 * Returns stale cache on API failure for graceful degradation.
 */
export async function getWikiRecentChanges(limit = 25): Promise<WikiRecentChange[]> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data.slice(0, limit);
  }

  const baseUrl = MEDIAWIKI_CONFIG.baseUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "recentchanges");
  url.searchParams.set("rcprop", "user|title|timestamp|comment|sizes|flags");
  url.searchParams.set("rcshow", "!bot");
  url.searchParams.set("rcnamespace", "0"); // Main namespace only
  url.searchParams.set("rclimit", "50");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEDIAWIKI_CONFIG.timeout);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": MEDIAWIKI_CONFIG.userAgent,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[WikiRC] HTTP ${response.status}`);
      return cached?.data.slice(0, limit) ?? [];
    }

    const data = await response.json();
    const raw: WikiRecentChange[] = data?.query?.recentchanges ?? [];

    // Keep all non-minor edits + minor edits with >= 1000 bytes changed
    const changes = raw.filter((rc) => !rc.minor || Math.abs(rc.newlen - rc.oldlen) >= 1000);

    cached = { data: changes, fetchedAt: Date.now() };
    return changes.slice(0, limit);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[WikiRC] Failed to fetch recent changes:", error);
    return cached?.data.slice(0, limit) ?? [];
  }
}

/**
 * Aggregate recent changes by page to find trending wiki pages.
 * Pages with more edits, more editors, and larger changes rank higher.
 */
export async function getWikiTrendingPages(limit = 10): Promise<WikiTrendingPage[]> {
  const changes = await getWikiRecentChanges(25);
  if (changes.length === 0) return [];

  // Group by page title
  const pageMap = new Map<string, { edits: WikiRecentChange[]; editors: Set<string> }>();
  for (const rc of changes) {
    const entry = pageMap.get(rc.title) ?? { edits: [], editors: new Set() };
    entry.edits.push(rc);
    entry.editors.add(rc.user);
    pageMap.set(rc.title, entry);
  }

  const pages: WikiTrendingPage[] = [];
  for (const [title, { edits, editors }] of pageMap) {
    const totalBytes = edits.reduce((sum, e) => sum + Math.abs(e.newlen - e.oldlen), 0);
    const latestEdit = new Date(Math.max(...edits.map((e) => new Date(e.timestamp).getTime())));
    const isNew = edits.some((e) => e.type === "new");

    pages.push({
      title,
      url: `https://ixwiki.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      editCount: edits.length,
      uniqueEditors: editors.size,
      totalBytesChanged: totalBytes,
      latestEdit,
      isNew,
    });
  }

  // Sort by edit count * editors (collaborative activity ranks higher)
  pages.sort((a, b) => b.editCount * b.uniqueEditors - a.editCount * a.uniqueEditors);
  return pages.slice(0, limit);
}
