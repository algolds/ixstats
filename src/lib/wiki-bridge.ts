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

import { Cache } from "~/lib/cache";

import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { parseInfobox, parseCoordTemplate } from "./wiki-infobox-parser";
import { withRetrySafe } from "~/lib/with-retry";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

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
// IxWiki MySQL Connection (same server)
// ──────────────────────────────────────────────

let ixwikiPool: Pool | null = null;

export function getIxWikiPool(): Pool {
  if (!ixwikiPool) {
    ixwikiPool = mysql.createPool({
      host: process.env.IXWIKI_DB_HOST || "localhost",
      port: Number(process.env.IXWIKI_DB_PORT) || 3306,
      user: process.env.IXWIKI_DB_USER || "ixwiki",
      password: process.env.IXWIKI_DB_PASSWORD || "",
      database: process.env.IXWIKI_DB_NAME || "ixwiki",
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60000,
      enableKeepAlive: true,
    });
  }
  return ixwikiPool;
}

export function getWikiDbPool(): Pool {
  return getIxWikiPool();
}

// ──────────────────────────────────────────────
// In-Memory LRU Cache (L1)
// ──────────────────────────────────────────────

const wikiBridgeCache = new Cache({
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxSize: 500,
});

function cacheGet<T>(key: string): T | null {
  return wikiBridgeCache.get<T>(key) ?? null;
}

function cacheSet<T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void {
  wikiBridgeCache.set(key, data, ttlMs);
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
         AND CONVERT(page_title USING utf8mb4) LIKE ?
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
              rc.rc_type, rc.rc_old_len, rc.rc_new_len,
              COALESCE(c.comment_text, '') AS rc_comment
       FROM recentchanges rc
       JOIN actor a ON a.actor_id = rc.rc_actor
       LEFT JOIN comment c ON c.comment_id = rc.rc_comment_id
       WHERE rc.rc_namespace = 0 AND rc.rc_bot = 0
       ORDER BY rc.rc_timestamp DESC
       LIMIT ?`,
      [limit]
    );

    const results: WikiRecentChange[] = (rows ?? []).map((row) => ({
      title: String(row.rc_title).replace(/_/g, " "),
      user: String(row.actor_name),
      timestamp: String(row.rc_timestamp),
      comment: String(row.rc_comment || ""),
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

/**
 * Get page revision history directly from MySQL.
 * Replaces api.php?action=query&prop=revisions (~400ms → ~40ms).
 */
async function ixwikiGetHistory(
  title: string,
  limit: number = 50,
  offset?: number
): Promise<{
  revisions: Array<{
    revid: number;
    parentid: number | null;
    timestamp: string;
    user: string;
    comment: string;
    size: number;
    minor: boolean;
  }>;
  hasMore: boolean;
}> {
  const cacheKey = `history:${title}:${limit}:${offset ?? 0}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetHistory> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const dbTitle = title.replace(/ /g, "_");

    // Get page_id first
    const [pageRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_id FROM page WHERE page_title = ? AND page_namespace = 0 LIMIT 1`,
      [dbTitle]
    );
    if (!pageRows || pageRows.length === 0) return { revisions: [], hasMore: false };
    const pageId = pageRows[0]!.page_id as number;

    // Fetch revisions with actor and comment join
    let query = `
      SELECT r.rev_id, r.rev_parent_id, r.rev_timestamp, r.rev_len, r.rev_minor_edit,
             a.actor_name,
             c.comment_text
      FROM revision r
      JOIN actor a ON a.actor_id = r.rev_actor
      LEFT JOIN comment c ON c.comment_id = r.rev_comment_id
      WHERE r.rev_page = ?
    `;
    const params: (number | string)[] = [pageId];

    if (offset) {
      query += ` AND r.rev_id < ?`;
      params.push(offset);
    }

    query += ` ORDER BY r.rev_timestamp DESC LIMIT ?`;
    params.push(limit + 1);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);
    const allRows = rows ?? [];
    const hasMore = allRows.length > limit;
    const resultRows = hasMore ? allRows.slice(0, limit) : allRows;

    const revisions = resultRows.map((row) => ({
      revid: row.rev_id as number,
      parentid: (row.rev_parent_id as number) || null,
      timestamp: formatMWTimestamp(String(row.rev_timestamp)),
      user: String(row.actor_name),
      comment: String(row.comment_text ?? ""),
      size: row.rev_len as number,
      minor: (row.rev_minor_edit as number) === 1,
    }));

    const result = { revisions, hasMore };
    cacheSet(cacheKey, result, 60 * 1000); // 1 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL history error:", err);
    return { revisions: [], hasMore: false };
  }
}

/**
 * Get user contributions directly from MySQL.
 * Replaces api.php?action=query&list=usercontribs (~400ms → ~40ms).
 */
async function ixwikiGetUserContribs(
  username: string,
  limit: number = 50,
  offset?: number
): Promise<{
  contribs: Array<{
    revid: number;
    title: string;
    timestamp: string;
    comment: string;
    size: number;
    minor: boolean;
    isNew: boolean;
  }>;
  hasMore: boolean;
}> {
  const cacheKey = `usercontribs:${username}:${limit}:${offset ?? 0}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetUserContribs> extends Promise<infer T> ? T : never>(
      cacheKey
    );
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    let query = `
      SELECT r.rev_id, r.rev_timestamp, r.rev_len, r.rev_minor_edit, r.rev_parent_id,
             p.page_title,
             c.comment_text
      FROM revision r
      JOIN actor a ON a.actor_id = r.rev_actor
      JOIN page p ON p.page_id = r.rev_page
      LEFT JOIN comment c ON c.comment_id = r.rev_comment_id
      WHERE a.actor_name = ? AND p.page_namespace = 0
    `;
    const params: (string | number)[] = [username];

    if (offset) {
      query += ` AND r.rev_id < ?`;
      params.push(offset);
    }

    query += ` ORDER BY r.rev_timestamp DESC LIMIT ?`;
    params.push(limit + 1);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);
    const allRows = rows ?? [];
    const hasMore = allRows.length > limit;
    const resultRows = hasMore ? allRows.slice(0, limit) : allRows;

    const contribs = resultRows.map((row) => ({
      revid: row.rev_id as number,
      title: String(row.page_title).replace(/_/g, " "),
      timestamp: formatMWTimestamp(String(row.rev_timestamp)),
      comment: String(row.comment_text ?? ""),
      size: row.rev_len as number,
      minor: (row.rev_minor_edit as number) === 1,
      isNew: (row.rev_parent_id as number) === 0,
    }));

    const result = { contribs, hasMore };
    cacheSet(cacheKey, result, 2 * 60 * 1000); // 2 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL user contribs error:", err);
    return { contribs: [], hasMore: false };
  }
}

