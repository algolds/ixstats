/**
 * Read-state primitives (docs/superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md, section 2).
 * A member's floor is thirty days back, or later when they marked everything read; a thread is unread when its last
 * post is newer than the later of that floor and what they read of it (`~/lib/thinkpages-forum/unread`). Lists ask for
 * a page of threads' read marks in one query, never one per thread.
 */
import type { PrismaClient } from "@prisma/client";
import { isUnread, unreadFloor } from "~/lib/thinkpages-forum/unread";

export type UnreadDb = Pick<PrismaClient, "forumThreadRead" | "forumReader">;

/** The member's floor now: the oldest last-post time that can still be unread. */
export async function readerFloor(
  db: Pick<PrismaClient, "forumReader">,
  userId: string,
  now: Date = new Date()
): Promise<Date> {
  const reader = await db.forumReader.findUnique({ where: { userId }, select: { allReadAt: true } });
  return unreadFloor(now, reader?.allReadAt ?? null);
}

/** What the member read of each thread, by thread id; a thread they never opened has no entry. */
export async function readTimes(
  db: Pick<PrismaClient, "forumThreadRead">,
  userId: string,
  threadIds: readonly string[]
): Promise<Map<string, Date>> {
  if (threadIds.length === 0) return new Map();
  const rows = await db.forumThreadRead.findMany({
    where: { userId, threadId: { in: [...threadIds] } },
    select: { threadId: true, readAt: true },
  });
  return new Map(rows.map((row) => [row.threadId, row.readAt]));
}

/** Of `threads`, the ids the member has not read: two queries whatever the count. `floor` is reused when the caller has it. */
export async function unreadIdsOf(
  db: UnreadDb,
  userId: string,
  threads: ReadonlyArray<{ id: string; lastPostAt: Date }>,
  floor?: Date
): Promise<Set<string>> {
  if (threads.length === 0) return new Set();
  const [start, reads] = await Promise.all([
    floor ?? readerFloor(db, userId),
    readTimes(
      db,
      userId,
      threads.map((thread) => thread.id)
    ),
  ]);
  return new Set(
    threads.filter((thread) => isUnread(thread.lastPostAt, reads.get(thread.id), start)).map((t) => t.id)
  );
}
