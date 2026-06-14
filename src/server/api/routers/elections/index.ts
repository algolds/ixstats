/**
 * Elections router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.elections.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - parties:     political party CRUD (get/create/update/delete)
 *  - legislature: legislature config and queries
 *  - elections:   election lifecycle, candidates, simulation, parliament view
 */
import { mergeRouters } from "~/server/api/trpc";
import { electionsPartiesRouter } from "./parties";
import { electionsLegislatureRouter } from "./legislature";
import { electionsElectionsRouter } from "./elections";

export const electionsRouter = mergeRouters(
  electionsPartiesRouter,
  electionsLegislatureRouter,
  electionsElectionsRouter
);