/**
 * Get user info directly from MySQL.
 * Replaces api.php?action=query&list=users (~300ms → ~20ms).
 */
async function ixwikiGetUserInfo(username: string): Promise<{
  exists: boolean;
  username: string;
  editCount: number;
  registration: string | null;
  groups: string[];
}> {
  const cacheKey = `userinfo:${username}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetUserInfo> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    const [userRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT user_id, user_name, user_editcount, user_registration
       FROM user WHERE user_name = ? LIMIT 1`,
      [username]
    );

    if (!userRows || userRows.length === 0) {
      return { exists: false, username, editCount: 0, registration: null, groups: [] };
    }

    const user = userRows[0]!;
    const userId = user.user_id as number;

    // Get user groups
    const [groupRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT ug_group FROM user_groups WHERE ug_user = ?`,
      [userId]
    );

    const groups = (groupRows ?? [])
      .map((g) => String(g.ug_group))
      .filter((g) => g !== "*" && g !== "user");

    const result = {
      exists: true,
      username: String(user.user_name),
      editCount: (user.user_editcount as number) ?? 0,
      registration: user.user_registration
        ? formatMWTimestamp(String(user.user_registration))
        : null,
      groups,
    };

    cacheSet(cacheKey, result, 5 * 60 * 1000); // 5 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL user info error:", err);
    return { exists: false, username, editCount: 0, registration: null, groups: [] };
  }
}

/**
 * Get pages linking to a given page directly from MySQL.
 * Replaces api.php?action=query&list=backlinks (~400ms → ~30ms).
 */
async function ixwikiGetBacklinks(
  title: string,
  limit: number = 50,
  offset?: number
): Promise<{ links: Array<{ title: string; ns: number }>; hasMore: boolean }> {
  const cacheKey = `backlinks:${title}:${limit}:${offset ?? 0}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetBacklinks> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const dbTitle = title.replace(/ /g, "_");

    // MediaWiki 1.45+ uses linktarget table instead of pl_title/pl_namespace
    let query = `
      SELECT DISTINCT p.page_title, p.page_namespace, p.page_id
      FROM pagelinks pl
      JOIN linktarget lt ON lt.lt_id = pl.pl_target_id
      JOIN page p ON p.page_id = pl.pl_from
      WHERE lt.lt_title = ? AND lt.lt_namespace = 0
    `;
    const params: (string | number)[] = [dbTitle];

    if (offset) {
      query += ` AND p.page_id > ?`;
      params.push(offset);
    }

    query += ` ORDER BY p.page_id ASC LIMIT ?`;
    params.push(limit + 1);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);
    const allRows = rows ?? [];
    const hasMore = allRows.length > limit;
    const resultRows = hasMore ? allRows.slice(0, limit) : allRows;

    const links = resultRows.map((row) => ({
      title: String(row.page_title).replace(/_/g, " "),
      ns: row.page_namespace as number,
    }));

    const result = { links, hasMore };
    cacheSet(cacheKey, result, 5 * 60 * 1000); // 5 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL backlinks error:", err);
    return { links: [], hasMore: false };
  }
}

/**
 * Get category members directly from MySQL.
 * Replaces api.php?action=query&list=categorymembers (~400ms → ~30ms).
 */
