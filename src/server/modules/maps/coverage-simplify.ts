/**
 * Coverage simplification of a realm's polygon layer in PostGIS (`ST_CoverageSimplify`, PostGIS 3.4 / GEOS 3.12).
 * The polygons are simplified as one coverage, so a border two of them share keeps the same vertices on both sides
 * (simplifying each polygon alone, as turf does, opens gaps and overlaps along borders). Server only.
 */
import type { PrismaClient } from "@prisma/client";
import type { Geometry } from "geojson";

type CoverageDb = Pick<PrismaClient, "$queryRaw">;

export interface CoverageRequest {
  layerType: string;
  realmId: string;
  /** Simplification tolerance in degrees. */
  tolerance: number;
  /** Decimal places the coordinates come back at (the layer's packing precision). */
  decimals: number;
}

type CoverageRow = { featureId: string; geometry: string | null };

/** Whether this database has `ST_CoverageSimplify` (PostGIS 3.4+ built against GEOS 3.12+). */
async function hasCoverageSimplify(db: CoverageDb): Promise<boolean> {
  const rows = await db.$queryRaw<
    Array<{ exists: boolean }>
  >`SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'st_coveragesimplify') AS "exists"`;
  return rows[0]?.exists === true;
}

/** A simplified polygon, or null when it is unreadable or simplified away to nothing. */
function parseGeometry(text: string | null): Geometry | null {
  if (!text) return null;
  try {
    const geometry = JSON.parse(text) as Geometry;
    const empty = "coordinates" in geometry && geometry.coordinates.length === 0;
    return empty ? null : geometry;
  } catch {
    return null;
  }
}

/**
 * The realm's active features of `layerType`, simplified as one coverage: featureId to geometry. A row crossing the
 * antimeridian is left out (stored with longitudes jumping 180 to -180, its `geom_postgis` is a planar sliver
 * spanning the world), as is a row with no polygon in it, and any feature the simplification emptied; the caller
 * simplifies those from their stored GeoJSON. Null when the function is missing or the coverage cannot be
 * simplified (overlapping shapes can make GEOS refuse), so the caller simplifies the whole layer itself.
 */
export async function simplifyLayerCoverage(
  db: CoverageDb,
  { layerType, realmId, tolerance, decimals }: CoverageRequest
): Promise<Map<string, Geometry> | null> {
  try {
    if (!(await hasCoverageSimplify(db))) return null;
    const rows = await db.$queryRaw<CoverageRow[]>`
      WITH polys AS (
        SELECT "featureId" AS fid, ST_CollectionExtract(geom_postgis, 3) AS g
        FROM map_layers
        WHERE "worldId" = ${realmId} AND "layerType" = ${layerType} AND "isActive"
          AND geom_postgis IS NOT NULL
          AND ST_XMax(geom_postgis) - ST_XMin(geom_postgis) <= 180
      )
      SELECT fid AS "featureId",
             ST_AsGeoJSON(ST_CoverageSimplify(g, ${tolerance}::float8) OVER (), ${decimals}::int) AS geometry
      FROM polys
      WHERE NOT ST_IsEmpty(g)`;
    const out = new Map<string, Geometry>();
    for (const row of rows) {
      const geometry = parseGeometry(row.geometry);
      if (geometry) out.set(row.featureId, geometry);
    }
    return out;
  } catch (err) {
    console.warn(`[coverage-simplify] ${layerType} of ${realmId} falls back to per-polygon:`, err);
    return null;
  }
}
