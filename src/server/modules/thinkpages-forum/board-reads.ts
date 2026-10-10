/**
 * Reads behind the Forums home and its rail: latest post and post count per board, forum statistics, trending
 * threads and a board's top posters. Each is a fixed number of queries however many boards there are. They take the
 * categories (placed rows, so no lookup per board) and apply the same rules as `summarizeCategories`: a category the
 * viewer cannot see is skipped, hidden threads and posts stay in only for the category's moderators, and Reports
 * shows a member only their own threads. Archived threads count in totals but are not "latest" or trending.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { canSeeCategory, canSeeThread, type ForumViewer } from "./access";
import { canModerateCategory } from "./mod-scope";
import { publicThreadWhere, publishedRealmIds } from "./public-threads";
import { hiddenFilter, ownThreadsWhere } from "./reads";

/** A category as the reads need it: its place and visibility, which decide what the viewer may see in it. */
export interface BoardCategory {
  id: string;
  scope: string;
  realmId: string | null;
  visibility: string;
}

/** The newest visible thread of a board and the author ids of its last visible post (resolve them with authorsOf). */
export interface LatestPost {
  threadId: string;
  threadTitle: string;
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  at: Date;
}

export interface TrendingThread {
  threadId: string;
  title: string;
  categoryName: string;
  repliesToday: number;
}

export interface ForumStatistics {
  threads: number;
  posts: number;
  members: number;
}

export interface TopPoster {
  authorUserId: string;
  postCount: number;
}

type ThreadsDb = Pick<PrismaClient, "forumThread">;

const DAY_MS = 24 * 60 * 60 * 1000;
const STATS_TTL_MS = 5 * 60 * 1000;
/** Trending asks for more than it returns, because threads the viewer cannot see are dropped afterwards. */
const TRENDING_OVERFETCH = 4;

const visibleTo = <C extends BoardCategory>(viewer: ForumViewer, categories: readonly C[]): C[] =>
  categories.filter((c) => canSeeCategory(viewer, c));

/** The threads of these categories the viewer may see, as one `OR` of per-category clauses; null when none. */
function threadsWhere(
  viewer: ForumViewer,
  categories: readonly BoardCategory[]
): { OR: Prisma.ForumThreadWhereInput[] } | null {
  const visible = visibleTo(viewer, categories);
  if (visible.length === 0) return null;
  return {
    OR: visible.map((c) => ({
      categoryId: c.id,
      ...hiddenFilter(viewer, c),
      ...ownThreadsWhere(viewer, c),
    })),
  };
}

/** Last post of each board's newest unarchived thread: two queries in all (threads, then those threads' last posts). */
export async function latestPerCategory(
  db: Pick<PrismaClient, "forumThread" | "forumPost">,
  viewer: ForumViewer,
  categories: readonly BoardCategory[]
): Promise<Map<string, LatestPost>> {
  const where = threadsWhere(viewer, categories);
  const latest = new Map<string, LatestPost>();
  if (!where) return latest;
  const threads = await db.forumThread.findMany({
    where: { archived: false, ...where },
    orderBy: { lastPostAt: "desc" },
    distinct: ["categoryId"],
    select: { id: true, title: true, categoryId: true, lastPostAt: true },
  });
  if (threads.length === 0) return latest;
  const moderated = new Set(
    categories.filter((c) => canModerateCategory(viewer, c)).map((c) => c.id)
  );
  const moderatedThreadIds = threads.filter((t) => moderated.has(t.categoryId)).map((t) => t.id);
  const posts = await db.forumPost.findMany({
    where: {
      threadId: { in: threads.map((t) => t.id) },
      ...(moderatedThreadIds.length > 0
        ? { OR: [{ hidden: false }, { threadId: { in: moderatedThreadIds } }] }
        : { hidden: false }),
    },
    orderBy: { createdAt: "desc" },
    distinct: ["threadId"],
    select: {
      threadId: true,
      authorUserId: true,
      authorPersonaId: true,
      importedAuthorName: true,
      createdAt: true,
    },
  });
  const lastPost = new Map(posts.map((p) => [p.threadId, p]));
  for (const t of threads) {
    const post = lastPost.get(t.id);
    latest.set(t.categoryId, {
      threadId: t.id,
      threadTitle: t.title,
      authorUserId: post?.authorUserId ?? null,
      authorPersonaId: post?.authorPersonaId ?? null,
      importedAuthorName: post?.importedAuthorName ?? null,
      at: post?.createdAt ?? t.lastPostAt,
    });
  }
  return latest;
}

