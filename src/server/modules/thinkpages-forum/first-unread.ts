/**
 * "Jump to unread": the first visible post of a thread newer than what the member has read (and than their thirty-day
 * floor), else the thread's last visible post. The caller resolves the post to its page with `resolvePostLocation`.
 */
import { seenSince } from "~/lib/thinkpages-forum/unread";
import type { ForumViewer } from "./access";
import { hiddenFilter, loadVisibleThread, type ReadsDb } from "./reads";
import { readerFloor, type UnreadDb } from "./unread";

export async function firstUnreadPost(
  db: ReadsDb & UnreadDb,
  viewer: NonNullable<ForumViewer>,
  threadId: string
): Promise<string | null> {
  const { thread, category } = await loadVisibleThread(db, viewer, threadId);
  const [floor, read] = await Promise.all([
    readerFloor(db, viewer.id),
    db.forumThreadRead.findUnique({
      where: { userId_threadId: { userId: viewer.id, threadId: thread.id } },
      select: { readAt: true },
    }),
  ]);
  const seen = seenSince(read?.readAt, floor);
  const visible = { threadId: thread.id, ...hiddenFilter(viewer, category) };
  const next = await db.forumPost.findFirst({
    where: { ...visible, createdAt: { gt: seen } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (next) return next.id;
  const last = await db.forumPost.findFirst({
    where: visible,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return last?.id ?? null;
}
