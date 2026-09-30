/**
 * Sports Seasons — Matches Router Index (Plan 137)
 *
 * Match-day simulation. The standalone playoff-round and race sub-routers were removed
 * (plan 341): their logic is inlined in `../fullseason.ts` and they had no callers.
 */

import { matchDaySimulationRouter } from "./matchDay";

export const sportsSeasonsMatchesRouter = matchDaySimulationRouter;
