// src/lib/wiki-os/article-store.ts
// Postgres shadow store for MediaWiki article wikitext.
//
// Read-through: serve from Postgres when fresh, otherwise pull from MediaWiki
// (wiki-bridge, direct MySQL) and backfill the shadow row. If MediaWiki is
// unreachable but a shadow row exists, serve the last-known copy — this is what
// lets WikiOS stay up when MediaWiki is down.
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
} from "~/lib/wiki/bridge";

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

// DB ops swallow errors (incl. missing table before migration) so the store
// degrades to a passthrough rather than breaking the read path.
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
 * Read article wikitext through the shadow store. Returns null if the page does
 * not exist on MediaWiki (and no shadow fallback applies).
 */
export async function getArticleWikitextShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ShadowResult | null> {
  const norm = normalize(title);
  const existing = await shadowGet(source, norm);

  if (existing && Date.now() - existing.syncedAt.getTime() < FRESH_MS) {
    return {
      wikitext: existing.wikitext,
      revid: existing.revisionId,
      timestamp: existing.revTimestamp,
      fromShadow: true,
      stale: false,
    };
  }

  try {
    const [article, revMeta] = await Promise.all([
      getArticleWikitext(norm, source),
      // Only ixwiki exposes revision metadata via wiki-bridge.
      source === "ixwiki" ? getCurrentRevMeta(norm) : Promise.resolve(null),
    ]);

    if (!article) {
      // Page gone from MediaWiki — drop any stale shadow so we never serve deleted content.
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
  } catch (err) {
    // MediaWiki unreachable — serve last-known shadow if we have one.
    if (existing) {
      return {
        wikitext: existing.wikitext,
        revid: existing.revisionId,
        timestamp: existing.revTimestamp,
        fromShadow: true,
        stale: true,
      };
    }
    throw err;
  }
}

/** Drop the shadow copy after an edit so the next read re-pulls from MediaWiki. */
export async function invalidateArticleShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<void> {
  try {
    await db.wikiArticle.deleteMany({ where: { source, title: normalize(title) } });
  } catch {
    /* best-effort */
  }
}

// ──────────────────────────────────────────────
// Stage 2b — write-through + local revision history
// ──────────────────────────────────────────────

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
 * Returns false if the write-through could not be completed (caller may fall
 * back to invalidating the shadow instead).
 */
export async function recordArticleRevision(input: RecordRevisionInput): Promise<boolean> {
  const source = input.source ?? "ixwiki";
  const title = normalize(input.title);
  const revid = input.mwRevId ?? null;
  try {
    const article = await db.wikiArticle.upsert({
      where: { source_title: { source, title } },
      create: { source, title, wikitext: input.wikitext, revisionId: revid, revTimestamp: null },
      update: { wikitext: input.wikitext, revisionId: revid, syncedAt: new Date() },
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
    // table not migrated yet, or transient DB error — shadow is best-effort
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
 * when present, otherwise falls back to MediaWiki (wiki-bridge MySQL). Keeps the
 * same shape as wiki-bridge's getPageHistory so callers don't change.
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
  return getPageHistory(norm, limit);
}

/**
 * Read-through single-revision wikitext. Serves a locally-recorded revision by
 * its MediaWiki rev id, otherwise falls back to MediaWiki (wiki-bridge MySQL).
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
  return getRevisionWikitext(revid);
}
