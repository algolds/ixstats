import { Cache } from "~/lib/cache";
import { parseMWTimestamp } from "~/lib/wiki-os/adapters/mediawiki/timestamp";

export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

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
 * Format MediaWiki timestamp (YYYYMMDDHHmmss or ISO) to standard ISO string.
 */
export function formatMWTimestamp(ts: string | number | null | undefined): string {
  if (!ts) return "";
  const iso = parseMWTimestamp(typeof ts === "number" ? String(ts) : ts);
  return iso ?? String(ts);
}
