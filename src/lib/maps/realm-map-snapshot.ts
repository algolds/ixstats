/**
 * Rollback snapshots for realm map imports. Before an import writes, `captureMapSnapshot` records the features it
 * is about to touch as they are (every feature of the layer for a replacing import, only the written keys for a
 * merge), which keys do not exist yet, and the linked countries' outline and land area. `restoreMapSnapshot` puts
 * all of it back: prior rows restored (geometry, properties, name, link, active flag), rows the import created
 * deleted, countries' outline and land area restored. Stored gzipped and capped in size (MapImport.snapshot).
 *
 * A world import also retires and creates generated nation slots (Country rows): `slots` holds the retired ones
 * (every scalar column) and the ids of the created ones, so a rollback removes the new slots and puts the old ones back.
 * It also records the realm's generation (`Realm.seed`, `generationParams`) and builds a relief layer: `realm` holds
 * what they were, so a rollback puts the previous world's record and relief version back.
 */
import { gunzipSync, gzipSync } from "node:zlib";
import { Prisma, type PrismaClient } from "@prisma/client";
import { rasterVersionDir, rasterVersionExists } from "~/server/modules/maps/realm-rasters.storage";
import { isPostGISAvailable } from "./geo-validation";
import { RELIEF_LAYER_ID, withRasterLayer } from "./raster-tiles";
import {
  parseRealmMapSettings,
  withRealmMapSettings,
  type RealmRasterLayer,
} from "./realm-map-settings";

export interface SnapshotRow {
  layerType: string;
  featureId: string;
  geometry: unknown;
  properties: unknown;
  countryId: string | null;
  displayName: string | null;
  isActive: boolean;
  areaSqKm: number | null;
  centroid: unknown;
  boundingBox: unknown;
  neighbors: unknown;
}

export interface SnapshotCountry {
  id: string;
  geometry: unknown;
  centroid: unknown;
  boundingBox: unknown;
  landArea: number | null;
  areaSqMi: number | null;
}

/** A Country row as the snapshot keeps it: the JSON turned its dates into strings. */
type Stored<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};
export type SnapshotSlotCountry = Stored<Prisma.CountryGetPayload<object>>;

/**
 * The generated nation slots a world import retired (kept whole), created (their ids) and closed (the ids of the kept
 * slots it made unclaimable; absent in a snapshot taken before it did).
 */
export interface SnapshotSlots {
  retired: SnapshotSlotCountry[];
  created: string[];
  reserved?: string[];
}

/** What a world import changes on the realm itself: its generation record and its relief raster layer. */
export interface SnapshotRealm {
  seed: number | null;
  generationParams: Prisma.JsonValue;
  /** The realm's `relief` raster layer entry as it was; null when it had none. */
  relief: RealmRasterLayer | null;
}

export interface MapImportSnapshot {
  version: 1;
  realmId: string;
  rows: SnapshotRow[];
  /** Keys the import created (they did not exist before): deleted on rollback. */
  created: Array<{ layerType: string; featureId: string }>;
  countries: SnapshotCountry[];
  /** World imports only. */
  slots?: SnapshotSlots;
  /** World imports only. */
  realm?: SnapshotRealm;
}

/** Snapshots bigger than this (uncompressed JSON) are not kept: the import then cannot be rolled back. */
export const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;

export interface SnapshotScope {
  layerType: string;
  /** The keys the import writes. */
  keys: readonly string[];
  /** A replacing import: every feature of the layer is recorded. */
  wholeLayer: boolean;
  /** Countries the import links or may change. */
  countryIds: readonly string[];
}

const ROW_SELECT = {
  layerType: true,
  featureId: true,
  geometry: true,
  properties: true,
  countryId: true,
  displayName: true,
  isActive: true,
  areaSqKm: true,
  centroid: true,
  boundingBox: true,
  neighbors: true,
} as const;

