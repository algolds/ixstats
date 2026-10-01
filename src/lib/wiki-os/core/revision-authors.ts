/**
 * revision-authors.ts — who made a page: its creator, last editor and contributors, from the
 * revision ledger (`wiki_revisions`) alone.
 *
 * The creator is the author of the oldest live revision, the last editor the author of the newest,
 * however many revisions the page has. A parked revision (a MediaWiki edit that conflicted with
 * WikiOS's head and never went live) is nobody's contribution to the page, so it is left out of all
 * three. Contributors are the distinct authors with their edit counts, most edits first, then by
 * name; every anonymous (IP) author is folded into one "Anonymous" entry, as MediaWiki's contributor
 * list counts them as a group.
 */

import { db } from "~/server/db";
import { ArticleRepository } from "./article-repository";
import { isAnonymousAuthor } from "./anonymous-author";
import type { ArticleAuthorInfo } from "~/lib/wiki-os/types/canonical";

/** The contributors listed with a page. */
export const MAX_LISTED_CONTRIBUTORS = 10;
/** The one entry every IP author is folded into. */
export const ANONYMOUS_CONTRIBUTOR = "Anonymous";
/** Who a revision with no recorded author is credited to. */
const UNKNOWN_AUTHOR = "MediaWiki Contributor";

export interface AuthorGroup {
  /** The author's name as stored; null when the revision recorded none. */
  author: string | null;
  edits: number;
  lastEditedAt: Date;
}

export interface EdgeRevision {
  author: string | null;
  createdAt: Date;
}

interface Contributor {
  username: string;
  editCount: number;
  lastContributedAt: string;
}

/** The contributors of `groups`, anonymous authors folded into one entry, plus the number of distinct people. */
function summarizeContributors(groups: readonly AuthorGroup[]): {
  contributors: Contributor[];
  total: number;
} {
  const named: Contributor[] = [];
  let anonymousEdits = 0;
  let anonymousAuthors = 0;
  let anonymousLast: Date | null = null;
  for (const group of groups) {
    const name = group.author ?? UNKNOWN_AUTHOR;
    if (isAnonymousAuthor(name)) {
      anonymousEdits += group.edits;
      anonymousAuthors += 1;
      if (!anonymousLast || group.lastEditedAt > anonymousLast) anonymousLast = group.lastEditedAt;
    } else {
      named.push({
        username: name,
        editCount: group.edits,
        lastContributedAt: group.lastEditedAt.toISOString(),
      });
    }
  }
  const contributors =
    anonymousLast === null
      ? named
      : [
          ...named,
          {
            username: ANONYMOUS_CONTRIBUTOR,
            editCount: anonymousEdits,
            lastContributedAt: anonymousLast.toISOString(),
          },
        ];
  contributors.sort((a, b) => b.editCount - a.editCount || a.username.localeCompare(b.username));
  return { contributors, total: named.length + anonymousAuthors };
}

/** The authorship of a page from its oldest and newest live revisions and its authors' totals. Pure. */
export function buildAuthorInfo(
  oldest: EdgeRevision,
  newest: EdgeRevision,
  groups: readonly AuthorGroup[],
  fallbackName: string | null
): ArticleAuthorInfo {
  const creator = oldest.author ?? fallbackName ?? UNKNOWN_AUTHOR;
  const createdAt = oldest.createdAt.toISOString();
  const lastEditor = newest.author ?? creator;
  const lastEditedAt = newest.createdAt.toISOString();
  const { contributors, total } = summarizeContributors(groups);
  const listed = contributors.slice(0, MAX_LISTED_CONTRIBUTORS);
  return {
    creator: { username: creator, timestamp: createdAt, avatar: null },
    createdAt,
    lastEditor: { username: lastEditor, timestamp: lastEditedAt, avatar: null },
    lastEditedAt,
    topContributors: listed,
    contributors: listed,
    totalContributors: total,
  };
}

/**
 * A page that has no live revision row (an article created outside the ledger): credited to the
 * WikiOS user who owns it, when it has one, at the times the row carries.
 */
function authorInfoWithoutRevisions(
  creatorName: string | null,
  createdAt: Date,
  updatedAt: Date
): ArticleAuthorInfo {
  const username = creatorName ?? UNKNOWN_AUTHOR;
  const created = createdAt.toISOString();
  const updated = updatedAt.toISOString();
  const contributors = creatorName
    ? [{ username: creatorName, editCount: 1, lastContributedAt: updated }]
    : [];
  return {
    creator: { username, timestamp: created, avatar: null },
    createdAt: created,
    lastEditor: { username, timestamp: updated, avatar: null },
    lastEditedAt: updated,
    topContributors: contributors,
    contributors,
    totalContributors: contributors.length,
  };
}

/** The wiki username of the WikiOS user `userId`, or null. */
async function ownerWikiUsername(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const owner = await db.user.findUnique({ where: { id: userId }, select: { wikiUsername: true } });
  return owner?.wikiUsername ?? null;
}

/**
 * The authorship of the page `title` in `source`, or null when the wiki has no such page. The page
 * is resolved as every other reader resolves it (a deleted page included: the caller decides who may
 * see it), so the ledger of one page never merges in a case-variant page's.
 */
export async function loadRevisionAuthors(
  title: string,
  source = "ixwiki"
): Promise<ArticleAuthorInfo | null> {
  const article = await ArticleRepository.getArticleBySlug(title, source, {
    includeArchived: true,
  });
  if (!article) return null;

  const live = { articleId: article.id, parked: false };
  const [oldest, newest, groups] = await Promise.all([
    db.wikiRevision.findFirst({
      where: live,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { author: true, createdAt: true },
    }),
    db.wikiRevision.findFirst({
      where: live,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { author: true, createdAt: true },
    }),
    db.wikiRevision.groupBy({
      by: ["author"],
      where: live,
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  // The article's owner is asked only when the ledger leaves the creator unnamed.
  const ownerName = oldest?.author ? null : await ownerWikiUsername(article.authorId);
  if (!oldest || !newest) {
    return authorInfoWithoutRevisions(ownerName, article.createdAt, article.updatedAt);
  }

  return buildAuthorInfo(
    oldest,
    newest,
    groups.map((group) => ({
      author: group.author,
      edits: group._count._all,
      lastEditedAt: group._max.createdAt ?? newest.createdAt,
    })),
    ownerName
  );
}
