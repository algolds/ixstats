// src/lib/wiki-os/bridge/types.ts
// Core types, MediaWiki row schemas, and L1 LRU in-memory cache.

import { Cache } from "~/lib/cache";
import { parseMWTimestamp } from "~/lib/wiki-os/mediawiki-timestamp";
import type { RowDataPacket } from "mysql2/promise";

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
}

// ──────────────────────────────────────────────
// MediaWiki Database Row Interfaces
// ──────────────────────────────────────────────

export interface MWRecentChangeRow extends RowDataPacket {
  rc_id: number;
  rc_timestamp: string | Buffer;
  rc_title: string | Buffer;
  rc_type: number;
  rc_minor?: number;
  rc_bot?: number;
  rc_old_len: number;
  rc_new_len: number;
  actor_name: string | Buffer | null;
  rc_comment: string | Buffer | null;
}

export interface MWSiteStatsRow extends RowDataPacket {
  ss_total_pages: number;
  ss_good_articles: number;
  ss_total_edits: number;
  ss_images: number;
  ss_users: number;
  ss_active_users: number;
}

export interface MWPageRow extends RowDataPacket {
  page_id: number;
  page_title: string | Buffer;
  page_len: number;
  page_namespace: number;
  page_is_redirect?: number;
  page_latest?: number;
}

export interface MWRevisionRow extends RowDataPacket {
  rev_id: number;
  rev_page: number;
  rev_parent_id: number | null;
  rev_timestamp: string | Buffer;
  rev_len: number;
  rev_minor_edit: number;
  actor_name: string | Buffer | null;
  comment_text: string | Buffer | null;
}

export interface MWUserRow extends RowDataPacket {
  user_id: number;
  user_name: string | Buffer;
  user_editcount: number;
  user_registration: string | Buffer | null;
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
  const iso = parseMWTimestamp(ts);
  return iso ?? String(ts);
}
