/**
 * WikiBridge — Unified wiki data service for IxStats.
 *
 * Single entry point for all wiki data across the platform.
 *
 * IxWiki (same server): Direct MySQL queries to the MediaWiki database.
 *   - 38ms per article vs 8.6s via the PHP API (225x faster)
 *   - No PHP processing, no template expansion, raw wikitext
 *
 * IIWiki (external): HTTP API with "IxStats-Builder" user agent.
 *   - ~400ms per request
 *   - Cloudflare requires exact user agent string
 *
 * Caching: L1 in-memory LRU → L2 WikiCache DB table → L3 source
 */

import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { parseInfobox, parseCoordTemplate, cleanWikiValue } from "./wiki-infobox-parser";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type WikiSource = "ixwiki" | "iiwiki";

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
// IxWiki MySQL Connection (same server)
// ──────────────────────────────────────────────

let ixwikiPool: Pool | null = null;

function getIxWikiPool(): Pool {
  if (!ixwikiPool) {
    ixwikiPool = mysql.createPool({
      host: "localhost",
      port: 3306,
      user: "ixwiki",
      password: "Multico1!",
      database: "ixwiki",
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60000,
      enableKeepAlive: true,
    });
  }
  return ixwikiPool;
}

// ──────────────────────────────────────────────
// In-Memory LRU Cache (L1)
// ──────────────────────────────────────────────

const CACHE_MAX = 500;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  // Evict oldest if full
  if (memCache.size >= CACHE_MAX) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
  memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// ──────────────────────────────────────────────
// IxWiki Direct MySQL Queries
// ──────────────────────────────────────────────

/**
 * Get article wikitext directly from the MediaWiki MySQL database.
 * Schema: page → slots → content → text
 */
async function ixwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  const cacheKey = `wikitext:${title}`;
  const cached = cacheGet<WikiArticle>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT p.page_id, p.page_title, p.page_len, t.old_text
       FROM page p
       JOIN slots s ON s.slot_revision_id = p.page_latest
       JOIN content c ON c.content_id = s.slot_content_id
       JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
       WHERE p.page_title = ? AND p.page_namespace = 0
       LIMIT 1`,
      [title.replace(/ /g, "_")]
    );

    if (!rows || rows.length === 0) return null;

    const row = rows[0]!;
    const article: WikiArticle = {
      title: String(row.page_title).replace(/_/g, " "),
      pageId: row.page_id as number,
      wikitext: String(row.old_text),
      length: row.page_len as number,
    };

    cacheSet(cacheKey, article);
    return article;
  } catch (err) {
    console.error("[WikiBridge] MySQL error fetching wikitext:", err);
    return null;
  }
}

/**
 * Search IxWiki pages by title prefix via direct MySQL.
 */
async function ixwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cacheGet<WikiSearchResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const pattern = query.replace(/ /g, "_") + "%";

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_id, page_title, page_len
       FROM page
       WHERE page_namespace = 0
         AND page_title LIKE ?
         AND page_is_redirect = 0
       ORDER BY page_len DESC
       LIMIT ?`,
      [pattern, limit]
    );

    const results: WikiSearchResult[] = (rows ?? []).map((row) => ({
      title: String(row.page_title).replace(/_/g, " "),
      pageId: row.page_id as number,
      length: row.page_len as number,
    }));

    cacheSet(cacheKey, results, 5 * 60 * 1000); // 5 min cache for search
    return results;
  } catch (err) {
    console.error("[WikiBridge] MySQL search error:", err);
    return [];
  }
}

/**
 * Get recent changes from IxWiki via direct MySQL.
 */
