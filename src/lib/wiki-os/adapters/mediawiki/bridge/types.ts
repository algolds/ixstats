import { Cache } from "~/lib/cache";
import { parseMWTimestamp } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { sameTitle } from "~/lib/wiki-os/core/title";

export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

/** A wiki WikiOS does not hold: its pages are read from the wiki itself. */
export type SisterWikiSource = Exclude<WikiSource, "ixwiki">;

// ──────────────────────────────────────────────
// Bridge DTO Interfaces
// ──────────────────────────────────────────────

export interface WikiSearchResult {
  title: string;
  pageId: number;
  /** Article length in bytes */
  length: number;
}

export interface WikiArticle {
  title: string;
  pageId: number;
  wikitext: string;
  length: number;
}

export interface WikiIntro {
  title: string;
  text: string;
}

export interface WikiSection {
  level: number;
  title: string;
  index: number;
}

export interface WikiRecentChange {
  title: string;
  user: string;
  timestamp: string;
  comment: string;
  type: "edit" | "new" | "log";
  oldLen: number;
  newLen: number;
  blurb?: string | null;
  thumbnail?: string | null;
  /** A MediaWiki edit that conflicted with WikiOS's head: listed, but never the page's live text. */
  parked?: boolean;
}

export interface WikiCategoryMembers {
  category: string;
  pages: Array<{ title: string; ns: number }>;
  subcategories: string[];
  files: string[];
  hasMore: boolean;
  nextOffset?: string;
}
// ──────────────────────────────────────────────
// In-Memory LRU Cache (L1)
// ──────────────────────────────────────────────

export const wikiBridgeCache = new Cache<unknown>({
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxSize: 500,
});

export function cacheGet<T>(key: string): T | null {
  return (wikiBridgeCache.get(key) as T | undefined) ?? null;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void {
  wikiBridgeCache.set(key, data, ttlMs);
}

/**
 * Forget what the bridge cache holds for the page `title` (intro, wikitext, page images), under every
 * spelling it was asked for: those keys hold the raw or lower-cased title.
 */
export function evictBridgeCacheForTitle(title: string, wiki: WikiSource): number {
  const prefixes = [`intro:${wiki}:`, `wikitext:${wiki}:`, "pageimages:"];
  let evicted = 0;
  for (const key of wikiBridgeCache.keys()) {
    const prefix = prefixes.find((candidate) => key.startsWith(candidate));
    if (prefix && sameTitle(key.slice(prefix.length), title, wiki)) {
      wikiBridgeCache.delete(key);
      evicted++;
    }
  }
  return evicted;
}

/**
 * Format MediaWiki timestamp (YYYYMMDDHHmmss or ISO) to standard ISO string.
 */
export function formatMWTimestamp(ts: string | number | null | undefined): string {
  if (!ts) return "";
  const iso = parseMWTimestamp(typeof ts === "number" ? String(ts) : ts);
  return iso ?? String(ts);
}