export async function captureMapSnapshot(
  db: Pick<PrismaClient, "mapLayer" | "country">,
  realmId: string,
  scopes: readonly SnapshotScope[]
): Promise<MapImportSnapshot> {
  const snapshot: MapImportSnapshot = { version: 1, realmId, rows: [], created: [], countries: [] };
  const countryIds = new Set<string>();
  for (const scope of scopes) {
    const rows = (await db.mapLayer.findMany({
      where: {
        realmId,
        layerType: scope.layerType,
        ...(scope.wholeLayer ? {} : { featureId: { in: [...scope.keys] } }),
      },
      select: ROW_SELECT,
      // Past the guarded client's 1000-row cap: Ixnay has 4068 altitude bands, and a rollback restores only what is here
      take: 50_000,
    })) as SnapshotRow[];
    snapshot.rows.push(...rows);
    const existing = new Set(rows.map((r) => r.featureId));
    for (const key of scope.keys) {
      if (!existing.has(key)) snapshot.created.push({ layerType: scope.layerType, featureId: key });
    }
    for (const row of rows)
      if (row.countryId && (!scope.wholeLayer || scope.keys.includes(row.featureId)))
        countryIds.add(row.countryId);
    for (const id of scope.countryIds) countryIds.add(id);
  }
  if (countryIds.size > 0) {
    snapshot.countries = (await db.country.findMany({
      where: { id: { in: [...countryIds] }, realmId },
      select: {
        id: true,
        geometry: true,
        centroid: true,
        boundingBox: true,
        landArea: true,
        areaSqMi: true,
      },
      take: 50_000,
    })) as SnapshotCountry[];
  }
  return snapshot;
}

/** The snapshot gzipped for storage, or null (with its size) when it is over the cap. */
export function packSnapshot(snapshot: MapImportSnapshot): {
  bytes: Uint8Array<ArrayBuffer> | null;
  size: number;
} {
  const json = JSON.stringify(snapshot);
  const size = Buffer.byteLength(json);
  if (size > MAX_SNAPSHOT_BYTES) return { bytes: null, size };
  const zipped = gzipSync(json);
  return {
    bytes: new Uint8Array(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    ),
    size,
  };
}

export function unpackSnapshot(bytes: Uint8Array): MapImportSnapshot {
  const snapshot = JSON.parse(gunzipSync(bytes).toString("utf8")) as MapImportSnapshot;
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.rows))
    throw new Error("Unreadable map import snapshot");
  return snapshot;
}

const json = (value: unknown) =>
  value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

/** A nullable JSON column's value for a row created again: nothing stored stays SQL NULL, as a new slot's was. */
const columnJson = (value: Prisma.JsonValue | undefined) =>
  value === null || value === undefined ? Prisma.DbNull : value;

export interface RestoreResult {
  restored: number;
  deleted: number;
  countries: number;
  /** World imports only: slots put back, new slots removed, new slots kept because a player holds or claimed them. */
  slots?: { restored: number; removed: number; kept: number };
}

/** The realm's generation record and relief layer now, for a snapshot a world import is about to change. */
export async function captureRealmState(
  db: Pick<PrismaClient, "realm">,
  realmId: string
): Promise<SnapshotRealm> {
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { seed: true, generationParams: true, settings: true },
  });
  const layers = parseRealmMapSettings(realm?.settings).rasterLayers ?? [];
  return {
    seed: realm?.seed ?? null,
    generationParams: realm?.generationParams ?? null,
    relief: layers.find((layer) => layer.id === RELIEF_LAYER_ID) ?? null,
  };
}

/**
 * The relief entry a snapshot recorded, when its tiles are still on disk. The build keeps only the newest two
 * versions, so after two more worlds the version a rollback would put back is gone: serving it would answer every
 * relief tile with a 404.
 */
async function reliefWithTiles(realmId: string, relief: RealmRasterLayer | null) {
  if (!relief) return null;
  const dir = rasterVersionDir(realmId, relief.id, relief.version);
  return dir && (await rasterVersionExists(dir)) ? relief : null;
}

