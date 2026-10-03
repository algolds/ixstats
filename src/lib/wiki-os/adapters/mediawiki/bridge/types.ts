import { Cache } from "~/lib/cache";
export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

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

/** Logs an error the bridge swallows (development only). */
export function warnDev(err: unknown): void {
  if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
}

const wikiBridgeCache = new Cache<unknown>({
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxSize: 500,
});

export function cacheGet<T>(key: string): T | null {
  return (wikiBridgeCache.get(key) as T | undefined) ?? null;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void {
  wikiBridgeCache.set(key, data, ttlMs);
}
