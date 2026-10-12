import type { PrismaClient } from "@prisma/client";
import { COUNTRY_BORDER_SQL } from "~/lib/maps/geo-validation";

type RawDb = Pick<PrismaClient, "$queryRawUnsafe">;

/**
 * Nearest-neighbour candidates measured exactly per point and water type. The index orders by planar degrees,
 * which can rank a farther feature first at high latitudes; the nearest by true distance is among the first few.
 */
const WATER_KNN_CANDIDATES = 5;

/** Distance reported for a water type the realm has none of. */
const NO_WATER_KM = 9999.0;

/**
 * The join that finds, for each point, the nearest river and nearest lake of one realm: the GiST index orders the
 * candidate features by `<->`, and only those few are measured exactly (on the sphere). Rows: `type`, `distance` (km).
 * `point` is the SQL expression of the point's geometry, `realm` that of the realm id to read.
 */
const nearestWaterSql = (point: string, realm: string) => `
  CROSS JOIN (VALUES ('rivers'), ('lakes')) AS lt(layer)
  CROSS JOIN LATERAL (
    SELECT MIN(ST_Distance(${point}::geography, cand.geom_postgis::geography)) / 1000.0 AS distance
    FROM (
      SELECT ml.geom_postgis FROM map_layers ml
      WHERE ml."layerType" = lt.layer AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = ${realm}
      ORDER BY ml.geom_postgis <-> ${point}
      LIMIT ${WATER_KNN_CANDIDATES}
    ) cand
  ) nn`;

/** Kilometres to the nearest river and the nearest lake. */
export interface WaterDistances {
  riverKm: number;
  lakeKm: number;
}

/** What one city import point needs from the database, answered for the whole batch at once. */
export interface CityPointLookup {
  /** The point is inside the country's border; null when there is no border (or no PostGIS) to check against. */
  inside: boolean | null;
  /** The approved subdivision covering the point. Meaningful only when `inside` is not null. */
  subdivisionId: string | null;
  /** Distance to the nearest river and lake; null when the water query failed. */
  water: WaterDistances | null;
}

const UNNEST_POINTS_SQL = `unnest($2::int[], $3::float8[], $4::float8[]) AS p(i, lng, lat)`;

async function lookupContainment(
  db: RawDb,
  countryId: string,
  indexes: number[],
  lngs: number[],
  lats: number[]
): Promise<Map<number, { inside: boolean | null; subdivisionId: string | null }>> {
  const rows = await db.$queryRawUnsafe<
    Array<{ i: number; is_inside: boolean | null; subdivisionId: string | null }>
  >(
    `WITH pts AS (
       SELECT p.i, ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326) AS pt FROM ${UNNEST_POINTS_SQL}
     ), border AS (SELECT ST_MakeValid(${COUNTRY_BORDER_SQL}) AS geom)
     SELECT pts.i, ST_Covers(border.geom, pts.pt) AS is_inside,
            (SELECT s.id FROM subdivisions s
              WHERE s."countryId" = $1 AND s.status = 'approved' AND s.geom_postgis IS NOT NULL
                AND ST_Covers(s.geom_postgis, pts.pt)
              LIMIT 1) AS "subdivisionId"
     FROM pts CROSS JOIN border`,
    countryId,
    indexes,
    lngs,
    lats
  );
  return new Map(
    rows.map((r) => [Number(r.i), { inside: r.is_inside, subdivisionId: r.subdivisionId ?? null }])
  );
}

/** Distances in km by point index (0 when the rows carry none); a type with no feature in the realm is 9999. */
function waterByPoint(
  rows: Array<{ i?: number; type: string; distance: number | string | null }>
): Map<number, WaterDistances> {
  const found = new Map<number, WaterDistances>();
  for (const r of rows) {
    const km = r.distance === null ? NO_WATER_KM : Number(r.distance);
    const i = Number(r.i ?? 0);
    const entry = found.get(i) ?? { riverKm: NO_WATER_KM, lakeKm: NO_WATER_KM };
    if (r.type === "rivers") entry.riverKm = km;
    if (r.type === "lakes") entry.lakeKm = km;
    found.set(i, entry);
  }
  return found;
}

