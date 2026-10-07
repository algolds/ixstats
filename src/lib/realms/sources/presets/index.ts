/**
 * Source presets: a known source's values (repository, ref, adapter, file paths, field names, attribution,
 * options, continent table), loaded into a realm's sync config with one action ("Load preset" in the settings,
 * `--preset <id>` in the script). Loading copies the values; from then on the realm's config is the only source
 * of truth, and editing a preset never changes a realm that already loaded it.
 */
import { z } from "zod";
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
});
export type SourcePreset = z.infer<typeof sourcePresetSchema>;

export const SOURCE_PRESETS: readonly SourcePreset[] = [sourcePresetSchema.parse(eurthMap)];

export function sourcePreset(id: string): SourcePreset | null {
  return SOURCE_PRESETS.find((preset) => preset.id === id) ?? null;
}
