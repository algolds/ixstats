/**
 * Thinkpages ThinkTanks sub-router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.thinkpages.thinktanks.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - groups:     ThinkTank group lifecycle (create / get / update / delete) and invites
 *  - membership: joining, leaving, role management, removal
 *  - messages:   ThinkTank messages and reaction / edit / delete operations
 *  - documents:  collaborative documents (create / get / update / delete)
 */
import { mergeRouters } from "~/server/api/trpc";
import { thinkpagesThinktanksGroupsRouter } from "./groups";
import { thinkpagesThinktanksMembershipRouter } from "./membership";
import { thinkpagesThinktanksMessagesRouter } from "./messages";
import { thinkpagesThinktanksDocumentsRouter } from "./documents";

export const thinkpagesThinktanksRouter = mergeRouters(
  thinkpagesThinktanksGroupsRouter,
  thinkpagesThinktanksMembershipRouter,
  thinkpagesThinktanksMessagesRouter,
  thinkpagesThinktanksDocumentsRouter
);
