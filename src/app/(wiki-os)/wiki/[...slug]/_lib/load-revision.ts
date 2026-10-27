import "server-only";

import { TRPCError } from "@trpc/server";
import { cache } from "react";
import type { RouterOutputs } from "~/trpc/react";
import { api, prefetchedState } from "~/trpc/server";

export type RevisionHtml = RouterOutputs["wikios"]["getRevisionHtml"];

export type RevisionLoad =
  | { status: "found"; data: RevisionHtml }
  | { status: "missing" }
  /** The revision exists but its text was never imported, or was deleted. */
  | { status: "text-unavailable" }
  /** The render failed or was refused as busy: the client asks again. */
  | { status: "unavailable" };

/**
 * Prime this request's query cache with the old revision `RevisionView` asks for (the same input)
 * and say what came of it. One attempt, no retries, like `loadArticle`.
 */
export const loadRevision = cache(async (ref: string): Promise<RevisionLoad> => {
  await api.wikios.getRevisionHtml.prefetch({ ref }, { retry: false });

  const state = prefetchedState<RevisionHtml>(["wikios", "getRevisionHtml"], { ref });
  if (state?.status === "success" && state.data) return { status: "found", data: state.data };
  if (state?.error instanceof TRPCError) {
    if (state.error.code === "NOT_FOUND") return { status: "missing" };
    if (state.error.code === "PRECONDITION_FAILED") return { status: "text-unavailable" };
  }
  return { status: "unavailable" };
});
