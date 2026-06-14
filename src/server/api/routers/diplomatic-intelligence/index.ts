/**
 * Diplomatic Intelligence router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.diplomaticIntelligence.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - analysis: read-only intelligence queries (briefings, network, activity feed, strategic assessment)
 *  - actions:  mutations (create diplomatic action)
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticIntelligenceAnalysisRouter } from "./analysis";
import { diplomaticIntelligenceActionsRouter } from "./actions";

export const diplomaticIntelligenceRouter = mergeRouters(
  diplomaticIntelligenceAnalysisRouter,
  diplomaticIntelligenceActionsRouter
);
