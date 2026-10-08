/**
 * What a realm's physical layer import reads (the map pipeline's `physical` step, realm-map-pipeline.ts): which of
 * the realm's map art is which (art keys of `pipeline.art`), the geography map's elevation legend and river colour,
 * the climate key (zones typed in, or a JS data file of the art read as literals), and any engine settings that
 * differ from the generic defaults (layerEngineOptionsSchema). Nothing here names a realm: a realm's values come
 * from its source preset or are typed in its admin panel. Only `land` is required: each other layer is traced when
 * its art is given. Client-safe.
 */
import { z } from "zod";
import { ClimateKeySchema } from "~/lib/maps/realm-map-settings";
import { artKeySchema } from "~/lib/maps/realm-map-art";
import { layerEngineOptionsSchema } from "./png/layer-engine-options";

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb hex")
  .transform((h) => h.toLowerCase());

const elevationBandSchema = z.object({
  /** The band's tint as painted on the map (the legend's swatch may differ slightly: sample the map). */
  color: hex,
  /** Lowest elevation, metres. */
  min: z.number(),
  /** Highest elevation, metres; null for the open top band. */
  max: z.number().nullable(),
});

/** A climate key kept in the art: a JS data file read as literals (never run). */
export const climateKeyFileSchema = z.object({
  art: artKeySchema,
  /** The classification's name (e.g. "Köppen"). */
  system: z.string().trim().min(1).max(60),
  /** The binding holding the zones array. */
  zonesBinding: z.string().trim().min(1).max(100),
  /** The binding holding a link prefix the file adds to each zone's page in code. */
  linkPrefixBinding: z.string().trim().min(1).max(100).optional(),
});

export const realmLayerConfigSchema = z.object({
  /** The blank map: land darker than a white sea. */
  land: artKeySchema,
  /** A climate map painted in its key's colours, and the key: typed in (zones), or a data file of the art. */
  climate: z
    .object({ art: artKeySchema, key: z.union([climateKeyFileSchema, ClimateKeySchema]) })
    .optional(),
  /** A map whose ice is white (a geography map). */
  ice: z.object({ art: artKeySchema }).optional(),
  /** A geography map's hypsometric tints and its legend's bands. */
  elevation: z
    .object({ art: artKeySchema, bands: z.array(elevationBandSchema).min(1).max(16) })
    .optional(),
  /** A geography map and the colours its rivers are drawn in. */
  rivers: z.object({ art: artKeySchema, colours: z.array(hex).min(1).max(8) }).optional(),
  /** Engine settings other than the defaults (layerEngineOptionsSchema's fields). */
  engine: layerEngineOptionsSchema.partial().optional(),
});
export type RealmLayerConfig = z.infer<typeof realmLayerConfigSchema>;

/** Every art key the config reads. */
export function layerConfigArt(config: RealmLayerConfig): string[] {
  const { climate, ice, elevation, rivers } = config;
  const keyFile = climate && "art" in climate.key ? climate.key.art : undefined;
  return [config.land, climate?.art, keyFile, ice?.art, elevation?.art, rivers?.art].filter(
    (key): key is string => key !== undefined
  );
}
