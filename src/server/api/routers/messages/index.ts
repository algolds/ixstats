/**
 * Messages router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.messages.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - conversations: folder listings, conversation creation, manual bridge sync
 *  - participants:  leave / add / read-state / user-search operations
 *  - messaging:     message-level CRUD, reactions, system-notification clearing
 */
import { mergeRouters } from "~/server/api/trpc";
import { messagesConversationsRouter } from "./conversations";
import { messagesParticipantsRouter } from "./participants";
import { messagesMessagingRouter } from "./messaging";

export const messagesRouter = mergeRouters(
  messagesConversationsRouter,
  messagesParticipantsRouter,
  messagesMessagingRouter
);
