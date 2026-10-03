/**
 * PostgreSQL-first access to WikiOS articles, revisions and histories, falling back to the
 * MediaWiki bridge.
 */

import { db } from "~/server/db";
import { Cache } from "~/lib/cache/cache";
import { ArticleRepository } from "../../core/article-repository";
import { toArticleSlug, toRevisionRef } from "../../core/domain-types";
import { getArticleWikitext, getPageHistory, getRevisionWikitext, type WikiSource } from "./bridge";
import { fetchMediaWikiPageAuthorsAndRevisions } from "./bridge/http-reader";
import type { ArticleAuthorInfo } from "~/lib/wiki-os/types/canonical";

interface ShadowResult {
  wikitext: string;
  revid: number | null;
  timestamp: string | null;
  fromShadow: boolean;
  stale: boolean;
}

interface HistoryRevision {
  /** Revision reference accepted by getRevisionWikitext (see `toRevisionRef`). */
  revid: string;
  timestamp: string;
  user: string;
  comment: string;
  size: number;
  byteDelta: number;
  minor: boolean;
}

/** Article wikitext from PostgreSQL, falling back to the MediaWiki bridge. */
export async function getArticleWikitextShadow(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ShadowResult | null> {
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

/** A revision's wikitext by the `revid` a history entry carries. */
export async function getRevisionWikitextShadow(
  revid: string
): Promise<{ wikitext: string; title: string; timestamp: string; fromShadow: boolean } | null> {
  const revision = await getRevisionWikitext(revid);
  return revision ? { ...revision, fromShadow: true } : null;
}

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

/** Revision history from PostgreSQL, falling back to MediaWiki. */
export async function getArticleHistoryShadow(
  title: string,
  limit = 50,
  offset?: number,
  source: WikiSource = "ixwiki"
): Promise<{ revisions: HistoryRevision[]; hasMore: boolean; fromShadow: boolean }> {
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
    const data = await fetchMediaWikiPageAuthorsAndRevisions(
      cleanTitle,
      source,
      250,
      MW_AUTHORS_TIMEOUT_MS
    ).catch(() => null);
    mwAuthorsCache.set(key, data, data?.creator ? MW_AUTHORS_TTL_MS : MW_AUTHORS_NEGATIVE_TTL_MS);
    return data;
  })().finally(() => {
    mwAuthorsInFlight.delete(key);
  });
  mwAuthorsInFlight.set(key, request);
  return request;
}

type AuthorEdit = { username: string; timestamp: string };
type Contributor = { username: string; editCount: number; lastContributedAt: string };

const UNKNOWN_CONTRIBUTOR = "MediaWiki Contributor";

function buildAuthorInfo(
  creator: AuthorEdit,
  lastEditor: AuthorEdit,
  contributors: Contributor[],
  totalContributors: number
): ArticleAuthorInfo {
  return {
    creator: { ...creator, avatar: null },
    createdAt: creator.timestamp,
    lastEditor: { ...lastEditor, avatar: null },
    lastEditedAt: lastEditor.timestamp,
    topContributors: contributors,
    contributors,
    totalContributors,
  };
}

/** Case-insensitive match on an article's title or slug. */
function articleTitleMatch(cleanTitle: string, extraTitles: string[] = []) {
  const titles = [cleanTitle, ...extraTitles];
  return [
    ...titles.map((title) => ({ title: { equals: title, mode: "insensitive" as const } })),
    { slug: { equals: toArticleSlug(cleanTitle), mode: "insensitive" as const } },
  ];
}

