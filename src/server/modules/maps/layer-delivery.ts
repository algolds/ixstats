/**
 * Map layers as the browser downloads them: the layer in the packed wire format (`geojson-pack.ts`), already
 * stringified, held in one byte-bounded cache keyed by realm, map version, loader format (`layer-format.ts`),
 * layer and zoom bucket, behind the versioned `/api/map-layers` route. A hit is a string handed to the response; a
 * miss builds it once however many requests wait for it. The version is in the key, so a map change made by another
 * process (the cron worker's imports) reads fresh data once it bumps `Realm.mapVersion`, without anything having to
 * clear this process's memory. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import { packFeatureCollection } from "~/lib/maps/geojson-pack";
import { LAYER_FORMAT_VERSION } from "~/lib/maps/layer-format";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { getCompressionForLayer, type ZoomBucket } from "./layer-lod";
import { loadLayerWithFallback } from "./layer-loader";
import { getRealmMapVersion, onMapInvalidated } from "~/server/shared/map-invalidation";

type DeliveryDb = Pick<PrismaClient, "realm">;

const PACKED_CACHE_BYTES = 256 * 1024 * 1024;
/** Entries are keyed by version, so this only bounds how long a superseded version's copy can sit in memory. */
const PACKED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const packedLayers = new ByteBoundedCache<string>({
  maxBytes: PACKED_CACHE_BYTES,
  defaultTtlMs: PACKED_CACHE_TTL_MS,
});

/** Builds in progress by cache key, so concurrent requests for a layer share one build. */
const inflight = new Map<string, Promise<string>>();

// A map change made in this process drops the realm's copies (null: every realm's) at once, rather than leaving
// them for the cache to age out.
onMapInvalidated((realmId) => {
  const ofRealm = (key: string) => realmId === null || key.startsWith(`${realmId}:`);
  packedLayers.deleteWhere(ofRealm);
  for (const key of inflight.keys()) if (ofRealm(key)) inflight.delete(key);
});

async function buildPackedLayer(
  db: DeliveryDb,
  realmId: string,
  version: number,
  layer: string,
  bucket: ZoomBucket
): Promise<string> {
  // A realm with no such layer (or Ixnay with neither rows nor file) serves an empty collection
  const fc = (await loadLayerWithFallback(db, layer, bucket, realmId, version)) ?? {
    type: "FeatureCollection" as const,
    features: [],
  };
  return JSON.stringify(
    packFeatureCollection(fc, getCompressionForLayer(layer, bucket).coordinatePrecision)
  );
}

/** The realm's layer at map version `version`: from the cache, else built once and cached. */
export function packedLayerAt(
  db: DeliveryDb,
  realmId: string,
  version: number,
  layer: string,
  bucket: ZoomBucket
): Promise<string> {
  const key = `${realmId}:${version}:${LAYER_FORMAT_VERSION}:${layer}:${bucket}`;
  const hit = packedLayers.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const building = inflight.get(key);
  if (building) return building;

  const build: Promise<string> = buildPackedLayer(db, realmId, version, layer, bucket)
    .then((body) => {
      packedLayers.set(key, body, Buffer.byteLength(body));
      return body;
    })
    .finally(() => {
      // Identity check: an invalidation may have replaced this entry with a newer build
      if (inflight.get(key) === build) inflight.delete(key);
    });
  inflight.set(key, build);
  return build;
}

/** The realm's layer at its current map version, as the packed JSON string the layer route sends. */
export async function getPackedLayer(
  db: DeliveryDb,
  realmId: string,
  layer: string,
  bucket: ZoomBucket
): Promise<string> {
  return packedLayerAt(db, realmId, await getRealmMapVersion(db, realmId), layer, bucket);
}

/** The layers /maps asks for as GeoJSON on first paint (the rest are vector tiles or load when switched on). */
const FIRST_PAINT_LAYERS = ["background", "political", "country_labels", "icecaps"];

async function warmLayers(db: DeliveryDb, buckets: ZoomBucket[]): Promise<number> {
  let warmed = 0;
  for (const bucket of buckets) {
    for (const layer of FIRST_PAINT_LAYERS) {
      try {
        await getPackedLayer(db, DEFAULT_REALM_ID, layer, bucket);
        warmed++;
      } catch (err) {
        console.warn(`[GeoCache] Failed to warm ${layer} (z${bucket}):`, err);
      }
    }
  }
  return warmed;
}

/** Builds Ixnay's first-paint layers at server start (the mid bucket every load asks for, and the detail one) so the
 * first /maps load finds them cached. Other realms build on first request. */
export async function warmGeoCache(db: DeliveryDb): Promise<void> {
  const start = Date.now();
  const warmed = await warmLayers(db, [1, 2]);
  console.log(
    `[GeoCache] Warmed ${warmed} packed layers in ${Date.now() - start}ms: ${(packedLayers.totalBytes / 1024 / 1024).toFixed(2)}MB`
  );
}

/** Dev server: just the mid bucket, in the background, so the first map load is quick. */
export async function warmGeoCacheDev(db: DeliveryDb): Promise<void> {
  const start = Date.now();
  await warmLayers(db, [1]);
  console.log(`[GeoCache] Dev warm-up done in ${Date.now() - start}ms`);
}
