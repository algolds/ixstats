import type { MultiPolygon, Polygon } from "geojson";
import type { PrismaClient } from "@prisma/client";

/**
 * Sync helper to keep Country cached geo columns up to date with its MapLayer political geometry.
 * Collapses the double-write points in the codebase.
 */

type RegionGeometry = Polygon | MultiPolygon;

interface LinkedRegion {
  centroid: unknown;
  boundingBox: unknown;
  areaSqKm: number | null;
}

/**
 * $1 the nation, $2 its realm. One outline for a nation drawn as several regions: their union in PostGIS (touching
 * regions merge, so no inner border is left), as a Polygon when it is one. A region whose planar width is over 180
 * degrees crosses +-180: its geom_postgis is a planar sliver, so it stays out of the union and comes back as its
 * stored GeoJSON (`wide`) to sit beside it.
 */
const REGION_UNION_SQL = `WITH regions AS (
    SELECT geom_postgis AS g, geometry,
           ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180 AS wide
      FROM map_layers
     WHERE "layerType" = 'political' AND "isActive" = true AND "countryId" = $1 AND "worldId" = $2
       AND geom_postgis IS NOT NULL
  ), merged AS (
    SELECT ST_CollectionExtract(ST_Union(g), 3) AS g FROM regions WHERE NOT wide
  )
  SELECT (SELECT ST_AsGeoJSON(CASE WHEN ST_NumGeometries(g) = 1 THEN ST_GeometryN(g, 1) ELSE g END)::json
            FROM merged WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)) AS geometry,
         (SELECT json_agg(geometry) FROM regions WHERE wide) AS wide`;

interface RegionUnionRow {
  geometry: RegionGeometry | null;
  wide: RegionGeometry[] | null;
}

const polygonsOf = (g: RegionGeometry) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

/** The nation's outline: the PostGIS union of its regions, with any region drawn across +-180 beside it. */
async function unionLinkedRegions(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  countryId: string,
  realmId: string
): Promise<RegionGeometry | null> {
  const [row] = await db.$queryRawUnsafe<RegionUnionRow[]>(REGION_UNION_SQL, countryId, realmId);
  const parts = [row?.geometry, ...(row?.wide ?? [])].filter((g): g is RegionGeometry => !!g);
  if (parts.length <= 1) return parts[0] ?? null;
  return { type: "MultiPolygon", coordinates: parts.flatMap(polygonsOf) };
}

const asPair = (v: unknown): [number, number] | null =>
  Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]) ? [v[0], v[1]] : null;
const asBox = (v: unknown): [number, number, number, number] | null =>
  Array.isArray(v) && v.length === 4 && v.every(Number.isFinite)
    ? (v as [number, number, number, number])
    : null;

/**
 * The nation's cached metrics from all its linked regions: the area-weighted centre of their centroids, the box
 * around their boxes and the sum of their areas (the outline is unionLinkedRegions). A value no region has stays
 * absent.
 */
export function combineRegions(regions: LinkedRegion[]) {
  const areas = regions.map((r) => r.areaSqKm).filter((a): a is number => a != null);
  const areaSqKm = areas.length > 0 ? areas.reduce((sum, a) => sum + a, 0) : null;

  const centred = regions
    .map((r) => ({ c: asPair(r.centroid), w: r.areaSqKm ?? 0 }))
    .filter((r): r is { c: [number, number]; w: number } => r.c !== null);
  const weight = centred.reduce((sum, r) => sum + r.w, 0);
  const centroid =
    centred.length === 0
      ? null
      : weight > 0
        ? ([
            centred.reduce((s, r) => s + r.c[0] * r.w, 0) / weight,
            centred.reduce((s, r) => s + r.c[1] * r.w, 0) / weight,
          ] as [number, number])
        : centred[0]!.c;

  const boxes = regions.map((r) => asBox(r.boundingBox)).filter((b) => b !== null);
  const boundingBox =
    boxes.length === 0
      ? null
      : regions.length === 1
        ? regions[0]!.boundingBox
        : [
            Math.min(...boxes.map((b) => b[0])),
            Math.min(...boxes.map((b) => b[1])),
            Math.max(...boxes.map((b) => b[2])),
            Math.max(...boxes.map((b) => b[3])),
          ];
  return {
    centroid: regions.length === 1 ? regions[0]!.centroid : centroid,
    boundingBox,
    areaSqKm,
  };
}

/**
 * Copy a nation's linked regions onto its cached geo columns. A nation may be drawn as several regions (islands,
 * exclaves): all of them count, read from the nation's own realm's map. With none linked, the cache is cleared.
 */
