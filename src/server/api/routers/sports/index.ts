/**
 * Sports router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.sports.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - leagues:   league CRUD, schedule, drafts, presets, entity search
 *  - teams:     team management, tactics, sponsors, training, lineups, clubs
 *  - seasons:   season lifecycle, match/playoff/race simulation, match revenue
 *  - standings: standings, brackets, race results, league/team history, records
 *  - transfers: player transfer listings, bids, valuations
 *  - club:      stadium upgrades, ticket pricing, patron saints
 */
import { mergeRouters } from "~/server/api/trpc";
import { sportsLeaguesRouter } from "./leagues";
import { sportsTeamsRouter } from "./teams";
import { sportsSeasonsRouter } from "./seasons";
import { sportsStandingsRouter } from "./standings";
import { sportsTransfersRouter } from "./transfers";
import { sportsClubRouter } from "./club";
import { sportsPredictionsRouter } from "./predictions";

export const sportsRouter = mergeRouters(
  sportsLeaguesRouter,
  sportsTeamsRouter,
  sportsSeasonsRouter,
  sportsStandingsRouter,
  sportsTransfersRouter,
  sportsClubRouter,
  sportsPredictionsRouter
);
