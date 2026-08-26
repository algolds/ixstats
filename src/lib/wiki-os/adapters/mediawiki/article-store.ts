/**
 * src/lib/wiki-os/adapters/mediawiki/article-store.ts — PostgreSQL Authoritative Read-Through Bridge
 *
 * Provides fast, unified access to WikiOS articles, revisions, and histories,
 * delegating directly to PostgreSQL ArticleRepository with fallback to MediaWiki bridge.
 */

import { db } from "~/server/db";
import { ArticleRepository } from "../../core/article-repository";
import { toArticleSlug, type WikiRevisionSummary } from "../../core/domain-types";
import {
  getArticleWikitext,
  getPageHistory,
  getRevisionWikitext,
  type WikiSource,
} from "./bridge";
import { fetchMediaWikiPageAuthorsAndRevisions } from "./bridge/http-reader";
import type { ArticleAuthorInfo } from "~/lib/wiki-os/types/canonical";

export type { ArticleAuthorInfo };

export interface ShadowResult {
  wikitext: string;
  revid: number | null;
  timestamp: string | null;
  fromShadow: boolean;
  stale: boolean;
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
 * Read article wikitext from PostgreSQL authoritative store, falling back to MediaWiki bridge.
 */
export async function getArticleWikitextShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ShadowResult | null> {
  // 1. Try PostgreSQL Authoritative Repository first (<2ms)
  const article = await ArticleRepository.findBySlug(title, source);
  if (article && article.wikitext) {
    return {
      wikitext: article.wikitext,
      revid: null,
      timestamp: article.updatedAt.toISOString(),
      fromShadow: true,
      stale: false,
    };
  }

  // 2. Direct MediaWiki SQL / HTTP fallback
  const direct = await getArticleWikitext(title, source);
  if (direct) {
    return {
      wikitext: direct.wikitext,
      revid: direct.pageId ?? null,
      timestamp: new Date().toISOString(),
      fromShadow: false,
      stale: false,
    };
  }

  return null;
}

/**
 * Read revision wikitext by revision ID.
 */
export async function getRevisionWikitextShadow(
  revid: number,
  title?: string,
  _source: WikiSource = "ixwiki"
): Promise<{ wikitext: string; title: string; timestamp: string; fromShadow: boolean } | null> {
  const direct = await getRevisionWikitext(revid);
  if (direct) {
    return {
      wikitext: direct,
      title: title || "",
      timestamp: new Date().toISOString(),
      fromShadow: false,
    };
  }
  return null;
}

/**
 * Fetch pre-rendered HTML from PostgreSQL
 */
export async function getArticleHtmlShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<{ html: string; timestamp?: string } | null> {
  const article = await ArticleRepository.findBySlug(title, source);
  if (article && article.contentHtml) {
    return {
      html: article.contentHtml,
      timestamp: article.updatedAt.toISOString(),
    };
  }
  return null;
}

/**
 * Save pre-rendered HTML to PostgreSQL article record
 */
export async function saveArticleHtmlShadow(
  title: string,
  html: string,
  source: WikiSource = "ixwiki"
): Promise<void> {
  try {
    const slug = toArticleSlug(title);
    await db.wikiArticle.updateMany({
      where: {
        source,
        OR: [{ slug }, { title: title.replace(/_/g, " ") }],
      },
      data: {
        contentHtml: html,
        updatedAt: new Date(),
      },
    });
  } catch {
    // Best-effort
  }
}

/**
 * Fetch revision history from PostgreSQL, falling back to MediaWiki.
 */
export async function getPageHistoryShadow(
  title: string,
  limit = 50,
  offset?: number,
  source: WikiSource = "ixwiki"
): Promise<{ revisions: HistoryRevision[]; hasMore: boolean; fromShadow: boolean }> {
  // 1. Check PostgreSQL revision records
  const pgRevs: WikiRevisionSummary[] = await ArticleRepository.getHistory(title, source, limit);
  if (pgRevs.length > 0) {
    return {
      revisions: pgRevs.map((r: WikiRevisionSummary, idx: number) => ({
        revid: idx + 1,
        parentid: null,
        timestamp: r.createdAt.toISOString(),
        user: r.author || "Wiki Contributor",
        comment: r.summary || "",
        size: r.byteSize || 0,
        minor: r.minor,
      })),
      hasMore: false,
      fromShadow: true,
    };
  }

  // 2. Fall back to MediaWiki
  const mwHistory = await getPageHistory(title, limit, offset);
  const revList = Array.isArray(mwHistory) ? mwHistory : (mwHistory as any)?.revisions ?? [];
  return {
    revisions: revList.map((r: any) => ({
      revid: r.rev_id || r.revid || 0,
      parentid: r.parentid ?? null,
      timestamp: r.rev_timestamp || r.timestamp || new Date().toISOString(),
      user: r.rev_user_text || r.user || "Wiki Contributor",
      comment: r.rev_comment || r.comment || "",
      size: r.rev_len || r.size || 0,
      minor: Boolean(r.rev_minor_edit ?? r.minor),
    })),
    hasMore: revList.length >= limit,
    fromShadow: false,
  };
}

/** Alias for getPageHistoryShadow */
export const getArticleHistoryShadow = getPageHistoryShadow;

/**
 * Get article authorship information (creator, last editor, top contributors)
 */
export async function getArticleAuthors(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ArticleAuthorInfo> {
  const cleanTitle = decodeURIComponent(title).replace(/_/g, " ").trim();

  // 1. Check MediaWiki upstream API for full chronological history & true original creator
  try {
    const mwData = await fetchMediaWikiPageAuthorsAndRevisions(cleanTitle, source, 250);
    if (mwData && mwData.creator) {
      // Check if PostgreSQL has any newer native edits
      let latestEditor: { username: string; timestamp?: string; avatar?: string | null } | null =
        typeof mwData.lastEditor === "object" && mwData.lastEditor ? mwData.lastEditor : null;
      let latestEditedAt: string | null =
        (typeof mwData.lastEditor === "object" && mwData.lastEditor ? mwData.lastEditor.timestamp : null) ?? null;

      try {
        const slug = toArticleSlug(cleanTitle);
        const latestPgRev = await db.wikiRevision.findFirst({
          where: {
            article: {
              source,
              OR: [
                { title: { equals: cleanTitle, mode: "insensitive" } },
                { slug: { equals: slug, mode: "insensitive" } },
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            author: true,
            createdAt: true,
          },
        });

        if (latestPgRev && (!latestEditedAt || new Date(latestPgRev.createdAt) > new Date(latestEditedAt))) {
          const fallbackName = latestEditor ? (typeof latestEditor === "string" ? latestEditor : latestEditor.username) : "MediaWiki Contributor";
          latestEditor = {
            username: latestPgRev.author || fallbackName,
            timestamp: new Date(latestPgRev.createdAt).toISOString(),
            avatar: null,
          };
          latestEditedAt = latestEditor.timestamp ?? null;
        }
      } catch {
        // Best effort PostgreSQL check
      }

      return {
        creator: {
          username: mwData.creator.username,
          timestamp: mwData.creator.timestamp,
          avatar: null,
        },
        createdAt: mwData.creator.timestamp,
        lastEditor: latestEditor,
        lastEditedAt: latestEditedAt,
        topContributors: mwData.contributors,
        contributors: mwData.contributors,
        totalContributors: mwData.totalContributors,
      };
    }
  } catch (mwErr) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[WikiOS:getArticleAuthors:mwFetch]", mwErr);
    }
  }

  // 2. Fall back to PostgreSQL Authoritative Store if MediaWiki is unreachable
  try {
    const slug = toArticleSlug(cleanTitle);
    const article = await db.wikiArticle.findFirst({
      where: {
        source,
        OR: [
          { title: { equals: cleanTitle, mode: "insensitive" } },
          { slug: { equals: slug, mode: "insensitive" } },
          { title: { equals: cleanTitle.replace(/_/g, " "), mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            wikiUsername: true,
          },
        },
      },
    });

    if (article) {
      const revisions = await db.wikiRevision.findMany({
        where: { articleId: article.id },
        orderBy: { createdAt: "asc" },
        select: {
          author: true,
          createdAt: true,
        },
      });

      if (revisions.length > 0) {
        const oldestRev = revisions[0]!;
        const newestRev = revisions[revisions.length - 1]!;

        const creatorUsername =
          oldestRev.author || article.author?.wikiUsername || "MediaWiki Contributor";
        const creatorTimestamp = (oldestRev.createdAt || article.createdAt).toISOString();

        const lastEditorUsername = newestRev.author || creatorUsername;
        const lastEditorTimestamp = (newestRev.createdAt || article.updatedAt).toISOString();

        const counts = new Map<string, { editCount: number; lastContributedAt: string }>();
        for (const r of revisions) {
          const user = r.author || "MediaWiki Contributor";
          const existing = counts.get(user);
          if (existing) {
            existing.editCount += 1;
          } else {
            counts.set(user, {
              editCount: 1,
              lastContributedAt: new Date(r.createdAt).toISOString(),
            });
          }
        }

        const contributors = Array.from(counts.entries())
          .map(([username, data]) => ({
            username,
            editCount: data.editCount,
            lastContributedAt: data.lastContributedAt,
          }))
          .sort((a, b) => b.editCount - a.editCount);

        return {
          creator: {
            username: creatorUsername,
            timestamp: creatorTimestamp,
            avatar: null,
          },
          createdAt: creatorTimestamp,
          lastEditor: {
            username: lastEditorUsername,
            timestamp: lastEditorTimestamp,
            avatar: null,
          },
          lastEditedAt: lastEditorTimestamp,
          topContributors: contributors.slice(0, 10),
          contributors: contributors.slice(0, 10),
          totalContributors: counts.size,
        };
      } else if (article.author || article.createdAt) {
        const creatorUsername = article.author?.wikiUsername || "MediaWiki Contributor";
        const creatorTimestamp = article.createdAt.toISOString();
        const lastEditorTimestamp = article.updatedAt.toISOString();

        return {
          creator: {
            username: creatorUsername,
            timestamp: creatorTimestamp,
            avatar: null,
          },
          createdAt: creatorTimestamp,
          lastEditor: {
            username: creatorUsername,
            timestamp: lastEditorTimestamp,
            avatar: null,
          },
          lastEditedAt: lastEditorTimestamp,
          topContributors: article.author?.wikiUsername
            ? [{ username: article.author.wikiUsername, editCount: 1, lastContributedAt: lastEditorTimestamp }]
            : [],
          contributors: article.author?.wikiUsername
            ? [{ username: article.author.wikiUsername, editCount: 1, lastContributedAt: lastEditorTimestamp }]
            : [],
          totalContributors: article.author?.wikiUsername ? 1 : 0,
        };
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[WikiOS:getArticleAuthors:pgFallback]", err);
    }
  }

  // 3. Fallback
  return {
    creator: null,
    createdAt: null,
    lastEditor: null,
    lastEditedAt: null,
    topContributors: [],
    contributors: [],
    totalContributors: 0,
  };
}

/**
 * Check whether a revision has already been recorded
 */
export async function hasRevision(revid: number, _source: WikiSource = "ixwiki"): Promise<boolean> {
  const existing = await db.wikiRevision.findFirst({
    where: {
      mwRevId: revid,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Record an article revision directly into PostgreSQL via authoritative ArticleRepository
 */
export async function recordArticleRevision(opts: {
  title: string;
  wikitext: string;
  mwRevId?: number | null;
  author?: string | null;
  authorId?: string | null;
  summary?: string | null;
  minor?: boolean;
  source?: WikiSource;
}): Promise<boolean> {
  try {
    const realm = opts.source || "ixwiki";
    await ArticleRepository.saveArticle(
      {
        slug: toArticleSlug(opts.title),
        title: opts.title,
        source: realm,
        wikitext: opts.wikitext,
        summary: opts.summary || undefined,
        minor: opts.minor,
      },
      opts.authorId || undefined,
      opts.author || "Wiki Contributor"
    );

    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ArticleStore] Failed to record article revision:", msg);
    return false;
  }
}

/**
 * Invalidate shadow cache on write / edit (No-op: PostgreSQL is authoritative and atomic).
 */
export function invalidateArticleShadow(_title: string, _source: WikiSource = "ixwiki"): void {
  // No-op
}

export function batchInvalidateArticleShadow(_titles: string[], _source: WikiSource = "ixwiki"): void {
  // No-op
}
