import { z } from "zod";
import type { Geometry } from "geojson";
import type { PrismaClient } from "@prisma/client";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  buildGeoProfile,
  computeEconomicGeoModifiers,
  computeNPCGeoModifiers,
  computeCrisisRiskFactors,
  estimateTemperature,
  estimatePrecipitation,
  getAgricultureFactor,
  resolveClimateFromColor,
  ELEVATION_ZONES,
  type ClimateZoneEntry,
  type ElevationZoneEntry,
} from "~/lib/maps/geo-analytics";
import { estimateBboxOverlap } from "./geometry";

const DEG_TO_KM = 111.32;

/** Longitude/latitude extent of the country; the whole globe when it has no stored bounding box. */
type Extent = [minLng: number, minLat: number, maxLng: number, maxLat: number];

const LAYER_SELECT = {
  featureId: true,
  geometry: true,
  properties: true,
  areaSqKm: true,
  displayName: true,
} as const;

/** Layers that overlap the extent, with each one's fill colour and the area it contributes. */
function overlappingFills(
  layers: Array<{ geometry: unknown; properties: unknown; areaSqKm: number | null }>,
  extent: Extent
) {
  return layers.flatMap((layer) => {
    const props = layer.properties as Record<string, unknown> | null;
    const geometry = layer.geometry as Geometry | null;
    const area = layer.areaSqKm ?? 0;
    if (!props || !geometry || area <= 0) return [];
    // Rough bbox overlap (PostGIS ST_Intersection would be more precise)
    const overlap = estimateBboxOverlap(geometry, ...extent);
    if (overlap <= 0) return [];
    return [{ fill: (props["fill"] as string) ?? "", overlapArea: area * overlap }];
  });
}

function withPercentAreas<T extends { areaSqKm: number; percentArea: number }>(zones: T[]) {
  const total = zones.reduce((sum, zone) => sum + zone.areaSqKm, 0);
  for (const zone of zones) {
    zone.percentArea = total > 0 ? Math.round((zone.areaSqKm / total) * 100 * 10) / 10 : 0;
  }
  return zones;
}

type OverlapLayers = Parameters<typeof overlappingFills>[0];

function buildClimateDistribution(layers: OverlapLayers, extent: Extent) {
  const zones: ClimateZoneEntry[] = [];
  for (const { fill, overlapArea } of overlappingFills(layers, extent)) {
    // Climate type comes from the fill colour (SVG paths have no text names)
    const type = resolveClimateFromColor(fill);
    if (!type) continue;
    // Aggregate same climate types (multiple SVG polygons per zone)
    const existing = zones.find((zone) => zone.type === type);
    if (existing) existing.areaSqKm += overlapArea;
    else {
      zones.push({
        type,
        percentArea: 0,
        areaSqKm: overlapArea,
        agricultureFactor: getAgricultureFactor(type),
      });
    }
  }
  return withPercentAreas(zones).sort((a, b) => b.areaSqKm - a.areaSqKm);
}

function buildElevationProfile(layers: OverlapLayers, extent: Extent) {
  const zones: ElevationZoneEntry[] = [];
  for (const { fill, overlapArea } of overlappingFills(layers, extent)) {
    const match = ELEVATION_ZONES.find((ez) => ez.color.toLowerCase() === fill.toLowerCase());
    if (!match) continue;
    const existing = zones.find((zone) => zone.zone === match.zoneId);
    if (existing) existing.areaSqKm += overlapArea;
    else {
      zones.push({
        zone: match.zoneId,
        name: match.zoneName,
        percentArea: 0,
        areaSqKm: overlapArea,
        minElev: match.elevationMin,
        maxElev: match.elevationMax,
      });
    }
  }
  return withPercentAreas(zones).sort((a, b) => a.minElev - b.minElev);
}