async function lookupWater(
  db: RawDb,
  countryId: string,
  indexes: number[],
  lngs: number[],
  lats: number[]
): Promise<Map<number, WaterDistances>> {
  const rows = await db.$queryRawUnsafe<
    Array<{ i: number; type: string; distance: number | string | null }>
  >(
    `WITH pts AS (
       SELECT p.i, ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326) AS pt FROM ${UNNEST_POINTS_SQL}
     )
     SELECT pts.i, lt.layer AS type, nn.distance
     FROM pts ${nearestWaterSql("pts.pt", `(SELECT "realmId" FROM "Country" WHERE id = $1)`)}`,
    countryId,
    indexes,
    lngs,
    lats
  );
  return waterByPoint(rows);
}

/**
 * What a city import needs to know about each point, in two queries however many points there are: inside the
 * country's border, which subdivision covers it, and the distance to the nearest river and lake. A query that
 * fails leaves its part unknown (`inside: null`, `water: null`) and the caller falls back to per-city lookups.
 */
export async function lookupCityPoints(
  db: RawDb,
  countryId: string,
  points: Array<[lng: number, lat: number]>
): Promise<CityPointLookup[]> {
  if (points.length === 0) return [];
  const indexes = points.map((_, i) => i);
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  const [containment, water] = await Promise.all([
    lookupContainment(db, countryId, indexes, lngs, lats).catch((err) => {
      console.error(`[lookupCityPoints] Containment query failed:`, err);
      return null;
    }),
    lookupWater(db, countryId, indexes, lngs, lats).catch((err) => {
      console.error(`[lookupCityPoints] Water query failed:`, err);
      return null;
    }),
  ]);

  return indexes.map((i) => ({
    inside: containment?.get(i)?.inside ?? null,
    subdivisionId: containment?.get(i)?.subdivisionId ?? null,
    water: water?.get(i) ?? null,
  }));
}

/**
 * Find Subdivision at coordinate point using PostGIS contains check.
 */
export async function findSubdivisionAtPoint(
  db: any,
  countryId: string,
  lng: number,
  lat: number
): Promise<any> {
  try {
    const results = (await db.$queryRawUnsafe(
      `
      SELECT id, name FROM subdivisions
      WHERE "countryId" = $1 AND status = 'approved'
        AND geom_postgis IS NOT NULL
        AND ST_Covers(ST_MakeValid(geom_postgis), ST_SetSRID(ST_MakePoint($2, $3), 4326))
      LIMIT 1
    `,
      countryId,
      lng,
      lat
    )) as Array<{ id: string; name: string }>;

    if (results.length > 0) {
      return results[0];
    }
  } catch (err) {
    console.error(`[findSubdivisionAtPoint] Failed:`, err);
  }
  return null;
}

/**
 * Compute and update spatial profiles (climate, elevation, water) for a Subdivision, from the base
 * layers of its country's realm only.
 */
