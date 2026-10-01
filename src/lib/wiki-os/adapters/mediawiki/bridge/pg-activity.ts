/**
 * pg-activity.ts — ixwiki recent changes, page history, user contributions and user info.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { cleanExcerpt, calculateRawTextBytes } from "~/lib/wiki-os/transformers/wikitext-parser";
import { fetchMediaWikiPageAuthorsAndRevisions } from "./http-reader";
import type { WikiRecentChange } from "./types";

// ---------------------------------------------------------------------------
// Activity, Contributions & History
// ---------------------------------------------------------------------------

export async function ixwikiRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  try {
    const revs: any[] = await (db as any).wikiRevision.findMany({
      where: {
        source: "ixwiki",
        article: { namespace: 0, status: "PUBLISHED" },
        author: { notIn: ["LorewardsBot", "Maintenance script", "Robot"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        article: {
          select: {
            title: true,
            summary: true,
            leadImageUrl: true,
            wikitext: true,
          },
        },
      },
    });

    if (revs.length > 0) {
      return revs
        .filter((r) => r.article?.title)
        .map((r) => {
          const blurb = cleanExcerpt(r.wikitext || r.article.wikitext || r.article.summary, 180);
          const rawSize = calculateRawTextBytes(r.wikitext || r.article.wikitext);
          const delta = r.byteDelta !== 0 ? r.byteDelta : rawSize;
          const oldLen = Math.max(0, rawSize - delta);
          const newLen = rawSize;

          return {
            title: r.article.title,
            user: r.author || "MediaWiki Editor",
            timestamp: new Date(r.createdAt).toISOString(),
            comment: r.summary || "",
            type: r.minor ? "edit" : "edit",
            oldLen,
            newLen,
            blurb: blurb || null,
            thumbnail: r.article.leadImageUrl || null,
            parked: r.parked === true,
          };
        });
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  // Live HTTP Fallback
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      list: "recentchanges",
      rcnamespace: "0",
      rcprop: "title|user|timestamp|comment|sizes|flags",
      rclimit: String(limit),
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const changes = data?.query?.recentchanges || [];
      return changes.map((rc: any) => ({
        title: rc.title,
        user: rc.user,
        timestamp: rc.timestamp,
        comment: rc.comment || "",
        type: rc.type === "new" ? "new" : "edit",
        oldLen: rc.oldlen || 0,
        newLen: rc.newlen || 0,
      }));
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

export async function ixwikiGetHistory(
  title: string,
  limit: number = 50,
  _offset?: number
): Promise<
  Array<{
    rev_id: number;
    rev_timestamp: string;
    rev_user_text: string;
    rev_comment: string;
    rev_len: number;
    rev_minor_edit: number;
    diff: number;
    /** A MediaWiki edit that did not go live (conflict): in the history, never the page's text. */
    parked: boolean;
  }>
