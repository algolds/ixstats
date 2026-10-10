/**
 * The `unread` flag of a listed thread and the `unreadThreads` count of a category row, attached by the routers to the
 * existing reads (reads.ts does not grow). Signed-out visitors get false and 0 with no query. The realm board is never
 * counted: its category is left out of the lookup.
 */
import type { PrismaClient } from "@prisma/client";
import { notBoardCategory } from "~/lib/thinkpages-forum/categories";
import { isUnread } from "~/lib/thinkpages-forum/unread";
import type { ForumViewer } from "./access";
import { ownThreadsWhere } from "./reads";
import { readerFloor, unreadIdsOf, type UnreadDb } from "./unread";

export type UnreadAttachDb = Pick<PrismaClient, "forumCategory" | "forumThread"> & UnreadDb;

/** Candidate threads read to count unread ones: the thirty-day window bounds it, this is the backstop. */
const COUNT_ROWS_MAX = 5000;

export async function markUnreadThreads<T extends { id: string; lastPostAt: Date }>(
  db: UnreadDb,
  viewer: ForumViewer,
  threads: readonly T[]
): Promise<Array<T & { unread: boolean }>> {
  const unread = viewer ? await unreadIdsOf(db, viewer.id, threads) : new Set<string>();
  return threads.map((thread) => ({ ...thread, unread: unread.has(thread.id) }));
}

async function unreadCountsByCategory(
  db: UnreadAttachDb,
  viewer: NonNullable<ForumViewer>,
  categoryIds: readonly string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const [categories, floor] = await Promise.all([
    db.forumCategory.findMany({
      where: { id: { in: [...categoryIds] }, ...notBoardCategory() },
      select: { id: true, scope: true, realmId: true, visibility: true },
    }),
    readerFloor(db, viewer.id),
  ]);
  if (categories.length === 0) return counts;
  const threads = await db.forumThread.findMany({
    where: {
      hidden: false,
      lastPostAt: { gt: floor },
      // A Reports category lists only the member's own threads (M8), so only those count.
      OR: categories.map((category) => ({
        categoryId: category.id,
        ...ownThreadsWhere(viewer, category),
      })),
    },
    orderBy: { lastPostAt: "desc" },
    take: COUNT_ROWS_MAX,
    select: {
      categoryId: true,
      lastPostAt: true,
      reads: { where: { userId: viewer.id }, select: { readAt: true } },
    },
  });
  for (const thread of threads) {
    if (isUnread(thread.lastPostAt, thread.reads[0]?.readAt, floor)) {
      counts.set(thread.categoryId, (counts.get(thread.categoryId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Category rows (each with its category `id`) with their unread thread count. */
export async function withUnreadCounts<T extends { id: string }>(
  db: UnreadAttachDb,
  viewer: ForumViewer,
  rows: readonly T[]
): Promise<Array<T & { unreadThreads: number }>> {
  const counts =
    viewer && rows.length > 0
      ? await unreadCountsByCategory(
          db,
          viewer,
          rows.map((row) => row.id)
        )
      : new Map<string, number>();
  return rows.map((row) => ({ ...row, unreadThreads: counts.get(row.id) ?? 0 }));
}
