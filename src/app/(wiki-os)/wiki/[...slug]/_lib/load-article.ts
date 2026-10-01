import "server-only";

import { TRPCError } from "@trpc/server";
import { cache } from "react";
import { articleHtmlInput } from "~/lib/wiki-os/config";
import type { RouterOutputs } from "~/trpc/react";
import { api, prefetchedState } from "~/trpc/server";

export type ArticleHtml = RouterOutputs["wikios"]["getArticleHtml"];

export type ArticleLoad =
  | { status: "found"; data: ArticleHtml }
  /** The page does not exist (or the title cannot be one): a 404. */
  | { status: "missing" }
  /** The lookup failed or was refused as busy: the page may well exist, and the client asks again. */
  | { status: "unavailable" };

/**
 * Prime this request's query cache with the article the client reader asks for (the same input, so
 * the client finds it in the hydrated cache and does not fetch again) and say what came of it.
 * Cached per request: `generateMetadata` and the page both call it, and the article is read once.
 * One attempt, no retries: a missing page must answer a 404 at once, not after backoff.
 */
export const loadArticle = cache(
  async (title: string, followRedirect: boolean): Promise<ArticleLoad> => {
    const input = articleHtmlInput(title, "ixwiki", { followRedirect });
    await api.wikios.getArticleHtml.prefetch(input, { retry: false });

    const state = prefetchedState<ArticleHtml>(["wikios", "getArticleHtml"], input);
    if (state?.status === "success" && state.data) return { status: "found", data: state.data };
    if (state?.error instanceof TRPCError && state.error.code === "NOT_FOUND") {
      return { status: "missing" };
    }
    return { status: "unavailable" };
  }
);
