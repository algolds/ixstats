/**
 * Transport router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.transport.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - routeQueries:   read queries for transport routes (GeoJSON, stats, single route)
 *  - routeMutations: route CRUD (generate/create/update/updateGeometry/delete)
 *  - hubs:           hub CRUD + per-country hub list
 */
import { mergeRouters } from "~/server/api/trpc";
import { transportRouteQueriesRouter } from "./routeQueries";
import { transportRouteMutationsRouter } from "./routeMutations";
import { transportHubsRouter } from "./hubs";

export const transportRouter = mergeRouters(
  transportRouteQueriesRouter,
  transportRouteMutationsRouter,
  transportHubsRouter
);
