/**
 * Economic Components router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.economicComponents.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - catalog: public read/usage endpoints (component catalog, templates, usage increment)
 *  - admin:   admin-only usage statistics
 *
 * Components are defined in code (~/lib/economy/atomic-data); there are no edit endpoints.
 */
import { mergeRouters } from "~/server/api/trpc";
import { economicComponentsCatalogRouter } from "./catalog";
import { economicComponentsAdminRouter } from "./admin";

export const economicComponentsRouter = mergeRouters(
  economicComponentsCatalogRouter,
  economicComponentsAdminRouter
);