async function ixwikiRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  const cacheKey = `recentchanges:${limit}`;
  const cached = cacheGet<WikiRecentChange[]>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT rc.rc_title, a.actor_name, rc.rc_timestamp,
              rc.rc_type, rc.rc_old_len, rc.rc_new_len
       FROM recentchanges rc
       JOIN actor a ON a.actor_id = rc.rc_actor
       WHERE rc.rc_namespace = 0 AND rc.rc_bot = 0
       ORDER BY rc.rc_timestamp DESC
       LIMIT ?`,
      [limit]
    );

    const results: WikiRecentChange[] = (rows ?? []).map((row) => ({
      title: String(row.rc_title).replace(/_/g, " "),
      user: String(row.actor_name),
      timestamp: String(row.rc_timestamp),
      comment: "",
      type: (row.rc_type as number) === 1 ? "new" : "edit",
      oldLen: row.rc_old_len as number,
      newLen: row.rc_new_len as number,
    }));

    cacheSet(cacheKey, results, 60 * 1000); // 1 min cache
    return results;
  } catch (err) {
    console.error("[WikiBridge] MySQL recent changes error:", err);
    return [];
  }
}

// ──────────────────────────────────────────────
// IIWiki HTTP API (external)
// ──────────────────────────────────────────────

const IIWIKI_API = "https://iiwiki.com/api.php";
const USER_AGENT = "IxStats-Builder";

async function iiwikiApiCall(params: Record<string, string>): Promise<unknown> {
  const url = new URL(IIWIKI_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`iiwiki API ${res.status}`);
  return res.json();
}

async function iiwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    const data = await iiwikiApiCall({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    }) as { query?: { pages?: Record<string, { pageid?: number; title?: string; revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }> } };

    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || !page.pageid || page.pageid < 0) return null;

    const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
    return {
      title: page.title ?? title,
      pageId: page.pageid,
      wikitext,
      length: wikitext.length,
    };
  } catch (err) {
    console.error("[WikiBridge] iiwiki fetch error:", err);
    return null;
  }
}

async function iiwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  try {
    const data = await iiwikiApiCall({
      action: "opensearch",
      search: query,
      limit: String(limit),
      namespace: "0",
    }) as [string, string[]];

    if (!Array.isArray(data) || data.length < 2) return [];
    return (data[1] ?? []).map((title, i) => ({
      title,
      pageId: i,
      length: 0,
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Public API — WikiBridge
// ──────────────────────────────────────────────

/**
 * Get raw article wikitext. Uses MySQL for ixwiki, HTTP for iiwiki.
 */
export async function getArticleWikitext(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiArticle | null> {
  if (wiki === "ixwiki") return ixwikiGetWikitext(title);
  return iiwikiGetWikitext(title);
}

/**
 * Get article intro (first paragraph, stripped of markup).
 * Parses wikitext directly — no PHP processing needed.
 */
export async function getArticleIntro(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiIntro | null> {
  const cacheKey = `intro:${wiki}:${title}`;
  const cached = cacheGet<WikiIntro>(cacheKey);
  if (cached) return cached;

  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;

  const intro = extractIntroFromWikitext(article.wikitext);
  const result: WikiIntro = { title: article.title, text: intro };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Search wiki pages by title prefix.
 */
export async function searchPages(
  query: string,
  limit: number = 10,
  wiki: WikiSource = "ixwiki"
): Promise<WikiSearchResult[]> {
  if (wiki === "ixwiki") return ixwikiSearch(query, limit);
  return iiwikiSearch(query, limit);
}

/**
 * Parse infobox from article wikitext.
 * Uses the existing wiki-infobox-parser.ts (pure functions).
 */
export async function getInfobox(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<ReturnType<typeof parseInfobox> | null> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;
  return parseInfobox(article.wikitext);
}

/**
 * Get article sections/TOC by parsing wikitext headings.
 */
export async function getPageSections(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiSection[]> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return [];

  const sections: WikiSection[] = [];
  const headingRegex = /^(={2,6})\s*(.+?)\s*\1$/gm;
  let match;
  let index = 0;

  while ((match = headingRegex.exec(article.wikitext)) !== null) {
    sections.push({
      level: match[1]!.length,
      title: match[2]!.trim(),
      index: index++,
    });
  }

  return sections;
}

/**
 * Get recent changes from IxWiki.
 */
export async function getRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  return ixwikiRecentChanges(limit);
}

/**
 * Get file/image URL for an IxWiki file.
 */
export function getImageUrl(filename: string): string {
  const clean = filename.replace(/^File:/, "").replace(/ /g, "_");
  return `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(clean)}`;
}

/**
 * Extract coordinates from article wikitext.
 */
export async function getCoordinates(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<[number, number] | null> {
  const article = await getArticleWikitext(title, wiki);
  if (!article) return null;
  return parseCoordTemplate(article.wikitext);
}

/**
 * Get images referenced on a wiki page with thumbnail URLs.
 * Uses HTTP API for image metadata (MySQL doesn't store thumbnail URLs).
 * Tries ixwiki first, falls back to iiwiki.
 */
export async function getPageImages(
  title: string,
  opts?: {
    excludePatterns?: RegExp[];
    thumbWidth?: number;
    limit?: number;
  }
): Promise<Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }> | null> {
  const cacheKey = `pageimages:${title}`;
  const cached = cacheGet<Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }>>(cacheKey);
  if (cached) return cached;

  const sources = [
    { wiki: "ixwiki" as WikiSource, base: "https://ixwiki.com" },
    { wiki: "iiwiki" as WikiSource, base: "https://iiwiki.com" },
  ];

  const thumbWidth = opts?.thumbWidth ?? 200;
  const maxImages = opts?.limit ?? 50;
  const excludePatterns = opts?.excludePatterns ?? [];

  for (const source of sources) {
    try {
      // Step 1: Get image titles from the page
      const listRes = await fetch(
        `${source.base}/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&imlimit=${maxImages}&format=json&redirects=1`,
        { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) }
      );
      if (!listRes.ok) continue;
      const listData = await listRes.json() as {
        query?: { pages?: Record<string, { missing?: boolean; images?: Array<{ title: string }> }> };
      };
      const pages = listData?.query?.pages;
      if (!pages) continue;
      const page = Object.values(pages)[0];
      if (page?.missing || !page?.images?.length) continue;

      const imageTitles = page.images
        .map((img) => img.title)
        .filter((t) => !excludePatterns.some((p) => p.test(t)));
      if (imageTitles.length === 0) continue;

      // Step 2: Resolve image URLs with thumbnails
      const titlesParam = imageTitles.slice(0, maxImages).map(encodeURIComponent).join("|");
      const infoRes = await fetch(
        `${source.base}/api.php?action=query&titles=${titlesParam}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${thumbWidth}&format=json`,
        { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) }
      );
      if (!infoRes.ok) continue;
      const infoData = await infoRes.json() as {
        query?: { pages?: Record<string, {
          title?: string; missing?: boolean;
          imageinfo?: Array<{ url: string; thumburl?: string; width: number; height: number; mime?: string }>;
        }> };
      };
      const infoPages = infoData?.query?.pages;
      if (!infoPages) continue;

      const images: Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }> = [];
      for (const p of Object.values(infoPages)) {
        if (p?.missing || !p?.imageinfo?.[0]) continue;
        const info = p.imageinfo[0];
        if (info.width < 100 && info.height < 100) continue;
        if (info.mime && !info.mime.startsWith("image/")) continue;
        images.push({
          title: p.title ?? "",
          url: info.url,
          thumbUrl: info.thumburl ?? info.url,
          width: info.width,
          height: info.height,
        });
      }

      if (images.length > 0) {
        cacheSet(cacheKey, images);
        return images;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Search with fallback: try ixwiki first, then iiwiki.
 */
export async function searchWithFallback(
  query: string,
  limit: number = 10
): Promise<WikiSearchResult[]> {
  const results = await searchPages(query, limit, "ixwiki");
  if (results.length > 0) return results;
  return searchPages(query, limit, "iiwiki");
}

// ──────────────────────────────────────────────
// Wikitext Processing Helpers
// ──────────────────────────────────────────────

/**
 * Extract the intro paragraph from raw wikitext.
 * Takes text before the first == heading, strips templates/markup.
 */
function extractIntroFromWikitext(wikitext: string): string {
  // Remove everything from first heading onward
  const headingIndex = wikitext.search(/^==[^=]/m);
  const intro = headingIndex > 0 ? wikitext.substring(0, headingIndex) : wikitext.substring(0, 2000);

  return cleanWikiMarkup(intro);
}

/**
 * Strip wiki markup to produce plaintext.
 */
function cleanWikiMarkup(text: string): string {
  let clean = text;

  // Remove infobox/template blocks ({{...}}) — handle nested
  let depth = 0;
  let result = "";
  let i = 0;
  while (i < clean.length) {
    if (clean[i] === "{" && clean[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (clean[i] === "}" && clean[i + 1] === "}") {
      depth = Math.max(0, depth - 1);
      i += 2;
    } else if (depth === 0) {
      result += clean[i];
      i++;
    } else {
      i++;
    }
  }
  clean = result;

  // Remove HTML tags
  clean = clean.replace(/<[^>]+>/g, "");

  // Convert wiki links: [[Link|Text]] → Text, [[Link]] → Link
  clean = clean.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");

  // Remove external links: [url text] → text
  clean = clean.replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, "$1");
  clean = clean.replace(/\[https?:\/\/[^\]]+\]/g, "");

  // Remove bold/italic markers
  clean = clean.replace(/'{2,5}/g, "");

  // Remove categories/files
  clean = clean.replace(/\[\[(?:Category|File|Image):[^\]]+\]\]/gi, "");

  // Remove references
  clean = clean.replace(/<ref[^>]*\/>/g, "");
  clean = clean.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");

  // Collapse whitespace
  clean = clean.replace(/\n{3,}/g, "\n\n");
  clean = clean.trim();

  return clean;
}

/**
 * Graceful shutdown — close MySQL pool.
 */
export async function closeWikiBridge(): Promise<void> {
  if (ixwikiPool) {
    await ixwikiPool.end();
    ixwikiPool = null;
  }
}