/** Put the realm's generation record and relief layer entry back; its other settings are kept. */
async function restoreRealmState(
  db: Pick<PrismaClient, "realm">,
  realmId: string,
  state: SnapshotRealm
): Promise<void> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  if (!realm) return;
  const layers = parseRealmMapSettings(realm.settings).rasterLayers ?? [];
  const relief = await reliefWithTiles(realmId, state.relief);
  const restored = relief
    ? withRasterLayer(layers, relief)
    : layers.filter((layer) => layer.id !== RELIEF_LAYER_ID);
  await db.realm.update({
    where: { id: realmId },
    data: {
      seed: state.seed,
      generationParams:
        state.generationParams === null
          ? Prisma.DbNull
          : (state.generationParams as Prisma.InputJsonValue),
      settings: withRealmMapSettings(realm.settings, {
        rasterLayers: restored.length > 0 ? restored : null,
      }) as Prisma.InputJsonValue,
    },
  });
}

/** The ids among `ids` a player holds or has a claim row for: deleting those would erase the player's claim. */
export async function heldSlots(
  db: Pick<PrismaClient, "country" | "realmClaim">,
  ids: readonly string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [owned, claimed] = await Promise.all([
    db.country.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, ownerUserId: true },
      take: 50_000,
    }),
    db.realmClaim.findMany({
      where: { countryId: { in: [...ids] } },
      select: { countryId: true },
      take: 50_000,
    }),
  ]);
  const held = new Set<string>();
  for (const country of owned) if (country.ownerUserId) held.add(country.id);
  for (const claim of claimed) if (claim.countryId) held.add(claim.countryId);
  return held;
}

/**
 * Remove the slots the import created, except any a player has claimed. Frees their names and slugs.
 *
 * A world is open to claims once applied, so a claim can arrive while this runs, and deleting a country removes its
 * claims (`RealmClaim.country` cascades). A claim takes a share lock on its country and then on its realm (the
 * foreign keys of RealmClaim), so this takes the locks the same way the apply does (the countries, then the realm)
 * and closes the slots before it asks who holds them: a claim filed already has committed and shows as held, and one
 * that comes later waits for the lock, then finds the slot closed or gone. The slots that are kept are opened again.
 */
async function removeCreatedSlots(tx: Prisma.TransactionClient, snapshot: MapImportSnapshot) {
  const { realmId } = snapshot;
  const ids = snapshot.slots?.created ?? [];
  if (ids.length === 0) return { removed: 0, kept: 0 };
  await tx.$queryRaw`SELECT "id" FROM "Country" WHERE "id" = ANY(${ids}::text[]) AND "realmId" = ${realmId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "realms" WHERE "id" = ${realmId} FOR UPDATE`;
  const open = await tx.country.findMany({
    where: { id: { in: ids }, realmId, claimable: true },
    select: { id: true },
    take: 50_000,
  });
  await tx.country.updateMany({ where: { id: { in: ids }, realmId }, data: { claimable: false } });

  const held = await heldSlots(tx, ids);
  const { count } = await tx.country.deleteMany({
    where: { id: { in: ids.filter((id) => !held.has(id)) }, realmId },
  });
  const reopen = open.map((slot) => slot.id).filter((id) => held.has(id));
  if (reopen.length > 0) {
    await tx.country.updateMany({
      where: { id: { in: reopen }, realmId },
      data: { claimable: true },
    });
  }
  return { removed: count, kept: held.size };
}

/** Put back the slots the import retired (scalar columns; their links come back with the map rows). */
async function recreateRetiredSlots(
  db: Pick<PrismaClient, "country">,
  snapshot: MapImportSnapshot
) {
  const retired = snapshot.slots?.retired ?? [];
  const present = new Set(
    (
      await db.country.findMany({
        where: { id: { in: retired.map((row) => row.id) } },
        select: { id: true },
        take: 50_000,
      })
    ).map((row) => row.id)
  );
  const missing = retired.filter((row) => !present.has(row.id));
  if (missing.length === 0) return 0;
  const { count } = await db.country.createMany({
    data: missing.map(({ geometry, centroid, boundingBox, ...scalars }) => ({
      ...scalars,
      geometry: columnJson(geometry),
      centroid: columnJson(centroid),
      boundingBox: columnJson(boundingBox),
    })),
  });
  return count;
}