/** Count and summed length/area of the realm's rivers or lakes clipped to the country, via PostGIS. */
async function clippedLayerStats(
  db: PrismaClient,
  countryId: string,
  layerType: "rivers" | "lakes"
) {
  const clipped = `ST_Intersection(
                  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
                  c.geom
                )::geography`;
  const [measure, perUnit] =
    layerType === "rivers" ? [`ST_Length(${clipped})`, "1000"] : [`ST_Area(${clipped})`, "1e6"];
  const rows = await db.$queryRawUnsafe<Array<{ count: number; total: number }>>(
    `
          WITH country AS (
            SELECT id, "realmId",
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT
            COUNT(ml.id)::int as count,
            COALESCE(SUM(${measure}), 0) / ${perUnit} as total
          FROM country c
          JOIN map_layers ml ON ml."layerType" = '${layerType}' AND ml."isActive" = true
            AND ml."worldId" = c."realmId"
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          `,
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
    const rivers = await clippedLayerStats(db, countryId, "rivers");
    const lakes = await clippedLayerStats(db, countryId, "lakes");
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
 * Neighbours and coastline via PostGIS: ST_Intersects on the JSONB geometry cast to PostGIS gives
 * pixel-perfect neighbour detection and accurate shared-border lengths.
 */
async function loadNeighbours(
  db: PrismaClient,
  countryId: string,
  extent: Extent,
  storedCoastlineKm: number | null
) {
  try {
    const neighborRows = await db.$queryRawUnsafe<
      Array<{ id: string; name: string; slug: string | null; shared_border_km: number }>
    >(
      `
          WITH country AS (
            SELECT id, name, "realmId",
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT DISTINCT ON (c2.id)
            c2.id, c2.name, c2.slug,
            ST_Length(
              ST_Intersection(
                ST_Boundary(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326))),
                ST_Boundary(c.geom)
              )::geography
            ) / 1000 as shared_border_km
          FROM country c
          JOIN map_layers ml ON ml."layerType" = 'political'
            AND ml."isActive" = true
            AND ml."countryId" IS NOT NULL
            AND ml."countryId" != c.id
          JOIN "Country" c2 ON c2.id = ml."countryId" AND c2."realmId" = c."realmId"
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          ORDER BY c2.id, shared_border_km DESC
        `,
      countryId
    );
    const neighbors = neighborRows
      .filter((r) => Number(r.shared_border_km) > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        sharedBorderKm: Math.round(Number(r.shared_border_km)),
      }))
      .sort((a, b) => b.sharedBorderKm - a.sharedBorderKm);

    const perimResult = await db.$queryRawUnsafe<Array<{ perimeter_km: number }>>(
      `
          SELECT ST_Perimeter(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))::geography
          ) / 1000 as perimeter_km
          FROM "Country"
          WHERE id = $1
        `,
      countryId
    );
    const perimeterKm = Math.round(Number(perimResult[0]?.perimeter_km ?? 0));
    const sharedBorderKm = neighbors.reduce((sum, n) => sum + n.sharedBorderKm, 0);
    return { neighbors, perimeterKm, coastlineKm: Math.max(0, perimeterKm - sharedBorderKm) };
  } catch {
    // PostGIS unavailable or geometry invalid — fall back to bbox estimation
    const [minLng, minLat, maxLng, maxLat] = extent;
    const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const perimeterKm = Math.round(
      2 * ((maxLat - minLat) * DEG_TO_KM + (maxLng - minLng) * DEG_TO_KM * cosLat) * 1.3
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
  getCountryGeoProfile: cachedPublicProcedure
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
      // Climate and altitude layers of the country's own realm
      const layersOfType = (layerType: "climate" | "altitudes") =>
        ctx.db.mapLayer.findMany({
          where: { layerType, isActive: true, realmId },
          select: LAYER_SELECT,
        });
      const [climateLayers, altitudeLayers] = await Promise.all([
        layersOfType("climate"),
        layersOfType("altitudes"),
      ]);

      const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);
      const climateDistribution = buildClimateDistribution(climateLayers, extent);
      const elevationProfile = buildElevationProfile(altitudeLayers, extent);
      const hydro = await loadHydrography(ctx.db, input.countryId, realmId, extent);
      const { neighbors, perimeterKm, coastlineKm } = await loadNeighbours(
        ctx.db,
        input.countryId,
        extent,
        country.coastlineKm
      );

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
      const nsSpanKm = bbox ? Math.abs(bbox[3] - bbox[1]) * DEG_TO_KM : 0;
      const ewSpanKm = bbox
        ? Math.abs(bbox[2] - bbox[0]) * DEG_TO_KM * Math.cos((centroidLat * Math.PI) / 180)
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
        superlatives: await loadSuperlatives(ctx.db, input.countryId),
        economic: computeEconomicGeoModifiers(profile),
        npcModifiers: computeNPCGeoModifiers(profile),
        crisisRisk: computeCrisisRiskFactors(profile),
      };
    }),
};
