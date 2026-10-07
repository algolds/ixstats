/**
 * `Realm.settings.map`: one realm's map configuration. Every key is optional and the whole object may be missing:
 * a realm with none draws on IxWorld's planet with a whole-globe equirectangular map.
 *
 * - Georeference (how a map image's pixels become lon/lat; used by the map import engine): `projection`,
 *   `bounds` (the area a cropped image covers) and `controlPoints` (pixel ↔ lon/lat pairs, at least three).
 * - Display (read by the map viewer): `radiusKm` (the realm's planet radius), `baseImage`, `attribution` and
 *   `defaultView`.
 *
 * Reading is forgiving: a malformed key is dropped on its own, never the others, and a missing `map` key reads as
 * `{}`. Writing keeps every other `Realm.settings` key and every `map` key it is not given. Pure, client-safe.
 */
import { z } from "zod";

export const MAP_PROJECTIONS = ["equirectangular", "mercator"] as const;
export type MapProjection = (typeof MAP_PROJECTIONS)[number];

/** Mercator cannot reach the poles; maps are cut here, as web maps are. */
export const MERCATOR_MAX_LAT = 85.0511287798;

const lon = z.number().finite().min(-180).max(180);
const lat = z.number().finite().min(-90).max(90);

/** The lon/lat box a cropped map image covers (west < east, south < north). */
export const mapBoundsSchema = z
  .object({ west: lon, south: lat, east: lon, north: lat })
  .refine((b) => b.west < b.east && b.south < b.north, {
    message: "Bounds need west < east and south < north",
  });
export type MapBounds = z.infer<typeof mapBoundsSchema>;

/** A pixel of the map image (x right, y down, from the top-left corner) and the lon/lat it shows. */
export const mapControlPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  lon,
  lat,
});
export type MapControlPoint = z.infer<typeof mapControlPointSchema>;

const baseImageSchema = z.object({
  url: z.string().min(1).max(2000),
  opacity: z.number().min(0).max(1).optional(),
});

const defaultViewSchema = z.object({
  center: z.tuple([lon, lat]),
  zoom: z.number().min(0).max(24),
});

export const realmMapSettingsSchema = z.object({
  radiusKm: z.number().positive().max(1_000_000).optional(),
  projection: z.enum(MAP_PROJECTIONS).optional(),
  bounds: mapBoundsSchema.optional(),
  controlPoints: z.array(mapControlPointSchema).min(3).max(64).optional(),
  baseImage: baseImageSchema.optional(),
  attribution: z.string().max(500).optional(),
  defaultView: defaultViewSchema.optional(),
});
export type RealmMapSettings = z.infer<typeof realmMapSettingsSchema>;

/** The georeference part of the settings: what the import engine needs to place an image on the globe. */
export const mapGeoreferenceSchema = realmMapSettingsSchema.pick({
  projection: true,
  bounds: true,
  controlPoints: true,
});
export type MapGeoreference = z.infer<typeof mapGeoreferenceSchema>;

const KEYS = Object.keys(realmMapSettingsSchema.shape) as Array<keyof RealmMapSettings>;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The realm's map settings from `Realm.settings`; a missing or malformed `map` reads as `{}`. */
export function readRealmMapSettings(settings: unknown): RealmMapSettings {
  const stored = asObject(asObject(settings).map);
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    if (stored[key] === undefined) continue;
    const parsed = realmMapSettingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data;
  }
  return out as RealmMapSettings;
}

/** Just the georeference keys of a realm's map settings. */
export function readRealmGeoreference(settings: unknown): MapGeoreference {
  const { projection, bounds, controlPoints } = readRealmMapSettings(settings);
  return {
    ...(projection && { projection }),
    ...(bounds && { bounds }),
    ...(controlPoints && { controlPoints }),
  };
}

export type RealmMapSettingsPatch = { [K in keyof RealmMapSettings]?: RealmMapSettings[K] | null };

/**
 * `Realm.settings` with `map` patched: a key given a value is set, a key given `null` is removed, a key left out
 * is kept. Every other settings key is kept; a non-object `settings` becomes `{}`.
 */
export function withRealmMapSettings(
  settings: unknown,
  patch: RealmMapSettingsPatch
): Record<string, unknown> {
  const root = asObject(settings);
  const map: Record<string, unknown> = { ...asObject(root.map) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete map[key];
    else map[key] = value;
  }
  return { ...root, map };
}
