/**
 * The realm map writer: upserts a set of features into one realm's map layer, keyed by (realm, layer type,
 * feature key), for any importer (a realm source sync's GeoJSON today; PNG, SVG or wiki imports later).
 *
 * - Geometry is checked before anything is written: Polygon or MultiPolygon, lon/lat in range, closed rings of
 *   at least four finite positions. A bad feature is rejected (and reported) instead of written.
 * - Writes go in batches, each in its own transaction with an explicit timeout, so a large map never trips the
 *   default interactive-transaction timeout and one bad batch does not undo the others.
 * - Where PostGIS is installed the writer fills `geom_postgis` itself (ST_MakeValid of the GeoJSON), never
 *   relying on a database trigger, and measures each feature with ST_Area(geography).
 * - Each feature gets its display name and, when given, its country link; the linked country takes the outline,
 *   centroid and bounding box. Its land area is never written here: which area a nation shows (a stated figure,
 *   or the measured one as a fallback) is the caller's decision, so the measured areas are returned.
 * - Only the given keys are touched: no other feature, and no other layer type, is deactivated or changed.
 *   A replacing import retires the rest of one layer itself, with `deactivateOtherFeatures`.
 * - A realm on a planet of its own size passes `areaScale` ((radiusKm / 6371)², planet.ts) so the stored areas
 *   are its own; PostGIS measures on Earth.
 * - Non-political layers (rivers, lakes, relief) may pass `geometryKinds: "any"` to accept lines and points too.
 */
import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { Prisma, PrismaClient } from "@prisma/client";
import { polygonMetrics } from "./feature-metrics";
import { isPostGISAvailable } from "./geo-validation";

export interface RealmMapFeatureInput {
  /** Stable key within the realm and layer (becomes MapLayer.featureId). */
  key: string;
  /** Polygon or MultiPolygon; any GeoJSON geometry with `geometryKinds: "any"`. */
  geometry: Polygon | MultiPolygon | Geometry;
  /** Display name (MapLayer.displayName); left unchanged when absent. */
  name?: string | null;
  /** Link the feature to this country of the realm. Absent leaves an existing link as it is. */
  countryId?: string | null;
  /** The importer's own measured area in km², used when PostGIS cannot measure. */
  areaKm2?: number | null;
  /** Stored as the feature's properties (replacing what the importer wrote before). */
  properties?: Record<string, unknown>;
}

export interface RealmMapWriteOptions {
  layerType?: string;
  batchSize?: number;
  transactionTimeoutMs?: number;
  /** Copy a linked feature's outline, centroid and bounding box onto its country (default true). */
  syncCountryGeometry?: boolean;
  /** "polygonal" (default): Polygon and MultiPolygon only. "any": lines and points are accepted too. */
  geometryKinds?: "polygonal" | "any";
  /** Multiplies every measured area (a realm's own planet size); default 1. */
  areaScale?: number;
}

export interface RealmMapWriteResult {
  written: string[];
  rejected: { key: string; reason: string }[];
  /** Each written feature's area in km² (PostGIS geography area when available, else the given or approximate). */
  areas: Record<string, number | null>;
}

export const DEFAULT_MAP_WRITE_BATCH = 20;
export const DEFAULT_MAP_WRITE_TIMEOUT_MS = 60_000;

function isPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0] as number) <= 180 &&
    Math.abs(p[1] as number) <= 90
  );
}

function ringProblem(ring: unknown): string | null {
  if (!Array.isArray(ring) || ring.length < 4) return "a ring has fewer than four positions";
  if (!ring.every(isPosition)) return "a position is not a finite lon/lat pair in range";
  const first = ring[0] as Position;
  const last = ring[ring.length - 1] as Position;
  if (first[0] !== last[0] || first[1] !== last[1]) return "a ring is not closed";
  return null;
}

const LINE_TYPES = new Set(["Point", "MultiPoint", "LineString", "MultiLineString"]);

/** Every position of a point or line geometry, or null when its nesting is wrong. */
function linePositions(type: string, coordinates: unknown[]): unknown[] | null {
  if (type === "Point") return [coordinates];
  if (type === "MultiPoint" || type === "LineString") return coordinates;
  if (type === "MultiLineString") {
    return coordinates.every(Array.isArray) ? (coordinates as unknown[][]).flat() : null;
  }
  return null;
}

/** Why a geometry cannot be written, or null when it can (`kinds: "any"` also accepts lines and points). */
export function geometryProblem(
  geometry: unknown,
  kinds: "polygonal" | "any" = "polygonal"
): string | null {
  const g = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return "no coordinates";
  if (kinds === "any" && typeof g.type === "string" && LINE_TYPES.has(g.type)) {
    const points = linePositions(g.type, g.coordinates);
    if (!points || !points.every(isPosition)) return "a position is not a finite lon/lat pair in range";
    return g.type.endsWith("LineString") && points.length < 2 ? "a line has fewer than two positions" : null;
  }
  const polygons =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : null;
  if (!polygons) return `a ${String(g.type)} is not a Polygon or MultiPolygon`;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) return "an empty polygon";
    for (const ring of polygon) {
      const problem = ringProblem(ring);
      if (problem) return problem;
    }
  }
  return null;
}

