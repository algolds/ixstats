"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface PagedThread<C extends { id: string }> {
  id: string;
  /** The first page of the thread's comments. */
  comments: C[];
  hasMoreComments: boolean;
}

/**
 * One thread's comments as the reader has paged them: the first page the thread arrived with, then
 * the pages "Show more replies" fetched (100 at a time, after the last comment held), and deleting a
 * comment, which also drops it from the pages fetched here.
 */
export function useThreadComments<C extends { id: string }>(
  thread: PagedThread<C>,
  onRefetch: () => void
) {
  const utils = api.useUtils();
  const notify = useNotify();
  const [moreComments, setMoreComments] = useState<C[]>([]);
  const [moreCursor, setMoreCursor] = useState<string | null | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const comments = useMemo(() => {
    const seen = new Set(thread.comments.map((c) => c.id));
    return [...thread.comments, ...moreComments.filter((c) => !seen.has(c.id))];
  }, [thread.comments, moreComments]);
  // Until the reader pages once, the first page's flag says whether more exist; then the cursor does.
  const hasMore = moreCursor === undefined ? thread.hasMoreComments : moreCursor !== null;

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const page = await utils.wikios.getThreadComments.fetch({
        threadId: thread.id,
        cursor: comments.at(-1)?.id,
      });
      setMoreComments((prev) => [...prev, ...(page.comments as unknown as C[])]);
      setMoreCursor(page.nextCursor);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to load replies");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const deleteComment = api.wikios.deleteComment.useMutation({
    onSuccess: (result, variables) => {
      setMoreComments((prev) => prev.filter((c) => c.id !== variables.commentId));
      notify.success(result.threadDeleted ? "Thread deleted" : "Comment deleted");
      onRefetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to delete comment");
    },
  });

  return { comments, hasMore, isLoadingMore, loadMore, deleteComment };
}
