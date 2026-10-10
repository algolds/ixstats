import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import { locatePostFor } from "~/server/api/routers/thinkpagesForum/permalink";
import { db } from "~/server/db";

export const metadata: Metadata = { title: "ThinkPages - IxStats" };

interface LegacyPostPageProps {
  params: Promise<{ postId: string }>;
}

/** The signed-in Clerk user id, or null when signed out or the session cannot be read. */
async function sessionUserId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

/**
 * The forum post permalink (ruling P5: wiki story chains link here) and the feed's old post URL. A forum post the
 * viewer may see goes to its thread page and anchor, with the page counted as their thread view counts it; anything
 * else is a feed post, at /dashboard/post, the same answer as for any unknown id, so nothing hidden is revealed.
 * Both hops are temporary (ruling R-e): the answer depends on the viewer and on moderation, so it must not be
 * cached as a move. The lookup runs as the session's viewer (P1); lookup failures surface.
 */
export default async function LegacyPostPage({ params }: LegacyPostPageProps) {
  const { postId } = await params;
  const location = await locatePostFor(db, await sessionUserId(), postId);
  redirect(permalinkTarget(postId, location));
}
