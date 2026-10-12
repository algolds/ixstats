import type { PrismaClient } from "@prisma/client";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache, clearRealmLayerCache } from "./layer-cache";

// One place that says "this realm's map changed". Every write path that changes what a realm's map layers hold
// (borders, imports, rollbacks, linkage, sovereignty, area recomputes) calls invalidateRealmMap after the write
// commits. It clears the server's assembled-layer caches and the cached map reads and increments
// Realm.mapVersion, which versioned layer and tile URLs carry: a new version is a new URL, so browsers and CDNs
// never serve the old map. This is a cross-domain primitive (src/server/shared), like layer-cache.ts.

type VersionWriter = Pick<PrismaClient, "$queryRaw">;
type AllVersionsWriter = Pick<PrismaClient, "$executeRaw">;
type VersionReader = { realm: Pick<PrismaClient["realm"], "findUnique"> };

/**
 * Cached tRPC reads of map data, matched by procedure path. Their keys carry the realm only for non-Ixnay
 * realms, so a bump drops them for every realm; a refill is cheap. "geoCore.getWorldMap" and
 * "geoCore.getMapBundle" also match the *Packed, *AsOf and *Detail variants.
 */
export const MAP_TRPC_KEYS: string[] = [
  "geoCore.getWorldMap",
  "geoCore.getMapBundle",
  "geoCore.getCountryFeatures",
  "geoCore.getAllMapFeatures",
  "geoCore.getCountryGeometry",
  "geoCore.getCountryGeoProfile",
  "geoCore.getCountryLinkage",
  "geoCore.getMapStats",
  "geoCore.listCountries",
  "countryGeo.getCountryGeoBundle",
  "geoEditor.validateLinkage",
];

/**
 * The Country columns the political layer reads: `continent` and `region` (tags on each of its features) and `name`
 * (a sovereign's name on its subjects' features). A country save bumps the map version only when one changed.
 */
export const COUNTRY_MAP_SELECT = {
  realmId: true,
  name: true,
  continent: true,
  region: true,
} as const;

type CountryMapFields = { name: string; continent: string | null; region: string | null };

/** True when `updates` names a column the political layer reads (so a before/after comparison is worth a read). */
export function touchesCountryMapFields(updates: object): boolean {
  return "name" in updates || "continent" in updates || "region" in updates;
}

/** True when a country's map-visible columns differ; with no `before` row, assume they do. */
export function countryMapChanged(
  before: CountryMapFields | null,
  after: CountryMapFields
): boolean {
  return (
    !before ||
    before.name !== after.name ||
    before.continent !== after.continent ||
    before.region !== after.region
  );
}

/** Called when a realm's map changed (null: every realm). For caches that live outside layer-cache.ts. */
type MapInvalidationHook = (realmId: string | null) => void;

const hooks = new Set<MapInvalidationHook>();

/** Register cleanup for a cache keyed by realm (the packed-layer LRU, the tile access memo). Returns the unregister. */
export function onMapInvalidated(hook: MapInvalidationHook): () => void {
  hooks.add(hook);
  return () => {
    hooks.delete(hook);
  };
}

function runHooks(realmId: string | null): void {
  for (const hook of hooks) {
    try {
      hook(realmId);
    } catch (error) {
      console.error("[map-invalidation] hook failed:", error);
    }
  }
}

const VERSION_TTL_MS = 5_000;
const versionMemo = new Map<string, { version: number; at: number }>();
/** Bumped around every invalidation, so a read that an invalidation overtook is not memoised. */
let epoch = 0;

/**
 * The realm's map version, memoised in this process for 5 s (the tiny `realms.map.version` query is hit by every
 * map load). An invalidation here drops the memo at once; one made by another process (the cron worker) shows
 * up within the TTL. A realm with no row reads as 0.
 */
export async function getRealmMapVersion(db: VersionReader, realmId: string): Promise<number> {
  const hit = versionMemo.get(realmId);
  if (hit && Date.now() - hit.at < VERSION_TTL_MS) return hit.version;
  const startedAt = epoch;
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { mapVersion: true } });
  const version = row?.mapVersion ?? 0;
  if (epoch === startedAt) versionMemo.set(realmId, { version, at: Date.now() });
  return version;
}

async function dropMapReads(): Promise<void> {
  await invalidateCache(MAP_TRPC_KEYS).catch(() => undefined);
}

/**
 * A realm's map changed: clear its assembled layers, the cached map reads and the memoised version, and increment
 * Realm.mapVersion. Call it AFTER the write commits (not inside its transaction: a reader could rebuild the old
 * data between the clear and the commit). Returns the new version, 0 when the realm has no row. Ixnay is realm
 * "default".
 */
export async function invalidateRealmMap(db: VersionWriter, realmId: string): Promise<number> {
  epoch++;
  clearRealmLayerCache(realmId);
  runHooks(realmId);
  const rows = await db.$queryRaw<
    Array<{ mapVersion: number }>
  >`UPDATE "realms" SET "mapVersion" = "mapVersion" + 1 WHERE "id" = ${realmId} RETURNING "mapVersion"`;
  versionMemo.delete(realmId);
  epoch++;
  await dropMapReads();
  return rows[0]?.mapVersion ?? 0;
}

/** For a change that spans realms or has no realm to name (global admin work): every realm's map changed. */
export async function invalidateAllRealmMaps(db: AllVersionsWriter): Promise<void> {
  epoch++;
  clearLayerCache();
  runHooks(null);
  await db.$executeRaw`UPDATE "realms" SET "mapVersion" = "mapVersion" + 1`;
  versionMemo.clear();
  epoch++;
  await dropMapReads();
}
