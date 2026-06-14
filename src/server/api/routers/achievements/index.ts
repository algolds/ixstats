/**
 * Achievements router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.achievements.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - country:    country-scoped achievement reads (recent / all / leaderboard)
 *  - progress:   user achievement progress and full status with OOL + wiki awards
 *  - management: admin sync, user collector resync, and explicit unlock mutation
 */
import { mergeRouters } from "~/server/api/trpc";
import { achievementsCountryRouter } from "./country";
import { achievementsProgressRouter } from "./progress";
import { achievementsManagementRouter } from "./management";

export const achievementsRouter = mergeRouters(
  achievementsCountryRouter,
  achievementsProgressRouter,
  achievementsManagementRouter
);
