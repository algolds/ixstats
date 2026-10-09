/**
 * A thread's `postCount` and `lastPostAt` (phase 3, shared with the phase 4 importer): both count the thread's
 * visible posts only, as members see them, and are recomputed under the thread's row lock so a concurrent reply is
 * never lost. Moderators see hidden posts badged but not counted.
 */
import type { PrismaClient } from "@prisma/client";

export type ThreadTx = Pick<PrismaClient, "forumThread" | "forumPost" | "$executeRaw">;

/**
 * Locks the thread row for the rest of the transaction. A reply updates the same row, so a recount made under the
 * lock sees every committed reply, and a reply still in flight increments the recounted value after it.
 */
export async function lockThread(tx: ThreadTx, threadId: string): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM "forum_threads" WHERE "id" = ${threadId} FOR NO KEY UPDATE`;
}

/** postCount and lastPostAt from the thread's visible posts (what members see); lastPostAt kept when none is. */
export async function recountThread(tx: ThreadTx, threadId: string): Promise<void> {
  const visible = { threadId, hidden: false };
  const postCount = await tx.forumPost.count({ where: visible });
  const latest = await tx.forumPost.aggregate({ where: visible, _max: { createdAt: true } });
  const lastPostAt = latest._max.createdAt;
  await tx.forumThread.update({
    where: { id: threadId },
    data: { postCount, ...(lastPostAt && { lastPostAt }) },
  });
}
