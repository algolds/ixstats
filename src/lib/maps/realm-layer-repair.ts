/**
 * Repair (and, with `coverage`, smooth) one polygon layer of a realm in place, idempotently: the map pipeline's
 * `repair` step and the source sync after it writes borders.
 *
 * - Each feature is made valid, repeated points dropped, stored as a MultiPolygon, and overlap strips given to one
 *   side, through the realm map writer (realm-map-writer.ts), with a rollback snapshot (MapImport).
 * - Smoothing works on the whole layer as one coverage (shared edges stay shared), so it must start from every
 *   feature's unsmoothed outline: smoothing a smoothed outline rounds its corners again. Each smoothed feature
 *   carries a record (CoverageStamp: settings and the hash of its stored outline). A feature is up to date when its
 *   record has these settings and its outline still has that hash. When any feature is not, the layer is smoothed
 *   again from each feature's unsmoothed outline: the source's border when the source still has the outline the
 *   feature was written from (`sourceHash`), else the feature's own outline when it has no record or was edited since
 *   (what the writer or a map editor stored is unsmoothed); a smoothed feature with neither is "blocked", and the
 *   layer is then not smoothed at all rather than rounded twice.
 * - Nothing changes (and nothing is written) when the layer is valid, has no overlaps and is smoothed up to date:
 *   a second run reports "unchanged".
 * - Rows whose rings cross ±180° are never repaired or smoothed in SQL (PostGIS reads them as planar slivers).
 * Needs PostGIS.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { MultiPolygon, Polygon } from "geojson";
import { isPostGISAvailable } from "./geo-validation";
import { captureMapSnapshot, packSnapshot } from "./realm-map-snapshot";
import {
  CROSSES_ANTIMERIDIAN_SQL,
  findOverlapTrims,
  type CoverageStamp,
} from "./realm-geometry-repair";
import { writeRealmMapFeatures, type RealmMapWriteResult } from "./realm-map-writer";
import type { CoverageSettings } from "./realm-map-pipeline";

export interface LayerFeatureState {
  id: string;
  key: string;
  countryId: string | null;
  name: string | null;
  properties: Prisma.JsonObject;
  geometry: Polygon | MultiPolygon;
  /** md5 of the stored outline (geometry::text), as CoverageStamp.hash records it. */
  hash: string;
  crosses: boolean;
  valid: boolean;
  reason: string;
  repeated: number;
  vertices: number;
  storedType: string | null;
}

/** A source's border for a feature key, and the hash the source sync stores for it (`properties.sourceHash`). */
export interface SourceOutline {
  geometry: Polygon | MultiPolygon;
  sourceHash: string;
}

type SmoothingStatus = "off" | "up-to-date" | "smooth" | "blocked";

export interface LayerRepairPlan {
  features: number;
  /** Rows across ±180°, left as they are. */
  crossing: string[];
  /** Invalid, with repeated points, or not stored as a MultiPolygon. */
  needsRepair: string[];
  trims: Array<{ key: string; removedKm2: number }>;
  smoothing: {
    status: SmoothingStatus;
    /** Features not smoothed up to date. */
    pending: string[];
    /** Features smoothed again from the source's border. */
    fromSource: string[];
    /** Smoothed features whose unsmoothed outline is unknown. */
    blocked: string[];
    /** Why the source's borders were not read, when they were wanted. */
    sourceProblem: string | null;
  };
  /** The outline each feature is written from. */
  inputs: Map<string, Polygon | MultiPolygon>;
  changed: boolean;
}

interface PlanInput {
  trims: ReadonlyArray<{ key: string; removedKm2: number }>;
  coverage: CoverageSettings | null;
  sourceRaw?: ReadonlyMap<string, SourceOutline>;
  /** The source's borders were wanted but could not be read (why). */
  sourceUnavailable?: string;
}

const LAYER_SQL = `SELECT id, "featureId" AS key, "countryId", "displayName" AS name, properties,
         geometry::text AS geojson, md5(geometry::text) AS hash,
         (geom_postgis IS NOT NULL AND ${CROSSES_ANTIMERIDIAN_SQL}) AS crosses,
         ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason,
         ST_NPoints(g) - ST_NPoints(ST_RemoveRepeatedPoints(g)) AS repeated, ST_NPoints(g) AS vertices,
         ST_GeometryType(geom_postgis) AS "storedType"
    FROM (SELECT *, ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326) AS g
            FROM map_layers
           WHERE "worldId" = $1 AND "layerType" = $2 AND "isActive" = true
             AND geometry->>'type' IN ('Polygon', 'MultiPolygon')) s
   ORDER BY "featureId" COLLATE "C"`;

