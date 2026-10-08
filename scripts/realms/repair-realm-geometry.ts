/**
 * Repair a realm's political borders in place: each made valid (repeated points dropped, self-intersections
 * untangled, stored as a MultiPolygon), every overlap strip between neighbours given to one side and, with the
 * pipeline's `coverage`, the layer smoothed as one coverage, idempotently (a smoothed border is never rounded
 * twice): the pipeline's `repair` step (realm-map-pipeline.repair.ts, src/lib/maps/realm-layer-repair.ts), run in
 * process. Then the areas are measured again and adjacency rebuilt. Needs PostGIS.
 *   bun scripts/realms/repair-realm-geometry.ts --realm <slug> [--source <checkout>] [--apply]
 * Dry run by default; a layer with nothing to repair reports "unchanged". Shared arguments: realm-map-cli.ts.
 */
import { realmMapCli } from "./realm-map-cli";

realmMapCli("repair-realm-geometry", ["repair"]);
