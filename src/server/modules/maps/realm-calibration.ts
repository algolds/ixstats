/**
 * A stored realm's map measured for World Studio's Calibration tab: the realm's active background, political,
 * altitude and climate features are read from their `geometry` JSON (never `geom_postgis`, whose planar repair of a
 * polygon across the antimeridian is wrong), run through the same sampler the browser worker runs on a generated
 * world, and the result is kept in process per map version. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import type { Feature, Geometry } from "geojson";
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import type { LayerFeatures } from "~/lib/worldgen/land-mask";
import { measureWorld, type MeasureLayers, type WorldMeasures } from "~/lib/worldgen/measure-world";

export type RealmMeasures =
  | {
      ok: true;
      realm: { id: string; slug: string; name: string };
      /** `Realm.mapVersion` the measures were taken at */
      mapVersion: number;
      measures: WorldMeasures;
    }
  | { ok: false; reason: string };

type MeasuredRealm = Extract<RealmMeasures, { ok: true }>;
type ReaderDb = Pick<PrismaClient, "mapLayer" | "realm">;

const MEASURED_LAYERS = ["background", "political", "altitudes", "climate"] as const;
/** Past the database guard's 1000 rows without a `take` (Ixnay has 4068 altitude bands alone). */
const LAYER_ROW_LIMIT = 50_000;

/** A measurement is about a kilobyte; the bound only keeps a long-running server from collecting stale versions. */
const ENTRY_BYTES = 2_048;
const cache = new ByteBoundedCache<MeasuredRealm>({
  maxBytes: 64 * ENTRY_BYTES,
  defaultTtlMs: 60 * 60 * 1000,
});
/** Reads under way, so two requests for one version share it. */
const inFlight = new Map<string, Promise<RealmMeasures>>();

/** Measure a realm by id or slug. Never throws for a missing realm or an empty map: it says why. */
export async function measureRealm(db: ReaderDb, realm: string): Promise<RealmMeasures> {
  const row = await db.realm.findFirst({
    where: { OR: [{ id: realm }, { slug: realm }] },
    select: { id: true, slug: true, name: true, mapVersion: true, settings: true },
  });
  if (!row) return { ok: false, reason: "There is no realm with that id or slug." };

  const key = `${row.id}:${row.mapVersion}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const running = inFlight.get(key);
  if (running) return running;

  const job = readAndMeasure(db, row).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function readAndMeasure(
  db: ReaderDb,
  row: { id: string; slug: string; name: string; mapVersion: number; settings: unknown }
): Promise<RealmMeasures> {
  const layers = await loadLayers(db, row.id);
  if (!layers) return { ok: false, reason: "This realm has no map layers to measure." };

  const settings = parseRealmMapSettings(row.settings);
  const measured: MeasuredRealm = {
    ok: true,
    realm: { id: row.id, slug: row.slug, name: row.name },
    mapVersion: row.mapVersion,
    measures: measureWorld(layers, {
      radiusKm: settings.radiusKm ?? EARTH_RADIUS_KM,
      ...(settings.climateKey ? { climateKey: settings.climateKey } : {}),
    }),
  };
  cache.set(`${row.id}:${row.mapVersion}`, measured, ENTRY_BYTES);
  return measured;
}

/** The realm's active features of the measured layers from `geometry`, or null when it has none at all. */
async function loadLayers(db: ReaderDb, realmId: string): Promise<MeasureLayers | null> {
  const rows = await db.mapLayer.findMany({
    where: { realmId, isActive: true, layerType: { in: [...MEASURED_LAYERS] } },
    select: { layerType: true, geometry: true, properties: true },
    // The order decides which climate feature paints a pixel two of them cover
    orderBy: { featureId: "asc" },
    take: LAYER_ROW_LIMIT,
  });
  if (rows.length === 0) return null;
  const layers: Record<string, LayerFeatures> = {};
  for (const layerRow of rows) {
    const collection = (layers[layerRow.layerType] ??= { type: "FeatureCollection", features: [] });
    collection.features.push({
      type: "Feature",
      properties: layerRow.properties as Feature["properties"],
      geometry: layerRow.geometry as Geometry | null,
    });
  }
  return layers;
}
