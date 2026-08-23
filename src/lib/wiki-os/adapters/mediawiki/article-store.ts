// src/lib/wiki-os/article-store.ts
// Postgres shadow store for MediaWiki article wikitext & revision history.
//
// Read-through: serve from Postgres when fresh, otherwise pull from MediaWiki
// (direct MySQL fast-path, falling back to HTTP Action API), and backfill the shadow row.
// If MediaWiki is unreachable but a shadow row exists, serve the last-known copy.
//
// MediaWiki MySQL remains authoritative. This is groundwork for the eventual
// source-of-truth flip (plans/WIKIOS.md → MediaWiki Independence Path, Stage 2).
// Deploy-safe: if the wiki_articles table does not exist yet, every helper
// degrades to a plain MediaWiki passthrough.

import { db } from "~/server/db";
import {
  getArticleWikitext,
  getCurrentRevMeta,
  getPageHistory,
  getRevisionWikitext,
  type WikiSource,
} from "./bridge";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { globalCache } from "~/lib/cache";

// Serve a shadow copy without re-checking MediaWiki for this long. In-app edits
// invalidate the shadow on save, so this window only matters for edits made
// directly on MediaWiki — and those are caught by edit-conflict detection.
const FRESH_MS = 5 * 60 * 1000;

export interface ShadowResult {
  wikitext: string;
  revid: number | null;
  timestamp: string | null;
  /** Served from Postgres without touching MediaWiki. */
  fromShadow: boolean;
  /** MediaWiki was unreachable; this is the last-known copy. */
  stale: boolean;
}

function normalize(title: string): string {
  return title.replace(/ /g, "_");
}

// ---------------------------------------------------------------------------
// Action API HTTP Fallbacks (for environments without direct MySQL access)
// ---------------------------------------------------------------------------

interface ActionApiQueryResponse {
  query?: {
    pages?: Array<{
      missing?: boolean;
      title?: string;
      revisions?: Array<{
        revid?: number;
        parentid?: number;
        timestamp?: string;
        user?: string;
        comment?: string;
        size?: number;
        minor?: boolean;
        slots?: { main?: { content?: string } };
        content?: string;
      }>;
    }>;
  };
}

