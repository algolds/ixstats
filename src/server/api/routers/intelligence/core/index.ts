/**
 * Intelligence core router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.intelCore.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - dashboard:  executive overview, quick actions, cabinet meetings, strategic plans
 *  - diplomatic: diplomatic channels, secure messaging, intelligence feed, key findings
 *  - actions:    quick action execution (single mutation)
 */
import { mergeRouters } from "~/server/api/trpc";
import { intelCoreDashboardRouter } from "./dashboard";
import { intelCoreDiplomaticRouter } from "./diplomatic";
import { intelCoreActionsRouter } from "./actions";

export const intelCoreRouter = mergeRouters(
  intelCoreDashboardRouter,
  intelCoreDiplomaticRouter,
  intelCoreActionsRouter
);
