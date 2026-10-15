/**
 * Economics router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.economics.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - profile: economic profile, labor market, demographics (core get/update)
 *  - fiscal:  fiscal system, income distribution, government budget (get/update)
 *  - config:  comprehensive economy configuration save/get (transaction endpoints)
 */
import { mergeRouters } from "~/server/api/trpc";
import { economicsProfileRouter } from "./profile";
import { economicsFiscalRouter } from "./fiscal";
import { economicsConfigRouter } from "./config";

export const economicsRouter = mergeRouters(
  economicsProfileRouter,
  economicsFiscalRouter,
  economicsConfigRouter
);