/** Open again the kept slots the import closed: their borders come back with the map rows. */
async function reopenReservedSlots(tx: Prisma.TransactionClient, snapshot: MapImportSnapshot) {
  const reserved = snapshot.slots?.reserved ?? [];
  if (reserved.length === 0) return;
  await tx.country.updateMany({
    where: { id: { in: reserved }, realmId: snapshot.realmId, ownerUserId: null },
    data: { claimable: true },
  });
}

/** Put a realm's map back as the snapshot recorded it. Batches of rows, each in its own transaction. */
export async function restoreMapSnapshot(
  db: PrismaClient,
  snapshot: MapImportSnapshot,
  options: { batchSize?: number; transactionTimeoutMs?: number } = {}
): Promise<RestoreResult> {
  const { realmId } = snapshot;
  const batchSize = Math.max(1, options.batchSize ?? 20);
  const timeout = options.transactionTimeoutMs ?? 60_000;
  const postgis = await isPostGISAvailable(db);
  const result: RestoreResult = { restored: 0, deleted: 0, countries: 0 };

  // Slots first: the new ones go (their names and slugs are free again), the old ones come back for the rows to link
  // to. One transaction, so a failure leaves the slots as they were rather than the new ones gone and the old not back
  if (snapshot.slots) {
    result.slots = await db.$transaction(
      async (tx) => {
        const { removed, kept } = await removeCreatedSlots(tx, snapshot);
        const restored = await recreateRetiredSlots(tx, snapshot);
        await reopenReservedSlots(tx, snapshot);
        return { restored, removed, kept };
      },
      { timeout, maxWait: timeout }
    );
  }

  for (let i = 0; i < snapshot.rows.length; i += batchSize) {
    const batch = snapshot.rows.slice(i, i + batchSize);
    await db.$transaction(
      async (tx) => {
        for (const row of batch) {
          const data = {
            geometry: row.geometry as Prisma.InputJsonValue,
            properties: (row.properties ?? {}) as Prisma.InputJsonValue,
            countryId: row.countryId,
            displayName: row.displayName,
            isActive: row.isActive,
            areaSqKm: row.areaSqKm,
            centroid: json(row.centroid),
            boundingBox: json(row.boundingBox),
            neighbors: json(row.neighbors),
          };
          const saved = await tx.mapLayer.upsert({
            where: {
              realmId_layerType_featureId: {
                realmId,
                layerType: row.layerType,
                featureId: row.featureId,
              },
            },
            update: data,
            create: { ...data, realmId, layerType: row.layerType, featureId: row.featureId },
            select: { id: true },
          });
          if (postgis && row.geometry) {
            await tx.$executeRawUnsafe(
              `UPDATE map_layers SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)) WHERE id = $1`,
              saved.id,
              JSON.stringify(row.geometry)
            );
          }
        }
      },
      { timeout, maxWait: timeout }
    );
    result.restored += batch.length;
  }

  for (const layerType of new Set(snapshot.created.map((c) => c.layerType))) {
    const keys = snapshot.created.filter((c) => c.layerType === layerType).map((c) => c.featureId);
    const { count } = await db.mapLayer.deleteMany({
      where: { realmId, layerType, featureId: { in: keys } },
    });
    result.deleted += count;
  }

  for (const country of snapshot.countries) {
    await db.country.update({
      where: { id: country.id },
      data: {
        geometry: json(country.geometry),
        centroid: json(country.centroid),
        boundingBox: json(country.boundingBox),
        landArea: country.landArea,
        areaSqMi: country.areaSqMi,
      },
    });
    result.countries++;
  }
  if (snapshot.realm) await restoreRealmState(db, realmId, snapshot.realm);
  return result;
}
