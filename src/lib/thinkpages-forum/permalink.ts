/**
 * Where the `/thinkpages/post/<id>` permalink (ruling P5) sends a viewer. Pure, so the server page and the
 * signed-in client gate agree on the destination.
 */
import { threadHref } from "./links";

/** Where a forum post sits, as `thinkpagesForum.resolvePost` answers for a viewer who may see it. */
export interface PostLocation {
  threadId: string;
  page: number;
}

/** A forum post the viewer may see opens its thread page at the post; anything else is a feed post. */
export function permalinkTarget(postId: string, location: PostLocation | null | undefined): string {
  const id = encodeURIComponent(postId);
  return location
    ? `${threadHref(location.threadId)}?page=${location.page}#post-${id}`
    : `/dashboard/post/${id}`;
}
