/**
 * ThinkPages posts router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.posts.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - posts:     post CRUD (create / update / delete) and pin/unpin
 *  - reactions: add / remove / fetch post reactions (incl. Discord sync)
 *  - bookmarks: per-user bookmark list, lookup, and toggle
 *  - flags:     post flagging (flag / unflag / list / lookup) for moderation
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesPostsPostsRouter } from "./posts";
import { thinkpagesPostsReactionsRouter } from "./reactions";
import { thinkpagesPostsBookmarksRouter } from "./bookmarks";
import { thinkpagesPostsFlagsRouter } from "./flags";

export const thinkpagesPostsRouter = mergeRouters(
  thinkpagesPostsPostsRouter,
  thinkpagesPostsReactionsRouter,
  thinkpagesPostsBookmarksRouter,
  thinkpagesPostsFlagsRouter
);