type WriterTx = Prisma.TransactionClient;

async function writeOne(
  tx: WriterTx,
  realmId: string,
  layerType: string,
  feature: RealmMapFeatureInput,
  postgis: boolean,
  syncCountry: boolean,
  areaScale: number
): Promise<number | null> {
  const metrics = polygonMetrics(feature.geometry);
  const geometry = feature.geometry as unknown as Prisma.InputJsonValue;
  const fields = {
    geometry,
    properties: (feature.properties ?? {}) as Prisma.InputJsonValue,
    ...(metrics && { centroid: metrics.centroid, boundingBox: metrics.boundingBox }),
    areaSqKm: feature.areaKm2 ?? (metrics ? metrics.areaSqKm * areaScale : null),
    isActive: true,
    ...(feature.name && { displayName: feature.name }),
  };
  const row = await tx.mapLayer.upsert({
    where: { realmId_layerType_featureId: { realmId, layerType, featureId: feature.key } },
    update: { ...fields, ...(feature.countryId && { countryId: feature.countryId }) },
    create: { ...fields, realmId, layerType, featureId: feature.key, countryId: feature.countryId ?? null },
    select: { id: true },
  });
  let area = fields.areaSqKm;
  if (postgis) {
    const measured = await tx.$queryRawUnsafe<Array<{ area: number | null }>>(
      `UPDATE map_layers
          SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
        WHERE id = $1
        RETURNING ST_Area(geom_postgis::geography) / 1000000.0 AS area`,
      row.id,
      JSON.stringify(feature.geometry)
    );
    const raw = measured[0]?.area;
    const value = typeof raw === "number" ? raw * areaScale : NaN;
    if (Number.isFinite(value) && value > 0) {
      area = value;
      await tx.mapLayer.update({ where: { id: row.id }, data: { areaSqKm: value } });
    }
  }
  if (feature.countryId && syncCountry) {
    await tx.country.update({
      where: { id: feature.countryId },
      data: {
        geometry,
        ...(metrics && { centroid: metrics.centroid, boundingBox: metrics.boundingBox }),
      },
    });
  }
  return area;
}

/**
 * Upsert features into a realm's map layer. Linked countries must be in the realm (checked here); a feature
 * whose country is elsewhere is rejected.
 */
export async function writeRealmMapFeatures(
  db: PrismaClient,
  realmId: string,
  features: readonly RealmMapFeatureInput[],
  options: RealmMapWriteOptions = {}
): Promise<RealmMapWriteResult> {
  const layerType = options.layerType ?? "political";
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_MAP_WRITE_BATCH);
  const timeout = options.transactionTimeoutMs ?? DEFAULT_MAP_WRITE_TIMEOUT_MS;
  const result: RealmMapWriteResult = { written: [], rejected: [], areas: {} };

  const linkIds = [...new Set(features.flatMap((f) => (f.countryId ? [f.countryId] : [])))];
  const linkable = new Set(
    linkIds.length
      ? (
          await db.country.findMany({
            where: { id: { in: linkIds }, realmId },
            select: { id: true },
          })
        ).map((c) => c.id)
      : []
  );
  const valid: RealmMapFeatureInput[] = [];
  for (const feature of features) {
    const problem = geometryProblem(feature.geometry, options.geometryKinds);
    if (problem) result.rejected.push({ key: feature.key, reason: problem });
    else if (feature.countryId && !linkable.has(feature.countryId))
      result.rejected.push({ key: feature.key, reason: "its country is not in this realm" });
    else valid.push(feature);
  }

  const postgis = await isPostGISAvailable(db);
  for (let i = 0; i < valid.length; i += batchSize) {
    const batch = valid.slice(i, i + batchSize);
    try {
      const areas = await db.$transaction(
        async (tx) => {
          const out: Array<[string, number | null]> = [];
          for (const feature of batch)
            out.push([
              feature.key,
              await writeOne(
                tx,
                realmId,
                layerType,
                feature,
                postgis,
                options.syncCountryGeometry ?? true,
                options.areaScale ?? 1
              ),
            ]);
          return out;
        },
        { timeout, maxWait: timeout }
      );
      for (const [key, area] of areas) {
        result.written.push(key);
        result.areas[key] = area;
      }
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 200);
      for (const feature of batch) result.rejected.push({ key: feature.key, reason });
    }
  }
  return result;
}

/**
 * Retire (isActive = false) every active feature of one realm layer whose key is not in `keep`: what a replacing
 * import does to the features its new map no longer has. Other layers are never touched. Returns how many.
 */
export async function deactivateOtherFeatures(
  db: Pick<PrismaClient, "mapLayer">,
  realmId: string,
  layerType: string,
  keep: readonly string[]
): Promise<number> {
  const { count } = await db.mapLayer.updateMany({
    where: { realmId, layerType, isActive: true, featureId: { notIn: [...keep] } },
    data: { isActive: false },
  });
  return count;
}
