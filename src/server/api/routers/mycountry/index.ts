/**
 * MyCountry router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.mycountry.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - dashboard:   public read-only queries that populate the executive dashboard
 *                 (country data, national summary, achievements, rankings, milestones)
 *  - intelligence: ongoing monitoring and vitality tracking (intelligence feed + vitality
 *                  snapshot updates with notification hooks)
 */
import { mergeRouters } from "~/server/api/trpc";
import { myCountryDashboardRouter } from "./dashboard";
import { myCountryIntelligenceRouter } from "./intelligence";

export const myCountryRouter = mergeRouters(
  myCountryDashboardRouter,
  myCountryIntelligenceRouter
);
