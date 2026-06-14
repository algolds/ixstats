/**
 * Polls router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.polls.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - management: admin CRUD (create, list, toggle active, delete)
 *  - voting:     user voting flow and public poll detail query
 *  - discord:    manual publish-to-Discord embed posting (admin)
 */
import { mergeRouters } from "~/server/api/trpc";
import { pollsManagementRouter } from "./management";
import { pollsVotingRouter } from "./voting";
import { pollsDiscordRouter } from "./discord";

export const pollsRouter = mergeRouters(
  pollsManagementRouter,
  pollsVotingRouter,
  pollsDiscordRouter
);
