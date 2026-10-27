/**
 * Government router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.government.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:       structure reads (getByCountryId / getFullByCountryId) and starting a budget year
 *  - budget:     the owner's National budget edits (structure, departments, allocations) and
 *                policy maintenance spent per year
 */
import { mergeRouters } from "~/server/api/trpc";
import { governmentCrudRouter } from "./crud";
import { governmentBudgetRouter } from "./budget";

export const governmentRouter = mergeRouters(governmentCrudRouter, governmentBudgetRouter);
