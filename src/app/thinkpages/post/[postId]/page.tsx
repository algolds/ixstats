import { redirect } from "next/navigation";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/server";

interface LegacyPostPageProps {
  params: Promise<{ postId: string }>;
}

/**
 * The forum post permalink (ruling P5: wiki story chains link here) and the feed's old post URL. A forum post the
 * viewer may see goes to its thread and anchor; anything else is a feed post, at /dashboard/post. Both hops are
 * temporary (ruling R-e): the answer depends on the viewer and on moderation, so it must not be cached as a move.
 * The `.catch` covers an id the input schema rejects (over 64 characters) and a failed lookup: the feed page then
 * says "Post not found", as the old client page did.
 */
export default async function LegacyPostPage({ params }: LegacyPostPageProps) {
  const { postId } = await params;
  const id = encodeURIComponent(postId);
  const location = await api.thinkpagesForum.resolvePost({ postId }).catch(() => null);
  if (location) redirect(`${threadHref(location.threadId)}?page=${location.page}#post-${id}`);
  redirect(`/dashboard/post/${id}`);
}
