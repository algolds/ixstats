// src/lib/wiki-os/bridge/mysql-reader.ts
// Direct MariaDB SQL readers for local IxWiki (38ms fast-path).

import type mysql from "mysql2/promise";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { getIxWikiPool } from "./mysql-pool";
import {
  type WikiArticle,
  type WikiSearchResult,
  type WikiRecentChange,
  type MWPageRow,
  type MWRecentChangeRow,
  type MWSiteStatsRow,
  cacheGet,
  cacheSet,
  formatMWTimestamp,
} from "./types";

export async function fetchIxWikiWikitextHttp(title: string): Promise<WikiArticle | null> {
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      format: "json",
      origin: "*",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } }; "*"?: string }>;
          }
        >;
      };
    };

    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || !page.pageid || page.pageid < 0) return null;

    const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? page.revisions?.[0]?.["*"] ?? "";
    if (!wikitext) return null;

    return {
      title: page.title ?? title,
      pageId: page.pageid,
      wikitext,
      length: wikitext.length,
    };
  } catch (err) {
    console.error("[WikiBridge] IxWiki HTTP fallback error:", err);
    return null;
  }
}

export async function ixwikiGetWikitext(title: string): Promise<WikiArticle | null> {
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

    if (rows && rows.length > 0) {
      const row = rows[0]!;
      const article: WikiArticle = {
        title: String(row.page_title).replace(/_/g, " "),
        pageId: row.page_id as number,
        wikitext: String(row.old_text),
        length: row.page_len as number,
      };

      cacheSet(cacheKey, article);
      return article;
    }
  } catch (err) {
    console.warn("[WikiBridge] MySQL error fetching wikitext, falling back to HTTP:", err);
  }

  const httpArticle = await fetchIxWikiWikitextHttp(title);
  if (httpArticle) {
    cacheSet(cacheKey, httpArticle);
  }
  return httpArticle;
}

export async function ixwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cacheGet<WikiSearchResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const pattern = query.replace(/ /g, "_") + "%";

    const [rows] = await pool.execute<MWPageRow[]>(
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
      pageId: Number(row.page_id) || 0,
      length: Number(row.page_len) || 0,
    }));

    cacheSet(cacheKey, results, 5 * 60 * 1000);
    return results;
  } catch (err) {
    console.error("[WikiBridge] MySQL search error:", err);
    return [];
  }
}

export async function fetchIxWikiRecentChangesHttp(limit: number = 20): Promise<WikiRecentChange[]> {
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      list: "recentchanges",
      rcnamespace: "0",
      rcprop: "title|timestamp|user|comment|sizes|flags",
      rclimit: String(limit),
      format: "json",
      origin: "*",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        recentchanges?: Array<{
          title: string;
          user: string;
          timestamp: string;
          comment: string;
          type: string;
          oldlen: number;
          newlen: number;
        }>;
      };
    };

    const changes = data?.query?.recentchanges ?? [];
    return changes.map((rc) => ({
      title: rc.title.replace(/_/g, " "),
      user: rc.user || "Wiki Contributor",
      timestamp: rc.timestamp,
      comment: rc.comment || "",
      type: rc.type === "new" ? "new" : "edit",
      oldLen: rc.oldlen || 0,
      newLen: rc.newlen || 0,
    }));
  } catch (_err) {
    return [];
  }
}

export async function ixwikiRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  const cacheKey = `recentchanges:${limit}`;
  const cached = cacheGet<WikiRecentChange[]>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();
    const [rows] = await pool.execute<MWRecentChangeRow[]>(
      `SELECT rc.rc_title, rc.rc_timestamp, rc.rc_type, rc.rc_old_len, rc.rc_new_len,
              COALESCE(a.actor_name, 'Unknown') AS actor_name,
              COALESCE(c.comment_text, '') AS rc_comment
       FROM recentchanges rc
       LEFT JOIN actor a ON a.actor_id = rc.rc_actor
       LEFT JOIN comment c ON c.comment_id = rc.rc_comment_id
       WHERE rc.rc_namespace = 0 AND rc.rc_bot = 0 AND rc.rc_deleted = 0
       ORDER BY rc.rc_timestamp DESC
       LIMIT ?`,
      [limit]
    );

    const results: WikiRecentChange[] = (rows ?? []).map((row) => ({
      title: String(row.rc_title).replace(/_/g, " "),
      user: String(row.actor_name || "Unknown"),
      timestamp: formatMWTimestamp(String(row.rc_timestamp)),
      comment: String(row.rc_comment || ""),
      type: (row.rc_type as number) === 1 ? "new" : "edit",
      oldLen: Number(row.rc_old_len) || 0,
      newLen: Number(row.rc_new_len) || 0,
    }));

    cacheSet(cacheKey, results, 60 * 1000);
    return results;
  } catch (_err) {
    const httpResults = await fetchIxWikiRecentChangesHttp(limit);
    if (httpResults.length > 0) {
      cacheSet(cacheKey, httpResults, 60 * 1000);
      return httpResults;
    }
    return [];
  }
}

