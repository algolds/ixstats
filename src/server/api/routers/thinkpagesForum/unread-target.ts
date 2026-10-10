/**
 * Where `/thinkpages/t/<id>/unread` sends a viewer (spec section 2): the thread page at the first post they have not
 * read, or at the last post when they have read it all. The page is a server component with no tRPC session, so it
 * resolves as the session's viewer (as the post permalink does). Signed-out visitors, and any refusal, get the thread.
 */
import { FORUM_HOME, threadHref } from "~/lib/thinkpages-forum/links";
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import {
  firstUnreadPost,
  ForumError,
  resolvePostLocation,
  type ReadsDb,
  type UnreadDb,
} from "~/server/modules/thinkpages-forum";
import { viewerForClerkUser, type PermalinkDb } from "./permalink";
import { id } from "./viewer";

export async function unreadTargetFor(
  db: PermalinkDb & ReadsDb & UnreadDb,
  clerkUserId: string | null,
  threadId: string
): Promise<string> {
  if (!id.safeParse(threadId).success) return FORUM_HOME;
  const viewer = await viewerForClerkUser(db, clerkUserId);
  if (!viewer) return threadHref(threadId);
  try {
    const postId = await firstUnreadPost(db, viewer, threadId);
    const location = postId ? await resolvePostLocation(db, viewer, postId) : null;
    return postId && location ? permalinkTarget(postId, location) : threadHref(threadId);
  } catch (error) {
    if (error instanceof ForumError) return threadHref(threadId);
    throw error;
  }
}
