/**
 * src/lib/wiki-os/adapters/mediawiki/article-store.ts — PostgreSQL Authoritative Read-Through Bridge
 *
 * Provides fast, unified access to WikiOS articles, revisions, and histories,
 * delegating directly to PostgreSQL ArticleRepository with fallback to MediaWiki bridge.
 */

import { db } from "~/server/db";
import { Cache } from "~/lib/cache/cache";
import { ArticleRepository } from "../../core/article-repository";
import { toArticleSlug, toRevisionRef } from "../../core/domain-types";
import { getArticleWikitext, getPageHistory, getRevisionWikitext, type WikiSource } from "./bridge";
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
  /** Revision reference accepted by getRevisionWikitext (see `toRevisionRef`). */
  revid: string;
  timestamp: string;
  user: string;
  comment: string;
  size: number;
  byteDelta: number;
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
 * Read a revision's wikitext by the `revid` a history entry carries. `wikitext` is null when the
 * revision's text was never imported (see `RevisionContent`).
 */
export async function getRevisionWikitextShadow(
  revid: string
): Promise<{
  wikitext: string | null;
  title: string;
  source: string;
  timestamp: string;
  fromShadow: boolean;
} | null> {
  const revision = await getRevisionWikitext(revid);
  return revision ? { ...revision, fromShadow: true } : null;
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
 * Save pre-rendered HTML to PostgreSQL article record.
 *
 * `renderedFromWikitext`: the wikitext the HTML was rendered from. When given, the write only
 * lands if the article still holds that wikitext, so a slow render cannot overwrite the cache of a
 * newer save.
 */
export async function saveArticleHtmlShadow(
  title: string,
  html: string,
  source: WikiSource = "ixwiki",
  renderedFromWikitext?: string
): Promise<void> {
  try {
    const slug = toArticleSlug(title);
    await db.wikiArticle.updateMany({
      where: {
        source,
        OR: [{ slug }, { title: title.replace(/_/g, " ") }],
        ...(renderedFromWikitext !== undefined ? { wikitext: renderedFromWikitext } : {}),
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
  const pgRevs = await ArticleRepository.getHistory(title, source, limit);
  if (pgRevs.length > 0) {
    return {
      revisions: pgRevs.map((r) => ({
        revid: toRevisionRef(r),
        timestamp: r.createdAt.toISOString(),
        user: r.author || "Wiki Contributor",
        comment: r.summary || "",
        size: r.byteSize || 0,
        byteDelta: r.byteDelta ?? 0,
        minor: r.minor,
      })),
      hasMore: false,
      fromShadow: true,
    };
  }

  // 2. Fall back to MediaWiki
  const revList = await getPageHistory(title, limit, offset);
  return {
    revisions: revList.map((r) => ({
      revid: String(r.rev_id),
      timestamp: r.rev_timestamp,
      user: r.rev_user_text || "Wiki Contributor",
      comment: r.rev_comment || "",
      size: r.rev_len || 0,
      byteDelta: r.diff || 0,
      minor: r.rev_minor_edit === 1,
    })),
    hasMore: revList.length >= limit,
    fromShadow: false,
  };
}

/** Alias for getPageHistoryShadow */
export const getArticleHistoryShadow = getPageHistoryShadow;

type MediaWikiAuthorsData = Awaited<ReturnType<typeof fetchMediaWikiPageAuthorsAndRevisions>>;

/** MediaWiki revision lineage changes slowly and a WikiOS edit is overlaid from Postgres below. */
const MW_AUTHORS_TTL_MS = 10 * 60 * 1000;
/** A failed or empty lookup is remembered briefly so an unreachable wiki does not stall every view. */
const MW_AUTHORS_NEGATIVE_TTL_MS = 60 * 1000;
/** Authorship is decoration: do not hold an article view for the full 8 s default. */
const MW_AUTHORS_TIMEOUT_MS = 2500;

const mwAuthorsCache = new Cache<MediaWikiAuthorsData>({
  defaultTtlMs: MW_AUTHORS_TTL_MS,
  maxSize: 500,
  namespace: "wiki-authors",
});
const mwAuthorsInFlight = new Map<string, Promise<MediaWikiAuthorsData>>();

/** MediaWiki page history for authorship: cached, single-flight and short-timeout (NEW-5). */
async function getMediaWikiAuthorsCached(
  cleanTitle: string,
  source: WikiSource
): Promise<MediaWikiAuthorsData> {
  const key = `${source}:${cleanTitle.toLowerCase()}`;
  const cached = mwAuthorsCache.get(key);
  if (cached !== undefined) return cached;

  const inFlight = mwAuthorsInFlight.get(key);
  if (inFlight) return inFlight;

  const request = (async () => {
    let data: MediaWikiAuthorsData = null;
    try {
      data = await fetchMediaWikiPageAuthorsAndRevisions(
        cleanTitle,
        source,
        250,
        MW_AUTHORS_TIMEOUT_MS
      );
    } catch {
      data = null;
    }
    mwAuthorsCache.set(key, data, data?.creator ? MW_AUTHORS_TTL_MS : MW_AUTHORS_NEGATIVE_TTL_MS);
    return data;
  })().finally(() => {
    mwAuthorsInFlight.delete(key);
  });
  mwAuthorsInFlight.set(key, request);
  return request;
}

/**
 * Get article authorship information (creator, last editor, top contributors)
 */
export async function getArticleAuthors(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ArticleAuthorInfo> {
  const cleanTitle = title.replace(/_/g, " ").trim();

  // 1. Check MediaWiki upstream API for full chronological history & true original creator
  try {
    const mwData = await getMediaWikiAuthorsCached(cleanTitle, source);
    if (mwData && mwData.creator) {
      // Check if PostgreSQL has any newer native edits
      let latestEditor: { username: string; timestamp?: string; avatar?: string | null } | null =
        typeof mwData.lastEditor === "object" && mwData.lastEditor ? mwData.lastEditor : null;
      let latestEditedAt: string | null =
        (typeof mwData.lastEditor === "object" && mwData.lastEditor
          ? mwData.lastEditor.timestamp
          : null) ?? null;

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

        if (
          latestPgRev &&
          (!latestEditedAt || new Date(latestPgRev.createdAt) > new Date(latestEditedAt))
        ) {
          const fallbackName = latestEditor
            ? typeof latestEditor === "string"
              ? latestEditor
              : latestEditor.username
            : "MediaWiki Contributor";
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
            ? [
                {
                  username: article.author.wikiUsername,
                  editCount: 1,
                  lastContributedAt: lastEditorTimestamp,
                },
              ]
            : [],
          contributors: article.author?.wikiUsername
            ? [
                {
                  username: article.author.wikiUsername,
                  editCount: 1,
                  lastContributedAt: lastEditorTimestamp,
                },
              ]
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
