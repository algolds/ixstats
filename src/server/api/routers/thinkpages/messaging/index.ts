/**
 * ThinkPages messaging router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.*` for messaging (conversations / messages / presence) is byte-identical
 * to the former monolith — no call sites change.
 *
 * Domains:
 *  - conversations: ThinkShare DM conversation CRUD (create / list / create-by-country)
 *  - messages:      ThinkShare DM message read/write (get messages, send, mark read)
 *  - presence:      user online presence (update / get for users)
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesMessagingConversationsRouter } from "./conversations";
import { thinkpagesMessagingMessagesRouter } from "./messages";
import { thinkpagesMessagingPresenceRouter } from "./presence";

export const thinkpagesMessagingRouter = mergeRouters(
  thinkpagesMessagingConversationsRouter,
  thinkpagesMessagingMessagesRouter,
  thinkpagesMessagingPresenceRouter
);
