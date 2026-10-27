/**
 * MyCountry router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.mycountry.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - dashboard:   public read-only queries that populate the executive dashboard
 *                 (country data, national summary, achievements, rankings, milestones)
 *  - first-steps: the welcome page after founding and the "First steps" checklist
 */
import { mergeRouters } from "~/server/api/trpc";
import { myCountryDashboardRouter } from "./dashboard";
import { myCountryFirstStepsRouter } from "./first-steps";

export const myCountryRouter = mergeRouters(myCountryDashboardRouter, myCountryFirstStepsRouter);
