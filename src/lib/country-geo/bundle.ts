import { getCountryColor } from "~/lib/maps/map-config";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";

/**
 * Builds a unified geographic data bundle for a country, reducing client round-trips
 * and ensuring attribute and spatial data are fetched together.
 */
export async function getCountryGeoBundle(db: any, countryId: string) {
  // 1. Fetch all independent country entities concurrently in a single round-trip
  const [
    country,
    mapLayer,
    subdivisions,
    cities,
    pois,
    storyPins,
    mapLabels,
    geoProfile,
  ] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: {
        id: true,
        name: true,
        slug: true,
        currentPopulation: true,
        currentTotalGdp: true,
        geoRollupMode: true,
        geometry: true,
        centroid: true,
        boundingBox: true,
        landArea: true,
        areaSqMi: true,
      },
    }),
    db.mapLayer.findFirst({
      where: {
        layerType: "political",
        countryId,
        isActive: true,
      },
    }),
    db.subdivision.findMany({
      where: { countryId, status: "approved" },
      orderBy: { name: "asc" },
    }),
    db.city.findMany({
      where: { countryId, status: "approved" },
      orderBy: [{ isNationalCapital: "desc" }, { population: "desc" }],
    }),
    db.pointOfInterest.findMany({
      where: { countryId, status: "approved" },
      orderBy: { name: "asc" },
    }),
    db.storyPin.findMany({
      where: { countryId, status: "approved" },
      orderBy: { ixTimeYear: "asc" },
    }),
    db.mapLabel.findMany({
      where: { countryId, status: "approved" },
      orderBy: { text: "asc" },
    }),
    db.countryGeoProfile.findUnique({
      where: { countryId },
    }),
  ]);

  if (!country) {
    throw new Error(`Country not found: ${countryId}`);
  }

  // Derive geometry details, falling back to cached country columns
  const geometry = (mapLayer?.geometry || country.geometry) ?? null;
  const centroid = (mapLayer?.centroid || country.centroid) ?? null;
  const boundingBox = (mapLayer?.boundingBox || country.boundingBox) ?? null;
  const areaSqKm = (mapLayer?.areaSqKm || country.landArea) ?? null;
  const displayName = mapLayer?.displayName || country.name;
  const featureId = mapLayer?.featureId ?? null;
  const fillColor = featureId ? getCountryColor(featureId) : null;

  // Parse centroid into standardized { lng, lat } format
  let parsedCentroid: { lng: number; lat: number } | null = null;
  if (Array.isArray(centroid) && centroid.length >= 2) {
    parsedCentroid = { lng: Number(centroid[0]), lat: Number(centroid[1]) };
  } else if (
    centroid &&
    typeof centroid === "object" &&
    "coordinates" in centroid &&
    Array.isArray((centroid as any).coordinates)
  ) {
    parsedCentroid = {
      lng: Number((centroid as any).coordinates[0]),
      lat: Number((centroid as any).coordinates[1]),
    };
  }

  // 2. Fetch neighboring countries via PostGIS spatial query if map layer has spatial geometry
  let neighbors: Array<{
    featureId: string;
    displayName: string;
    countryId: string | null;
    centroidLng: number;
    centroidLat: number;
  }> = [];

  if (mapLayer && mapLayer.geom_postgis !== null) {
    try {
      const dbNeighbors = (await db.$queryRawUnsafe(
        `SELECT ml2."featureId", ml2."displayName", ml2."countryId",
                (ml2.centroid -> 'coordinates' ->> 0)::float AS "centroidLng",
                (ml2.centroid -> 'coordinates' ->> 1)::float AS "centroidLat"
         FROM map_layers ml1
         JOIN map_layers ml2 ON ml2."layerType" = 'political'
           AND ml2."isActive" = true
           AND ml2.id != ml1.id
           AND ml1.geom_postgis IS NOT NULL
           AND ml2.geom_postgis IS NOT NULL
           AND ST_Touches(ST_MakeValid(ml1.geom_postgis), ST_MakeValid(ml2.geom_postgis))
         WHERE ml1.id = $1`,
        mapLayer.id
      )) as Array<{
        featureId: string;
        displayName: string | null;
        countryId: string | null;
        centroidLng: number | null;
        centroidLat: number | null;
      }>;

      neighbors = dbNeighbors.map((n) => ({
        featureId: n.featureId,
        displayName: n.displayName || featureIdToDisplayName(n.featureId),
        countryId: n.countryId,
        centroidLng: Number(n.centroidLng) || 0,
        centroidLat: Number(n.centroidLat) || 0,
      }));
    } catch (err) {
      console.warn(`[getCountryGeoBundle] Failed to calculate neighbors via PostGIS:`, err);
    }
  }

  // 6. Compute rollups & coverage ratios (Phase P-D preparation)
  const cityPopulationSum = cities.reduce((sum: number, c: any) => sum + (c.population ?? 0), 0);
  const subdivisionPopulationSum = subdivisions.reduce(
    (sum: number, s: any) => sum + (s.population ?? 0),
    0
  );

  const cityGdpContributionSum = cities.reduce(
    (sum: number, c: any) => sum + (c.gdpContribution ?? 0),
    0
  );
  const subdivisionGdpContributionSum = subdivisions.reduce(
    (sum: number, s: any) => sum + (s.gdpContribution ?? 0),
    0
  );

  let reconciledSubdivisions = subdivisions;
  let reconciledCities = cities;
  let populationCoverage =
    country.currentPopulation > 0 ? subdivisionPopulationSum / country.currentPopulation : 0;

  let gdpCoverage =
    country.currentTotalGdp > 0 ? subdivisionGdpContributionSum / country.currentTotalGdp : 0;

  // Apply top-down scaling on display values if in top-down mode
  if (country.geoRollupMode === "top-down") {
    populationCoverage = 1.0;
    gdpCoverage = 1.0;

    if (subdivisionPopulationSum > 0 || subdivisionGdpContributionSum > 0) {
      const popScale =
        subdivisionPopulationSum > 0 ? country.currentPopulation / subdivisionPopulationSum : 1;
      const gdpScale =
        subdivisionGdpContributionSum > 0
          ? country.currentTotalGdp / subdivisionGdpContributionSum
          : 1;

      reconciledSubdivisions = subdivisions.map((s: any) => ({
        ...s,
        population: s.population ? Math.round(s.population * popScale) : 0,
        gdpContribution: s.gdpContribution ? s.gdpContribution * gdpScale : 0,
      }));
    }

    if (cityPopulationSum > 0 || cityGdpContributionSum > 0) {
      const popScale = cityPopulationSum > 0 ? country.currentPopulation / cityPopulationSum : 1;
      const gdpScale =
        cityGdpContributionSum > 0 ? country.currentTotalGdp / cityGdpContributionSum : 1;

      reconciledCities = cities.map((c: any) => {
        const hasPopShare =
          c.populationShare !== null && c.populationShare !== undefined && c.populationShare > 0;
        const pop = hasPopShare
          ? Math.round(country.currentPopulation * (c.populationShare / 100))
          : c.population
            ? Math.round(c.population * popScale)
            : 0;

        const gdp = c.gdpContribution ? c.gdpContribution * gdpScale : 0;
        return {
          ...c,
          population: pop,
          gdpContribution: gdp,
        };
      });
    }
  }

  return {
    country: {
      id: country.id,
      name: country.name,
      slug: country.slug,
      geoRollupMode: country.geoRollupMode,
      currentPopulation: country.currentPopulation,
      currentTotalGdp: country.currentTotalGdp,
    },
    geometry,
    centroid: parsedCentroid,
    boundingBox,
    areaSqKm,
    displayName,
    featureId,
    fillColor,
    subdivisions: reconciledSubdivisions,
    cities: reconciledCities,
    pois,
    storyPins,
    mapLabels,
    neighbors,
    geoProfile,
    rollups: {
      cityPopulationSum,
      subdivisionPopulationSum,
      cityGdpContributionSum,
      subdivisionGdpContributionSum,
      populationCoverage,
      gdpCoverage,
    },
  };
}
