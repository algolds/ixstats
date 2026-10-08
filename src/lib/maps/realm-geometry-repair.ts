/**
 * Geometry repair for a realm's polygon features, used by the realm map writer and the repair script
 * (scripts/realms/repair-realm-geometry.ts).
 *
 * - Each polygon is made valid before it is stored: repeated consecutive points are dropped (rings that collapse
 *   go), then with PostGIS `ST_MakeValid` untangles self-intersections and only the polygonal parts are kept, as
 *   a MultiPolygon. Without PostGIS only the repeated points go.
 * - A geometry whose rings cross ±180° is never repaired in SQL: PostGIS reads it as a planar polygon spanning
 *   the globe and its "repair" is slivers. Such rows are also left out of overlap removal.
 * - Overlaps between a realm layer's features (borders traced one nation at a time, each grown into the border,
 *   overlap in thin strips) are removed so every strip belongs to exactly one side: the feature whose key sorts
 *   first (byte order) keeps it. A midline split would move each border back to the middle of the strip, but
 *   needs a medial axis per strip; giving the strip to one side keeps the union of the layer exactly (no gaps),
 *   is one statement, gives the same result whatever order features were written in, and moves a border by at
 *   most the strip's width, which is within the drawn border line of the source art.
 * - Coverage smoothing (`smoothLayerCoverage`): a layer traced from pixel art (borders, bands, zones) shows the
 *   pixels' steps when zoomed in. The layer is made an exact coverage first (its outlines noded into faces, each
 *   face given to the feature that holds it, the first key winning where two do, so overlaps go and shared edges
 *   match vertex for vertex), then simplified as a coverage (PostGIS `ST_CoverageSimplify`, Visvalingam on each
 *   shared edge once) and smoothed as a topology (topology-smooth.ts: Chaikin on each shared arc once, junctions
 *   kept). Shared edges stay shared, so no gap or overlap opens between neighbours. Rows across ±180° stay out.
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { Prisma, PrismaClient } from "@prisma/client";
import { polygonMetrics } from "./feature-metrics";
import { smoothTopology, type ArcTopology } from "./topology-smooth";

// TopoJSON packages are CommonJS.
const topoServer = require("topojson-server") as {
  topology: (objects: Record<string, FeatureCollection>) => ArcTopology & {
    objects: Record<string, unknown>;
  };
};
const topoClient = require("topojson-client") as {
  feature: (
    topology: unknown,
    object: unknown
  ) => FeatureCollection<Polygon | MultiPolygon, { id: string }>;
};

type RawDb = Pick<PrismaClient, "$queryRawUnsafe">;
type TrimDb = RawDb & { country: Pick<Prisma.TransactionClient["country"], "updateMany"> };

/** Overlaps smaller than this (in square degrees, about 1 m² at the equator) are floating-point noise. */
const MIN_OVERLAP_DEG2 = 1e-10;

const REPAIR_SQL = `SELECT ST_AsGeoJSON(
    ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326)), 3))
  ) AS geojson`;

/** Rows whose GeoJSON crosses ±180° (a planar width over 180° and a segment jumping more than 180°). */
export const CROSSES_ANTIMERIDIAN_SQL = `(ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180 AND EXISTS (
         SELECT 1 FROM ST_DumpSegments(ST_GeomFromGeoJSON(geometry::text)) s
          WHERE abs(ST_X(ST_StartPoint(s.geom)) - ST_X(ST_EndPoint(s.geom))) > 180))`;

/**
 * $1 realm, $2 layer type, $3 keys (null: all), $4 area scale. Each feature loses the union of the overlapping
 * features whose key sorts before its own; only pairs with a key in $3 count. Rows whose GeoJSON crosses ±180°
 * (a planar width over 180° and a segment jumping more than 180°) stay out.
 */