export async function syncCountryGeometryFromMapLayer(db: any, countryId: string): Promise<void> {
  const country = await db.country.findUnique?.({
    where: { id: countryId },
    select: { realmId: true },
  });
  const regions: LinkedRegion[] = await db.mapLayer.findMany({
    where: {
      layerType: "political",
      countryId,
      isActive: true,
      ...(country?.realmId && { realmId: country.realmId }),
    },
    select: {
      centroid: true,
      boundingBox: true,
      areaSqKm: true,
    },
    orderBy: { areaSqKm: "desc" },
    take: 1000,
  });

  if (regions.length > 0) {
    const mapLayer = combineRegions(regions);
    const geometry = await unionLinkedRegions(db, countryId, country?.realmId);
    // Only what the regions actually have: one imported without metrics must not null the country's centroid,
    // bounding box or (baseline) land area, and with no PostGIS geometry yet the cached outline stays.
    await db.country.update({
      where: { id: countryId },
      data: {
        ...(geometry && { geometry }),
        ...(mapLayer.centroid != null && { centroid: mapLayer.centroid }),
        ...(mapLayer.boundingBox != null && { boundingBox: mapLayer.boundingBox }),
        ...(mapLayer.areaSqKm != null && {
          landArea: mapLayer.areaSqKm,
          areaSqMi: mapLayer.areaSqKm * 0.386102,
        }),
      },
    });
  } else {
    // If no active political layer is linked, clear the cached fields
    await db.country.update({
      where: { id: countryId },
      data: {
        geometry: null,
        centroid: null,
        boundingBox: null,
        landArea: null,
        areaSqMi: null,
      },
    });
  }
}

/**
 * Recalculates the largest city based on population and updates NationalIdentity cache.
 */
export async function recalculateLargestCity(db: any, countryId: string): Promise<void> {
  const largestCity = await db.city.findFirst({
    where: {
      countryId,
      status: "approved",
      population: { not: null },
    },
    orderBy: {
      population: "desc",
    },
  });

  if (largestCity) {
    await db.nationalIdentity.upsert({
      where: { countryId },
      update: {
        largestCityId: largestCity.id,
        largestCity: largestCity.name,
      },
      create: {
        countryId,
        largestCity: largestCity.name,
        largestCityId: largestCity.id,
      },
    });
  } else {
    await db.nationalIdentity.upsert({
      where: { countryId },
      update: {
        largestCityId: null,
        largestCity: null,
      },
      create: {
        countryId,
        largestCity: null,
        largestCityId: null,
      },
    });
  }
}

/**
 * Syncs subdivision and country demographics from child cities and subdivisions.
 */
export async function syncGeographicDemographics(
  db: any,
  countryId: string,
  subdivisionId?: string | null
) {
  if (subdivisionId) {
    const citiesSum = await db.city.aggregate({
      where: { subdivisionId, status: "approved" },
      _sum: { population: true, gdpContribution: true },
    });
    const subPop = citiesSum._sum.population ?? 0;
    const subGdp = citiesSum._sum.gdpContribution ?? 0;
    await db.subdivision.update({
      where: { id: subdivisionId },
      data: {
        population: subPop,
        gdpContribution: subGdp,
      },
    });
  }

  // Fetch the country rollup mode to see if we should sync to the national baseline
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { geoRollupMode: true },
  });

  if (!country || country.geoRollupMode !== "bottom-up") {
    return;
  }

  const subdivisionsSum = await db.subdivision.aggregate({
    where: { countryId, status: "approved" },
    _sum: { population: true, gdpContribution: true },
  });
  const totalSubPop = subdivisionsSum._sum.population ?? 0;
  const totalSubGdp = subdivisionsSum._sum.gdpContribution ?? 0;

  // Only subdivisions cover the whole nation. City figures are urban-only, so falling back to them
  // would overwrite the national population/GDP with the urban total; leave the national figures alone.
  if (totalSubPop > 0) {
    const gdpPerCapita = totalSubGdp / totalSubPop;
    await db.country.update({
      where: { id: countryId },
      data: {
        currentPopulation: totalSubPop,
        currentTotalGdp: totalSubGdp,
        currentGdpPerCapita: gdpPerCapita,
      },
    });
  }
}

/**
 * Update the rollup mode of a country.
 */
export async function updateGeoRollupMode(db: any, countryId: string, mode: string) {
  if (!["hybrid", "top-down", "bottom-up"].includes(mode)) {
    throw new Error(`Invalid rollup mode: ${mode}`);
  }

  const country = await db.country.update({
    where: { id: countryId },
    data: { geoRollupMode: mode },
  });

  // If switched to bottom-up, sync demographics immediately
  if (mode === "bottom-up") {
    await syncGeographicDemographics(db, countryId);
  }

  return country;
}

/**
 * Rebase the country's national population and GDP totals to match geographic sums.
 */
