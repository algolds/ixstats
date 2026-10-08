/**
 * Forum reads. They return ids only; the router adds display names through `authorsOf` (one query per kind per
 * page). Hidden threads and posts are omitted for everyone but site admins, and a category the viewer cannot see
 * reads as NOT_FOUND so its existence does not leak.
 */
import type { PrismaClient } from "@prisma/client";
import { isSiteAdmin } from "~/server/modules/realms";
import { canSeeCategory, type ForumViewer } from "./access";
import { ForumError } from "./errors";

export const THREADS_PER_PAGE = 25;
export const POSTS_PER_PAGE = 20;

export type ReadsDb = Pick<PrismaClient, "forumCategory" | "forumThread" | "forumPost">;
export type AuthorsDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

const SITE_SCOPE = { scope: "site", realmId: null } as const;

const isAdmin = (viewer: ForumViewer): boolean => viewer !== null && isSiteAdmin(viewer);
const hiddenFilter = (viewer: ForumViewer): { hidden?: false } => (isAdmin(viewer) ? {} : { hidden: false });
const pageOf = (page: number): number => (Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1);

export async function listSiteCategories(db: Pick<ReadsDb, "forumCategory" | "forumThread">, viewer: ForumViewer) {
  const all = await db.forumCategory.findMany({ where: SITE_SCOPE, orderBy: { order: "asc" } });
  const visible = all.filter((c) => canSeeCategory(viewer, c));
  const stats = await db.forumThread.groupBy({
    by: ["categoryId"],
    where: { categoryId: { in: visible.map((c) => c.id) }, ...hiddenFilter(viewer) },
    _count: { _all: true },
    _max: { lastPostAt: true },
  });
  const byCategory = new Map(stats.map((s) => [s.categoryId, s]));
  return visible.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    icAllowed: c.icAllowed,
    postRole: c.postRole,
    threadCount: byCategory.get(c.id)?._count._all ?? 0,
    lastPostAt: byCategory.get(c.id)?._max.lastPostAt ?? null,
  }));
}

export async function getCategoryThreads(
  db: Pick<ReadsDb, "forumCategory" | "forumThread">,
  viewer: ForumViewer,
  key: string,
  page: number
) {
  const category = await db.forumCategory.findFirst({ where: { ...SITE_SCOPE, key } });
  if (!category || !canSeeCategory(viewer, category)) throw new ForumError("NOT_FOUND", "Category not found.");
  const where = { categoryId: category.id, ...hiddenFilter(viewer) };
  const [threads, total] = await Promise.all([
    db.forumThread.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }],
      skip: (pageOf(page) - 1) * THREADS_PER_PAGE,
      take: THREADS_PER_PAGE,
      select: {
        id: true,
        title: true,
        authorUserId: true,
        authorPersonaId: true,
        pinned: true,
        locked: true,
        postCount: true,
        lastPostAt: true,
      },
    }),
    db.forumThread.count({ where }),
  ]);
  return {
    category: {
      key: category.key,
      name: category.name,
      description: category.description,
      icAllowed: category.icAllowed,
      postRole: category.postRole,
      visibility: category.visibility,
    },
    threads,
    total,
  };
}

export async function getThreadPosts(db: ReadsDb, viewer: ForumViewer, threadId: string, page: number) {
  const row = await db.forumThread.findUnique({ where: { id: threadId }, include: { category: true } });
  if (!row || (row.hidden && !isAdmin(viewer)) || !canSeeCategory(viewer, row.category)) {
    throw new ForumError("NOT_FOUND", "Thread not found.");
  }
  const { category, ...thread } = row;
  const where = { threadId, ...hiddenFilter(viewer) };
  const [posts, total] = await Promise.all([
    db.forumPost.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (pageOf(page) - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
      select: {
        id: true,
        authorUserId: true,
        authorPersonaId: true,
        contentHtml: true,
        editedAt: true,
        createdAt: true,
      },
    }),
    db.forumPost.count({ where }),
  ]);
  return {
    thread,
    category: {
      key: category.key,
      name: category.name,
      icAllowed: category.icAllowed,
      visibility: category.visibility,
      postRole: category.postRole,
    },
    posts,
    total,
  };
}

/** Where a post sits for the `/thinkpages/post/<id>` permalink (ruling P5); null when the viewer cannot see it. */
export async function resolvePostLocation(
  db: Pick<ReadsDb, "forumPost">,
  viewer: ForumViewer,
  postId: string
): Promise<{ threadId: string; page: number } | null> {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      threadId: true,
      createdAt: true,
      hidden: true,
      thread: { select: { hidden: true, category: { select: { visibility: true } } } },
    },
  });
  if (!post) return null;
  const admin = isAdmin(viewer);
  if ((post.hidden || post.thread.hidden) && !admin) return null;
  if (!canSeeCategory(viewer, post.thread.category)) return null;
  const before = await db.forumPost.count({
    where: {
      threadId: post.threadId,
      ...hiddenFilter(viewer),
      OR: [{ createdAt: { lt: post.createdAt } }, { createdAt: post.createdAt, id: { lt: post.id } }],
    },
  });
  return { threadId: post.threadId, page: Math.floor(before / POSTS_PER_PAGE) + 1 };
}

export interface ForumUserAuthor {
  name: string;
  handle: string | null;
}
export interface ForumPersonaAuthor {
  displayName: string;
  username: string;
}

/**
 * Display data for a page of authors in one query per kind. A user is shown by Passport handle, else wiki name,
 * else Discord name, else "Member": never the forum name (it can be a legacy account name) and never a Clerk id.
 */
export async function authorsOf(
  db: AuthorsDb,
  userIds: readonly string[],
  personaIds: ReadonlyArray<string | null | undefined>
) {
  const uniqueUsers = [...new Set(userIds)];
  const uniquePersonas = [...new Set(personaIds.filter((id): id is string => !!id))];
  const [users, personas] = await Promise.all([
    uniqueUsers.length
      ? db.user.findMany({
          where: { id: { in: uniqueUsers } },
          select: { id: true, handle: true, wikiUsername: true, discordUsername: true },
        })
      : [],
    uniquePersonas.length
      ? db.thinkpagesAccount.findMany({
          where: { id: { in: uniquePersonas } },
          select: { id: true, displayName: true, username: true },
        })
      : [],
  ]);
  return {
    users: new Map<string, ForumUserAuthor>(
      users.map((u) => [u.id, { name: u.handle ?? u.wikiUsername ?? u.discordUsername ?? "Member", handle: u.handle }])
    ),
    personas: new Map<string, ForumPersonaAuthor>(
      personas.map((p) => [p.id, { displayName: p.displayName, username: p.username }])
    ),
  };
}
