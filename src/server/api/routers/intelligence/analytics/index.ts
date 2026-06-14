/**
 * Intelligence analytics router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.intelAnalytics.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - insights:   analytics dashboard, advanced analytics, AI recommendations, predictive
 *                models, real-time metrics, and admin briefing creation
 *  - policies:   economic policy CRUD, implementation, and effectiveness analysis
 *  - indicators: public economic indicators and commodity prices
 */
import { mergeRouters } from "~/server/api/trpc";
import { intelAnalyticsInsightsRouter } from "./insights";
import { intelAnalyticsPoliciesRouter } from "./policies";
import { intelAnalyticsIndicatorsRouter } from "./indicators";

export const intelAnalyticsRouter = mergeRouters(
  intelAnalyticsInsightsRouter,
  intelAnalyticsPoliciesRouter,
  intelAnalyticsIndicatorsRouter
);
