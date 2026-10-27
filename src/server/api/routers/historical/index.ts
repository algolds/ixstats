/**
 * Historical router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.historical.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - core:        country timeline, vitality rings, budget, aggregated metrics
 */
import { mergeRouters } from "~/server/api/trpc";
import { historicalCoreRouter } from "./core";

export const historicalRouter = mergeRouters(historicalCoreRouter);
