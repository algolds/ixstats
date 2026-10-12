/**
 * Rollback snapshots for realm map imports. Before an import writes, `captureMapSnapshot` records the features it
 * is about to touch as they are (every feature of the layer for a replacing import, only the written keys for a
 * merge), which keys do not exist yet, and the linked countries' outline and land area. `restoreMapSnapshot` puts
 * all of it back: prior rows restored (geometry, properties, name, link, active flag), rows the import created
 * deleted, countries' outline and land area restored. Stored gzipped and capped in size (MapImport.snapshot).
 *
 * A world import also retires and creates generated nation slots (Country rows): `slots` holds the retired ones
 * (every scalar column) and the ids of the created ones, so a rollback removes the new slots and puts the old ones back.
 */
import { gunzipSync, gzipSync } from "node:zlib";
import { Prisma, type PrismaClient } from "@prisma/client";
import { isPostGISAvailable } from "./geo-validation";

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

/** The generated nation slots a world import retired (kept whole) and created (their ids). */
export interface SnapshotSlots {
  retired: SnapshotSlotCountry[];
  created: string[];
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
const columnJson = (value: unknown) =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

export interface RestoreResult {
  restored: number;
  deleted: number;
  countries: number;
  /** World imports only: slots put back, new slots removed, new slots kept because a player holds or claimed them. */
  slots?: { restored: number; removed: number; kept: number };
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
    }),
    db.realmClaim.findMany({ where: { countryId: { in: [...ids] } }, select: { countryId: true } }),
  ]);
  const held = new Set<string>();
  for (const country of owned) if (country.ownerUserId) held.add(country.id);
  for (const claim of claimed) if (claim.countryId) held.add(claim.countryId);
  return held;
}

/** Remove the slots the import created, except any a player has since claimed. Frees their names and slugs. */
async function removeCreatedSlots(db: PrismaClient, snapshot: MapImportSnapshot) {
  const ids = snapshot.slots?.created ?? [];
  const held = await heldSlots(db, ids);
  const { count } = await db.country.deleteMany({
    where: { id: { in: ids.filter((id) => !held.has(id)) }, realmId: snapshot.realmId },
  });
  return { removed: count, kept: held.size };
}

/** Put back the slots the import retired (scalar columns; their links come back with the map rows). */
async function recreateRetiredSlots(db: PrismaClient, snapshot: MapImportSnapshot) {
  const retired = snapshot.slots?.retired ?? [];
  const present = new Set(
    (
      await db.country.findMany({
        where: { id: { in: retired.map((row) => row.id) } },
        select: { id: true },
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

  // Slots first: the new ones go (their names and slugs are free again), the old ones come back for the rows to link to
  if (snapshot.slots) {
    const { removed, kept } = await removeCreatedSlots(db, snapshot);
    result.slots = { restored: await recreateRetiredSlots(db, snapshot), removed, kept };
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
  return result;
}
