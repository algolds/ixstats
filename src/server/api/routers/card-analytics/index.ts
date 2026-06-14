/**
 * Card Analytics router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cardAnalytics.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - economy: card economy overview, value history, GDP correlation
 *  - market:  recent market activity, user portfolio performance
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardAnalyticsEconomyRouter } from "./economy";
import { cardAnalyticsMarketRouter } from "./market";

export const cardAnalyticsRouter = mergeRouters(
  cardAnalyticsEconomyRouter,
  cardAnalyticsMarketRouter
);
