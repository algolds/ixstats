import { z } from "zod";
import type { Geometry } from "geojson";
import type { PrismaClient } from "@prisma/client";
import { cachedStaticProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  buildGeoProfile,
  computeEconomicGeoModifiers,
  computeNPCGeoModifiers,
  computeCrisisRiskFactors,
  estimateTemperature,
  estimatePrecipitation,
} from "~/lib/maps/geo-analytics";
import { kmPerDegree, kmPerDegreeLng, scaleDistanceToRadius } from "~/lib/maps/planet";
import { parseRealmMapSettings, realmRadiusKm } from "~/lib/maps/realm-map-settings";
import { estimateBboxOverlap } from "./geometry";
import {
  buildClimateZones,
  buildElevationZones,
  countryZoneFills,
  type Extent,
} from "./profile-zones";

/**
 * $1 country: how many of the realm's rivers or lakes touch the country and their summed length/area inside it.
 * The country is cut into pieces of at most 256 vertices (ST_Subdivide) so each overlay is a small one; the
 * bounding-box test (`&&`) lets the GiST index on `geom_postgis` prune the layer first, and a feature that lies
 * inside a piece counts whole. The pieces partition the country, so their lengths and areas add up.
 */
function clippedLayerSql(layerType: "rivers" | "lakes") {
  const [measure, perUnit] = layerType === "rivers" ? ["ST_Length", "1000"] : ["ST_Area", "1e6"];
  return `
    WITH c AS MATERIALIZED (
      SELECT "realmId", geom_postgis FROM "Country" WHERE id = $1 AND geom_postgis IS NOT NULL
    ),
    parts AS MATERIALIZED (SELECT ST_Subdivide(c.geom_postgis, 256) AS g FROM c),
    cand AS MATERIALIZED (
      SELECT ml.id, ml.geom_postgis AS g
        FROM c JOIN map_layers ml ON ml."layerType" = '${layerType}' AND ml."isActive" = true
         AND ml."worldId" = c."realmId" AND ml.geom_postgis && c.geom_postgis
    )
    SELECT COUNT(DISTINCT cand.id)::int AS count,
      COALESCE(SUM(${measure}((CASE WHEN ST_CoveredBy(cand.g, parts.g) THEN cand.g
                                    ELSE ST_Intersection(cand.g, parts.g) END)::geography)), 0) / ${perUnit} AS total
      FROM cand JOIN parts ON cand.g && parts.g AND ST_Intersects(cand.g, parts.g)`;
}

/** Count and summed length/area of the realm's rivers or lakes clipped to the country, via PostGIS. */
async function clippedLayerStats(
  db: PrismaClient,
  countryId: string,
  layerType: "rivers" | "lakes"
) {
  const rows = await db.$queryRawUnsafe<Array<{ count: number; total: number }>>(
    clippedLayerSql(layerType),
    countryId
  );
  return { count: Number(rows[0]?.count ?? 0), total: Number(rows[0]?.total ?? 0) };
}

/** Bbox-estimation fallback for when the PostGIS hydrography queries fail. */
async function hydrographyByBbox(db: PrismaClient, realmId: string, extent: Extent) {
  const inExtent = async (layerType: "rivers" | "lakes") => {
    const layers = await db.mapLayer.findMany({
      where: { layerType, isActive: true, realmId },
      select: { featureId: true, geometry: true, properties: true, areaSqKm: true },
    });
    return layers.filter((layer) => {
      const geometry = layer.geometry as Geometry | null;
      return !!geometry && estimateBboxOverlap(geometry, ...extent) > 0;
    });
  };
  const [rivers, lakes] = await Promise.all([inExtent("rivers"), inExtent("lakes")]);
  return {
    riverCount: rivers.length,
    totalRiverLengthKm: rivers.reduce((sum, river) => {
      const props = river.properties as Record<string, unknown> | null;
      return sum + ((props?.["lengthKm"] as number) ?? river.areaSqKm ?? 0);
    }, 0),
    lakeCount: lakes.length,
    totalLakeAreaSqKm: lakes.reduce((sum, lake) => sum + (lake.areaSqKm ?? 0), 0),
  };
}

async function loadHydrography(
  db: PrismaClient,
  countryId: string,
  realmId: string,
  extent: Extent
) {
  try {
    const [rivers, lakes] = await Promise.all([
      clippedLayerStats(db, countryId, "rivers"),
      clippedLayerStats(db, countryId, "lakes"),
    ]);
    return {
      riverCount: rivers.count,
      totalRiverLengthKm: rivers.total,
      lakeCount: lakes.count,
      totalLakeAreaSqKm: lakes.total,
    };
  } catch (err) {
    console.warn("PostGIS hydro query failed, falling back to bbox estimation:", err);
    return hydrographyByBbox(db, realmId, extent);
  }
}

