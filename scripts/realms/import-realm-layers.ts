/**
 * Import a realm's physical map layers (land, lakes, climate zones with the climate key, ice caps, elevation
 * bands, rivers) traced from its map art by the PNG layer engine, as its map pipeline config's `physical` says:
 * the pipeline's `physical` step (realm-map-pipeline.physical.ts), run in process.
 *   bun scripts/realms/import-realm-layers.ts --realm <slug> [--source <checkout>] [--apply]
 * Dry run by default: each layer's features, vertices and area, and what an apply would create, change or retire.
 * --apply replaces those layer types as one map import (with a rollback snapshot), sets the climate key and
 * measures the areas again. Shared arguments: realm-map-cli.ts.
 */
import { realmMapCli } from "./realm-map-cli";

realmMapCli("import-realm-layers", ["physical"]);
