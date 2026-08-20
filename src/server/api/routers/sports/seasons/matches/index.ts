/**
 * Sports Seasons — Matches Router Index (Plan 137)
 *
 * Recombines match day, playoff round, and race simulation sub-routers into the unified
 * `sportsSeasonsMatchesRouter` via `mergeRouters`.
 */

import { mergeRouters } from "~/server/api/trpc";
import { matchDaySimulationRouter } from "./matchDay";
import { playoffsSimulationRouter } from "./playoffs";
import { raceSimulationRouter } from "./race";

export const sportsSeasonsMatchesRouter = mergeRouters(
  matchDaySimulationRouter,
  playoffsSimulationRouter,
  raceSimulationRouter
);
