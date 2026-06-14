/**
 * ThinkPages posts/posts router — split across files by concern (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.posts.*` is byte-identical to the former monolith — no call sites change.
 *
 * Concerns:
 *  - create:  post creation flow (notifications, mentions, credits, Discord autopost)
 *  - modify:  mutations on existing posts (update / delete / pin-unpin)
 *  - queries: read-only post lookups (single post, posts by user)
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesPostsPostsCreateRouter } from "./create";
import { thinkpagesPostsPostsModifyRouter } from "./modify";
import { thinkpagesPostsPostsQueriesRouter } from "./queries";

export const thinkpagesPostsPostsRouter = mergeRouters(
  thinkpagesPostsPostsCreateRouter,
  thinkpagesPostsPostsModifyRouter,
  thinkpagesPostsPostsQueriesRouter
);