export async function updateSubdivisionSpatialProfile(
  db: any,
  subdivisionId: string
): Promise<any> {
  const subdivision = await db.subdivision.findUnique({
    where: { id: subdivisionId },
    select: { id: true, geometry: true, areaSqKm: true },
  });

  if (!subdivision || !subdivision.geometry || Object.keys(subdivision.geometry).length === 0) {
    return null;
  }

  const { resolveClimateFromColor, getAgricultureFactor, ELEVATION_ZONES } =
    await import("~/lib/maps/geo-analytics");

  try {
    // 1. Climate distribution
    const climateResults = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml.properties->>'fill' as fill,
        ST_Area(ST_Intersection(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN "Country" co ON co.id = s."countryId"
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = co."realmId"
      WHERE s.id = $1
        AND ST_Intersects(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))
    `,
      subdivisionId
    )) as Array<{ fill: string; intersectAreaSqKm: number }>;

    const climateMap = new Map<string, number>();
    for (const r of climateResults) {
      if (!r.fill || r.intersectAreaSqKm <= 0) continue;
      const climateName = resolveClimateFromColor(r.fill);
      if (climateName) {
        climateMap.set(
          climateName,
          (climateMap.get(climateName) ?? 0) + Number(r.intersectAreaSqKm)
        );
      }
    }

    const totalClimateArea = Array.from(climateMap.values()).reduce((sum, a) => sum + a, 0);
    const climateProfile = Array.from(climateMap.entries()).map(([climateName, areaSqKm]) => ({
      type: climateName,
      name: climateName,
      percentArea:
        totalClimateArea > 0 ? Math.round((areaSqKm / totalClimateArea) * 100 * 10) / 10 : 0,
      areaSqKm: Math.round(areaSqKm * 100) / 100,
      agricultureFactor: getAgricultureFactor(climateName),
    }));

    // 2. Elevation profile
    const elevationResults = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml.properties->>'fill' as fill,
        ST_Area(ST_Intersection(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN "Country" co ON co.id = s."countryId"
      JOIN map_layers ml ON ml."layerType" = 'altitudes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = co."realmId"
      WHERE s.id = $1
        AND ST_Intersects(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))
    `,
      subdivisionId
    )) as Array<{ fill: string; intersectAreaSqKm: number }>;

    const elevationMap = new Map<
      string,
      { name: string; areaSqKm: number; minElev: number; maxElev: number }
    >();
    for (const r of elevationResults) {
      if (!r.fill || r.intersectAreaSqKm <= 0) continue;
      const zoneMatch = ELEVATION_ZONES.find(
        (ez) => ez.color.toLowerCase() === r.fill.toLowerCase()
      );
      if (zoneMatch) {
        const existing = elevationMap.get(zoneMatch.zoneId);
        if (existing) {
          existing.areaSqKm += Number(r.intersectAreaSqKm);
        } else {
          elevationMap.set(zoneMatch.zoneId, {
            name: zoneMatch.zoneName,
            areaSqKm: Number(r.intersectAreaSqKm),
            minElev: zoneMatch.elevationMin,
            maxElev: zoneMatch.elevationMax,
          });
        }
      }
    }

    const totalElevArea = Array.from(elevationMap.values()).reduce((sum, z) => sum + z.areaSqKm, 0);
    const elevationProfile = Array.from(elevationMap.entries()).map(([zoneId, z]) => ({
      zone: zoneId,
      name: z.name,
      percentArea: totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0,
      areaSqKm: Math.round(z.areaSqKm * 100) / 100,
      minElev: z.minElev,
      maxElev: z.maxElev,
    }));

    // 3. Water access (rivers and lakes)
    const riverResult = (await db.$queryRawUnsafe(
      `
      SELECT 
        COALESCE(SUM(ST_Length(ST_Intersection(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))::geography) / 1000.0), 0.0) as "riverLengthKm"
      FROM subdivisions s
      JOIN "Country" co ON co.id = s."countryId"
      JOIN map_layers ml ON ml."layerType" = 'rivers' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = co."realmId"
      WHERE s.id = $1
        AND ST_Intersects(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))
    `,
      subdivisionId
    )) as Array<{ riverLengthKm: number }>;

    const lakeResult = (await db.$queryRawUnsafe(
      `
      SELECT 
        COALESCE(SUM(ST_Area(ST_Intersection(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))::geography) / 1000000.0), 0.0) as "lakeAreaSqKm"
      FROM subdivisions s
      JOIN "Country" co ON co.id = s."countryId"
      JOIN map_layers ml ON ml."layerType" = 'lakes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = co."realmId"
      WHERE s.id = $1
        AND ST_Intersects(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))
    `,
      subdivisionId
    )) as Array<{ lakeAreaSqKm: number }>;

    const riverLengthKm = Number(riverResult[0]?.riverLengthKm) || 0;
    const lakeAreaSqKm = Number(lakeResult[0]?.lakeAreaSqKm) || 0;

    const waterAccess = {
      hasRiver: riverLengthKm > 0,
      hasLake: lakeAreaSqKm > 0,
      riverLengthKm: Math.round(riverLengthKm * 100) / 100,
      lakeAreaSqKm: Math.round(lakeAreaSqKm * 100) / 100,
    };

    // Update the subdivision record
    return await db.subdivision.update({
      where: { id: subdivisionId },
      data: {
        climateProfile: climateProfile as any,
        elevationProfile: elevationProfile as any,
        waterAccess: waterAccess as any,
      },
    });
  } catch (err) {
    console.error(`[updateSubdivisionSpatialProfile] Failed for ${subdivisionId}:`, err);
    return null;
  }
}

