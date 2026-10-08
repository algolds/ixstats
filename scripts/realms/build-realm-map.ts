/**
 * Build a realm's map in IxWorld from its map pipeline config (`Realm.settings.map.pipeline`): the same background
 * job the realm's admin panel (Map) queues, run in this process (docs/systems/realm-maps.md).
 *   bun scripts/realms/build-realm-map.ts --realm <slug> [--steps repair,physical,rasters,labels,flags,defaultView,areas]
 *     [--source <checkout>] [--preset <id> [--force]] [--apply]
 * Steps run in pipeline order; all of them by default. Dry run by default: each step reports what it would change
 * (a step whose output is already in place reports "unchanged"); --apply writes. See realm-map-cli.ts.
 */
import { MAP_PIPELINE_STEPS } from "~/lib/maps/realm-map-pipeline";
import { realmMapCli } from "./realm-map-cli";

realmMapCli("build-realm-map", MAP_PIPELINE_STEPS);
