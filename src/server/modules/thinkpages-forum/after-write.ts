/**
 * What happens after a forum write commits (spec section 4), called by the routers without awaiting them: the author
 * starts watching the thread (starting a thread and replying; an edit or a board message does not), then the post's
 * notices go out. Both are best effort and log their failures: nothing here ever throws, so a post is never failed by
 * a notice.
 */
import { notifyForumPost, type NoticeActor, type NotifyDb } from "./post-notify";
import { notifyReaction, type ReactionNoticeDb } from "./reaction-notify";
import { autoWatch } from "./watch";

async function watchQuietly(db: NotifyDb, userId: string, threadId: string): Promise<void> {
  try {
    await autoWatch(db, userId, threadId);
  } catch (error) {
    console.error("[thinkpages-forum] Auto-watch failed:", error);
  }
}

export async function afterThreadStarted(
  db: NotifyDb,
  actor: NoticeActor,
  created: { threadId: string; postId: string }
): Promise<void> {
  await watchQuietly(db, actor.id, created.threadId);
  await notifyForumPost(db, actor, { postId: created.postId, edited: false });
}

export async function afterReply(
  db: NotifyDb,
  actor: NoticeActor,
  input: { threadId: string; postId: string }
): Promise<void> {
  await watchQuietly(db, actor.id, input.threadId);
  await notifyForumPost(db, actor, { postId: input.postId, edited: false });
}

export function afterBoardMessage(db: NotifyDb, actor: NoticeActor, postId: string): Promise<void> {
  return notifyForumPost(db, actor, { postId, edited: false });
}

/** An edit of a thread post or a board message: only the mentions it adds are told. */
export function afterEdit(db: NotifyDb, actor: NoticeActor, postId: string): Promise<void> {
  return notifyForumPost(db, actor, { postId, edited: true });
}

/** A reaction to a post: only its owner is told (once), and nothing is watched. */
export function afterReaction(
  db: ReactionNoticeDb,
  actor: NoticeActor,
  postId: string
): Promise<void> {
  return notifyReaction(db, actor, { postId });
}
