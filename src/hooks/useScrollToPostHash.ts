"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import { api } from "~/trpc/react";

const POST_HASH = "#post-";

/** The post id a `#post-<id>` hash names, or null for a malformed escape. */
function postIdOf(hash: string): string | null {
  try {
    return decodeURIComponent(hash.slice(POST_HASH.length));
  } catch {
    return null;
  }
}

/**
 * Scrolls to `#post-<id>` once that page's posts are on screen (permalinks, after a reply), once per hash and page:
 * a refetch (saving an edit, a moderator action) leaves the reader where they are. When the post is not on this
 * page (a link counted without the hidden posts a moderator sees, or posts added or hidden since), asks where it
 * sits for this viewer and moves there, so the scroll happens on the right page (P2).
 */
export function useScrollToPostHash(posts: readonly { id: string }[], threadId: string, page: number) {
  const router = useRouter();
  const utils = api.useUtils();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    const key = `${page}${hash}`;
    if (posts.length === 0 || !hash.startsWith(POST_HASH) || handled.current === key) return;
    handled.current = key;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ block: "start" });
      return;
    }
    const postId = postIdOf(hash);
    if (postId === null) return;
    void utils.thinkpagesForum.resolvePost
      .fetch({ postId })
      .then((at) => {
        if (at && (at.threadId !== threadId || at.page !== page))
          router.replace(permalinkTarget(postId, at));
      })
      .catch(() => undefined);
  }, [posts, threadId, page, utils, router]);
}
