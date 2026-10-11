/**
 * The four ways a member marks things read: a thread (opened by its page), a board ("Mark board read"), everything
 * ("Mark all read"), and the realm board on the realm landing. Every mark is idempotent and only moves a read time
 * forward. The thread mark reads the newest visible post of the page the member is shown from the database, never from
 * the client, and never past the thread's last post.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import type { ForumViewer } from "./access";
import { advertGate } from "./advert-access";
import { boardThreadOf } from "./board-thread";
import { ForumError } from "./errors";
import { canSeeRealm, loadForumRealm } from "./realm-access";
import {
  hiddenFilter,
  loadCategory,
  loadVisibleThread,
  ownThreadsWhere,
  type CategoryLocator,
  type ReadsDb,
} from "./reads";
import { readerFloor, unreadIdsOf, type UnreadDb } from "./unread";

export type ReadMarksDb = ReadsDb &
  UnreadDb &
  Pick<PrismaClient, "forumThreadWatch" | "$executeRaw">;

/** Threads of one board read per round of "Mark board read". */
export const MARK_CATEGORY_CHUNK = 500;
/**
 * ponytail: one "Mark board read" covers at most this many threads of the board (newest first, inside the thirty-day
 * window), so a very busy board needs a second press. The window bounds it in practice; this is the backstop.
 */
export const MARK_CATEGORY_MAX = 5000;

/** Moves the member's read time of a thread forward to `readAt`: a create when none, then a bump only if older. */
async function advanceRead(
  db: Pick<PrismaClient, "forumThreadRead">,
  userId: string,
  threadId: string,
  readAt: Date
): Promise<void> {
  await db.forumThreadRead.createMany({
    data: [{ userId, threadId, readAt }],
    skipDuplicates: true,
  });
  await db.forumThreadRead.updateMany({
    where: { userId, threadId, readAt: { lt: readAt } },
    data: { readAt },
  });
}

export async function markThreadRead(
  db: ReadMarksDb,
  viewer: NonNullable<ForumViewer>,
  input: { threadId: string; page: number }
): Promise<{ readAt: Date | null }> {
  const { thread, category } = await loadVisibleThread(db, viewer, input.threadId);
  const page = Math.max(1, Math.floor(input.page));
  const shown = await db.forumPost.findMany({
    where: { threadId: thread.id, ...hiddenFilter(viewer, category) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * POSTS_PER_PAGE,
    take: POSTS_PER_PAGE,
    select: { createdAt: true },
  });
  const newest = shown.at(-1)?.createdAt;
  if (!newest) return { readAt: null };
  const readAt = newest > thread.lastPostAt ? thread.lastPostAt : newest;
  await advanceRead(db, viewer.id, thread.id, readAt);
  // Visiting the thread re-arms its watch: the next reply notifies again.
  await db.forumThreadWatch.updateMany({
    where: { userId: viewer.id, threadId: thread.id, notifiedAt: { not: null } },
    data: { notifiedAt: null },
  });
  return { readAt };
}

export async function markCategoryRead(
  db: ReadMarksDb,
  viewer: NonNullable<ForumViewer>,
  where: CategoryLocator
): Promise<{ marked: number }> {
  const { category } = await loadCategory(db, viewer, where);
  const floor = await readerFloor(db, viewer.id);
  let marked = 0;
  let cursor: { id: string; lastPostAt: Date } | undefined;
  for (let scanned = 0; scanned < MARK_CATEGORY_MAX; scanned += MARK_CATEGORY_CHUNK) {
    const threads = await db.forumThread.findMany({
      where: {
        categoryId: category.id,
        hidden: false,
        lastPostAt: { gt: floor },
        ...ownThreadsWhere(viewer, category),
        // The advert gate and the keyset cursor are both `AND` parts: a spread would let one replace the other.
        AND: [
          advertGate(viewer),
          ...(cursor
            ? [
                {
                  OR: [
                    { lastPostAt: { lt: cursor.lastPostAt } },
                    { lastPostAt: cursor.lastPostAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ lastPostAt: "desc" }, { id: "desc" }],
      take: MARK_CATEGORY_CHUNK,
      select: { id: true, lastPostAt: true },
    });
    marked += await markUnreadOf(db, viewer.id, threads, floor);
    cursor = threads.at(-1);
    if (threads.length < MARK_CATEGORY_CHUNK) break;
  }
  return { marked };
}

/**
 * Marks the unread ones of `threads` read up to their last post, in one statement; how many. The upsert only moves a
 * read time forward (`WHERE` on the conflict), so a concurrent advance after the unread check is never lowered.
 */
async function markUnreadOf(
  db: ReadMarksDb,
  userId: string,
  threads: ReadonlyArray<{ id: string; lastPostAt: Date }>,
  floor: Date
): Promise<number> {
  const unread = await unreadIdsOf(db, userId, threads, floor);
  const rows = threads.filter((thread) => unread.has(thread.id));
  if (rows.length === 0) return 0;
  const values = rows.map((thread) => Prisma.sql`(${userId}, ${thread.id}, ${thread.lastPostAt})`);
  await db.$executeRaw(Prisma.sql`
    INSERT INTO forum_thread_reads ("userId", "threadId", "readAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("userId", "threadId") DO UPDATE SET "readAt" = EXCLUDED."readAt"
    WHERE forum_thread_reads."readAt" < EXCLUDED."readAt"`);
  return rows.length;
}

export async function markAllRead(
  db: Pick<PrismaClient, "forumReader">,
  userId: string,
  now: Date = new Date()
): Promise<{ allReadAt: Date }> {
  await db.forumReader.upsert({
    where: { userId },
    create: { userId, allReadAt: now },
    update: { allReadAt: now },
  });
  return { allReadAt: now };
}

/** The realm landing was opened at the top: the realm board is read up to its last message. */
export async function markRealmBoardRead(
  db: Pick<PrismaClient, "realm" | "forumThread" | "forumThreadRead">,
  viewer: NonNullable<ForumViewer>,
  realmSlug: string
): Promise<{ readAt: Date | null }> {
  const realm = await loadForumRealm(db, { slug: realmSlug });
  if (!realm || !canSeeRealm(viewer, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  const board = await boardThreadOf(db, realm.id);
  if (!board) return { readAt: null };
  const thread = await db.forumThread.findUnique({
    where: { id: board.threadId },
    select: { lastPostAt: true },
  });
  if (!thread) return { readAt: null };
  await advanceRead(db, viewer.id, board.threadId, thread.lastPostAt);
  return { readAt: thread.lastPostAt };
}
