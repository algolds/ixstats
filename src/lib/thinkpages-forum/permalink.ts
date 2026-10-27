/**
 * Where the `/thinkpages/post/<id>` permalink (ruling P5) sends a viewer. Pure, so the server page's destination
 * is tested on its own.
 */
import { realmBoardHref, threadHref } from "./links";

/** Where a forum post sits, as `thinkpagesForum.resolvePost` answers for a viewer who may see it. */
export interface PostLocation {
  threadId: string;
  page: number;
}

/** A realm board message: it sits on its realm's landing page, not in a thread. */
export interface BoardPostLocation {
  realmSlug: string;
}

/**
 * A forum post the viewer may see opens its thread page at the post, a realm board message the realm landing at the
 * message; anything else is a feed post.
 */
export function permalinkTarget(
  postId: string,
  location: PostLocation | BoardPostLocation | null | undefined
): string {
  if (!location) return `/dashboard/post/${encodeURIComponent(postId)}`;
  if ("realmSlug" in location) return realmBoardHref(location.realmSlug, postId);
  return `${threadHref(location.threadId)}?page=${location.page}#post-${encodeURIComponent(postId)}`;
}
