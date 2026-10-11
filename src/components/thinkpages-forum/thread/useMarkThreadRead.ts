"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useReadStateRefresh } from "../useReadStateRefresh";

interface MarkThreadReadArgs {
  threadId: string;
  page: number;
  signedIn: boolean;
  /** The last post the page shows; nothing is marked before there is one. */
  newestPostId: string | undefined;
}

/**
 * The thread page was shown, so the member has read up to its newest post on this page (spec section 2). It fires once
 * per thread, page and newest shown post: a reply or a refetch that brings a newer post changes the key, so the member's
 * own reply (shown straight after it is posted) is read too. A write on every GET is not allowed, so this is a mutation
 * fired by the page. After it, the lists and counts that show unread are refreshed.
 */
export function useMarkThreadRead({
  threadId,
  page,
  signedIn,
  newestPostId,
}: MarkThreadReadArgs): void {
  const refresh = useReadStateRefresh();
  const { mutateAsync: markRead } = api.thinkpagesForum.markThreadRead.useMutation();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!signedIn || !newestPostId) return;
    const key = `${threadId}:${page}:${newestPostId}`;
    if (done.current === key) return;
    done.current = key;
    markRead({ threadId, page }).then(
      // The mark is saved; a failed refresh of the lists is not an error to report.
      () => void refresh().catch(() => undefined),
      () => {
        // Not saved. The key stays, so a re-render does not retry in a loop; the next change of page or newest post
        // tries again.
      }
    );
  }, [signedIn, threadId, page, newestPostId, markRead, refresh]);
}