export async function ixwikiGetHistory(
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

    const [pageRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_id FROM page WHERE page_title = ? AND page_namespace = 0 LIMIT 1`,
      [dbTitle]
    );
    if (!pageRows || pageRows.length === 0) return { revisions: [], hasMore: false };
    const pageId = pageRows[0]!.page_id as number;

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
    cacheSet(cacheKey, result, 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL history error:", err);
    return { revisions: [], hasMore: false };
  }
}

export async function ixwikiGetUserContribs(
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
    cacheSet(cacheKey, result, 2 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL user contribs error:", err);
    return { contribs: [], hasMore: false };
  }
}

export async function ixwikiGetUserInfo(username: string): Promise<{
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

    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL user info error:", err);
    return { exists: false, username, editCount: 0, registration: null, groups: [] };
  }
}

export async function ixwikiGetBacklinks(
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
    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL backlinks error:", err);
    return { links: [], hasMore: false };
  }
}

export async function ixwikiGetCategoryMembers(
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

export async function ixwikiGetSiteStats(): Promise<{
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
    const [rows] = await pool.execute<MWSiteStatsRow[]>(
      `SELECT ss_total_pages, ss_good_articles, ss_total_edits,
              ss_images, ss_users, ss_active_users
       FROM site_stats LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      return { pages: 0, articles: 0, edits: 0, images: 0, users: 0, activeUsers: 0 };
    }

    const row = rows[0]!;
    const result = {
      pages: Number(row.ss_total_pages) || 0,
      articles: Number(row.ss_good_articles) || 0,
      edits: Number(row.ss_total_edits) || 0,
      images: Number(row.ss_images) || 0,
      users: Number(row.ss_users) || 0,
      activeUsers: Number(row.ss_active_users) || 0,
    };

    cacheSet(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL site stats error:", err);
    return { pages: 0, articles: 0, edits: 0, images: 0, users: 0, activeUsers: 0 };
  }
}

export async function ixwikiGetRandomPage(): Promise<string | null> {
  try {
    const pool = getIxWikiPool();
    const rand = Math.random();
    let [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT page_title FROM page
       WHERE page_namespace = 0 AND page_is_redirect = 0 AND page_random >= ?
       ORDER BY page_random ASC LIMIT 1`,
      [rand]
    );
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

export async function ixwikiResolveRedirect(title: string): Promise<string> {
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
      if ((target.rd_namespace as number) !== 0) break;
      currentTitle = String(target.rd_title);
      hops++;
    }

    const resolved = currentTitle.replace(/_/g, " ");
    cacheSet(cacheKey, resolved, 30 * 60 * 1000);
    return resolved;
  } catch (err) {
    console.error("[WikiBridge] MySQL redirect error:", err);
    return title;
  }
}

export async function ixwikiGetRevisionWikitext(revid: number): Promise<{
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
    cacheSet(cacheKey, result, 60 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL revision wikitext error:", err);
    return null;
  }
}

export async function ixwikiGetCurrentRevMeta(title: string): Promise<{
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
    cacheSet(cacheKey, result, 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL rev meta error:", err);
    return null;
  }
}

export async function ixwikiGetNamespacedWikitext(
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

export async function ixwikiSearchTemplates(query: string, limit: number = 20): Promise<string[]> {
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

export async function ixwikiFullTextSearch(
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

    let countQuery = `SELECT COUNT(*) as total FROM searchindex si JOIN page p ON p.page_id = si.si_page WHERE MATCH(si.si_text) AGAINST(? IN NATURAL LANGUAGE MODE)`;
    const countParams: (string | number)[] = [query];
    if (namespace !== undefined) {
      countQuery += ` AND p.page_namespace = ?`;
      countParams.push(namespace);
    }
    const [countRows] = await pool.execute<mysql.RowDataPacket[]>(countQuery, countParams);
    const totalHits = (countRows?.[0]?.total as number) ?? 0;

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
        wordCount: Math.round((row.page_len as number) / 6),
        timestamp: formatMWTimestamp(String(row.page_touched)),
      };
    });

    const result = { results, totalHits };
    cacheSet(cacheKey, result, 2 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] MySQL fulltext search error:", err);
    return { results: [], totalHits: 0 };
  }
}

export async function ixwikiGetParentCategories(
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

export async function ixwikiGetCategoryInfo(categoryName: string): Promise<{
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

    const [catRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT cat_pages, cat_subcats, cat_files FROM category WHERE cat_title = ?`,
      [catName]
    );
    const catInfo = catRows?.[0];

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

export async function ixwikiGetPageProps(pageId: number): Promise<Record<string, string>> {
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

export async function ixwikiGetPageProtection(title: string): Promise<
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

export async function ixwikiGetImageMeta(filename: string): Promise<{
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

export async function ixwikiGetPageLog(
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

export async function ixwikiGetCategoryTree(): Promise<
  Array<{ name: string; subcategories: string[]; pageCount: number }>
> {
  const cacheKey = "category_tree";
  const cached =
    cacheGet<Array<{ name: string; subcategories: string[]; pageCount: number }>>(cacheKey);
  if (cached) return cached;

  try {
    const pool = getIxWikiPool();

    const [rows] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        cl_to AS name,
        COUNT(*) AS pageCount
      FROM categorylinks
      GROUP BY cl_to
      ORDER BY pageCount DESC
      LIMIT 500
    `);

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

    cacheSet(cacheKey, result, 60 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("[WikiBridge] Category tree query failed:", (err as Error).message);
    return [];
  }
}
