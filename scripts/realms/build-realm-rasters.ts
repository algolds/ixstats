/**
 * Build a realm's raster layers (its map art as Web Mercator tiles) from its map pipeline config and record them
 * in `settings.map.rasterLayers`: the pipeline's `rasters` step (realm-map-pipeline.rasters.ts), run in process.
 *   bun scripts/realms/build-realm-rasters.ts --realm <slug> [--source <checkout>] [--apply]
 * Tiles go to MAP_RASTER_DIR (default data/map-rasters), which the web server must read from the same path; a
 * layer whose art is unchanged is not built again; versions other than the new one and the one it replaces are
 * removed. Shared arguments: realm-map-cli.ts.
 */
import { realmMapCli } from "./realm-map-cli";

realmMapCli("build-realm-rasters", ["rasters"]);
