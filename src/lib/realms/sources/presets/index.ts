/**
 * Source presets: a known source's values (repository, ref, adapter, file paths, field names, attribution,
 * options, continent table, the realm's wiki: the world's sister wiki, root category, keyword, roster and
 * portal, and its map pipeline: art, raster layers, physical layers, labels, flags, default view and smoothing),
 * loaded into a realm's sync config and map pipeline with one action each ("Load preset" in the settings,
 * `--preset <id>` in the scripts). Loading copies the values; from then on the realm's config is the only source of
 * truth, and editing a preset never changes a realm that already loaded it.
 */
import { z } from "zod";
import { realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import { realmWikiSettingsSchema } from "~/lib/realms/realm-wiki-settings";
import {
  continentMapSchema,
  intervalHoursSchema,
  realmSyncOptionsSchema,
  refSchema,
  repoSchema,
  SOURCE_PROVIDERS,
} from "../config";
import eurthMap from "./eurth-map.json";

export const sourcePresetSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  provider: z.enum(SOURCE_PROVIDERS),
  repo: repoSchema,
  ref: refSchema,
  format: z.string().min(1).max(60),
  intervalHours: intervalHoursSchema.optional(),
  settings: z.record(z.string(), z.unknown()),
  options: realmSyncOptionsSchema.optional(),
  continentMap: continentMapSchema.optional(),
  /** The realm's wiki (`Realm.settings.wiki`), filled when the realm has none yet. */
  wiki: realmWikiSettingsSchema.optional(),
  /** The realm's map pipeline (`Realm.settings.map.pipeline`), filled by the map panel's "Load preset". */
  mapPipeline: realmMapPipelineSchema.optional(),
});
export type SourcePreset = z.infer<typeof sourcePresetSchema>;

export const SOURCE_PRESETS: readonly SourcePreset[] = [sourcePresetSchema.parse(eurthMap)];

export function sourcePreset(id: string): SourcePreset | null {
  return SOURCE_PRESETS.find((preset) => preset.id === id) ?? null;
}