const FIND_TRIMS_SQL = `WITH layer AS (
    SELECT id, "featureId" AS key, "countryId", ST_CollectionExtract(ST_MakeValid(geom_postgis), 3) AS g
      FROM map_layers
     WHERE "worldId" = $1 AND "layerType" = $2 AND "isActive" = true AND geom_postgis IS NOT NULL
       AND NOT ${CROSSES_ANTIMERIDIAN_SQL}
  ), taken AS (
    SELECT a.id, ST_Union(b.g) AS g
      FROM layer a
      JOIN layer b ON b.key COLLATE "C" < a.key COLLATE "C" AND ST_Intersects(a.g, b.g)
     WHERE ($3::text[] IS NULL OR a.key = ANY($3::text[]) OR b.key = ANY($3::text[]))
       AND ST_Area(ST_Intersection(a.g, b.g)) > ${MIN_OVERLAP_DEG2}
     GROUP BY a.id
  ), trimmed AS (
    SELECT a.id, a.key, a."countryId", a.g AS before,
           ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Difference(a.g, t.g)), 3)) AS g
      FROM layer a JOIN taken t ON t.id = a.id
  )
  SELECT id, key, "countryId", ST_AsGeoJSON(g) AS geojson,
         (ST_Area(before::geography) - ST_Area(g::geography)) / 1000000.0 * $4 AS removed_km2
    FROM trimmed
   WHERE NOT ST_IsEmpty(g)
   ORDER BY key COLLATE "C"`;

const APPLY_TRIM_SQL = `UPDATE map_layers
    SET geometry = $2::text::jsonb,
        geom_postgis = ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326),
        centroid = $3::text::jsonb,
        "boundingBox" = $4::text::jsonb,
        "areaSqKm" = ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326)::geography) / 1000000.0 * $5,
        "updatedAt" = NOW()
  WHERE id = $1 AND "worldId" = $6
  RETURNING "areaSqKm" AS area`;

const samePosition = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

function dedupeRing(ring: Position[]): Position[] {
  return ring.filter((p, i) => i === 0 || !samePosition(p, ring[i - 1]!));
}

/**
 * The geometry as a MultiPolygon without repeated consecutive points. A ring left with fewer than four positions
 * is dropped, and with it its polygon when it was the outer ring. Null when no polygon is left.
 */
export function dropRepeatedPoints(geometry: Polygon | MultiPolygon): MultiPolygon | null {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const kept: Position[][][] = [];
  for (const polygon of polygons) {
    const rings = polygon.map(dedupeRing);
    if ((rings[0]?.length ?? 0) < 4) continue;
    kept.push(rings.filter((ring) => ring.length >= 4));
  }
  return kept.length > 0 ? { type: "MultiPolygon", coordinates: kept } : null;
}

/** Whether a ring jumps across ±180° between two consecutive positions. */
export function crossesAntimeridian(geometry: Polygon | MultiPolygon): boolean {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  return rings.some((ring) =>
    ring.some((p, i) => i > 0 && Math.abs(p[0]! - ring[i - 1]![0]!) > 180)
  );
}

/** PostGIS's GeoJSON output as a MultiPolygon; its rounding (9 decimals) can repeat a point, so those go too. */
function parseMultiPolygon(text: string | null | undefined): MultiPolygon | null {
  if (!text) return null;
  const parsed = JSON.parse(text) as MultiPolygon | null;
  return parsed?.type === "MultiPolygon" ? dropRepeatedPoints(parsed) : null;
}

/**
 * The geometry repaired for storing (see the module comment); null when nothing polygonal is left. With
 * `postgis` false, or for a geometry crossing ±180°, only repeated points are dropped.
 */
export async function repairPolygonalGeometry(
  db: RawDb,
  geometry: Polygon | MultiPolygon,
  postgis: boolean
): Promise<MultiPolygon | null> {
  const deduped = dropRepeatedPoints(geometry);
  if (!deduped || !postgis || crossesAntimeridian(deduped)) return deduped;
  const rows = await db.$queryRawUnsafe<Array<{ geojson: string | null }>>(
    REPAIR_SQL,
    JSON.stringify(deduped)
  );
  return parseMultiPolygon(rows[0]?.geojson);
}

/** A feature's new outline, to be stored (storeFeatureGeometries). */
export interface FeatureGeometryUpdate {
  id: string;
  key: string;
  countryId: string | null;
  geometry: MultiPolygon;
}

export interface OverlapTrim extends FeatureGeometryUpdate {
  /** The feature without the strips it gives up (`geometry`); the area given up, km² on the realm's planet. */
  removedKm2: number;
}

export interface OverlapOptions {
  layerType?: string;
  /** Only overlaps with one of these features count (default: the whole layer). */
  keys?: readonly string[] | null;
  /** Multiplies measured areas (a realm's own planet size); default 1. */
  areaScale?: number;
}

