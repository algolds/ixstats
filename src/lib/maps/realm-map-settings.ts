/**
 * A realm's map settings: the `map` key of `Realm.settings`. Every key is optional; a realm without them gets
 * IxWorld's planet and a plain map. Client-safe.
 *
 * - `radiusKm`: the planet's radius, which scales every area and distance measured on the realm's map
 *   (`src/lib/maps/planet.ts`). Default 6371 km (Earth, and IxEarth).
 * - `defaultView`: where the realm's map opens (centre and zoom), saved from the editor's
 *   "Save current view as default".
 * - `baseImage`: a full-globe equirectangular image drawn under the political layer, an `https://` address or an
 *   image uploaded through the site's image upload route (`isMapBaseImageUrl`).
 * - `attribution`: the credit line the realm's map shows (falls back to the realm's source sync attribution).
 * - `projection`, `bounds`, `controlPoints`: georeferencing of imported maps, owned by the map import work; kept
 *   here as pass-through placeholders so a stored value is never dropped.
 */
import { z } from "zod";
import { EARTH_RADIUS_KM } from "./planet";

/** The smallest and largest planet radius a realm may set, in km (a large moon to a super-Earth). */
export const MIN_REALM_RADIUS_KM = 500;
export const MAX_REALM_RADIUS_KM = 50_000;

export const MAX_MAP_ATTRIBUTION_LENGTH = 300;

/** An image uploaded through `/api/upload/image`, served under `/images/uploads/uploaded_…`. */
const UPLOADED_IMAGE = /^\/images\/uploads\/uploaded_[A-Za-z0-9_.-]+$/;

/** A base map image: an `https://` address or an image uploaded through the site's image upload route. */
export function isMapBaseImageUrl(url: string): boolean {
  const value = url.trim();
  if (UPLOADED_IMAGE.test(value)) return !value.includes("..");
  return /^https:\/\/[^\s"'<>]+$/i.test(value) && value.length <= 1000;
}

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-85).max(85);

export const RealmMapDefaultViewSchema = z.object({
  center: z.tuple([lng, lat]),
  zoom: z.number().min(0).max(22),
});

export type RealmMapDefaultView = z.infer<typeof RealmMapDefaultViewSchema>;

export const RealmMapSettingsSchema = z.object({
  radiusKm: z.number().min(MIN_REALM_RADIUS_KM).max(MAX_REALM_RADIUS_KM).optional(),
  // Owned by the map import work (georeferencing); passed through untouched here.
  projection: z.unknown().optional(),
  bounds: z.unknown().optional(),
  controlPoints: z.unknown().optional(),
  baseImage: z
    .string()
    .trim()
    .refine(isMapBaseImageUrl, "Use an https:// image or an uploaded image")
    .optional(),
  attribution: z.string().trim().max(MAX_MAP_ATTRIBUTION_LENGTH).optional(),
  defaultView: RealmMapDefaultViewSchema.optional(),
});

export type RealmMapSettings = z.infer<typeof RealmMapSettingsSchema>;

function settingsObject(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

/**
 * The realm's map settings from `Realm.settings` (its `map` key). Each key is read on its own: a malformed value
 * is dropped instead of discarding the rest.
 */
export function parseRealmMapSettings(settings: unknown): RealmMapSettings {
  const raw = settingsObject(settingsObject(settings).map);
  const shape = RealmMapSettingsSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    if (raw[key] === undefined) continue;
    const parsed = shape[key].safeParse(raw[key]);
    if (parsed.success && parsed.data !== undefined && parsed.data !== "") out[key] = parsed.data;
  }
  return out as RealmMapSettings;
}

/** The realm's planet radius in km (`settings.map.radiusKm`), else Earth's. */
export function realmRadiusKm(settings: unknown): number {
  return parseRealmMapSettings(settings).radiusKm ?? EARTH_RADIUS_KM;
}

/**
 * `Realm.settings` with the map settings changed: keys in `changes` set to a value replace the stored one, keys
 * set to `null` are removed, every other stored key (map or not) is kept.
 */
export function withRealmMapSettings(
  settings: unknown,
  changes: { [K in keyof RealmMapSettings]?: RealmMapSettings[K] | null }
): Record<string, unknown> {
  const stored = settingsObject(settings);
  const map: Record<string, unknown> = { ...settingsObject(stored.map) };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null || value === "") delete map[key];
    else map[key] = value;
  }
  return { ...stored, map };
}
