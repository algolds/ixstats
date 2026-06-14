/**
 * Government Components router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.governmentComponents.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - catalog: public component catalog queries (list, by type, by category, synergies) and public usage tracking
 *  - admin:   admin-only management (usage stats, custom synergy creation, stub create/update/delete)
 */
import { mergeRouters } from "~/server/api/trpc";
import { governmentComponentsCatalogRouter } from "./catalog";
import { governmentComponentsAdminRouter } from "./admin";

export const governmentComponentsRouter = mergeRouters(
  governmentComponentsCatalogRouter,
  governmentComponentsAdminRouter
);