/** The features of one realm layer that give up overlap strips, and what each keeps. Reads only (PostGIS). */
export async function findOverlapTrims(
  db: RawDb,
  realmId: string,
  options: OverlapOptions = {}
): Promise<OverlapTrim[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string;
      key: string;
      countryId: string | null;
      geojson: string | null;
      removed_km2: number | null;
    }>
  >(
    FIND_TRIMS_SQL,
    realmId,
    options.layerType ?? "political",
    options.keys ? [...options.keys] : null,
    options.areaScale ?? 1
  );
  return rows.flatMap((row) => {
    const geometry = parseMultiPolygon(row.geojson);
    return geometry
      ? [
          {
            id: row.id,
            key: row.key,
            countryId: row.countryId,
            geometry,
            removedKm2: Number(row.removed_km2 ?? 0),
          },
        ]
      : [];
  });
}

/**
 * Store each feature's new outline (a trim, a smoothing): outline, PostGIS copy, area (× `areaScale`), centroid and
 * bounding box, and the linked country's outline, centroid and box (unless `syncCountryGeometry` is false). Only
 * rows and countries of `realmId` are touched. Returns each feature's new area in km².
 */
export async function storeFeatureGeometries(
  db: TrimDb,
  realmId: string,
  trims: readonly FeatureGeometryUpdate[],
  options: { areaScale?: number; syncCountryGeometry?: boolean } = {}
): Promise<Record<string, number | null>> {
  const areas: Record<string, number | null> = {};
  for (const trim of trims) {
    const metrics = polygonMetrics(trim.geometry);
    const rows = await db.$queryRawUnsafe<Array<{ area: number | null }>>(
      APPLY_TRIM_SQL,
      trim.id,
      JSON.stringify(trim.geometry),
      JSON.stringify(metrics?.centroid ?? null),
      JSON.stringify(metrics?.boundingBox ?? null),
      options.areaScale ?? 1,
      realmId
    );
    areas[trim.key] = rows[0]?.area ?? null;
    if (trim.countryId && options.syncCountryGeometry !== false && metrics) {
      await db.country.updateMany({
        where: { id: trim.countryId, realmId },
        data: {
          geometry: { type: "MultiPolygon", coordinates: trim.geometry.coordinates },
          centroid: metrics.centroid,
          boundingBox: metrics.boundingBox,
        },
      });
    }
  }
  return areas;
}

/**
 * $1 realm, $2 layer type, $3 tolerance (degrees). The layer's outlines noded into faces; each face goes to the
 * feature holding a point inside it (the first key when two do); each feature's faces are unioned, so neighbours
 * match vertex for vertex, and the whole layer is simplified as one coverage.
 */
const COVERAGE_SQL = `WITH layer AS (
    SELECT id, "featureId" AS key, "countryId",
           ST_SnapToGrid(ST_CollectionExtract(ST_MakeValid(geom_postgis), 3), 1e-7) AS g
      FROM map_layers
     WHERE "worldId" = $1 AND "layerType" = $2 AND "isActive" = true AND geom_postgis IS NOT NULL
       AND NOT ${CROSSES_ANTIMERIDIAN_SQL}
  ), faces AS (
    SELECT row_number() OVER () AS fid, d.geom AS f
      FROM (SELECT ST_Polygonize(e) AS gc FROM (SELECT ST_Union(ST_Boundary(g)) AS e FROM layer) u) p,
           ST_Dump(p.gc) d
  ), owned AS (
    SELECT DISTINCT ON (fid) fid, l.id, f
      FROM faces JOIN layer l ON ST_Intersects(l.g, ST_PointOnSurface(f))
     ORDER BY fid, l.key COLLATE "C"
  ), noded AS (
    SELECT id, ST_Union(f) AS g FROM owned GROUP BY id
  )
  SELECT l.id, l.key, l."countryId", ST_AsGeoJSON(ST_Multi(s.g)) AS geojson, ST_NPoints(l.g) AS before
    FROM (SELECT id, ST_CoverageSimplify(g, $3) OVER () AS g FROM noded) s
    JOIN layer l ON l.id = s.id
   WHERE NOT ST_IsEmpty(s.g)
   ORDER BY l.key COLLATE "C"`;

export interface CoverageOptions {
  layerType: string;
  /** ST_CoverageSimplify's tolerance, degrees (a source pixel: 0.045° on an 8000 px wide globe). */
  tolerance: number;
  /** Rounds of corner cutting after simplifying (0: none). */
  smooth: number;
}

