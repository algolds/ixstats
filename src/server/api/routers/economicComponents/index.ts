/**
 * Economic Components router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.economicComponents.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - catalog:    public read/usage endpoints (component catalog, by-type, by-category,
 *                synergies, templates, usage increment)
 *  - components: admin-only component mutations (create / update / delete component)
 *  - admin:      admin-only stats and relationship/template mutations
 *                (usage stats, create synergy, create template)
 */
import { mergeRouters } from "~/server/api/trpc";
import { economicComponentsCatalogRouter } from "./catalog";
import { economicComponentsComponentsRouter } from "./components";
import { economicComponentsAdminRouter } from "./admin";

export const economicComponentsRouter = mergeRouters(
  economicComponentsCatalogRouter,
  economicComponentsComponentsRouter,
  economicComponentsAdminRouter
);