async function ixwikiGetCategoryMembers(
  category: string,
  limit: number = 50,
  type?: "page" | "subcat" | "file"
): Promise<{
  members: Array<{ title: string; ns: number; isSubcategory: boolean }>;
  hasMore: boolean;
}> {
  const catName = category.replace(/^Category:/, "").replace(/ /g, "_");
  const cacheKey = `catmembers:${catName}:${limit}:${type ?? "all"}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetCategoryMembers> extends Promise<infer T> ? T : never>(
      cacheKey
    );
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    let query = `
      SELECT p.page_title, p.page_namespace
      FROM categorylinks cl
      JOIN linktarget lt ON lt.lt_id = cl.cl_target_id
      JOIN page p ON p.page_id = cl.cl_from
      WHERE lt.lt_namespace = 14 AND lt.lt_title = ?
    `;
    const params: (string | number)[] = [catName];

    if (type === "subcat") {
      query += ` AND p.page_namespace = 14`;
    } else if (type === "page") {
      query += ` AND p.page_namespace = 0`;
    } else if (type === "file") {
      query += ` AND p.page_namespace = 6`;
    }

    query += ` ORDER BY cl.cl_sortkey ASC LIMIT ?`;
    params.push(limit + 1);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);
    const allRows = rows ?? [];
    const hasMore = allRows.length > limit;
    const resultRows = hasMore ? allRows.slice(0, limit) : allRows;

    const members = resultRows.map((row) => {
      const ns = row.page_namespace as number;
      let title = String(row.page_title).replace(/_/g, " ");
      if (ns === 14) title = `Category:${title}`;
      return { title, ns, isSubcategory: ns === 14 };
    });

    const result = { members, hasMore };
    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL category members error:", err);
    return { members: [], hasMore: false };
  }
}

/**
 * Get site statistics directly from MySQL.
 * Replaces api.php?action=query&meta=siteinfo (~200ms → ~5ms).
 */
async function ixwikiGetSiteStats(): Promise<{
  pages: number;
  articles: number;
  edits: number;
  images: number;
  users: number;
  activeUsers: number;
}> {
  const cacheKey = "sitestats";
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetSiteStats> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT ss_total_pages, ss_good_articles, ss_total_edits,
              ss_images, ss_users, ss_active_users
       FROM site_stats LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      return { pages: 0, articles: 0, edits: 0, images: 0, users: 0, activeUsers: 0 };
    }

    const row = rows[0]!;
    const result = {
      pages: (row.ss_total_pages as number) ?? 0,
      articles: (row.ss_good_articles as number) ?? 0,
      edits: (row.ss_total_edits as number) ?? 0,
      images: (row.ss_images as number) ?? 0,
      users: (row.ss_users as number) ?? 0,
      activeUsers: (row.ss_active_users as number) ?? 0,
    };

    cacheSet(cacheKey, result, 5 * 60 * 1000); // 5 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL site stats error:", err);
    return { pages: 0, articles: 0, edits: 0, images: 0, users: 0, activeUsers: 0 };
  }
}

/**
 * Get a random article title directly from MySQL.
 * Replaces api.php?action=query&list=random (~200ms → ~10ms).
 * Uses the page_random column that MediaWiki maintains.
 */
async function ixwikiGetRandomPage(): Promise<string | null> {
  try {
    const pool = getIxWikiPool();
    const rand = Math.random();
    // Try to find a page with page_random >= our random value
    let [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_title FROM page
       WHERE page_namespace = 0 AND page_is_redirect = 0 AND page_random >= ?
       ORDER BY page_random ASC LIMIT 1`,
      [rand]
    );
    // Wrap-around if nothing found above our random value
    if (!rows || rows.length === 0) {
      [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT page_title FROM page
         WHERE page_namespace = 0 AND page_is_redirect = 0
         ORDER BY page_random ASC LIMIT 1`
      );
    }
    if (!rows || rows.length === 0) return null;
    return String(rows[0]!.page_title).replace(/_/g, " ");
  } catch (err) {
    console.error("[WikiBridge] MySQL random page error:", err);
    return null;
  }
}

/**
 * Resolve redirects directly from MySQL.
 * Replaces api.php?action=query&redirects=1 (~300ms → ~20ms).
 * Follows redirect chains up to 5 hops.
 */
async function ixwikiResolveRedirect(title: string): Promise<string> {
  const cacheKey = `redirect:${title}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    let currentTitle = title.replace(/ /g, "_");
    let hops = 0;

    while (hops < 5) {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT rd.rd_namespace, rd.rd_title
         FROM page p
         JOIN redirect rd ON rd.rd_from = p.page_id
         WHERE p.page_title = ? AND p.page_namespace = 0
         LIMIT 1`,
        [currentTitle]
      );
      if (!rows || rows.length === 0) break;
      const target = rows[0]!;
      if ((target.rd_namespace as number) !== 0) break; // Only follow main namespace redirects
      currentTitle = String(target.rd_title);
      hops++;
    }

    const resolved = currentTitle.replace(/_/g, " ");
    cacheSet(cacheKey, resolved, 30 * 60 * 1000); // 30 min cache
    return resolved;
  } catch (err) {
    console.error("[WikiBridge] MySQL redirect error:", err);
    return title;
  }
}

/**
 * Get wikitext of a specific revision by ID directly from MySQL.
 * Replaces api.php?action=query&revids=X&prop=revisions&rvprop=content (~400ms → ~40ms).
 */
async function ixwikiGetRevisionWikitext(revid: number): Promise<{
  wikitext: string;
  title: string;
  timestamp: string;
} | null> {
  const cacheKey = `revwikitext:${revid}`;
  const cached = cacheGet<{ wikitext: string; title: string; timestamp: string }>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT p.page_title, r.rev_timestamp, t.old_text
       FROM revision r
       JOIN page p ON p.page_id = r.rev_page
       JOIN slots s ON s.slot_revision_id = r.rev_id
       JOIN content c ON c.content_id = s.slot_content_id
       JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
       WHERE r.rev_id = ?
       LIMIT 1`,
      [revid]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0]!;
    const result = {
      wikitext: String(row.old_text),
      title: String(row.page_title).replace(/_/g, " "),
      timestamp: formatMWTimestamp(String(row.rev_timestamp)),
    };
    cacheSet(cacheKey, result, 60 * 60 * 1000); // 1 hour (immutable)
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL revision wikitext error:", err);
    return null;
  }
}