/**
 * $1 country: the other countries' political features of the same realm that touch it, each with the length of
 * border they share. The `&&` test lets the GiST index on `geom_postgis` prune the realm's features first.
 */
const NEIGHBOURS_SQL = `
  WITH c AS MATERIALIZED (
    SELECT id, "realmId", geom_postgis, ST_Boundary(geom_postgis) AS edge
      FROM "Country" WHERE id = $1 AND geom_postgis IS NOT NULL
  )
  SELECT DISTINCT ON (c2.id)
    c2.id, c2.name, c2.slug,
    ST_Length(ST_Intersection(ST_Boundary(ml.geom_postgis), c.edge)::geography) / 1000 AS shared_border_km
    FROM c
    JOIN map_layers ml ON ml."layerType" = 'political' AND ml."isActive" = true
     AND ml."worldId" = c."realmId" AND ml."countryId" IS NOT NULL AND ml."countryId" != c.id
     AND ml.geom_postgis && c.geom_postgis
    JOIN "Country" c2 ON c2.id = ml."countryId" AND c2."realmId" = c."realmId"
   WHERE ST_Intersects(ml.geom_postgis, c.geom_postgis)
   ORDER BY c2.id, shared_border_km DESC`;

const PERIMETER_SQL = `
  SELECT ST_Perimeter(geom_postgis::geography) / 1000 AS perimeter_km
    FROM "Country" WHERE id = $1 AND geom_postgis IS NOT NULL`;

/**
 * Neighbours and coastline via PostGIS: intersecting the stored `geom_postgis` shapes gives pixel-perfect
 * neighbour detection and accurate shared-border lengths.
 */
async function loadNeighbours(
  db: PrismaClient,
  countryId: string,
  extent: Extent,
  storedCoastlineKm: number | null
) {
  try {
    const [neighborRows, [perimeter]] = await Promise.all([
      db.$queryRawUnsafe<
        Array<{ id: string; name: string; slug: string | null; shared_border_km: number }>
      >(NEIGHBOURS_SQL, countryId),
      db.$queryRawUnsafe<Array<{ perimeter_km: number }>>(PERIMETER_SQL, countryId),
    ]);
    if (!perimeter) throw new Error("Country has no PostGIS geometry");
    const neighbors = neighborRows
      .filter((r) => Number(r.shared_border_km) > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        sharedBorderKm: Math.round(Number(r.shared_border_km)),
      }))
      .sort((a, b) => b.sharedBorderKm - a.sharedBorderKm);

    const perimeterKm = Math.round(Number(perimeter.perimeter_km ?? 0));
    const sharedBorderKm = neighbors.reduce((sum, n) => sum + n.sharedBorderKm, 0);
    return { neighbors, perimeterKm, coastlineKm: Math.max(0, perimeterKm - sharedBorderKm) };
  } catch {
    // PostGIS unavailable or geometry invalid — fall back to bbox estimation
    const [minLng, minLat, maxLng, maxLat] = extent;
    const perimeterKm = Math.round(
      2 *
        ((maxLat - minLat) * kmPerDegree() +
          (maxLng - minLng) * kmPerDegreeLng((minLat + maxLat) / 2)) *
        1.3
    );
    return { neighbors: [], perimeterKm, coastlineKm: storedCoastlineKm ?? perimeterKm };
  }
}

async function loadSuperlatives(db: PrismaClient, countryId: string) {
  const where = { countryId, status: "approved" } as const;
  const [peak, river, lake] = await Promise.all([
    db.peak.findFirst({ where, orderBy: { elevation: "desc" } }),
    db.namedRiver.findFirst({ where, orderBy: { lengthKm: "desc" } }),
    db.namedLake.findFirst({ where, orderBy: { areaSqKm: "desc" } }),
  ]);

  let tallestPeak = null;
  if (peak) {
    tallestPeak = {
      name: peak.name,
      elevation: peak.elevation,
      prominence: peak.prominence,
      type: "peak" as const,
    };
  } else {
    // Fallback: highest city elevation
    const highestCity = await db.city.findFirst({
      where,
      orderBy: { elevation: "desc" },
      select: { name: true, elevation: true },
    });
    if (highestCity && highestCity.elevation !== null) {
      tallestPeak = {
        name: highestCity.name,
        elevation: highestCity.elevation,
        prominence: null,
        type: "city" as const,
      };
    }
  }

  return {
    tallestPeak,
    longestRiver: river ? { name: river.name, lengthKm: river.lengthKm } : null,
    largestLake: lake
      ? { name: lake.name, areaSqKm: lake.areaSqKm, maxDepthM: lake.maxDepthM }
      : null,
  };
}