> {
  try {
    const revs: any[] = await (db as any).wikiRevision.findMany({
      where: {
        article: {
          source: "ixwiki",
          OR: [{ title }, { slug: toArticleSlug(title) }],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        mwRevId: true,
        author: true,
        summary: true,
        byteSize: true,
        byteDelta: true,
        minor: true,
        parked: true,
        createdAt: true,
      },
    });

    if (revs.length > 1) {
      return revs.map((r) => ({
        rev_id: r.mwRevId || 0,
        rev_timestamp: new Date(r.createdAt).toISOString(),
        rev_user_text: r.author || "MediaWiki Editor",
        rev_comment: r.summary || "",
        rev_len: r.byteSize || 0,
        rev_minor_edit: r.minor ? 1 : 0,
        diff: r.byteDelta || 0,
        parked: r.parked === true,
      }));
    }

    // If PostgreSQL only has 0 or 1 revision (e.g. from single-revision sync), fetch full history from MediaWiki
    const mwData = await fetchMediaWikiPageAuthorsAndRevisions(title, "ixwiki", limit);
    if (mwData && mwData.revisions.length > 0) {
      return mwData.revisions.map((r: any) => ({
        rev_id: r.revid,
        rev_timestamp: r.timestamp,
        rev_user_text: r.user,
        rev_comment: r.comment,
        rev_len: r.size,
        rev_minor_edit: 0,
        diff: 0,
        parked: false,
      }));
    }

    if (revs.length === 1) {
      const r = revs[0];
      return [
        {
          rev_id: r.mwRevId || 0,
          rev_timestamp: new Date(r.createdAt).toISOString(),
          rev_user_text: r.author || "MediaWiki Editor",
          rev_comment: r.summary || "",
          rev_len: r.byteSize || 0,
          rev_minor_edit: r.minor ? 1 : 0,
          diff: r.byteDelta || 0,
          parked: r.parked === true,
        },
      ];
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

export interface UserContribution {
  rev_id: number;
  page_title: string;
  page_namespace: number;
  rev_timestamp: string;
  rev_len: number;
  diff: number;
  rev_comment: string;
  rev_minor_edit: number;
  is_new: boolean;
  /** A MediaWiki edit that did not go live (conflict): the user's, listed, never the page's text. */
  parked: boolean;
}

export async function ixwikiGetUserContribs(
  username: string,
  limit: number = 50,
  _offset?: number,
  namespace: number = 0
): Promise<UserContribution[]> {
  const results: UserContribution[] = [];

  // 1. Live MediaWiki Action API HTTP
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      list: "usercontribs",
      ucuser: username,
      ucnamespace: String(namespace),
      uclimit: String(Math.min(100, limit)),
      ucprop: "ids|title|timestamp|comment|size|flags",
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const contribs = data?.query?.usercontribs || [];
      for (const c of contribs) {
        results.push({
          rev_id: Number(c.revid || 0),
          page_title: String(c.title || "").replace(/_/g, " "),
          page_namespace: Number(c.ns ?? 0),
          rev_timestamp: String(c.timestamp || new Date().toISOString()),
          rev_len: Number(c.size || 0),
          diff: Number(c.sizediff || 0),
          rev_comment: String(c.comment || ""),
          rev_minor_edit: c.minor !== undefined ? 1 : 0,
          is_new: c.new !== undefined,
          parked: false,
        });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  // 2. Merge PostgreSQL revisions
  try {
    const pgRevs: any[] = await (db as any).wikiRevision.findMany({
      where: {
        author: { equals: username, mode: "insensitive" },
        article: { namespace, status: "PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        article: {
          select: { title: true, namespace: true },
        },
      },
    });

    // MediaWiki lists every edit its editor made, parked ones too: WikiOS knows which never went live.
    const parkedRevIds = new Set<number>(
      pgRevs.filter((r) => r.parked === true && r.mwRevId).map((r) => Number(r.mwRevId))
    );
    for (const result of results) {
      if (parkedRevIds.has(result.rev_id)) result.parked = true;
    }

    for (const r of pgRevs) {
      const title = r.article?.title || "Untitled";
      const revId = Number(r.mwRevId || 0);
      if (!results.some((existing) => existing.rev_id === revId && revId > 0)) {
        results.push({
          rev_id: revId,
          page_title: title,
          page_namespace: Number(r.article?.namespace || 0),
          rev_timestamp: new Date(r.createdAt).toISOString(),
          rev_len: Number(r.byteSize || 0),
          diff: Number(r.byteDelta || 0),
          rev_comment: String(r.summary || ""),
          rev_minor_edit: r.minor ? 1 : 0,
          is_new: Number(r.byteSize || 0) === Number(r.byteDelta || 0),
          parked: r.parked === true,
        });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  results.sort((a, b) => new Date(b.rev_timestamp).getTime() - new Date(a.rev_timestamp).getTime());
  return results.slice(0, limit);
}

export async function ixwikiGetUserCreatedPages(
  username: string,
  limit: number = 100
): Promise<
  Array<{
    title: string;
    namespace: number;
    createdAt: string;
    byteSize: number;
  }>
> {
  const pagesMap = new Map<
    string,
    { title: string; namespace: number; createdAt: string; byteSize: number }
  >();

  // 1. Live MediaWiki Action API HTTP (new creations)
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      list: "usercontribs",
      ucuser: username,
      ucnamespace: "0",
      ucshow: "new",
      uclimit: String(Math.min(200, limit)),
      ucprop: "title|timestamp|size",
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const contribs = data?.query?.usercontribs || [];
      for (const c of contribs) {
        const title = String(c.title || "").replace(/_/g, " ");
        pagesMap.set(title.toLowerCase(), {
          title,
          namespace: Number(c.ns ?? 0),
          createdAt: String(c.timestamp || new Date().toISOString()),
          byteSize: Number(c.size || 0),
        });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  // 2. Merge PostgreSQL created articles
  try {
    const createdArticles: any[] = await (db as any).wikiArticle.findMany({
      where: {
        source: "ixwiki",
        status: "PUBLISHED",
        revisions: {
          some: {
            author: { equals: username, mode: "insensitive" },
          },
        },
      },
      take: limit,
      select: {
        title: true,
        namespace: true,
        createdAt: true,
        wordCount: true,
      },
    });

    for (const a of createdArticles) {
      const key = a.title.toLowerCase();
      if (!pagesMap.has(key)) {
        pagesMap.set(key, {
          title: a.title,
          namespace: a.namespace || 0,
          createdAt: new Date(a.createdAt).toISOString(),
          byteSize: (a.wordCount || 0) * 6,
        });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return Array.from(pagesMap.values()).slice(0, limit);
}

export interface IxwikiUserInfo {
  exists: boolean;
  userId: number;
  username: string;
  editCount: number;
  registration: string | null;
  groups: string[];
  user_id: number;
  user_name: string;
  user_editcount: number;
  user_registration: string;
}

/** Live MediaWiki Action API read: the only source of a real user id, edit count and groups. */
async function fetchLiveUserInfo(cleanUser: string): Promise<IxwikiUserInfo | null> {
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      list: "users",
      ususers: cleanUser,
      usprop: "editcount|registration|groups",
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const u = data?.query?.users?.[0];
      if (u && !u.missing) {
        const canonicalName = u.name || cleanUser;
        const totalEdits = Number(u.editcount || 0);
        const regDate: string | null = u.registration || null;
        const groups = Array.isArray(u.groups) ? u.groups : [];

        return {
          exists: true,
          userId: Number(u.userid || 0),
          username: canonicalName,
          editCount: totalEdits,
          registration: regDate,
          groups,
          user_id: Number(u.userid || 0),
          user_name: canonicalName,
          user_editcount: totalEdits,
          user_registration: regDate ?? "",
        };
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return null;
}

/**
 * MediaWiki user info. Real data (id, edit count, groups) comes only from the live MediaWiki API. When the wiki
 * cannot be reached but IxStats has mirrored activity for the name, the user is reported as existing with
 * `userId: 0`, `editCount: 0` and no groups: "unknown", never an estimate or a made-up id.
 */
export async function ixwikiGetUserInfo(username: string): Promise<IxwikiUserInfo | null> {
  const cleanUser = decodeURIComponent(username).replace(/^@/, "").trim();
  if (!cleanUser) return null;

  const live = await fetchLiveUserInfo(cleanUser);
  if (live) return live;

  // Local mirror: proves the name is known (revisions / Lorewards stats) but not its edit count or id.
  try {
    const [revCount, stats, firstRev] = await Promise.all([
      (db as any).wikiRevision.count({
        where: { author: { equals: cleanUser, mode: "insensitive" } },
      }),
      (db as any).lorewardUserStats.findFirst({
        where: { username: { equals: cleanUser, mode: "insensitive" } },
        select: { username: true },
      }),
      (db as any).wikiRevision.findFirst({
        where: { author: { equals: cleanUser, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { author: true },
      }),
    ]);

    if (revCount > 0 || stats) {
      const canonicalName = firstRev?.author || stats?.username || cleanUser;
      return {
        exists: true,
        userId: 0,
        username: canonicalName,
        editCount: 0,
        registration: null,
        groups: [],
        user_id: 0,
        user_name: canonicalName,
        user_editcount: 0,
        user_registration: "",
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return {
    exists: false,
    userId: 0,
    username: cleanUser,
    editCount: 0,
    registration: null,
    groups: [],
    user_id: 0,
    user_name: cleanUser,
    user_editcount: 0,
    user_registration: "",
  };
}
