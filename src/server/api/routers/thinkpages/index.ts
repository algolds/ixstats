/**
 * ThinkPages router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - accounts:   ThinkPages account/profile CRUD
 *  - posts:      posts, reactions, bookmarks, flags, pins
 *  - feed:       trending topics, country mood, citizen reactions, Discord topic/emojis
 *  - thinktanks: ThinkTank groups, members, messages, documents
 *  - messaging:  ThinkShare DM conversations, messages, presence
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "./accounts";
import { thinkpagesPostsRouter } from "./posts";
import { thinkpagesFeedRouter } from "./feed";
import { thinkpagesThinktanksRouter } from "./thinktanks";
import { thinkpagesMessagingRouter } from "./messaging";

export const thinkpagesRouter = mergeRouters(
  thinkpagesAccountsRouter,
  thinkpagesPostsRouter,
  thinkpagesFeedRouter,
  thinkpagesThinktanksRouter,
  thinkpagesMessagingRouter,
);