/**
 * Get current revision metadata (revid + timestamp) for a page.
 * Replaces api.php?action=query&prop=revisions&rvprop=ids|timestamp (~300ms → ~10ms).
 */
async function ixwikiGetCurrentRevMeta(title: string): Promise<{
  revid: number;
  timestamp: string;
} | null> {
  const cacheKey = `revmeta:${title}`;
  const cached = cacheGet<{ revid: number; timestamp: string }>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT r.rev_id, r.rev_timestamp
       FROM page p
       JOIN revision r ON r.rev_id = p.page_latest
       WHERE p.page_title = ? AND p.page_namespace = 0
       LIMIT 1`,
      [title.replace(/ /g, "_")]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0]!;
    const result = {
      revid: row.rev_id as number,
      timestamp: formatMWTimestamp(String(row.rev_timestamp)),
    };
    cacheSet(cacheKey, result, 60 * 1000); // 1 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL rev meta error:", err);
    return null;
  }
}

/**
 * Get wikitext from a specific namespace (not just main namespace 0).
 * Used for Talk pages (namespace 1), Templates (namespace 10), etc.
 */
async function ixwikiGetNamespacedWikitext(
  title: string,
  namespace: number
): Promise<{
  wikitext: string;
  title: string;
} | null> {
  const cacheKey = `ns-wikitext:${namespace}:${title}`;
  const cached = cacheGet<{ wikitext: string; title: string }>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const dbTitle = title.replace(/ /g, "_");
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT p.page_title, t.old_text
       FROM page p
       JOIN slots s ON s.slot_revision_id = p.page_latest
       JOIN content c ON c.content_id = s.slot_content_id
       JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
       WHERE p.page_title = ? AND p.page_namespace = ?
       LIMIT 1`,
      [dbTitle, namespace]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0]!;
    const result = {
      wikitext: String(row.old_text),
      title: String(row.page_title).replace(/_/g, " "),
    };
    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL namespaced wikitext error:", err);
    return null;
  }
}

/**
 * Search templates by prefix directly from MySQL.
 * Replaces api.php?action=opensearch&namespace=10 (~200ms → ~20ms).
 */
async function ixwikiSearchTemplates(query: string, limit: number = 20): Promise<string[]> {
  const cacheKey = `tmplsearch:${query}:${limit}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const pattern = query.replace(/ /g, "_") + "%";
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_title FROM page
       WHERE page_namespace = 10 AND CONVERT(page_title USING utf8mb4) LIKE ? AND page_is_redirect = 0
       ORDER BY page_len DESC LIMIT ?`,
      [pattern, limit]
    );
    const results = (rows ?? []).map((r) => String(r.page_title).replace(/_/g, " "));
    cacheSet(cacheKey, results, 5 * 60 * 1000);
    return results;
  } catch (err) {
    console.error("[WikiBridge] MySQL template search error:", err);
    return [];
  }
}

/**
 * Full-text search using MySQL searchindex table.
 * Replaces api.php?action=query&list=search (~500ms → ~100ms).
 */
