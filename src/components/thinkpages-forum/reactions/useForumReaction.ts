"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { useCallback, useRef, useState } from "react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import type { BoardData } from "../realm/types";
import type { ThreadData } from "../thread/types";
import {
  chooseReaction,
  patchBoard,
  patchThread,
  readBoard,
  readThread,
  settledReaction,
  type ReactionState,
  type Reduce,
} from "./reaction-cache";

const threadKey = () => getQueryKey(api.thinkpagesForum.thread);
const boardKey = () => getQueryKey(api.thinkpagesForum.getBoard);

/** The post's counts and reaction as the first cached thread or board page holding it shows them. */
function currentState(queryClient: QueryClient, postId: string): ReactionState | null {
  for (const [, data] of queryClient.getQueriesData<ThreadData>({ queryKey: threadKey() })) {
    const found = readThread(data, postId);
    if (found) return found;
  }
  for (const [, data] of queryClient.getQueriesData<BoardData>({ queryKey: boardKey() })) {
    const found = readBoard(data, postId);
    if (found) return found;
  }
  return null;
}

/** Applies `reduce` to the post in every cached thread and board page that holds it. */
function patchAll(queryClient: QueryClient, postId: string, reduce: Reduce): void {
  for (const [key, data] of queryClient.getQueriesData<ThreadData>({ queryKey: threadKey() })) {
    const next = patchThread(data, postId, reduce);
    if (next !== data) queryClient.setQueryData(key, next);
  }
  for (const [key, data] of queryClient.getQueriesData<BoardData>({ queryKey: boardKey() })) {
    const next = patchBoard(data, postId, reduce);
    if (next !== data) queryClient.setQueryData(key, next);
  }
}

/**
 * Sets or clears the viewer's reaction to one post (`null` clears) with an optimistic update (spec section 4): in-flight
 * reads are cancelled, every cached page holding the post shows the change at once, and the server's counts replace it
 * when it answers. A failure puts that post back as it was and says so. One request at a time: a call while one is in
 * flight is ignored.
 */
export function useForumReaction(postId: string) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { mutateAsync: react } = api.thinkpagesForum.react.useMutation();
  const { mutateAsync: unreact } = api.thinkpagesForum.unreact.useMutation();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  const set = useCallback(
    async (next: string | null): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      const before = currentState(queryClient, postId);
      try {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: threadKey() }),
          queryClient.cancelQueries({ queryKey: boardKey() }),
        ]);
        patchAll(queryClient, postId, chooseReaction(next));
        const result =
          next === null ? await unreact({ postId }) : await react({ postId, type: next });
        patchAll(queryClient, postId, settledReaction(result.counts, result.mine));
      } catch (error) {
        if (before) patchAll(queryClient, postId, settledReaction(before.counts, before.mine));
        notify.error(
          "Could not update your reaction",
          error instanceof Error ? error.message : undefined
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [queryClient, notify, postId, react, unreact]
  );

  return { set, pending };
}