/** Posts per board (archived threads included, as `summarizeCategories` counts them), in one grouped query. */
export async function postCountsPerCategory(
  db: ThreadsDb,
  viewer: ForumViewer,
  categories: readonly BoardCategory[]
): Promise<Map<string, number>> {
  const where = threadsWhere(viewer, categories);
  if (!where) return new Map();
  const rows = await db.forumThread.groupBy({
    by: ["categoryId"],
    where,
    _sum: { postCount: true },
  });
  return new Map(rows.map((r) => [r.categoryId, r._sum.postCount ?? 0]));
}

let statistics: { at: number; value: ForumStatistics } | null = null;

/**
 * Threads, posts and distinct member authors over public content only (the same set for every viewer, so one
 * per-process cache entry serves them all), cached for five minutes. `now` is injectable for tests.
 */
export async function forumStatistics(
  db: Pick<PrismaClient, "forumThread" | "forumPost" | "realm">,
  now: number = Date.now()
): Promise<ForumStatistics> {
  if (statistics && now - statistics.at < STATS_TTL_MS) return statistics.value;
  const thread = await publicThreadWhere(db);
  const visiblePost = { hidden: false, thread };
  const [threads, posts, authors] = await Promise.all([
    db.forumThread.count({ where: thread }),
    db.forumPost.count({ where: visiblePost }),
    db.forumPost.groupBy({
      by: ["authorUserId"],
      where: { ...visiblePost, authorUserId: { not: null } },
    }),
  ]);
  const value = { threads, posts, members: authors.length };
  statistics = { at: now, value };
  return value;
}

/** Threads with the most posts in the last 24 hours that the viewer may see, most active first. */
export async function trendingThreads(
  db: Pick<PrismaClient, "forumThread" | "forumPost" | "realm">,
  viewer: ForumViewer,
  limit = 5,
  now: Date = new Date()
): Promise<TrendingThread[]> {
  const realmIds = await publishedRealmIds(db);
  const active = await db.forumPost.groupBy({
    by: ["threadId"],
    where: {
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      hidden: false,
      thread: {
        hidden: false,
        archived: false,
        category: { OR: [{ scope: "site" }, { scope: "realm", realmId: { in: realmIds } }] },
      },
    },
    _count: { threadId: true },
    orderBy: { _count: { threadId: "desc" } },
    take: limit * TRENDING_OVERFETCH,
  });
  if (active.length === 0) return [];
  const threads = await db.forumThread.findMany({
    where: { id: { in: active.map((a) => a.threadId) } },
    select: {
      id: true,
      title: true,
      authorUserId: true,
      hidden: true,
      category: { select: { id: true, name: true, visibility: true, scope: true, realmId: true } },
    },
  });
  const byId = new Map(threads.map((t) => [t.id, t]));
  const trending: TrendingThread[] = [];
  for (const { threadId, _count } of active) {
    const thread = byId.get(threadId);
    if (!thread || !canSeeThread(viewer, thread, thread.category)) continue;
    trending.push({
      threadId,
      title: thread.title,
      categoryName: thread.category.name,
      repliesToday: _count.threadId,
    });
  }
  return trending.slice(0, limit);
}

/** The authors with the most posts in this board since the start of the (UTC) calendar month. */
export async function boardTopPosters(
  db: Pick<PrismaClient, "forumPost">,
  viewer: ForumViewer,
  category: BoardCategory,
  limit = 5,
  now: Date = new Date()
): Promise<TopPoster[]> {
  if (!canSeeCategory(viewer, category)) return [];
  const rows = await db.forumPost.groupBy({
    by: ["authorUserId"],
    where: {
      authorUserId: { not: null },
      createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) },
      ...hiddenFilter(viewer, category),
      thread: {
        categoryId: category.id,
        ...hiddenFilter(viewer, category),
        ...ownThreadsWhere(viewer, category),
      },
    },
    _count: { authorUserId: true },
    orderBy: { _count: { authorUserId: "desc" } },
    take: limit,
  });
  return rows.flatMap((r) =>
    r.authorUserId ? [{ authorUserId: r.authorUserId, postCount: r._count.authorUserId }] : []
  );
}