async function ixwikiFullTextSearch(
  query: string,
  limit: number = 20,
  offset: number = 0,
  namespace?: number
): Promise<{
  results: Array<{
    title: string;
    namespace: number;
    snippet: string;
    size: number;
    wordCount: number;
    timestamp: string;
  }>;
  totalHits: number;
}> {
  const cacheKey = `ftsearch:${query}:${limit}:${offset}:${namespace ?? "all"}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiFullTextSearch> extends Promise<infer T> ? T : never>(
      cacheKey
    );
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    // Count total hits
    let countQuery = `SELECT COUNT(*) as total FROM searchindex si JOIN page p ON p.page_id = si.si_page WHERE MATCH(si.si_text) AGAINST(? IN NATURAL LANGUAGE MODE)`;
    const countParams: (string | number)[] = [query];
    if (namespace !== undefined) {
      countQuery += ` AND p.page_namespace = ?`;
      countParams.push(namespace);
    }
    const [countRows] = await pool.execute<mysql.RowDataPacket[]>(countQuery, countParams);
    const totalHits = (countRows?.[0]?.total as number) ?? 0;

    // Get results with relevance
    let searchQuery = `
      SELECT p.page_id, p.page_title, p.page_namespace, p.page_len, p.page_touched,
             MATCH(si.si_text) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance,
             SUBSTRING(si.si_text, 1, 500) AS text_preview
      FROM searchindex si
      JOIN page p ON p.page_id = si.si_page
      WHERE MATCH(si.si_text) AGAINST(? IN NATURAL LANGUAGE MODE)
    `;
    const searchParams: (string | number)[] = [query, query];
    if (namespace !== undefined) {
      searchQuery += ` AND p.page_namespace = ?`;
      searchParams.push(namespace);
    }
    searchQuery += ` ORDER BY relevance DESC LIMIT ? OFFSET ?`;
    searchParams.push(limit, offset);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(searchQuery, searchParams);

    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = (rows ?? []).map((row) => {
      const textPreview = String(row.text_preview ?? "");
      // Build snippet: find first query term and extract context
      const lowerText = textPreview.toLowerCase();
      let snippetStart = 0;
      for (const term of queryTerms) {
        const idx = lowerText.indexOf(term);
        if (idx >= 0) {
          snippetStart = Math.max(0, idx - 60);
          break;
        }
      }
      let snippet = textPreview.substring(snippetStart, snippetStart + 200);
      // Highlight query terms
      for (const term of queryTerms) {
        snippet = snippet.replace(
          new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
          '<span class="searchmatch">$1</span>'
        );
      }
      if (snippetStart > 0) snippet = "..." + snippet;

      return {
        title: String(row.page_title).replace(/_/g, " "),
        namespace: row.page_namespace as number,
        snippet,
        size: row.page_len as number,
        wordCount: Math.round((row.page_len as number) / 6), // Rough estimate
        timestamp: formatMWTimestamp(String(row.page_touched)),
      };
    });

    const result = { results, totalHits };
    cacheSet(cacheKey, result, 2 * 60 * 1000); // 2 min cache
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL fulltext search error:", err);
    return { results: [], totalHits: 0 };
  }
}

/**
 * Get parent categories for a page directly from MySQL.
 * Replaces api.php?action=query&prop=categories (~400ms → ~20ms).
 */
async function ixwikiGetParentCategories(
  title: string
): Promise<Array<{ title: string; fullTitle: string }>> {
  const cacheKey = `parentcats:${title}`;
  const cached = cacheGet<Array<{ title: string; fullTitle: string }>>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const dbTitle = title.replace(/ /g, "_");

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT lt.lt_title
       FROM categorylinks cl
       JOIN page p ON p.page_id = cl.cl_from
       JOIN linktarget lt ON lt.lt_id = cl.cl_target_id
       WHERE p.page_title = ? AND p.page_namespace = 0
       ORDER BY cl.cl_sortkey`,
      [dbTitle]
    );

    // Filter out hidden categories
    const catTitles = (rows ?? []).map((r) => String(r.lt_title));
    let hiddenCats = new Set<string>();
    if (catTitles.length > 0) {
      const placeholders = catTitles.map(() => "?").join(",");
      const [hiddenRows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.page_title FROM page p
         JOIN page_props pp ON pp.pp_page = p.page_id
         WHERE pp.pp_propname = 'hiddencat' AND p.page_namespace = 14
           AND p.page_title IN (${placeholders})`,
        catTitles
      );
      hiddenCats = new Set((hiddenRows ?? []).map((r) => String(r.page_title)));
    }

    const result = catTitles
      .filter((t) => !hiddenCats.has(t))
      .map((t) => ({
        title: t.replace(/_/g, " "),
        fullTitle: `Category:${t.replace(/_/g, " ")}`,
      }));

    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL parent categories error:", err);
    return [];
  }
}

/**
 * Get category info (counts) and subcategories directly from MySQL.
 * Replaces multiple API calls in getCategoryTree (~1500ms → ~50ms).
 */
async function ixwikiGetCategoryInfo(categoryName: string): Promise<{
  title: string;
  totalPages: number;
  totalSubcats: number;
  totalFiles: number;
  subcategories: Array<{ title: string; fullTitle: string }>;
}> {
  const catName = categoryName.replace(/^Category:/, "").replace(/ /g, "_");
  const cacheKey = `catinfo:${catName}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetCategoryInfo> extends Promise<infer T> ? T : never>(
      cacheKey
    );
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    // Get category counts
    const [catRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT cat_pages, cat_subcats, cat_files FROM category WHERE cat_title = ?`,
      [catName]
    );
    const catInfo = catRows?.[0];

    // Get subcategories
    const [subRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT p.page_title
       FROM categorylinks cl
       JOIN page p ON p.page_id = cl.cl_from
       JOIN linktarget lt ON lt.lt_id = cl.cl_target_id
       WHERE lt.lt_title = ? AND lt.lt_namespace = 14 AND p.page_namespace = 14
       ORDER BY cl.cl_sortkey LIMIT 100`,
      [catName]
    );

    const subcategories = (subRows ?? []).map((r) => {
      const t = String(r.page_title).replace(/_/g, " ");
      return { title: t, fullTitle: `Category:${t}` };
    });

    const result = {
      title: catName.replace(/_/g, " "),
      totalPages: (catInfo?.cat_pages as number) ?? 0,
      totalSubcats: (catInfo?.cat_subcats as number) ?? 0,
      totalFiles: (catInfo?.cat_files as number) ?? 0,
      subcategories,
    };

    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL category info error:", err);
    return {
      title: catName.replace(/_/g, " "),
      totalPages: 0,
      totalSubcats: 0,
      totalFiles: 0,
      subcategories: [],
    };
  }
}