interface LayerRow {
  id: string;
  key: string;
  countryId: string | null;
  name: string | null;
  properties: Prisma.JsonValue;
  geojson: string;
  hash: string;
  crosses: boolean | null;
  valid: boolean;
  reason: string;
  repeated: number | bigint;
  vertices: number | bigint;
  storedType: string | null;
}

const isJsonObject = (value: Prisma.JsonValue | undefined): value is Prisma.JsonObject =>
  value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value);

/** Each active polygon of the layer: outline, health, link, properties and outline hash. Reads only (PostGIS). */
export async function readLayerFeatures(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  realmId: string,
  layerType: string
): Promise<LayerFeatureState[]> {
  const rows = await db.$queryRawUnsafe<LayerRow[]>(LAYER_SQL, realmId, layerType);
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    countryId: row.countryId,
    name: row.name,
    properties: isJsonObject(row.properties) ? row.properties : {},
    geometry: JSON.parse(row.geojson) as Polygon | MultiPolygon,
    hash: row.hash,
    crosses: row.crosses === true,
    valid: row.valid,
    reason: row.reason,
    repeated: Number(row.repeated),
    vertices: Number(row.vertices),
    storedType: row.storedType,
  }));
}

function readStamp(properties: Prisma.JsonObject): CoverageStamp | null {
  const stamp = properties.coverage;
  if (!isJsonObject(stamp)) return null;
  const { tolerance, smooth, hash } = stamp;
  return typeof tolerance === "number" && typeof smooth === "number" && typeof hash === "string"
    ? { tolerance, smooth, hash }
    : null;
}

const isUpToDate = (feature: LayerFeatureState, coverage: CoverageSettings) => {
  const stamp = readStamp(feature.properties);
  return (
    stamp !== null &&
    stamp.tolerance === coverage.tolerance &&
    stamp.smooth === coverage.smooth &&
    stamp.hash === feature.hash
  );
};

type RawOutline = { geometry: Polygon | MultiPolygon; fromSource: boolean } | null;

/** A feature's unsmoothed outline (see the module comment), or null when it is unknown. */
function rawOutline(feature: LayerFeatureState, input: PlanInput): RawOutline {
  const stamp = readStamp(feature.properties);
  if (stamp && stamp.hash !== feature.hash)
    return { geometry: feature.geometry, fromSource: false };
  const sourceHash = feature.properties.sourceHash;
  const source = input.sourceRaw?.get(feature.key);
  if (source && typeof sourceHash === "string" && source.sourceHash === sourceHash) {
    return { geometry: source.geometry, fromSource: true };
  }
  // A synced feature without a record may be one smoothed before records were kept: only its source can tell.
  const synced = typeof sourceHash === "string" && input.sourceUnavailable !== undefined;
  return stamp || synced ? null : { geometry: feature.geometry, fromSource: false };
}

function planSmoothing(
  features: readonly LayerFeatureState[],
  input: PlanInput
): Pick<LayerRepairPlan, "smoothing" | "inputs"> {
  const inputs = new Map(features.map((f) => [f.key, f.geometry]));
  const smoothing = {
    status: "off" as SmoothingStatus,
    pending: [] as string[],
    fromSource: [] as string[],
    blocked: [] as string[],
    sourceProblem: input.sourceUnavailable ?? null,
  };
  const { coverage } = input;
  if (!coverage) return { smoothing, inputs };
  const smoothable = features.filter((f) => !f.crosses);
  smoothing.pending = smoothable.filter((f) => !isUpToDate(f, coverage)).map((f) => f.key);
  if (smoothing.pending.length === 0)
    return { smoothing: { ...smoothing, status: "up-to-date" }, inputs };
  const raw = new Map(smoothable.map((f) => [f.key, rawOutline(f, input)]));
  smoothing.blocked = [...raw].flatMap(([key, outline]) => (outline ? [] : [key]));
  if (smoothing.blocked.length > 0)
    return { smoothing: { ...smoothing, status: "blocked" }, inputs };
  for (const [key, outline] of raw) {
    inputs.set(key, outline!.geometry);
    if (outline!.fromSource) smoothing.fromSource.push(key);
  }
  return { smoothing: { ...smoothing, status: "smooth" }, inputs };
}

