/**
 * ThinkPages posts reactions sub-router — split by concern (2026-06-13).
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.posts.reactions.*` is byte-identical to the former monolith —
 * no call sites change.
 *
 * Concerns:
 *  - mutations: add/remove reactions (write, with Discord sync)
 *  - queries:   fetch post reactions with account details (read)
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesPostsReactionsMutationsRouter } from "./mutations";
import { thinkpagesPostsReactionsQueriesRouter } from "./queries";

export const thinkpagesPostsReactionsRouter = mergeRouters(
  thinkpagesPostsReactionsMutationsRouter,
  thinkpagesPostsReactionsQueriesRouter
);
