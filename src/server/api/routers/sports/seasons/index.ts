/**
 * Sports/seasons router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.sports.*` is byte-identical to the former monolith — no call sites change.
 * (sports/index.ts imports `sportsSeasonsRouter` from "./seasons" which auto-resolves here.)
 *
 * Domains:
 *  - lifecycle:  season start/end transitions, match-revenue collection, season + match reads
 *  - matches:    per-event simulation (regular matchday, playoff round, single race)
 *  - fullseason: bulk simulate-to-end-of-season pipeline
 */
import { mergeRouters } from "~/server/api/trpc";
import { sportsSeasonsLifecycleRouter } from "./lifecycle";
import { sportsSeasonsMatchesRouter } from "./matches";
import { sportsSeasonsFullseasonRouter } from "./fullseason";

export const sportsSeasonsRouter = mergeRouters(
  sportsSeasonsLifecycleRouter,
  sportsSeasonsMatchesRouter,
  sportsSeasonsFullseasonRouter
);
