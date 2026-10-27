/**
 * Watching a thread (spec sections 1 and 4): one row per member and thread. Watching needs a thread the member may
 * read, so the realm board and a staff or Reports thread read as NOT_FOUND; unwatching only deletes the member's own
 * row. Starting a thread and replying watch it automatically (`autoWatch`, after the post committed, so no visibility
 * check). Every call is idempotent.
 */
import type { PrismaClient } from "@prisma/client";
import type { ForumViewer } from "./access";
import { loadVisibleThread, type ReadsDb } from "./reads";

export type WatchDb = ReadsDb & Pick<PrismaClient, "forumThreadWatch">;

export async function autoWatch(
  db: Pick<PrismaClient, "forumThreadWatch">,
  userId: string,
  threadId: string
): Promise<void> {
  await db.forumThreadWatch.createMany({ data: [{ userId, threadId }], skipDuplicates: true });
}

export async function watchThread(
  db: WatchDb,
  viewer: NonNullable<ForumViewer>,
  threadId: string
): Promise<{ watching: true }> {
  const { thread } = await loadVisibleThread(db, viewer, threadId);
  await autoWatch(db, viewer.id, thread.id);
  return { watching: true };
}

export async function unwatchThread(
  db: Pick<PrismaClient, "forumThreadWatch">,
  userId: string,
  threadId: string
): Promise<{ watching: false }> {
  await db.forumThreadWatch.deleteMany({ where: { userId, threadId } });
  return { watching: false };
}

export async function isWatching(
  db: Pick<PrismaClient, "forumThreadWatch">,
  userId: string,
  threadId: string
): Promise<boolean> {
  return (await db.forumThreadWatch.count({ where: { userId, threadId } })) > 0;
}
