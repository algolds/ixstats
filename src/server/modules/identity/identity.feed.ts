/**
 * Pure builders for the passport's WikiOS work: authored pages and the wiki activity feed.
 * (Moved from routers/ixnayid/passport-feed.ts, now typed.)
 */
import type {
  AuthoredArticle,
  WikiActivityItem,
  WikiActivityType,
} from "./identity.types";

export interface AuthoredArticleRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatedPageRow {
  title: string;
  createdAt: string;
  byteSize: number;
}

export interface NativeRevisionRow {
  id: string;
  summary: string | null;
  minor: boolean;
  createdAt: Date;
  article: { title: string; slug: string } | null;
}

export interface WikiContribRow {
  rev_id: number;
  page_title: string;
  rev_timestamp: string;
  rev_len: number;
  rev_comment: string;
  rev_minor_edit: number;
  is_new: boolean;
}

export interface DiscussionCommentRow {
  id: string;
  content: string;
  createdAt: Date;
  thread: { title: string | null; articleTitle: string | null } | null;
}

export interface LoreAwardRow {
  id: string;
  date: string;
  type: string;
  winnerUser: string | null;
  winnerPage: string | null;
  winnerScore: number | null;
  runnerUpPage: string | null;
  runnerUpScore: number | null;
}

const byNewest = (a: { time: number }, b: { time: number }) => b.time - a.time;

const underscoreSlug = (title: string) => title.toLowerCase().replace(/ /g, "_");

/** Native WikiOS articles first, then MediaWiki-created pages not already listed, newest first. */
export function buildAuthoredArticles(
  rawAuthored: AuthoredArticleRow[],
  createdPages: CreatedPageRow[]
): AuthoredArticle[] {
  const articles: AuthoredArticle[] = [];
  const seenTitles = new Set<string>();
  const add = (article: AuthoredArticle) => {
    const key = article.title.toLowerCase();
    if (seenTitles.has(key)) return;
    seenTitles.add(key);
    articles.push(article);
  };

  for (const a of rawAuthored) {
    if (!a.title) continue;
    add({
      id: a.id,
      slug: a.slug || underscoreSlug(a.title),
      title: a.title,
      summary: a.summary || "WikiOS Canonical Article",
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    });
  }

  for (const page of createdPages) {
    if (!page.title) continue;
    const created = new Date(page.createdAt);
    add({
      id: `mw-page-${page.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      slug: underscoreSlug(page.title),
      title: page.title,
      summary: `Authored Wiki Article (${(page.byteSize || 0).toLocaleString()} B)`,
      createdAt: created,
      updatedAt: created,
    });
  }

  return articles
    .map((article) => ({ article, time: article.updatedAt.getTime() }))
    .sort(byNewest)
    .map(({ article }) => article);
}

function revisionItems(revisions: NativeRevisionRow[]): WikiActivityItem[] {
  return revisions.map((rev) => {
    const title = rev.article?.title || "Wiki Article";
    const articleSlug = rev.article?.slug || rev.article?.title || "";
    return {
      id: `rev-${rev.id}`,
      type: rev.minor ? "minor_edit" : "revision",
      title,
      articleSlug,
      summary:
        rev.summary || (rev.minor ? "Minor formatting & copyedit" : "Revised article content"),
      byteDiff: null,
      timestamp: new Date(rev.createdAt).toISOString(),
      url: `/wiki/${encodeURIComponent(articleSlug || title)}`,
    };
  });
}

function contribType(c: WikiContribRow): WikiActivityType {
  if (c.is_new) return "publish";
  return c.rev_minor_edit ? "minor_edit" : "revision";
}

function contribItems(contribs: WikiContribRow[]): WikiActivityItem[] {
  return contribs.flatMap((c, idx) => {
    if (!c.page_title || c.page_title === "Untitled") return [];
    const timestamp = c.rev_timestamp || new Date().toISOString();
    const ts = new Date(timestamp).getTime() || idx;
    const safeSlug = c.page_title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    return [
      {
        id: `mw-${c.rev_id || 0}-${safeSlug}-${ts}-${idx}`,
        type: contribType(c),
        title: c.page_title,
        articleSlug: underscoreSlug(c.page_title),
        summary: c.rev_comment || (c.is_new ? "Created new article" : "MediaWiki article revision"),
        byteDiff: c.rev_len,
        timestamp: new Date(timestamp).toISOString(),
        url: `/wiki/${encodeURIComponent(c.page_title)}`,
      },
    ];
  });
}

function commentItems(comments: DiscussionCommentRow[]): WikiActivityItem[] {
  return comments.map((comment) => {
    const articleTitle = comment.thread?.articleTitle || "";
    return {
      id: `comment-${comment.id}`,
      type: "discussion",
      title: comment.thread?.title || "Margin Discussion",
      articleSlug: articleTitle,
      summary:
        comment.content.length > 120 ? `${comment.content.slice(0, 117)}...` : comment.content,
      byteDiff: null,
      timestamp: new Date(comment.createdAt).toISOString(),
      url: articleTitle ? `/wiki/${encodeURIComponent(articleTitle)}` : `/wiki`,
    };
  });
}

const DISTINCTION: Record<string, string> = {
  daily: "Lore of the Day",
  weekly: "Lore of the Week",
};

/** True when `wikiName` is the entry's winner (not its runner-up). */
export function isAwardWinner(award: LoreAwardRow, wikiName: string | null): boolean {
  return Boolean(wikiName && award.winnerUser?.toLowerCase() === wikiName.toLowerCase());
}

function laurelItems(awards: LoreAwardRow[], wikiName: string | null): WikiActivityItem[] {
  return awards.map((award) => {
    const isWinner = isAwardWinner(award, wikiName);
    const articleName =
      (isWinner ? award.winnerPage : award.runnerUpPage) || award.winnerPage || "Wiki Lore";
    const score = isWinner ? award.winnerScore : award.runnerUpScore;
    const distinction = DISTINCTION[award.type] ?? "Monthly Laureate";
    return {
      id: `laurel-${award.id}`,
      type: "laurel",
      title: articleName,
      articleSlug: underscoreSlug(articleName),
      summary: `${distinction} (${isWinner ? "Winner" : "Runner-Up"}${score ? ` · +${score} pts` : ""})`,
      byteDiff: null,
      timestamp: new Date(award.date).toISOString(),
      url: `/wiki/${encodeURIComponent(articleName)}`,
    };
  });
}

/** Native revisions, MediaWiki contributions, margin discussions and laurels, newest first. */
export function buildWikiActivityFeed(
  nativeRevisions: NativeRevisionRow[],
  wikiContribs: WikiContribRow[],
  wikiComments: DiscussionCommentRow[],
  loreAwards: LoreAwardRow[],
  wikiName: string | null
): WikiActivityItem[] {
  return [
    ...revisionItems(nativeRevisions),
    ...contribItems(wikiContribs),
    ...commentItems(wikiComments),
    ...laurelItems(loreAwards, wikiName),
  ]
    .map((item) => ({ item, time: new Date(item.timestamp).getTime() }))
    .sort(byNewest)
    .map(({ item }) => item);
}
