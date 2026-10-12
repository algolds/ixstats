import type { MultiPolygon, Polygon } from "geojson";
import type { City, PrismaClient, Subdivision } from "@prisma/client";

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
 * $1 the nation, $2 its realm. One outline for a nation drawn as several regions: atlas_country_union
 * (migration 20261021120000_atlas_r0) returns their union in PostGIS (touching regions merge, so no inner border is
 * left), as a Polygon when it is one, and under `wide` the stored GeoJSON of any region drawn across +-180, whose
 * geom_postgis is a planar sliver, to sit beside it. It catches its own failures (in SQL, so a caller's
 * transaction is never aborted) and returns NULL: the cached outline stays.
 */
const REGION_UNION_SQL = "SELECT atlas_country_union($1, $2) AS result";

interface RegionUnion {
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
  let union: RegionUnion | null | undefined;
  try {
    const [row] = await db.$queryRawUnsafe<Array<{ result: RegionUnion | null }>>(
      REGION_UNION_SQL,
      countryId,
      realmId
    );
    union = row?.result;
  } catch (error) {
    // Only a database without the function lands here (a failed union is caught in SQL): the cached outline
    // stays. On a transaction client this statement error would already have aborted the transaction.
    console.warn(`[country-geo] region union failed for ${countryId}, keeping its outline:`, error);
    return null;
  }
  const parts = [union?.geometry, ...(union?.wide ?? [])].filter((g): g is RegionGeometry => !!g);
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
    // Without the country row there is no realm to read the regions from: the cached outline stays
    const geometry = country?.realmId
      ? await unionLinkedRegions(db, countryId, country.realmId)
      : null;
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

type CityDemographics = { id: string; population: number; gdpContribution: number };

/** Splits a subdivision's population and GDP over its cities in proportion to their existing populations. */
function scaleCityDemographics(
  cities: City[],
  subPop: number,
  subGdp: number,
  citiesSumPop: number
): CityDemographics[] {
  const popScale = subPop / citiesSumPop;
  const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

  let allocatedPop = 0;
  let allocatedGdp = 0;

  return cities.map((city, i) => {
    let pop = Math.round((city.population ?? 0) * popScale);
    let gdp = pop * gdpPerCapita;

    // Rounding adjustment for last city
    if (i === cities.length - 1) {
      pop = subPop - allocatedPop;
      gdp = subGdp - allocatedGdp;
    }

    allocatedPop += pop;
    allocatedGdp += gdp;

    return { id: city.id, population: pop, gdpContribution: gdp };
  });
}

/**
 * Splits a subdivision's population and GDP over its cities by predefined category/status weights:
 * National Capital = 5.0, Subdivision Capital = 3.0, standard City/major = 2.0, Town = 0.5, other/Village = 0.1.
 */
function weightCityDemographics(
  cities: City[],
  sub: Subdivision,
  subPop: number,
  subGdp: number
): CityDemographics[] {
  const getWeight = (c: City) => {
    if (c.isNationalCapital) return 5.0;
    if (c.isSubdivisionCapital || c.name === sub.capital) return 3.0;
    if (c.type === "city" || c.type === "major") return 2.0;
    if (c.type === "town") return 0.5;
    return 0.1;
  };

  const weights = cities.map((c) => ({ city: c, w: getWeight(c) }));
  const sumWeights = weights.reduce((sum, item) => sum + item.w, 0);

  const gdpPerCapita = subPop > 0 ? subGdp / subPop : 0;

  let allocatedPop = 0;
  let allocatedGdp = 0;

  return weights.map(({ city, w }, i): CityDemographics => {
    let pop = Math.round(subPop * (w / sumWeights));
    let gdp = pop * gdpPerCapita;

    // Rounding adjustment for last city
    if (i === weights.length - 1) {
      pop = subPop - allocatedPop;
      gdp = subGdp - allocatedGdp;
    }

    allocatedPop += pop;
    allocatedGdp += gdp;

    return { id: city.id, population: pop, gdpContribution: gdp };
  });
}

/** Rows per UPDATE statement when writing city demographics. */
const CITY_UPDATE_CHUNK = 500;

/** Writes the cities' figures in a few UPDATE ... FROM statements, all inside one transaction. */
async function writeCityDemographics(
  db: Pick<PrismaClient, "$executeRawUnsafe" | "$transaction">,
  updates: CityDemographics[]
) {
  const statements = [];
  for (let from = 0; from < updates.length; from += CITY_UPDATE_CHUNK) {
    const chunk = updates.slice(from, from + CITY_UPDATE_CHUNK);
    statements.push(
      db.$executeRawUnsafe(
        `UPDATE cities AS c
         SET population = v.population, "gdpContribution" = v.gdp, "updatedAt" = NOW()
         FROM unnest($1::text[], $2::float8[], $3::float8[]) AS v(id, population, gdp)
         WHERE c.id = v.id`,
        chunk.map((u) => u.id),
        chunk.map((u) => u.population),
        chunk.map((u) => u.gdpContribution)
      )
    );
  }
  if (statements.length > 0) await db.$transaction(statements);
}

/**
 * Distributes subdivision populations and GDP contributions down to the subdivision's approved cities.
 * Uses either scaling proportional to existing populations or predefined category/status weights.
 * Reads every subdivision's cities in one query and writes all the new figures in one transaction.
 */
export async function distributeSubdivisionDemographicsToCities(
  db: any,
  countryId: string,
  scaleExisting: boolean
) {
  // 1. Fetch subdivisions for the country, and their approved cities in one query
  const subdivisions: Subdivision[] = await db.subdivision.findMany({
    where: { countryId, status: "approved" },
  });
  const allCities: City[] = await db.city.findMany({
    where: {
      subdivisionId: { in: subdivisions.map((sub) => sub.id) },
      countryId,
      status: "approved",
    },
  });
  const citiesBySubdivision = new Map<string | null, City[]>();
  for (const city of allCities) {
    const siblings = citiesBySubdivision.get(city.subdivisionId);
    if (siblings) siblings.push(city);
    else citiesBySubdivision.set(city.subdivisionId, [city]);
  }

  // 2. Work out each subdivision's cities
  const cityUpdates: CityDemographics[] = [];
  for (const sub of subdivisions) {
    const subPop = sub.population ?? 0;
    const subGdp = sub.gdpContribution ?? 0;
    const cities = citiesBySubdivision.get(sub.id) ?? [];

    if (subPop <= 0 || cities.length === 0) continue;

    // Fall back to weights if the sum of existing population is 0
    const citiesSumPop = cities.reduce((sum, c) => sum + (c.population ?? 0), 0);
    cityUpdates.push(
      ...(scaleExisting && citiesSumPop > 0
        ? scaleCityDemographics(cities, subPop, subGdp, citiesSumPop)
        : weightCityDemographics(cities, sub, subPop, subGdp))
    );
  }

  // 3. Write updates to database
  await writeCityDemographics(db, cityUpdates);

  return { success: true, totalCitiesUpdated: cityUpdates.length };
}