/**
 * Get page properties (displaytitle, defaultsort, etc.) directly from MySQL.
 */
async function ixwikiGetPageProps(pageId: number): Promise<Record<string, string>> {
  const cacheKey = `pageprops:${pageId}`;
  const cached = cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT pp_propname, pp_value FROM page_props WHERE pp_page = ?`,
      [pageId]
    );
    const props: Record<string, string> = {};
    for (const row of rows ?? []) {
      props[String(row.pp_propname)] = String(row.pp_value);
    }
    cacheSet(cacheKey, props, 10 * 60 * 1000);
    return props;
  } catch (err) {
    console.error("[WikiBridge] MySQL page props error:", err);
    return {};
  }
}

/**
 * Get page protection status directly from MySQL.
 */
async function ixwikiGetPageProtection(title: string): Promise<
  Array<{
    type: string;
    level: string;
    expiry: string | null;
  }>
> {
  const cacheKey = `protection:${title}`;
  const cached = cacheGet<Array<{ type: string; level: string; expiry: string | null }>>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT pr.pr_type, pr.pr_level, pr.pr_expiry
       FROM page_restrictions pr
       JOIN page p ON p.page_id = pr.pr_page
       WHERE p.page_title = ? AND p.page_namespace = 0`,
      [title.replace(/ /g, "_")]
    );
    const result = (rows ?? []).map((r) => ({
      type: String(r.pr_type),
      level: String(r.pr_level),
      expiry: r.pr_expiry ? formatMWTimestamp(String(r.pr_expiry)) : null,
    }));
    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL protection error:", err);
    return [];
  }
}

/**
 * Get image metadata directly from MySQL.
 * Replaces api.php?action=query&prop=imageinfo (~400ms → ~20ms).
 */
async function ixwikiGetImageMeta(filename: string): Promise<{
  name: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  timestamp: string;
  url: string;
  thumbUrl: string;
} | null> {
  const cacheKey = `imgmeta:${filename}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetImageMeta> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const dbName = filename.replace(/^File:/, "").replace(/ /g, "_");
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT img_name, img_width, img_height, img_size,
              img_major_mime, img_minor_mime, img_timestamp
       FROM image WHERE img_name = ? LIMIT 1`,
      [dbName]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0]!;
    const name = String(row.img_name);

    // Compute URL using MediaWiki's hash-based path structure
    const crypto = await import("crypto");
    const md5 = crypto.createHash("md5").update(name).digest("hex");
    const hashPath = `${md5[0]}/${md5.slice(0, 2)}`;
    const baseUrl = process.env.IXWIKI_IMAGE_BASE_URL || "https://ixwiki.com/images";
    const url = `${baseUrl}/${hashPath}/${encodeURIComponent(name)}`;
    const thumbUrl = `${baseUrl}/thumb/${hashPath}/${encodeURIComponent(name)}/200px-${encodeURIComponent(name)}`;

    const result = {
      name: name.replace(/_/g, " "),
      width: row.img_width as number,
      height: row.img_height as number,
      size: row.img_size as number,
      mimeType: `${row.img_major_mime}/${row.img_minor_mime}`,
      timestamp: formatMWTimestamp(String(row.img_timestamp)),
      url,
      thumbUrl,
    };
    cacheSet(cacheKey, result, 10 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL image meta error:", err);
    return null;
  }
}

/**
 * Get action log entries for a page directly from MySQL.
 */
async function ixwikiGetPageLog(
  title: string,
  limit: number = 50
): Promise<
  Array<{
    id: number;
    type: string;
    action: string;
    timestamp: string;
    user: string;
    comment: string;
    params: string;
  }>
