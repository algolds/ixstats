/**
 * NPC Personalities router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.npcPersonalities.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - query:     read-only public queries (list, by id, by archetype, by country)
 *  - diplomacy: diplomatic simulation (scenario response, tone, usage tracking)
 *  - admin:     admin-only CRUD, country assignment, and aggregate stats
 */
import { mergeRouters } from "~/server/api/trpc";
import { npcPersonalitiesQueryRouter } from "./query";
import { npcPersonalitiesDiplomacyRouter } from "./diplomacy";
import { npcPersonalitiesAdminRouter } from "./admin";

export const npcPersonalitiesRouter = mergeRouters(
  npcPersonalitiesQueryRouter,
  npcPersonalitiesDiplomacyRouter,
  npcPersonalitiesAdminRouter
);
