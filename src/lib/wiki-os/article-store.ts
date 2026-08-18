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
      titles: title,
      rvprop: "content|ids|timestamp",
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
    return await db.wikiArticle.findUnique({ where: { source_title: { source, title } } });
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
    await db.wikiArticle.upsert({
      where: { source_title: { source, title } },
      create: { source, title, wikitext, revisionId: revid, revTimestamp: timestamp },
      update: { wikitext, revisionId: revid, revTimestamp: timestamp, syncedAt: new Date() },
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
        await db.wikiArticle.delete({ where: { id: existing.id } }).catch(() => undefined);
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
  title: string,
  source: WikiSource = "ixwiki"
): Promise<{ html: string; revid: number | null; timestamp: string | null } | null> {
  const norm = normalize(title);
  const row = (await shadowGet(source, norm)) as unknown as {
    htmlContent?: string | null;
    htmlSyncedAt?: Date | null;
    revisionId: number | null;
    revTimestamp: string | null;
  } | null;

  if (row && row.htmlContent) {
    const isFresh =
      row.htmlSyncedAt && Date.now() - new Date(row.htmlSyncedAt).getTime() < 60 * 60 * 1000;
    if (isFresh) {
      return {
        html: row.htmlContent,
        revid: row.revisionId,
        timestamp: row.revTimestamp,
      };
    }
  }
  return null;
}

/**
 * Cache transformed Parsoid HTML in Postgres shadow store (Phase 8).
 */
export async function saveArticleHtmlShadow(
  title: string,
  html: string,
  source: WikiSource = "ixwiki"
): Promise<void> {
  const norm = normalize(title);
  try {
    await (db.wikiArticle.updateMany as Function)({
      where: { source, title: norm },
      data: { htmlContent: html, htmlSyncedAt: new Date() },
    });
  } catch {
    /* best-effort */
  }
}

/** Drop the shadow copy after an edit so the next read re-pulls from MediaWiki. */
export async function invalidateArticleShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<void> {
  try {
    await (db.wikiArticle.updateMany as Function)({
      where: { source, title: normalize(title) },
      data: { htmlContent: null, htmlSyncedAt: null },
    });
  } catch {
    /* best-effort */
  }
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
      include: { article: { select: { title: true } } },
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
