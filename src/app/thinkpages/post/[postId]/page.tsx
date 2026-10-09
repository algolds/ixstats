import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { ForumPermalinkGate } from "~/components/thinkpages-forum/ForumPermalinkGate";
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "ThinkPages - IxStats" };

interface LegacyPostPageProps {
  params: Promise<{ postId: string }>;
}

async function isSignedIn(): Promise<boolean> {
  try {
    return Boolean((await auth()).userId);
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

/**
 * The forum post permalink (ruling P5: wiki story chains link here) and the feed's old post URL. A forum post the
 * viewer may see goes to its thread and anchor; anything else is a feed post, at /dashboard/post. Both hops are
 * temporary (ruling R-e): the answer depends on the viewer and on moderation, so it must not be cached as a move.
 * The `.catch` covers an id the input schema rejects (over 64 characters) and a failed lookup.
 *
 * The server's tRPC caller has no session, so this lookup sees what a guest sees. A signed-in viewer it did not
 * place gets the client gate, which asks again with their session (a report thread, a private board, a hidden
 * post for moderators) before falling back to the feed.
 */
export default async function LegacyPostPage({ params }: LegacyPostPageProps) {
  const { postId } = await params;
  const location = await api.thinkpagesForum.resolvePost({ postId }).catch(() => null);
  if (location) redirect(permalinkTarget(postId, location));
  if (await isSignedIn()) return <ForumPermalinkGate postId={postId} />;
  redirect(permalinkTarget(postId, null));
}
