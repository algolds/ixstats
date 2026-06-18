/**
 * Validate a point is within a country's borders using PostGIS.
 * Returns true if inside, false if outside or query fails.
 */
export async function checkPointInCountryTerritory(
  db: any,
  countryId: string,
  lng: number,
  lat: number
): Promise<boolean> {
  const { validatePointContainment } = await import("~/lib/geo-validation");
  try {
    await validatePointContainment(db, countryId, lng, lat);
    return true;
  } catch {
    return false;
  }
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
        AND ST_Covers(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
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
 * Compute and update spatial profiles (climate, elevation, water) for a Subdivision
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
    await import("~/lib/geo-analytics");

  try {
    // 1. Climate distribution
    const climateResults = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml.properties->>'fill' as fill,
        ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
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
        ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0 as "intersectAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'altitudes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
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
        COALESCE(SUM(ST_Length(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000.0), 0.0) as "riverLengthKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'rivers' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
    `,
      subdivisionId
    )) as Array<{ riverLengthKm: number }>;

    const lakeResult = (await db.$queryRawUnsafe(
      `
      SELECT 
        COALESCE(SUM(ST_Area(ST_Intersection(s.geom_postgis, ml.geom_postgis)::geography) / 1000000.0), 0.0) as "lakeAreaSqKm"
      FROM subdivisions s
      JOIN map_layers ml ON ml."layerType" = 'lakes' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
      WHERE s.id = $1
        AND ST_Intersects(s.geom_postgis, ml.geom_postgis)
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

/**
 * Compute and update spatial profile (climate, water access) for a City
 */
export async function updateCitySpatialProfile(db: any, cityId: string): Promise<any> {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { id: true, coordinates: true },
  });

  if (!city || !city.coordinates) {
    return null;
  }

  const { resolveClimateFromColor } = await import("~/lib/geo-analytics");

  try {
    // 1. Dominant climate
    const climateResult = (await db.$queryRawUnsafe(
      `
      SELECT ml.properties->>'fill' as fill
      FROM cities c
      JOIN map_layers ml ON ml."layerType" = 'climate' AND ml."isActive" = true AND ml.geom_postgis IS NOT NULL
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

    // 2. Distance to nearest water body (rivers, lakes)
    const waterDistances = (await db.$queryRawUnsafe(
      `
      SELECT 
        ml."layerType" as "type",
        COALESCE(MIN(ST_Distance(c.geom_postgis::geography, ml.geom_postgis::geography) / 1000.0), 9999.0) as "distance"
      FROM cities c
      JOIN map_layers ml ON ml."isActive" = true AND ml.geom_postgis IS NOT NULL AND ml."layerType" IN ('rivers', 'lakes')
      WHERE c.id = $1
      GROUP BY ml."layerType"
    `,
      cityId
    )) as Array<{ type: string; distance: number }>;

    const riverDist = Number(waterDistances.find((w) => w.type === "rivers")?.distance) ?? 9999.0;
    const lakeDist = Number(waterDistances.find((w) => w.type === "lakes")?.distance) ?? 9999.0;

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
  const { alignSharedVertices } = await import("~/lib/border-editor");
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
          `UPDATE subdivisions SET geom_postgis = ST_GeomFromGeoJSON($1) WHERE id = $2`,
          JSON.stringify(res.geomB),
          neighbor.id
        );
      } catch (err) {
        console.warn(`[alignSubdivisionBorders] Failed to sync PostGIS for neighbor ${neighbor.name}:`, err);
      }
    }
    if (res.modifiedA) {
      // Target geometry was modified (inserted neighbor's vertex into target)
      alignedGeometry = res.geomA;
    }
  }

  return alignedGeometry;
}
