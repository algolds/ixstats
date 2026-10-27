/**
 * Seed a realm's own map labels (oceans, seas, regions, continents) from its map pipeline config's `labels` (typed
 * in, or a JSON label file of its art): the pipeline's `labels` step, run in process. Labels are matched by key (an
 * entry's `key`, else its text): changed ones updated, missing ones created; labels the list does not name stay.
 *   bun scripts/realms/seed-realm-labels.ts --realm <slug> [--source <checkout>] [--apply]
 * Label list format: realmLabelSeedFileSchema (src/lib/maps/realm-labels.ts). Shared arguments: realm-map-cli.ts.
 */
import { realmMapCli } from "./realm-map-cli";

realmMapCli("seed-realm-labels", ["labels"]);