export interface CoverageUpdate extends FeatureGeometryUpdate {
  verticesBefore: number;
  verticesAfter: number;
}

const vertexCount = (geometry: MultiPolygon) =>
  geometry.coordinates.reduce(
    (n, polygon) => n + polygon.reduce((m, ring) => m + ring.length, 0),
    0
  );

/**
 * Smooth the features as one topology with the PNG layer engine's settings, `tolerance` standing for its pixel:
 * corner cuts at most one tolerance, vertices spanning less than 0.35 of a tolerance square dropped again.
 */
function smoothCoverage(
  features: ReadonlyArray<{ id: string; geometry: MultiPolygon }>,
  tolerance: number,
  rounds: number
): Map<string, MultiPolygon> {
  const collection: FeatureCollection<MultiPolygon, { id: string }> = {
    type: "FeatureCollection",
    features: features.map((f): Feature<MultiPolygon, { id: string }> => ({
      type: "Feature",
      properties: { id: f.id },
      geometry: f.geometry,
    })),
  };
  const topology = smoothTopology(topoServer.topology({ regions: collection }), {
    iterations: rounds,
    maxCut: tolerance,
    prune: tolerance * tolerance * 0.35,
  });
  const out = new Map<string, MultiPolygon>();
  for (const f of topoClient.feature(topology, topology.objects.regions).features) {
    const geometry = f.geometry && dropRepeatedPoints(f.geometry);
    if (geometry) out.set(f.properties.id, geometry);
  }
  return out;
}

/**
 * One realm layer as a smooth coverage (see the module comment): each feature's new outline, valid (made so with
 * PostGIS after smoothing). Reads only; store the result with storeFeatureGeometries.
 */
export async function smoothLayerCoverage(
  db: RawDb,
  realmId: string,
  options: CoverageOptions
): Promise<CoverageUpdate[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string;
      key: string;
      countryId: string | null;
      geojson: string | null;
      before: number;
    }>
  >(COVERAGE_SQL, realmId, options.layerType, options.tolerance);
  const simplified = rows.flatMap((row) => {
    const geometry = parseMultiPolygon(row.geojson);
    return geometry ? [{ ...row, geometry }] : [];
  });
  const smoothed =
    options.smooth > 0
      ? smoothCoverage(simplified, options.tolerance, options.smooth)
      : new Map(simplified.map((f) => [f.id, f.geometry]));
  const updates: CoverageUpdate[] = [];
  for (const row of simplified) {
    const geometry = await repairPolygonalGeometry(db, smoothed.get(row.id) ?? row.geometry, true);
    if (!geometry) continue;
    updates.push({
      id: row.id,
      key: row.key,
      countryId: row.countryId,
      geometry,
      verticesBefore: Number(row.before),
      verticesAfter: vertexCount(geometry),
    });
  }
  return updates;
}

/**
 * Coverage smoothing's record on a feature (`properties.coverage`): the settings it was smoothed with and the
 * md5 of its outline as stored afterwards. A feature whose outline still has that hash is smoothed and must not be
 * smoothed again (each pass would round its corners further); one edited or rewritten since has another hash, or
 * no record (a write replaces the properties).
 */
export interface CoverageStamp {
  tolerance: number;
  smooth: number;
  hash: string;
}

/** $1 realm, $2 layer type, $3 tolerance, $4 rounds: the record on every feature the coverage covered. */
const STAMP_COVERAGE_SQL = `UPDATE map_layers
    SET properties = COALESCE(properties, '{}'::jsonb) || jsonb_build_object('coverage',
          jsonb_build_object('tolerance', $3::float8, 'smooth', $4::int, 'hash', md5(geometry::text)))
  WHERE "worldId" = $1 AND "layerType" = $2 AND "isActive" = true AND geom_postgis IS NOT NULL
    AND geometry->>'type' IN ('Polygon', 'MultiPolygon')
    AND NOT ${CROSSES_ANTIMERIDIAN_SQL}
  RETURNING "featureId" AS key`;

/** Record the smoothing on each feature of a layer just smoothed as one coverage (see CoverageStamp). */
export async function stampLayerCoverage(
  db: RawDb,
  realmId: string,
  options: CoverageOptions
): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ key: string }>>(
    STAMP_COVERAGE_SQL,
    realmId,
    options.layerType,
    options.tolerance,
    options.smooth
  );
  return rows.length;
}