/** What a repair of the layer would do (pure). */
export function planLayerRepair(
  features: readonly LayerFeatureState[],
  input: PlanInput
): LayerRepairPlan {
  const crossing = features.filter((f) => f.crosses).map((f) => f.key);
  const needsRepair = features
    .filter((f) => !f.crosses && (!f.valid || f.repeated > 0 || f.storedType !== "ST_MultiPolygon"))
    .map((f) => f.key);
  const { smoothing, inputs } = planSmoothing(features, input);
  return {
    features: features.length,
    crossing,
    needsRepair,
    trims: [...input.trims],
    smoothing,
    inputs,
    changed: needsRepair.length > 0 || input.trims.length > 0 || smoothing.status === "smooth",
  };
}

interface LayerRepairOptions {
  layerType: string;
  coverage: CoverageSettings | null;
  apply: boolean;
  /** Clerk userId, "cron" or "script:…" (MapImport.createdBy). */
  createdBy: string;
  sourceRaw?: ReadonlyMap<string, SourceOutline>;
  sourceUnavailable?: string;
  /** Multiplies measured areas (a realm's own planet size); default 1. */
  areaScale?: number;
}

export interface LayerRepairReport {
  plan: LayerRepairPlan;
  written: RealmMapWriteResult | null;
  /** The rollback snapshot's MapImport. */
  mapImportId: string | null;
}

type RepairDb = PrismaClient;

const withoutStamp = (properties: Prisma.JsonObject): Prisma.JsonObject => {
  const { coverage: _coverage, ...rest } = properties;
  return rest;
};

async function writeRepair(
  db: RepairDb,
  realmId: string,
  features: readonly LayerFeatureState[],
  plan: LayerRepairPlan,
  options: LayerRepairOptions
): Promise<Omit<LayerRepairReport, "plan">> {
  const smoothing = plan.smoothing.status === "smooth" && options.coverage;
  const snapshot = await captureMapSnapshot(db, realmId, [
    {
      layerType: options.layerType,
      keys: features.map((f) => f.key),
      wholeLayer: false,
      countryIds: [],
    },
  ]);
  const written = await writeRealmMapFeatures(
    db,
    realmId,
    features.map((f) => ({
      key: f.key,
      geometry: plan.inputs.get(f.key) ?? f.geometry,
      name: f.name,
      countryId: f.countryId,
      properties: smoothing ? withoutStamp(f.properties) : f.properties,
    })),
    {
      layerType: options.layerType,
      areaScale: options.areaScale,
      ...(smoothing && { coverage: smoothing }),
    }
  );
  const packed = packSnapshot(snapshot);
  const record = await db.mapImport.create({
    data: {
      realmId,
      layerTypes: [options.layerType],
      mode: "merge",
      createdBy: options.createdBy,
      summary: {
        written: written.written.length,
        rejected: written.rejected.length,
        smoothed: written.smoothed,
        source: "repair",
      },
      snapshot: packed.bytes,
      snapshotBytes: packed.size,
      rollbackAvailable: packed.bytes !== null,
    },
    select: { id: true },
  });
  return { written, mapImportId: record.id };
}

/** Plan the layer's repair and, with `apply` and something to change, write it (see the module comment). */
export async function repairRealmLayer(
  db: RepairDb,
  realmId: string,
  options: LayerRepairOptions
): Promise<LayerRepairReport> {
  if (!(await isPostGISAvailable(db))) throw new Error("Border repair needs PostGIS");
  const features = await readLayerFeatures(db, realmId, options.layerType);
  const trims = await findOverlapTrims(db, realmId, {
    layerType: options.layerType,
    areaScale: options.areaScale,
  });
  const plan = planLayerRepair(features, {
    trims: trims.map((t) => ({ key: t.key, removedKm2: t.removedKm2 })),
    coverage: options.coverage,
    sourceRaw: options.sourceRaw,
    sourceUnavailable: options.sourceUnavailable,
  });
  if (!options.apply || !plan.changed) return { plan, written: null, mapImportId: null };
  return { plan, ...(await writeRepair(db, realmId, features, plan, options)) };
}
