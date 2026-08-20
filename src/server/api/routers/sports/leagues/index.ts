/**
 * Sports Leagues Router — domain-split sub-router index (Plan 136)
 *
 * Recombines CRUD, schedule, presets, and admin routers into the unified
 * `sportsLeaguesRouter` via `mergeRouters`. Preserves the exact `api.sports.*`
 * surface without call-site changes.
 */

import { mergeRouters } from "~/server/api/trpc";
import { leaguesCrudRouter } from "./crud";
import { leaguesScheduleRouter } from "./schedule";
import { leaguesPresetsRouter } from "./presets";
import { leaguesAdminRouter } from "./admin";

export const sportsLeaguesRouter = mergeRouters(
  leaguesCrudRouter,
  leaguesScheduleRouter,
  leaguesPresetsRouter,
  leaguesAdminRouter
);
