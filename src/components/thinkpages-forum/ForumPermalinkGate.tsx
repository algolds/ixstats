"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

interface ForumPermalinkGateProps {
  postId: string;
  /** Shown while the lookup runs and while redirecting, so the feed's "not found" never flashes. */
  pending: ReactNode;
  /** The feed post page, rendered when the id is not a forum post the viewer can see. */
  children: ReactNode;
}

/**
 * `/thinkpages/post/<id>` (ruling P5): a forum post id redirects to its thread page and anchor;
 * anything else renders the feed post as before.
 */
export function ForumPermalinkGate({ postId, pending, children }: ForumPermalinkGateProps) {
  const router = useRouter();
  const { data: location, isLoading } = api.thinkpagesForum.resolvePost.useQuery(
    { postId },
    { retry: false }
  );

  useEffect(() => {
    if (!location) return;
    router.replace(`/thinkpages/t/${location.threadId}?page=${location.page}#post-${postId}`);
  }, [location, postId, router]);

  return isLoading || location ? pending : children;
}