/** A city's distance to the nearest river and lake of its country's realm. */
async function cityWaterDistances(db: RawDb, cityId: string): Promise<WaterDistances> {
  const rows = await db.$queryRawUnsafe<Array<{ type: string; distance: number | string | null }>>(
    `SELECT lt.layer AS "type", nn.distance
     FROM cities c
     JOIN "Country" co ON co.id = c."countryId"
     ${nearestWaterSql("c.geom_postgis", `co."realmId"`)}
     WHERE c.id = $1`,
    cityId
  );
  return waterByPoint(rows).get(0) ?? { riverKm: NO_WATER_KM, lakeKm: NO_WATER_KM };
}

/**
 * Compute and update spatial profile (climate, water access) for a City, from the base layers of its
 * country's realm only. `water` is the nearest river and lake when the caller already measured them.
 */
export async function updateCitySpatialProfile(
  db: any,
  cityId: string,
  water?: WaterDistances
): Promise<any> {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { id: true, coordinates: true },
  });

  if (!city || !city.coordinates) {
    return null;
  }

  const { resolveClimateFromColor } = await import("~/lib/maps/geo-analytics");

  try {
    // 1. Dominant climate
    const climateResult = (await db.$queryRawUnsafe(
      `
      SELECT ml.properties->>'fill' as fill
      FROM cities c
      JOIN "Country" co ON co.id = c."countryId"
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
        AND ml."worldId" = co."realmId"
      WHERE c.id = $1
        AND ST_Covers(ml.geom_postgis, c.geom_postgis)
      LIMIT 1
    `,
      cityId
    )) as Array<{ fill: string }>;

    let climateName = null;
    if (climateResult.length > 0 && climateResult[0]?.fill) {
      climateName = resolveClimateFromColor(climateResult[0].fill);
    }

    // 2. Distance to nearest water body (rivers, lakes), unless the import batch already measured it
    const { riverKm: riverDist, lakeKm: lakeDist } =
      water ?? (await cityWaterDistances(db, cityId));

    // Consider close if within 10km
    const waterAccess = {
      nearRiver: riverDist <= 10.0,
      nearLake: lakeDist <= 10.0,
      riverDistanceKm: Math.round(riverDist * 100) / 100,
      lakeDistanceKm: Math.round(lakeDist * 100) / 100,
    };

    return await db.city.update({
      where: { id: cityId },
      data: {
        climate: climateName,
        waterAccess: waterAccess as any,
      },
    });
  } catch (err) {
    console.error(`[updateCitySpatialProfile] Failed for ${cityId}:`, err);
    return null;
  }
}

/**
 * Aligns the borders of a target subdivision with other subdivisions in the same country.
 * Mutually inserts vertices where boundaries are shared/snapped to edges.
 * Updates the neighbor subdivisions in the database if modified.
 */
export async function alignSubdivisionBorders(
  db: any,
  countryId: string,
  targetId: string | null,
  geometry: any,
  tolerance = 1e-7
): Promise<any> {
  const { alignSharedVertices } = await import("~/lib/maps/border-editor");
  const subdivisions = await db.subdivision.findMany({
    where: {
      countryId,
      status: "approved",
      ...(targetId ? { id: { not: targetId } } : {}),
    },
    select: {
      id: true,
      name: true,
      geometry: true,
    },
  });

  let alignedGeometry = JSON.parse(JSON.stringify(geometry));

  for (const neighbor of subdivisions) {
    if (
      !neighbor.geometry ||
      (neighbor.geometry as any).type === "Point" ||
      !(neighbor.geometry as any).coordinates
    ) {
      continue;
    }

    const res = alignSharedVertices(alignedGeometry, neighbor.geometry as any, tolerance);
    if (res.modifiedB) {
      // Neighbor geometry was modified (inserted target's vertex into neighbor)
      await db.subdivision.update({
        where: { id: neighbor.id },
        data: { geometry: res.geomB },
      });
      // Force PostGIS triggers to run
      try {
        await db.$executeRawUnsafe(
          `UPDATE subdivisions SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
          JSON.stringify(res.geomB),
          neighbor.id
        );
      } catch (err) {
        console.warn(
          `[alignSubdivisionBorders] Failed to sync PostGIS for neighbor ${neighbor.name}:`,
          err
        );
      }
    }
    if (res.modifiedA) {
      // Target geometry was modified (inserted neighbor's vertex into target)
      alignedGeometry = res.geomA;
    }
  }

  return alignedGeometry;
}
