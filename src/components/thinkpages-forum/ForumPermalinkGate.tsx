"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SystemRestart as Loader2 } from "iconoir-react";
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import { api } from "~/trpc/react";

/**
 * The post permalink for a signed-in viewer the server's lookup did not place. The server asks as a guest, so a
 * member's report thread, a private realm board or a hidden post for a moderator only resolves here, with the
 * viewer's session. Replaces the URL with the thread anchor, or with the feed post when the viewer cannot see a
 * forum post by that id (the same answer as for any other id, so nothing hidden is revealed).
 */
export function ForumPermalinkGate({ postId }: { postId: string }) {
  const router = useRouter();
  const { data: location, isPending } = api.thinkpagesForum.resolvePost.useQuery(
    { postId },
    { retry: false }
  );

  useEffect(() => {
    if (!isPending) router.replace(permalinkTarget(postId, location));
  }, [isPending, location, postId, router]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="text-label-secondary size-8 animate-spin" aria-label="Loading" />
      </div>
    </div>
  );
}
