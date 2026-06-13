/**
 * Government router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.government.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:       structure reads (getByCountryId / getFullByCountryId), conflict check,
 *                delete, and partial autosave
 *  - lifecycle:  full create / update of the government structure (departments, budgets, revenue)
 *  - budget:     budget & revenue summaries, allocation updates, sub-budget categories
 *  - components: atomic government components, department hierarchy, political metrics,
 *                effectiveness analysis
 */
import { mergeRouters } from "~/server/api/trpc";
import { governmentCrudRouter } from "./crud";
import { governmentLifecycleRouter } from "./lifecycle";
import { governmentBudgetRouter } from "./budget";
import { governmentComponentsRouter } from "./components";

export const governmentRouter = mergeRouters(
  governmentCrudRouter,
  governmentLifecycleRouter,
  governmentBudgetRouter,
  governmentComponentsRouter
);