> {
  const cacheKey = `pagelog:${title}:${limit}`;
  const cached =
    cacheGet<ReturnType<typeof ixwikiGetPageLog> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT l.log_id, l.log_type, l.log_action, l.log_timestamp, l.log_params,
              a.actor_name, c.comment_text
       FROM logging l
       JOIN actor a ON a.actor_id = l.log_actor
       LEFT JOIN comment c ON c.comment_id = l.log_comment_id
       WHERE l.log_title = ? AND l.log_namespace = 0
       ORDER BY l.log_timestamp DESC LIMIT ?`,
      [title.replace(/ /g, "_"), limit]
    );
    const result = (rows ?? []).map((r) => ({
      id: r.log_id as number,
      type: String(r.log_type),
      action: String(r.log_action),
      timestamp: formatMWTimestamp(String(r.log_timestamp)),
      user: String(r.actor_name),
      comment: String(r.comment_text ?? ""),
      params: String(r.log_params ?? ""),
    }));
    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL page log error:", err);
    return [];
  }
}

/**
 * Format MediaWiki timestamp (20231015123456) to ISO string.
 */
function formatMWTimestamp(ts: string): string {
  if (ts.includes("-") || ts.includes("T")) return ts; // Already formatted
  // MW format: YYYYMMDDHHMMSS
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const hour = ts.slice(8, 10);
  const min = ts.slice(10, 12);
  const sec = ts.slice(12, 14);
  return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
}

// ──────────────────────────────────────────────
// External Wiki Fetch Helper (retry + 403 resilience)
// ──────────────────────────────────────────────

const USER_AGENT = "IxStats-Builder";

/**
 * Fetch from an external wiki API with retry logic for transient 403 errors.
 * Returns null on persistent failures instead of throwing.
 */
async function fetchExternalWiki(url: string, retries = 2): Promise<Response | null> {
  const result = await withRetrySafe(
    async (signal) => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
          Accept: "application/json, text/html, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    },
    {
      maxAttempts: retries + 1,
      strategy: "linear",
      baseDelayMs: 2000,
      timeoutMs: 20000,
      retryIf: (err) => err.message.includes("HTTP 403"),
      // eslint-disable-next-line unused-imports/no-unused-vars
      onRetry: (attempt, err) => {
        console.warn(
          `[WikiBridge] ${new URL(url).hostname} returned 403, retry ${attempt}/${retries + 1}`
        );
      },
    }
  );

  if (!result.success) {
    console.warn(`[WikiBridge] ${new URL(url).hostname} fetch failed:`, result.error?.message);
    return null;
  }
  return result.value ?? null;
}

// ──────────────────────────────────────────────
// IIWiki HTTP API (direct access — Cloudflare whitelisted)
// ──────────────────────────────────────────────

function getIiwikiApiBaseUrl(): string {
  return "https://iiwiki.com";
}

function getFullIiwikiApiUrl(): string {
  return "https://iiwiki.com/api.php";
}

async function iiwikiApiCall(params: Record<string, string>): Promise<unknown | null> {
  const url = new URL(getFullIiwikiApiUrl());
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchExternalWiki(url.toString());
  if (!res) return null;
  return res.json();
}

async function iiwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    const data = (await iiwikiApiCall({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    })) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
          }
        >;
      };
    } | null;

    if (!data) return null;
    const pages = data.query?.pages;
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
    });

    if (!data || !Array.isArray(data) || data.length < 2) return [];
    return ((data[1] as string[]) ?? []).map((title: string, i: number) => ({
      title,
      pageId: i,
      length: 0,
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// AltHistory Wiki HTTP API (external — Fandom)
// ──────────────────────────────────────────────

const ALTHISTORY_API = "https://althistory.fandom.com/api.php";

async function althistoryApiCall(params: Record<string, string>): Promise<unknown | null> {
  const url = new URL(ALTHISTORY_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchExternalWiki(url.toString());
  if (!res) return null;
  return res.json();
}

async function althistoryGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    const data = (await althistoryApiCall({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    })) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
          }
        >;
      };
    } | null;

    if (!data) return null;
    const pages = data.query?.pages;
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
    console.error("[WikiBridge] althistory fetch error:", err);
    return null;
  }
}

async function althistorySearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  try {
    const data = await althistoryApiCall({
      action: "opensearch",
      search: query,
      limit: String(limit),
      namespace: "0",
    });

    if (!data || !Array.isArray(data) || data.length < 2) return [];
    return ((data[1] as string[]) ?? []).map((title: string, i: number) => ({
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

const wikitextPromises = new Map<string, Promise<WikiArticle | null>>();

/**
 * Get raw article wikitext. Uses MySQL for ixwiki, HTTP for iiwiki/althistory.
 */
export async function getArticleWikitext(
  title: string,
  wiki: WikiSource = "ixwiki"
): Promise<WikiArticle | null> {
  const key = `${wiki}:${title}`;
  let promise = wikitextPromises.get(key);
  if (!promise) {
    promise = (async () => {
      try {
        if (wiki === "ixwiki") return await ixwikiGetWikitext(title);
        if (wiki === "althistory") return await althistoryGetWikitext(title);
        return await iiwikiGetWikitext(title);
      } finally {
        wikitextPromises.delete(key);
      }
    })();
    wikitextPromises.set(key, promise);
  }
  return promise;
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
  if (wiki === "althistory") return althistorySearch(query, limit);
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
 * Get page revision history via direct MySQL.
 */
export async function getPageHistory(title: string, limit?: number, offset?: number) {
  return ixwikiGetHistory(title, limit, offset);
}

/**
 * Get user contributions via direct MySQL.
 */
export async function getUserContribs(username: string, limit?: number, offset?: number) {
  return ixwikiGetUserContribs(username, limit, offset);
}

/**
 * Get user info via direct MySQL.
 */
export async function getUserInfo(username: string) {
  return ixwikiGetUserInfo(username);
}

/**
 * Get backlinks (pages linking to a page) via direct MySQL.
 */
export async function getBacklinks(title: string, limit?: number, offset?: number) {
  return ixwikiGetBacklinks(title, limit, offset);
}

/**
 * Get category members via direct MySQL.
 */
export async function getCategoryMembers(
  category: string,
  limit?: number,
  type?: "page" | "subcat" | "file"
) {
  return ixwikiGetCategoryMembers(category, limit, type);
}

/**
 * Get site statistics via direct MySQL.
 */
export async function getSiteStats() {
  return ixwikiGetSiteStats();
}

/**
 * Get a random article title via direct MySQL.
 */
export async function getRandomPage() {
  return ixwikiGetRandomPage();
}

/**
 * Resolve redirects via direct MySQL (up to 5 hops).
 */
export async function resolveRedirect(title: string) {
  return ixwikiResolveRedirect(title);
}

/**
 * Get wikitext of a specific revision by ID via direct MySQL.
 */
export async function getRevisionWikitext(revid: number) {
  return ixwikiGetRevisionWikitext(revid);
}

/**
 * Get current revision metadata (revid + timestamp) via direct MySQL.
 */
export async function getCurrentRevMeta(title: string) {
  return ixwikiGetCurrentRevMeta(title);
}

/**
 * Get wikitext from any namespace via direct MySQL.
 */
export async function getNamespacedWikitext(title: string, namespace: number) {
  return ixwikiGetNamespacedWikitext(title, namespace);
}

/**
 * Search templates by prefix via direct MySQL.
 */
export async function searchTemplates(query: string, limit?: number) {
  return ixwikiSearchTemplates(query, limit);
}

/**
 * Full-text search via MySQL searchindex table.
 */
export async function fullTextSearch(
  query: string,
  limit?: number,
  offset?: number,
  namespace?: number
) {
  return ixwikiFullTextSearch(query, limit, offset, namespace);
}

/**
 * Get parent categories via direct MySQL.
 */
export async function getParentCategories(title: string) {
  return ixwikiGetParentCategories(title);
}

/**
 * Get category info with subcategories via direct MySQL.
 */
export async function getCategoryInfo(category: string) {
  return ixwikiGetCategoryInfo(category);
}

/**
 * Get page properties via direct MySQL.
 */
export async function getPageProps(pageId: number) {
  return ixwikiGetPageProps(pageId);
}

/**
 * Get page protection status via direct MySQL.
 */
export async function getPageProtection(title: string) {
  return ixwikiGetPageProtection(title);
}

/**
 * Get image metadata via direct MySQL.
 */
export async function getImageMeta(filename: string) {
  return ixwikiGetImageMeta(filename);
}

/**
 * Get page action log via direct MySQL.
 */
export async function getPageLog(title: string, limit?: number) {
  return ixwikiGetPageLog(title, limit);
}

// Re-exported from wiki-image-url (shared with client-safe code)
export { getImageUrl } from "./wiki-image-url";

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
): Promise<Array<{
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}> | null> {
  const cacheKey = `pageimages:${title}`;
  const cached =
    cacheGet<
      Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }>
    >(cacheKey);
  if (cached) return cached;

  const sources = [
    { wiki: "ixwiki" as WikiSource, base: "https://ixwiki.com" },
    { wiki: "iiwiki" as WikiSource, base: getIiwikiApiBaseUrl() },
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
      const listData = (await listRes.json()) as {
        query?: {
          pages?: Record<string, { missing?: boolean; images?: Array<{ title: string }> }>;
        };
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
      const infoData = (await infoRes.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              missing?: boolean;
              imageinfo?: Array<{
                url: string;
                thumburl?: string;
                width: number;
                height: number;
                mime?: string;
              }>;
            }
          >;
        };
      };
      const infoPages = infoData?.query?.pages;
      if (!infoPages) continue;

      const images: Array<{
        title: string;
        url: string;
        thumbUrl: string;
        width: number;
        height: number;
      }> = [];
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
  const intro =
    headingIndex > 0 ? wikitext.substring(0, headingIndex) : wikitext.substring(0, 2000);

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

// ──────────────────────────────────────────────
// Category Tree (cached 1 hour)
// ──────────────────────────────────────────────

/**
 * Build a top-level category tree from the MediaWiki `categorylinks` table.
 * Returns the top 500 categories with their subcategory names and page counts.
 * Result is cached in L1 memory for 1 hour.
 */
export async function ixwikiGetCategoryTree(): Promise<
  Array<{ name: string; subcategories: string[]; pageCount: number }>
> {
  const cacheKey = "category_tree";
  const cached =
    cacheGet<Array<{ name: string; subcategories: string[]; pageCount: number }>>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    // Get all categories with their page counts
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        cl_to AS name,
        COUNT(*) AS pageCount
      FROM categorylinks
      GROUP BY cl_to
      ORDER BY pageCount DESC
      LIMIT 500
    `);

    // Get subcategory relationships (namespace 14 = Category)
    const [subRows] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        p.page_title AS child,
        cl.cl_to AS parent
      FROM categorylinks cl
      JOIN page p ON cl.cl_from = p.page_id
      WHERE p.page_namespace = 14
      LIMIT 2000
    `);

    const subcatMap = new Map<string, string[]>();
    for (const row of subRows as Array<{ child: string; parent: string }>) {
      const parent = (row.parent as string).replace(/_/g, " ");
      const child = (row.child as string).replace(/_/g, " ");
      if (!subcatMap.has(parent)) subcatMap.set(parent, []);
      subcatMap.get(parent)!.push(child);
    }

    const result = (rows as Array<{ name: string; pageCount: number }>).map((r) => ({
      name: (r.name as string).replace(/_/g, " "),
      subcategories: subcatMap.get((r.name as string).replace(/_/g, " ")) ?? [],
      pageCount: Number(r.pageCount),
    }));

    cacheSet(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL
    return result;
  } catch (err) {
    console.error("[WikiBridge] Category tree query failed:", (err as Error).message);
    return [];
  }
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
