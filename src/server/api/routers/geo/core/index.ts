/**
 * Geographic Map Router (geoCore)
 *
 * tRPC router for the IxEarth world map system: map layer data, country geometry,
 * spatial queries, and country-feature linking.
 *
 * Data source: PostgreSQL + PostGIS (map_layers table), with file-based fallback.
 *
 * This router is composed from domain-grouped procedure records (see the sibling
 * files). Helper modules (cache, geometry, layer-loader, shared) hold the shared
 * caching, geometry math, and layer-assembly logic.
 */

import { createTRPCRouter } from "~/server/api/trpc";
import { worldMapProcedures } from "./world-map";
import { countryProcedures } from "./country";
import { pointQueryProcedures } from "./point-queries";
import { discoveryProcedures } from "./discovery";
import { statsProcedures } from "./stats";
import { geoProfileProcedures } from "./geo-profile";
import { overlayProcedures } from "./overlays";
import { adminOpsProcedures } from "./admin-ops";
import { borderHistoryProcedures } from "./border-history";

export const geoCoreRouter = createTRPCRouter({
  ...worldMapProcedures,
  ...borderHistoryProcedures,
  ...countryProcedures,
  ...pointQueryProcedures,
  ...discoveryProcedures,
  ...statsProcedures,
  ...geoProfileProcedures,
  ...overlayProcedures,
  ...adminOpsProcedures,
});

// Preserve the original public API of `geo/core` (resolves to `geo/core/index.ts`),
// so existing importers across the codebase keep working unchanged.
export { clearLayerCache, layerCache } from "./cache";
export { warmGeoCache, warmGeoCacheDev } from "./layer-loader";
export { extractAllPositions } from "./geometry";