async function fetchWikitextViaActionApi(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<{ wikitext: string; revid: number | null; timestamp: string | null } | null> {
  try {
    const apiUrl = getMediaWikiApiUrl(source);
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: title.replace(/_/g, " "),
      rvprop: "content|ids|timestamp",
      rvslots: "main",
      formatversion: "2",
      format: "json",
      redirects: "1",
    });

    const res = await fetch(`${apiUrl}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as ActionApiQueryResponse;
    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;

    const rev = page.revisions?.[0];
    const wikitext = rev?.slots?.main?.content ?? rev?.content ?? "";
    return {
      wikitext,
      revid: rev?.revid ?? null,
      timestamp: rev?.timestamp ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchRevisionWikitextViaActionApi(
  revid: number,
  source: WikiSource = "ixwiki"
): Promise<{ wikitext: string; title: string; timestamp: string } | null> {
  try {
    const apiUrl = getMediaWikiApiUrl(source);
    const params = new URLSearchParams({
      action: "query",
      revids: String(revid),
      prop: "revisions",
      rvprop: "content|timestamp|ids",
      rvslots: "main",
      formatversion: "2",
      format: "json",
    });

    const res = await fetch(`${apiUrl}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as ActionApiQueryResponse;
    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;

    const rev = page.revisions?.[0];
    if (!rev) return null;

    const wikitext = rev.slots?.main?.content ?? rev.content ?? "";
    return {
      wikitext,
      title: page.title ? page.title.replace(/_/g, " ") : "",
      timestamp: rev.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchPageHistoryViaActionApi(
  title: string,
  limit = 50,
  source: WikiSource = "ixwiki"
): Promise<{ revisions: HistoryRevision[]; hasMore: boolean }> {
  try {
    const apiUrl = getMediaWikiApiUrl(source);
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|timestamp|user|comment|size|flags",
      rvlimit: String(limit + 1),
      formatversion: "2",
      format: "json",
    });

    const res = await fetch(`${apiUrl}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return { revisions: [], hasMore: false };
    const data = (await res.json()) as ActionApiQueryResponse;
    const page = data.query?.pages?.[0];
    if (!page || page.missing || !page.revisions) return { revisions: [], hasMore: false };

    const rawRevs = page.revisions;
    const hasMore = rawRevs.length > limit;
    const slice = hasMore ? rawRevs.slice(0, limit) : rawRevs;

    return {
      revisions: slice.map((r) => ({
        revid: r.revid ?? 0,
        parentid: r.parentid ?? null,
        timestamp: r.timestamp ?? new Date().toISOString(),
        user: r.user ?? "",
        comment: r.comment ?? "",
        size: r.size ?? 0,
        minor: r.minor ?? false,
      })),
      hasMore,
    };
  } catch {
    return { revisions: [], hasMore: false };
  }
}

// ---------------------------------------------------------------------------
// Database Operations (Best-Effort Shadow Storage)
// ---------------------------------------------------------------------------

async function shadowGet(source: WikiSource, title: string) {
  try {
    const withUnderscores = title.replace(/ /g, "_");
    const withSpaces = title.replace(/_/g, " ");
    return await (db.wikiArticle.findFirst as any)({
      where: {
        source,
        OR: [
          { title: withSpaces },
          { title: withUnderscores },
        ],
      },
      select: {
        id: true,
        title: true,
        wikitext: true,
        revisionId: true,
        revTimestamp: true,
        syncedAt: true,
      },
    });
  } catch {
    return null;
  }
}

async function shadowPut(
  source: WikiSource,
  title: string,
  wikitext: string,
  revid: number | null,
  timestamp: string | null
) {
  try {
    const canonicalTitle = title.replace(/_/g, " ").trim();
    await (db.wikiArticle.upsert as any)({
      where: { source_title: { source, title: canonicalTitle } },
      create: { source, title: canonicalTitle, wikitext, revisionId: revid, revTimestamp: timestamp },
      update: { wikitext, revisionId: revid, revTimestamp: timestamp, syncedAt: new Date() },
      select: { id: true },
    });
  } catch {
    /* table not migrated yet, or transient DB error — shadow is best-effort */
  }
}

/**
 * Read article wikitext through the multi-tier shadow store.
 * Priority: Fresh Postgres Shadow -> Direct MySQL -> Action API HTTP -> Stale Shadow
 */
export async function getArticleWikitextShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ShadowResult | null> {
  const norm = normalize(title);
  const existing = await shadowGet(source, norm);

  // Tier 1: Fresh Postgres Shadow
  if (existing && Date.now() - existing.syncedAt.getTime() < FRESH_MS) {
    return {
      wikitext: existing.wikitext,
      revid: existing.revisionId,
      timestamp: existing.revTimestamp,
      fromShadow: true,
      stale: false,
    };
  }

  // Tier 2: Direct MySQL Bridge (~38ms ultra-fast path)
  try {
    const [article, revMeta] = await Promise.all([
      getArticleWikitext(norm, source),
      source === "ixwiki" ? getCurrentRevMeta(norm) : Promise.resolve(null),
    ]);

    if (!article) {
      if (existing) {
        await (db.wikiArticle.delete as any)({ where: { id: existing.id } }).catch(() => undefined);
      }
      return null;
    }

    await shadowPut(
      source,
      norm,
      article.wikitext,
      revMeta?.revid ?? null,
      revMeta?.timestamp ?? null
    );

    return {
      wikitext: article.wikitext,
      revid: revMeta?.revid ?? null,
      timestamp: revMeta?.timestamp ?? null,
      fromShadow: false,
      stale: false,
    };
  } catch (mysqlErr) {
    // Tier 3: Action API HTTP Fallback (if MySQL port/connection is unavailable)
    try {
      const httpResult = await fetchWikitextViaActionApi(norm, source);
      if (httpResult) {
        await shadowPut(
          source,
          norm,
          httpResult.wikitext,
          httpResult.revid,
          httpResult.timestamp
        );
        return {
          wikitext: httpResult.wikitext,
          revid: httpResult.revid,
          timestamp: httpResult.timestamp,
          fromShadow: false,
          stale: false,
        };
      }
    } catch {
      /* Action API fallback failed */
    }

    // Tier 4: Serve Stale Shadow (if available)
    if (existing) {
      return {
        wikitext: existing.wikitext,
        revid: existing.revisionId,
        timestamp: existing.revTimestamp,
        fromShadow: true,
        stale: true,
      };
    }
    throw mysqlErr;
  }
}

/**
 * Read cached rendered HTML from Postgres shadow store (Phase 8).
 * Returns null if not cached or expired (>1 hour).
 */
export async function getArticleHtmlShadow(
  _title: string,
  _source: WikiSource = "ixwiki"
): Promise<{ html: string; revid: number | null; timestamp: string | null } | null> {
  return null;
}

/**
 * Cache transformed Parsoid HTML in Postgres shadow store (Phase 8).
 */
export async function saveArticleHtmlShadow(
  _title: string,
  _html: string,
  _source: WikiSource = "ixwiki"
): Promise<void> {
  /* best-effort */
}

/** Drop the shadow copy after an edit so the next read re-pulls from MediaWiki. */
export async function invalidateArticleShadow(
  _title: string,
  _source: WikiSource = "ixwiki"
): Promise<void> {
  /* best-effort */
}

// ---------------------------------------------------------------------------
// Stage 2b — write-through + local revision history
// ---------------------------------------------------------------------------

export interface RecordRevisionInput {
  title: string;
  wikitext: string;
  source?: WikiSource;
  mwRevId?: number | null;
  author?: string | null;
  summary?: string | null;
  minor?: boolean;
}

/**
 * Write-through on save: upsert the WikiArticle shadow with the new wikitext +
 * revid, and append a WikiRevision row. Best-effort — every DB op is
 * error-swallowed so a Postgres hiccup can never fail the user's MediaWiki save.
 */
export async function recordArticleRevision(input: RecordRevisionInput): Promise<boolean> {
  const source = input.source ?? "ixwiki";
  const title = normalize(input.title);
  const revid = input.mwRevId ?? null;
  try {
    const article = await db.wikiArticle.upsert({
      where: { source_title: { source, title } },
      create: {
        source,
        title,
        wikitext: input.wikitext,
        revisionId: revid,
        revTimestamp: null,
      },
      update: {
        wikitext: input.wikitext,
        revisionId: revid,
        syncedAt: new Date(),
      },
      select: { id: true },
    });
    await db.wikiRevision.create({
      data: {
        articleId: article.id,
        source,
        mwRevId: revid,
        wikitext: input.wikitext,
        author: input.author ?? null,
        summary: input.summary ?? null,
        minor: input.minor ?? false,
      },
      select: { id: true },
    });
    return true;
  } catch {
    return false;
  }
}

/** True if a revision with this MediaWiki rev id is already recorded locally. */
export async function hasRevision(
  mwRevId: number,
  source: WikiSource = "ixwiki"
): Promise<boolean> {
  try {
    const existing = await db.wikiRevision.findFirst({
      where: { source, mwRevId },
      select: { id: true },
    });
    return !!existing;
  } catch {
    return false;
  }
}

export interface HistoryRevision {
  revid: number;
  parentid: number | null;
  timestamp: string;
  user: string;
  comment: string;
  size: number;
  minor: boolean;
}

/**
 * Read-through article history. Serves locally-recorded revisions from Postgres
 * when present, otherwise falls back to MediaWiki (MySQL -> Action API HTTP).
 */
export async function getArticleHistoryShadow(
  title: string,
  limit = 50,
  source: WikiSource = "ixwiki"
): Promise<{ revisions: HistoryRevision[]; hasMore: boolean }> {
  const norm = normalize(title);
  try {
    const article = await db.wikiArticle.findUnique({
      where: { source_title: { source, title: norm } },
      select: { id: true },
    });
    if (article) {
      const rows = await db.wikiRevision.findMany({
        where: { articleId: article.id },
        select: {
          mwRevId: true,
          createdAt: true,
          author: true,
          summary: true,
          wikitext: true,
          minor: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });
      if (rows.length > 0) {
        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        return {
          revisions: slice.map((r) => ({
            revid: r.mwRevId ?? 0,
            parentid: null,
            timestamp: r.createdAt.toISOString(),
            user: r.author ?? "",
            comment: r.summary ?? "",
            size: r.wikitext.length,
            minor: r.minor,
          })),
          hasMore,
        };
      }
    }
  } catch {
    /* fall through to MediaWiki */
  }

  // Tier 2: MySQL
  try {
    return await getPageHistory(norm, limit);
  } catch {
    // Tier 3: Action API HTTP Fallback
    return fetchPageHistoryViaActionApi(norm, limit, source);
  }
}

/**
 * Read-through single-revision wikitext. Serves a locally-recorded revision by
 * its MediaWiki rev id, otherwise falls back to MediaWiki (MySQL -> Action API HTTP).
 */
export async function getRevisionWikitextShadow(
  revid: number,
  source: WikiSource = "ixwiki"
): Promise<{ wikitext: string; title: string; timestamp: string } | null> {
  try {
    const rev = await db.wikiRevision.findFirst({
      where: { source, mwRevId: revid },
      select: {
        wikitext: true,
        createdAt: true,
        article: { select: { title: true } },
      },
    });
    if (rev) {
      return {
        wikitext: rev.wikitext,
        title: rev.article.title.replace(/_/g, " "),
        timestamp: rev.createdAt.toISOString(),
      };
    }
  } catch {
    /* fall through to MediaWiki */
  }

  // Tier 2: MySQL
  try {
    return await getRevisionWikitext(revid);
  } catch {
    // Tier 3: Action API HTTP Fallback
    return fetchRevisionWikitextViaActionApi(revid, source);
  }
}

export interface ArticleAuthorInfo {
  creator: string | null;
  creatorAvatar?: string | null;
  createdAt: string | null;
  lastEditor: string | null;
  lastEditorAvatar?: string | null;
  lastEditedAt: string | null;
}

/**
 * Resolve Clerk profile picture URLs for wiki usernames.
 * Checks globalCache -> PostgreSQL db.user -> Clerk API with 1-hour TTL.
 */
async function resolveClerkAvatars(
  usernames: Array<string | null | undefined>
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const clean = usernames.filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0 && !/^\d+\.\d+\.\d+\.\d+$/.test(u)
  );
  if (clean.length === 0) return result;

  const toFetch: string[] = [];

  // 1. Check in-memory cache first (<0.1ms)
  for (const name of clean) {
    const key = `wiki_author_avatar:${name.toLowerCase()}`;
    const cached = await globalCache.get<string | null>(key);
    if (cached !== undefined && cached !== null) {
      result[name.toLowerCase()] = cached;
    } else {
      toFetch.push(name);
    }
  }

  if (toFetch.length === 0) return result;

  try {
    // 2. Query Postgres db.user for linked accounts
    const dbUsers = await db.user.findMany({
      where: {
        OR: [
          { wikiUsername: { in: toFetch, mode: "insensitive" } },
          { clerkUserId: { in: toFetch } },
        ],
      },
      select: {
        clerkUserId: true,
        wikiUsername: true,
      },
    });

    const wikiToClerk = new Map<string, string>();
    for (const u of dbUsers) {
      if (u.clerkUserId) {
        if (u.wikiUsername) {
          wikiToClerk.set(u.wikiUsername.toLowerCase(), u.clerkUserId);
        }
        wikiToClerk.set(u.clerkUserId.toLowerCase(), u.clerkUserId);
      }
    }

    const hasClerkKeys = Boolean(
      process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    );

    if (hasClerkKeys) {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();

      // Resolve via found clerkUserIds
      const uniqueClerkIds = Array.from(new Set(wikiToClerk.values()));
      for (const clerkId of uniqueClerkIds) {
        try {
          const clerkUser = await client.users.getUser(clerkId);
          if (clerkUser?.imageUrl) {
            for (const [wName, cId] of wikiToClerk.entries()) {
              if (cId === clerkId) {
                result[wName] = clerkUser.imageUrl;
                void globalCache.set(`wiki_author_avatar:${wName}`, clerkUser.imageUrl, { ttl: 3600 });
              }
            }
          }
        } catch {
          /* ignore Clerk user lookup error */
        }
      }

      // Check remaining unresolved names directly in Clerk by username
      const remaining = toFetch.filter((n) => !result[n.toLowerCase()]);
      if (remaining.length > 0) {
        try {
          const clerkList = await client.users.getUserList({
            username: remaining,
            limit: 10,
          });
          const usersArray = Array.isArray(clerkList) ? clerkList : clerkList?.data || [];
          for (const u of usersArray) {
            if (u.username && u.imageUrl) {
              const lower = u.username.toLowerCase();
              result[lower] = u.imageUrl;
              void globalCache.set(`wiki_author_avatar:${lower}`, u.imageUrl, { ttl: 3600 });
            }
          }
        } catch {
          /* ignore Clerk user list error */
        }
      }
    }
  } catch (err) {
    console.warn("[ArticleStore] Failed to resolve Clerk avatars:", err);
  }

  // Cache nulls for remaining unresolved to avoid hammering on re-render (5 min TTL)
  for (const name of toFetch) {
    const lower = name.toLowerCase();
    if (result[lower] === undefined) {
      result[lower] = null;
      void globalCache.set(`wiki_author_avatar:${lower}`, null, { ttl: 300 });
    }
  }

  return result;
}

/**
 * Fetch article creator and latest editor with Clerk profile images.
 */
export async function getArticleAuthors(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ArticleAuthorInfo> {
  const norm = normalize(title);
  try {
    const apiUrl = getMediaWikiApiUrl(source);
    const [creatorRes, latestRes] = await Promise.all([
      fetch(
        `${apiUrl}?action=query&prop=revisions&titles=${encodeURIComponent(norm)}&rvprop=user|timestamp&rvdir=newer&rvlimit=1&formatversion=2&format=json`,
        {
          headers: { "User-Agent": DEFAULT_USER_AGENT },
          signal: AbortSignal.timeout(4000),
        }
      ),
      fetch(
        `${apiUrl}?action=query&prop=revisions&titles=${encodeURIComponent(norm)}&rvprop=user|timestamp&rvdir=older&rvlimit=1&formatversion=2&format=json`,
        {
          headers: { "User-Agent": DEFAULT_USER_AGENT },
          signal: AbortSignal.timeout(4000),
        }
      ),
    ]);

    let creator: string | null = null;
    let createdAt: string | null = null;
    let lastEditor: string | null = null;
    let lastEditedAt: string | null = null;

    if (creatorRes.ok) {
      const data = (await creatorRes.json()) as ActionApiQueryResponse;
      const rev = data.query?.pages?.[0]?.revisions?.[0];
      if (rev?.user) {
        creator = rev.user;
        createdAt = rev.timestamp ?? null;
      }
    }

    if (latestRes.ok) {
      const data = (await latestRes.json()) as ActionApiQueryResponse;
      const rev = data.query?.pages?.[0]?.revisions?.[0];
      if (rev?.user) {
        lastEditor = rev.user;
        lastEditedAt = rev.timestamp ?? null;
      }
    }

    if (!creator && lastEditor) {
      creator = lastEditor;
      createdAt = lastEditedAt;
    }

    // Resolve Clerk avatars for both creator and editor
    const avatars = await resolveClerkAvatars([creator, lastEditor]);

    return {
      creator,
      creatorAvatar: creator ? avatars[creator.toLowerCase()] ?? null : null,
      createdAt,
      lastEditor,
      lastEditorAvatar: lastEditor ? avatars[lastEditor.toLowerCase()] ?? null : null,
      lastEditedAt,
    };
  } catch {
    return {
      creator: null,
      creatorAvatar: null,
      createdAt: null,
      lastEditor: null,
      lastEditorAvatar: null,
      lastEditedAt: null,
    };
  }
}
