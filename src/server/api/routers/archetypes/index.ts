/**
 * Archetypes router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.archetypes.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - queries:    read-only procedures (categories, selectable, by-category, usage stats, user selections, country matches)
 *  - selections: user mutation to update their archetype selections
 *  - admin:      admin/system mutations (recalc, create, update, delete, initialize)
 */
import { mergeRouters } from "~/server/api/trpc";
import { archetypesQueriesRouter } from "./queries";
import { archetypesSelectionsRouter } from "./selections";
import { archetypesAdminRouter } from "./admin";

export const archetypesRouter = mergeRouters(
  archetypesQueriesRouter,
  archetypesSelectionsRouter,
  archetypesAdminRouter
);