/** MediaWiki lineage, with the newest WikiOS edit in Postgres overlaid as last editor. */
async function getAuthorsFromMediaWiki(
  cleanTitle: string,
  source: WikiSource
): Promise<ArticleAuthorInfo | null> {
  const mwData = await getMediaWikiAuthorsCached(cleanTitle, source);
  if (!mwData?.creator) return null;

  let latestEditor: { username: string; timestamp?: string; avatar?: string | null } | null =
    mwData.lastEditor;
  let latestEditedAt: string | null = latestEditor?.timestamp ?? null;

  try {
    const latestPgRev = await db.wikiRevision.findFirst({
      where: { article: { source, OR: articleTitleMatch(cleanTitle) } },
      orderBy: { createdAt: "desc" },
      select: { author: true, createdAt: true },
    });

    if (
      latestPgRev &&
      (!latestEditedAt || new Date(latestPgRev.createdAt) > new Date(latestEditedAt))
    ) {
      latestEditedAt = new Date(latestPgRev.createdAt).toISOString();
      latestEditor = {
        username:
          latestPgRev.author || (latestEditor ? latestEditor.username : UNKNOWN_CONTRIBUTOR),
        timestamp: latestEditedAt,
        avatar: null,
      };
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

/** Authorship rebuilt from WikiOS revisions, used when MediaWiki is unreachable. */
async function getAuthorsFromPostgres(
  cleanTitle: string,
  source: WikiSource
): Promise<ArticleAuthorInfo | null> {
  const article = await db.wikiArticle.findFirst({
    where: { source, OR: articleTitleMatch(cleanTitle, [cleanTitle.replace(/_/g, " ")]) },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { wikiUsername: true } },
    },
  });
  if (!article) return null;

  const revisions = await db.wikiRevision.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "asc" },
    select: { author: true, createdAt: true },
  });

  if (revisions.length === 0) {
    if (!article.author && !article.createdAt) return null;
    const username = article.author?.wikiUsername || UNKNOWN_CONTRIBUTOR;
    const lastEditedAt = article.updatedAt.toISOString();
    const contributors = article.author?.wikiUsername
      ? [{ username: article.author.wikiUsername, editCount: 1, lastContributedAt: lastEditedAt }]
      : [];
    return buildAuthorInfo(
      { username, timestamp: article.createdAt.toISOString() },
      { username, timestamp: lastEditedAt },
      contributors,
      contributors.length
    );
  }

  const oldestRev = revisions[0]!;
  const newestRev = revisions[revisions.length - 1]!;
  const creatorUsername = oldestRev.author || article.author?.wikiUsername || UNKNOWN_CONTRIBUTOR;

  const counts = new Map<string, Contributor>();
  for (const r of revisions) {
    const username = r.author || UNKNOWN_CONTRIBUTOR;
    const existing = counts.get(username);
    if (existing) existing.editCount += 1;
    else {
      counts.set(username, {
        username,
        editCount: 1,
        lastContributedAt: new Date(r.createdAt).toISOString(),
      });
    }
  }
  const contributors = Array.from(counts.values())
    .sort((a, b) => b.editCount - a.editCount)
    .slice(0, 10);

  return buildAuthorInfo(
    {
      username: creatorUsername,
      timestamp: (oldestRev.createdAt || article.createdAt).toISOString(),
    },
    {
      username: newestRev.author || creatorUsername,
      timestamp: (newestRev.createdAt || article.updatedAt).toISOString(),
    },
    contributors,
    counts.size
  );
}

const NO_AUTHORS: ArticleAuthorInfo = {
  creator: null,
  createdAt: null,
  lastEditor: null,
  lastEditedAt: null,
  topContributors: [],
  contributors: [],
  totalContributors: 0,
};

/** Article authorship: creator, last editor and top contributors. */
export async function getArticleAuthors(
  title: string,
  source: WikiSource = "ixwiki"
): Promise<ArticleAuthorInfo> {
  const cleanTitle = decodeURIComponent(title).replace(/_/g, " ").trim();
  const sources = [
    ["mwFetch", getAuthorsFromMediaWiki],
    ["pgFallback", getAuthorsFromPostgres],
  ] as const;

  for (const [label, lookup] of sources) {
    try {
      const info = await lookup(cleanTitle, source);
      if (info) return info;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[WikiOS:getArticleAuthors:${label}]`, err);
      }
    }
  }

  return { ...NO_AUTHORS, topContributors: [], contributors: [] };
}