export async function rebaseNationalFromGeography(db: any, countryId: string) {
  const subdivisionsSum = await db.subdivision.aggregate({
    where: { countryId, status: "approved" },
    _sum: { population: true, gdpContribution: true },
  });

  let totalPop = subdivisionsSum._sum.population ?? 0;
  let totalGdp = subdivisionsSum._sum.gdpContribution ?? 0;

  // Fallback to cities if no subdivisions are present/approved
  if (totalPop === 0 && totalGdp === 0) {
    const citiesSum = await db.city.aggregate({
      where: { countryId, status: "approved" },
      _sum: { population: true, gdpContribution: true },
    });
    totalPop = citiesSum._sum.population ?? 0;
    totalGdp = citiesSum._sum.gdpContribution ?? 0;
  }

  if (totalPop <= 0) {
    throw new Error("Cannot rebase: geographic population must be greater than zero.");
  }

  const gdpPerCapita = totalGdp / totalPop;

  const country = await db.country.update({
    where: { id: countryId },
    data: {
      currentPopulation: totalPop,
      currentTotalGdp: totalGdp,
      currentGdpPerCapita: gdpPerCapita,
    },
  });

  return country;
}

/**
 * Distributes subdivision populations and GDP contributions down to the subdivision's approved cities.
 * Uses either scaling proportional to existing populations or predefined category/status weights.
 */
export async function distributeSubdivisionDemographicsToCities(
  db: any,
  countryId: string,
  scaleExisting: boolean
) {
  // 1. Fetch subdivisions for the country
  const subdivisions = await db.subdivision.findMany({
    where: { countryId, status: "approved" },
  });

  let totalCitiesUpdated = 0;

  // 2. Iterate subdivisions
  for (const sub of subdivisions) {
    const subPop = sub.population ?? 0;
    const subGdp = sub.gdpContribution ?? 0;

    if (subPop <= 0) continue;

    // Fetch approved cities in this subdivision
    const cities = await db.city.findMany({
      where: { subdivisionId: sub.id, countryId, status: "approved" },
    });

    if (cities.length === 0) continue;

    let useScaling = scaleExisting;
    let citiesSumPop = 0;
    if (useScaling) {
      citiesSumPop = cities.reduce((sum: number, c: any) => sum + (c.population ?? 0), 0);
      if (citiesSumPop <= 0) {
        useScaling = false; // Fallback to weights if sum of existing population is 0
      }
    }

    const cityUpdates: Array<{ id: string; population: number; gdpContribution: number }> = [];

    if (useScaling) {
      // Scale existing population proportionally
      const popScale = subPop / citiesSumPop;
      const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

      let allocatedPop = 0;
      let allocatedGdp = 0;

      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        let pop = Math.round((city.population ?? 0) * popScale);
        let gdp = pop * gdpPerCapita;

        // Rounding adjustment for last city
        if (i === cities.length - 1) {
          pop = subPop - allocatedPop;
          gdp = subGdp - allocatedGdp;
        }

        allocatedPop += pop;
        allocatedGdp += gdp;

        cityUpdates.push({ id: city.id, population: pop, gdpContribution: gdp });
      }
    } else {
      // Predefined weights
      // National Capital = 5.0
      // Subdivision Capital = 3.0
      // standard City/major = 2.0
      // Town = 0.5
      // other/Village = 0.1
      const getWeight = (c: any) => {
        if (c.isNationalCapital) return 5.0;
        if (c.isSubdivisionCapital || c.name === sub.capital) return 3.0;
        if (c.type === "city" || c.type === "major") return 2.0;
        if (c.type === "town") return 0.5;
        return 0.1;
      };

      const weights = cities.map((c: any) => ({ city: c, w: getWeight(c) }));
      const sumWeights = weights.reduce((sum: number, item: { w: number }) => sum + item.w, 0);

      const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

      let allocatedPop = 0;
      let allocatedGdp = 0;

      for (let i = 0; i < weights.length; i++) {
        const { city, w } = weights[i];
        let pop = Math.round(subPop * (w / sumWeights));
        let gdp = pop * gdpPerCapita;

        // Rounding adjustment for last city
        if (i === weights.length - 1) {
          pop = subPop - allocatedPop;
          gdp = subGdp - allocatedGdp;
        }

        allocatedPop += pop;
        allocatedGdp += gdp;

        cityUpdates.push({ id: city.id, population: pop, gdpContribution: gdp });
      }
    }

    // Write updates to database
    for (const update of cityUpdates) {
      await db.city.update({
        where: { id: update.id },
        data: {
          population: update.population,
          gdpContribution: update.gdpContribution,
        },
      });
      totalCitiesUpdated++;
    }
  }

  return { success: true, totalCitiesUpdated };
}
