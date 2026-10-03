/**
 * pg-activity.ts — ixwiki recent changes, page history, user contributions and user info.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { cleanExcerpt, calculateRawTextBytes } from "~/lib/wiki-os/transformers/wikitext-parser";
import { fetchIxwikiLive, fetchMediaWikiPageAuthorsAndRevisions } from "./http-reader";
import { warnDev, type WikiRecentChange } from "./types";

const BOT_AUTHORS = ["LorewardsBot", "Maintenance script", "Robot"];
const UNKNOWN_EDITOR = "MediaWiki Editor";

export async function ixwikiRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  try {
    const revs: any[] = await (db as any).wikiRevision.findMany({
      where: {
        source: "ixwiki",
        article: { namespace: 0 },
        author: { notIn: BOT_AUTHORS },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        article: {
          select: { title: true, summary: true, leadImageUrl: true, wikitext: true },
        },
      },
    });

    if (revs.length > 0) {
      return revs
        .filter((r) => r.article?.title)
        .map((r) => {
          const wikitext = r.wikitext || r.article.wikitext;
          const blurb = cleanExcerpt(wikitext || r.article.summary, 180);
          const newLen = calculateRawTextBytes(wikitext);
          const delta = r.byteDelta !== 0 ? r.byteDelta : newLen;

          return {
            title: r.article.title,
            user: r.author || UNKNOWN_EDITOR,
            timestamp: new Date(r.createdAt).toISOString(),
            comment: r.summary || "",
            type: "edit" as const,
            oldLen: Math.max(0, newLen - delta),
            newLen,
            blurb: blurb || null,
            thumbnail: r.article.leadImageUrl || null,
          };
        });
    }
  } catch (err) {
    warnDev(err);
  }

  // Live HTTP fallback
  try {
    const data = await fetchIxwikiLive<{ query?: { recentchanges?: any[] } }>(
      {
        action: "query",
        list: "recentchanges",
        rcnamespace: "0",
        rcprop: "title|user|timestamp|comment|sizes|flags",
        rclimit: String(limit),
      },
      6000
    );
    if (data) {
      return (data.query?.recentchanges || []).map((rc) => ({
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
    warnDev(err);
  }

  return [];
}

interface HistoryRow {
  rev_id: number;
  rev_timestamp: string;
  rev_user_text: string;
  rev_comment: string;
  rev_len: number;
  rev_minor_edit: number;
  diff: number;
}

const toHistoryRow = (r: any): HistoryRow => ({
  rev_id: r.mwRevId || 0,
  rev_timestamp: new Date(r.createdAt).toISOString(),
  rev_user_text: r.author || UNKNOWN_EDITOR,
  rev_comment: r.summary || "",
  rev_len: r.byteSize || 0,
  rev_minor_edit: r.minor ? 1 : 0,
  diff: r.byteDelta || 0,
});

export async function ixwikiGetHistory(
  title: string,
  limit: number = 50,
  _offset?: number
): Promise<HistoryRow[]> {
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
        createdAt: true,
      },
    });

    if (revs.length > 1) return revs.map(toHistoryRow);

    // With 0 or 1 PostgreSQL revisions (e.g. from a single-revision sync), MediaWiki has the full history.
    const mwData = await fetchMediaWikiPageAuthorsAndRevisions(title, "ixwiki", limit);
    if (mwData && mwData.revisions.length > 0) {
      return mwData.revisions.map((r) => ({
        rev_id: r.revid,
        rev_timestamp: r.timestamp,
        rev_user_text: r.user,
        rev_comment: r.comment,
        rev_len: r.size,
        rev_minor_edit: 0,
        diff: 0,
      }));
    }

    if (revs.length === 1) return [toHistoryRow(revs[0])];
  } catch (err) {
    warnDev(err);
  }

  return [];
}

interface UserContribution {
  rev_id: number;
  page_title: string;
  page_namespace: number;
  rev_timestamp: string;
  rev_len: number;
  diff: number;
  rev_comment: string;
  rev_minor_edit: number;
  is_new: boolean;
}

const liveContribToRow = (c: any): UserContribution => ({
  rev_id: Number(c.revid || 0),
  page_title: String(c.title || "").replace(/_/g, " "),
  page_namespace: Number(c.ns ?? 0),
  rev_timestamp: String(c.timestamp || new Date().toISOString()),
  rev_len: Number(c.size || 0),
  diff: Number(c.sizediff || 0),
  rev_comment: String(c.comment || ""),
  rev_minor_edit: c.minor !== undefined ? 1 : 0,
  is_new: c.new !== undefined,
});

const pgRevisionToContrib = (r: any): UserContribution => ({
  rev_id: Number(r.mwRevId || 0),
  page_title: r.article?.title || "Untitled",
  page_namespace: Number(r.article?.namespace || 0),
  rev_timestamp: new Date(r.createdAt).toISOString(),
  rev_len: Number(r.byteSize || 0),
  diff: Number(r.byteDelta || 0),
  rev_comment: String(r.summary || ""),
  rev_minor_edit: r.minor ? 1 : 0,
  is_new: Number(r.byteSize || 0) === Number(r.byteDelta || 0),
});

export async function ixwikiGetUserContribs(
  username: string,
  limit: number = 50,
  _offset?: number,
  namespace: number = 0
): Promise<UserContribution[]> {
  const results: UserContribution[] = [];

  // Live MediaWiki Action API
  try {
    const data = await fetchIxwikiLive<{ query?: { usercontribs?: any[] } }>(
      {
        action: "query",
        list: "usercontribs",
        ucuser: username,
        ucnamespace: String(namespace),
        uclimit: String(Math.min(100, limit)),
        ucprop: "ids|title|timestamp|comment|size|flags",
      },
      8000
    );
    results.push(...(data?.query?.usercontribs || []).map(liveContribToRow));
  } catch (err) {
    warnDev(err);
  }

  // Merge PostgreSQL revisions the live API did not return
  try {
    const pgRevs: any[] = await (db as any).wikiRevision.findMany({
      where: {
        author: { equals: username, mode: "insensitive" },
        article: { namespace },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { article: { select: { title: true, namespace: true } } },
    });

    for (const contrib of pgRevs.map(pgRevisionToContrib)) {
      const known = contrib.rev_id > 0 && results.some((e) => e.rev_id === contrib.rev_id);
      if (!known) results.push(contrib);
    }
  } catch (err) {
    warnDev(err);
  }

  results.sort((a, b) => new Date(b.rev_timestamp).getTime() - new Date(a.rev_timestamp).getTime());
  return results.slice(0, limit);
}

interface CreatedPage {
  title: string;
  namespace: number;
  createdAt: string;
  byteSize: number;
}

export async function ixwikiGetUserCreatedPages(
  username: string,
  limit: number = 100
): Promise<CreatedPage[]> {
  const pagesMap = new Map<string, CreatedPage>();

  // Live MediaWiki Action API (new creations)
  try {
    const data = await fetchIxwikiLive<{ query?: { usercontribs?: any[] } }>(
      {
        action: "query",
        list: "usercontribs",
        ucuser: username,
        ucnamespace: "0",
        ucshow: "new",
        uclimit: String(Math.min(200, limit)),
        ucprop: "title|timestamp|size",
      },
      8000
    );
    for (const c of data?.query?.usercontribs || []) {
      const title = String(c.title || "").replace(/_/g, " ");
      pagesMap.set(title.toLowerCase(), {
        title,
        namespace: Number(c.ns ?? 0),
        createdAt: String(c.timestamp || new Date().toISOString()),
        byteSize: Number(c.size || 0),
      });
    }
  } catch (err) {
    warnDev(err);
  }

  // Merge PostgreSQL created articles
  try {
    const createdArticles: any[] = await (db as any).wikiArticle.findMany({
      where: {
        source: "ixwiki",
        revisions: { some: { author: { equals: username, mode: "insensitive" } } },
      },
      take: limit,
      select: { title: true, namespace: true, createdAt: true, wordCount: true },
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
    warnDev(err);
  }

  return Array.from(pagesMap.values()).slice(0, limit);
}

interface IxwikiUserInfo {
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

function buildUserInfo(
  exists: boolean,
  username: string,
  { userId = 0, editCount = 0, registration = null, groups = [] }: Partial<IxwikiUserInfo> = {}
): IxwikiUserInfo {
  return {
    exists,
    userId,
    username,
    editCount,
    registration,
    groups,
    user_id: userId,
    user_name: username,
    user_editcount: editCount,
    user_registration: registration ?? "",
  };
}

/** Live MediaWiki Action API read: the only source of a real user id, edit count and groups. */
async function fetchLiveUserInfo(cleanUser: string): Promise<IxwikiUserInfo | null> {
  try {
    const data = await fetchIxwikiLive<{ query?: { users?: any[] } }>(
      {
        action: "query",
        list: "users",
        ususers: cleanUser,
        usprop: "editcount|registration|groups",
      },
      6000
    );
    const u = data?.query?.users?.[0];
    if (u && !u.missing) {
      return buildUserInfo(true, u.name || cleanUser, {
        userId: Number(u.userid || 0),
        editCount: Number(u.editcount || 0),
        registration: u.registration || null,
        groups: Array.isArray(u.groups) ? u.groups : [],
      });
    }
  } catch (err) {
    warnDev(err);
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
    const byName = { equals: cleanUser, mode: "insensitive" };
    const [revCount, stats, firstRev] = await Promise.all([
      (db as any).wikiRevision.count({ where: { author: byName } }),
      (db as any).lorewardUserStats.findFirst({
        where: { username: byName },
        select: { username: true },
      }),
      (db as any).wikiRevision.findFirst({
        where: { author: byName },
        orderBy: { createdAt: "asc" },
        select: { author: true },
      }),
    ]);

    if (revCount > 0 || stats) {
      return buildUserInfo(true, firstRev?.author || stats?.username || cleanUser);
    }
  } catch (err) {
    warnDev(err);
  }

  return buildUserInfo(false, cleanUser);
}