export const geoProfileProcedures = {
  getCountryGeoProfile: cachedStaticProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          geometry: true,
          centroid: true,
          boundingBox: true,
          coastlineKm: true,
          landArea: true,
          areaSqMi: true,
          realmId: true,
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      const centroid = country.centroid as [number, number] | null;
      const bbox = country.boundingBox as [number, number, number, number] | null;

      if (!country.geometry || !centroid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Country has no map geometry. Link it to a map feature first.",
        });
      }

      const extent: Extent = bbox ?? [-180, -90, 180, 90];
      const realmId = country.realmId;
      const realm = await ctx.db.realm.findUnique({
        where: { id: realmId },
        select: { settings: true },
      });
      // Distances measured on Earth's radius (PostGIS geography) scale to the realm's planet
      const radiusKm = realmRadiusKm(realm?.settings);
      const onPlanet = (km: number) => scaleDistanceToRadius(km, radiusKm);
      // Everything below is independent: climate and altitude layers of the country's own realm (its zones named
      // by its climate key), hydrography, neighbours and perimeter, and the superlatives
      const [climateFills, altitudeFills, hydro, measured, superlatives] = await Promise.all([
        countryZoneFills(ctx.db, country, "climate", extent),
        countryZoneFills(ctx.db, country, "altitudes", extent),
        loadHydrography(ctx.db, input.countryId, realmId, extent),
        loadNeighbours(ctx.db, input.countryId, extent, country.coastlineKm),
        loadSuperlatives(ctx.db, input.countryId),
      ]);
      const climateKey = parseRealmMapSettings(realm?.settings).climateKey ?? null;

      const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);
      const climateDistribution = buildClimateZones(climateFills, true, climateKey).sort(
        (a, b) => b.areaSqKm - a.areaSqKm
      );
      const elevationProfile = buildElevationZones(altitudeFills).sort(
        (a, b) => a.minElev - b.minElev
      );
      const neighbors = measured.neighbors.map((n) => ({
        ...n,
        sharedBorderKm: Math.round(onPlanet(n.sharedBorderKm)),
      }));
      const perimeterKm = onPlanet(measured.perimeterKm);
      const coastlineKm = Math.round(onPlanet(measured.coastlineKm));

      const profile = buildGeoProfile({
        climateDistribution,
        elevationProfile,
        coastlineKm,
        neighborCount: neighbors.length,
        totalRiverLengthKm: hydro.totalRiverLengthKm,
        totalLakeAreaSqKm: hydro.totalLakeAreaSqKm,
        areaKm2,
      });

      const temp = estimateTemperature(
        centroid[1] ?? 0,
        profile.meanElevation,
        climateDistribution
      );
      const centroidLat = centroid[1] ?? 0;
      const nsSpanKm = bbox ? Math.abs(bbox[3] - bbox[1]) * kmPerDegree(radiusKm) : 0;
      const ewSpanKm = bbox
        ? Math.abs(bbox[2] - bbox[0]) * kmPerDegreeLng(centroidLat, radiusKm)
        : 0;

      return {
        countryId: country.id,
        countryName: country.name,
        area: {
          areaKm2: Math.round(areaKm2),
          perimeterKm: Math.round(perimeterKm),
          nsSpanKm: Math.round(nsSpanKm),
          ewSpanKm: Math.round(ewSpanKm),
          centroid,
        },
        climate: {
          zones: climateDistribution,
          dominant: profile.dominantClimate,
          diversityIndex: profile.climateDiversity,
          estMeanTempC: temp.meanTempC,
          estAnnualPrecipMm: estimatePrecipitation(climateDistribution, profile.meanElevation),
          estSummerHighC: temp.summerHighC,
          estWinterLowC: temp.winterLowC,
        },
        elevation: {
          zones: elevationProfile,
          dominant: profile.dominantElevation,
          meanElev: profile.meanElevation,
          terrainRoughness: profile.terrainRoughness,
        },
        hydro: {
          riverCount: hydro.riverCount,
          totalRiverLengthKm: Math.round(hydro.totalRiverLengthKm),
          lakeCount: hydro.lakeCount,
          totalLakeAreaSqKm: Math.round(hydro.totalLakeAreaSqKm),
          drainageDensity: profile.drainageDensity,
        },
        derived: {
          arableLandPercent: profile.arableLandPercent,
          isLandlocked: profile.isLandlocked,
          isIsland: profile.isIsland,
          coastlineKm: profile.coastlineKm,
          neighborCount: profile.neighborCount,
        },
        neighbors,
        superlatives,
        economic: computeEconomicGeoModifiers(profile),
        npcModifiers: computeNPCGeoModifiers(profile),
        crisisRisk: computeCrisisRiskFactors(profile),
      };
    }),
};
