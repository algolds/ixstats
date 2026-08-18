import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line unused-imports/no-unused-imports
import type { Geometry } from "geojson";
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

export const geoProfileProcedures = {
  getCountryGeoProfile: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Get country geometry and basic info
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
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      const countryGeo = country.geometry as import("geojson").Geometry | null;
      const centroid = country.centroid as [number, number] | null;
      const bbox = country.boundingBox as [number, number, number, number] | null;

      if (!countryGeo || !centroid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Country has no map geometry. Link it to a map feature first.",
        });
      }

      // 2. Get intersecting map layers for climate and altitude analysis
      const [climateLayers, altitudeLayers] = await Promise.all([
        ctx.db.mapLayer.findMany({
          where: { layerType: "climate", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "altitudes", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
      ]);

      // 3. Compute area (use stored value or estimate from geometry)
      const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);

      // 4. Build climate distribution
      // Strategy: match climate features by checking if they overlap the country's bbox
      // (client-side approximation; PostGIS ST_Intersection would be more precise)
      const climateDistribution: ClimateZoneEntry[] = [];
      const countryMinLng = bbox?.[0] ?? -180;
      const countryMinLat = bbox?.[1] ?? -90;
      const countryMaxLng = bbox?.[2] ?? 180;
      const countryMaxLat = bbox?.[3] ?? 90;

      for (const cl of climateLayers) {
        const props = cl.properties as Record<string, unknown> | null;
        if (!props) continue;

        // Check rough bbox overlap
        const clGeo = cl.geometry as import("geojson").Geometry | null;
        if (!clGeo) continue;

        // Resolve climate type from fill color (SVG paths have no text names)
        const fill = (props["fill"] as string) ?? "";
        const climateName = resolveClimateFromColor(fill);
        if (!climateName) continue;

        // Simple bbox overlap test using the climate feature's centroid or first coord
        const clArea = cl.areaSqKm ?? 0;
        if (clArea <= 0) continue;

        // For now, use a proportional estimation based on the feature's total area
        // and the country's relative size. This will be replaced with PostGIS
        // ST_Intersection once the endpoint is validated.
        // We estimate overlap fraction from bbox coverage
        const overlapFraction = estimateBboxOverlap(
          clGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = clArea * overlapFraction;
        const agFactor = getAgricultureFactor(climateName);

        // Aggregate same climate types (multiple SVG polygons per zone)
        const existing = climateDistribution.find((e) => e.type === climateName);
        if (existing) {
          existing.areaSqKm += overlapArea;
        } else {
          climateDistribution.push({
            type: climateName,
            percentArea: 0, // computed below
            areaSqKm: overlapArea,
            agricultureFactor: agFactor,
          });
        }
      }

      // Normalize climate percentages
      const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of climateDistribution) {
        z.percentArea =
          totalClimateArea > 0 ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10 : 0;
      }
      // Sort by area descending
      climateDistribution.sort((a, b) => b.areaSqKm - a.areaSqKm);

      // 5. Build elevation profile
      const elevationProfile: ElevationZoneEntry[] = [];
      for (const al of altitudeLayers) {
        const props = al.properties as Record<string, unknown> | null;
        if (!props) continue;

        const alGeo = al.geometry as import("geojson").Geometry | null;
        if (!alGeo) continue;

        const alArea = al.areaSqKm ?? 0;
        if (alArea <= 0) continue;

        const overlapFraction = estimateBboxOverlap(
          alGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = alArea * overlapFraction;

        // Match to elevation zone by color or name
        const fill = (props["fill"] as string) ?? "";
        const zoneMatch = ELEVATION_ZONES.find(
          (ez) => ez.color.toLowerCase() === fill.toLowerCase()
        );

        if (zoneMatch) {
          // Aggregate into existing zone or create new entry
          const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
          if (existing) {
            existing.areaSqKm += overlapArea;
          } else {
            elevationProfile.push({
              zone: zoneMatch.zoneId,
              name: zoneMatch.zoneName,
              percentArea: 0, // computed below
              areaSqKm: overlapArea,
              minElev: zoneMatch.elevationMin,
              maxElev: zoneMatch.elevationMax,
            });
          }
        }
      }

      // Normalize elevation percentages
      const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of elevationProfile) {
        z.percentArea =
          totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
      }
      elevationProfile.sort((a, b) => a.minElev - b.minElev);

      // 6. Hydrography: clip rivers/lakes to country using PostGIS with bbox fallback
      let riverCount = 0;
      let totalRiverLengthKm = 0;
      let lakeCount = 0;
      let totalLakeAreaSqKm = 0;

      try {
        const riverStats = await ctx.db.$queryRawUnsafe<
          Array<{ count: number; length_km: number }>
        >(
          `
          WITH country AS (
            SELECT id,
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT
            COUNT(ml.id)::int as count,
            COALESCE(SUM(
              ST_Length(
                ST_Intersection(
                  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
                  c.geom
                )::geography
              )
            ), 0) / 1000 as length_km
          FROM country c
          JOIN map_layers ml ON ml."layerType" = 'rivers' AND ml."isActive" = true
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          `,
          input.countryId
        );

        riverCount = Number(riverStats[0]?.count ?? 0);
        totalRiverLengthKm = Number(riverStats[0]?.length_km ?? 0);

        const lakeStats = await ctx.db.$queryRawUnsafe<Array<{ count: number; area_sqkm: number }>>(
          `
          WITH country AS (
            SELECT id,
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT
            COUNT(ml.id)::int as count,
            COALESCE(SUM(
              ST_Area(
                ST_Intersection(
                  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
                  c.geom
                )::geography
              )
            ), 0) / 1e6 as area_sqkm
          FROM country c
          JOIN map_layers ml ON ml."layerType" = 'lakes' AND ml."isActive" = true
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          `,
          input.countryId
        );

        lakeCount = Number(lakeStats[0]?.count ?? 0);
        totalLakeAreaSqKm = Number(lakeStats[0]?.area_sqkm ?? 0);
      } catch (err) {
        console.warn("PostGIS hydro query failed, falling back to bbox estimation:", err);
        const [fallbackRivers, fallbackLakes] = await Promise.all([
          ctx.db.mapLayer.findMany({
            where: { layerType: "rivers", isActive: true },
            select: {
              featureId: true,
              geometry: true,
              properties: true,
              areaSqKm: true,
            },
          }),
          ctx.db.mapLayer.findMany({
            where: { layerType: "lakes", isActive: true },
            select: {
              featureId: true,
              geometry: true,
              areaSqKm: true,
            },
          }),
        ]);

        const filteredRivers = fallbackRivers.filter((r) => {
          const rGeo = r.geometry as import("geojson").Geometry | null;
          if (!rGeo) return false;
          return (
            estimateBboxOverlap(rGeo, countryMinLng, countryMinLat, countryMaxLng, countryMaxLat) >
            0
          );
        });

        const filteredLakes = fallbackLakes.filter((l) => {
          const lGeo = l.geometry as import("geojson").Geometry | null;
          if (!lGeo) return false;
          return (
            estimateBboxOverlap(lGeo, countryMinLng, countryMinLat, countryMaxLng, countryMaxLat) >
            0
          );
        });

        riverCount = filteredRivers.length;
        totalRiverLengthKm = filteredRivers.reduce((s, r) => {
          const p = r.properties as Record<string, unknown> | null;
          return s + ((p?.["lengthKm"] as number) ?? r.areaSqKm ?? 0);
        }, 0);

        lakeCount = filteredLakes.length;
        totalLakeAreaSqKm = filteredLakes.reduce((s, l) => s + (l.areaSqKm ?? 0), 0);
      }

      // 7. Find neighbors + coastline via PostGIS spatial queries
      // Uses ST_Intersects on JSONB geometry cast to PostGIS geometry for pixel-perfect
      // neighbor detection and accurate coastline/shared-border computation.
      interface PostGISNeighborRow {
        id: string;
        name: string;
        slug: string | null;
        shared_border_km: number;
      }

      let neighborCountries: Array<{
        id: string;
        name: string;
        slug: string | null;
        sharedBorderKm: number;
      }> = [];
      let perimeterKm = 0;
      let coastlineKm = 0;

      try {
        // Query 1: Find all neighboring countries and their shared border lengths
        const neighborRows = await ctx.db.$queryRawUnsafe<PostGISNeighborRow[]>(
          `
          WITH country AS (
            SELECT id, name,
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
          JOIN "Country" c2 ON c2.id = ml."countryId"
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          ORDER BY c2.id, shared_border_km DESC
        `,
          input.countryId
        );

        neighborCountries = neighborRows
          .filter((r) => Number(r.shared_border_km) > 0)
          .map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            sharedBorderKm: Math.round(Number(r.shared_border_km)),
          }))
          .sort((a, b) => b.sharedBorderKm - a.sharedBorderKm);

        // Query 2: Get country perimeter for coastline calculation
        const perimResult = await ctx.db.$queryRawUnsafe<Array<{ perimeter_km: number }>>(
          `
          SELECT ST_Perimeter(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))::geography
          ) / 1000 as perimeter_km
          FROM "Country"
          WHERE id = $1
        `,
          input.countryId
        );

        perimeterKm = Math.round(Number(perimResult[0]?.perimeter_km ?? 0));
        const totalSharedBorderKm = neighborCountries.reduce((s, n) => s + n.sharedBorderKm, 0);
        coastlineKm = Math.max(0, perimeterKm - totalSharedBorderKm);
      } catch {
        // PostGIS unavailable or geometry invalid — fall back to bbox estimation
        const latMid = (countryMinLat + countryMaxLat) / 2;
        const degToKm = 111.32;
        const cosLat = Math.cos((latMid * Math.PI) / 180);
        perimeterKm = Math.round(
          2 *
            ((countryMaxLat - countryMinLat) * degToKm +
              (countryMaxLng - countryMinLng) * degToKm * cosLat) *
            1.3
        );
        coastlineKm = country.coastlineKm ?? perimeterKm;
      }

      const neighborCount = neighborCountries.length;
      const profile = buildGeoProfile({
        climateDistribution,
        elevationProfile,
        coastlineKm,
        neighborCount,
        totalRiverLengthKm,
        totalLakeAreaSqKm: totalLakeAreaSqKm,
        areaKm2,
      });

      // 8. Query superlatives
      const [peaks, namedRivers, namedLakes] = await Promise.all([
        ctx.db.peak.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { elevation: "desc" },
          take: 1,
        }),
        ctx.db.namedRiver.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { lengthKm: "desc" },
          take: 1,
        }),
        ctx.db.namedLake.findMany({
          where: { countryId: input.countryId, status: "approved" },
          orderBy: { areaSqKm: "desc" },
          take: 1,
        }),
      ]);

      let tallestPeak = null;
      if (peaks[0]) {
        tallestPeak = {
          name: peaks[0].name,
          elevation: peaks[0].elevation,
          prominence: peaks[0].prominence,
          type: "peak" as const,
        };
      } else {
        // Fallback: highest city elevation
        const highestCity = await ctx.db.city.findFirst({
          where: { countryId: input.countryId, status: "approved" },
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

      const longestRiver = namedRivers[0]
        ? {
            name: namedRivers[0].name,
            lengthKm: namedRivers[0].lengthKm,
          }
        : null;

      const largestLake = namedLakes[0]
        ? {
            name: namedLakes[0].name,
            areaSqKm: namedLakes[0].areaSqKm,
            maxDepthM: namedLakes[0].maxDepthM,
          }
        : null;

      // 9. Compute gameplay modifiers
      const economicModifiers = computeEconomicGeoModifiers(profile);
      const npcModifiers = computeNPCGeoModifiers(profile);
      const crisisRisk = computeCrisisRiskFactors(profile);

      // 10. Temperature and precipitation estimates
      const centroidLat = centroid[1] ?? 0;
      const temp = estimateTemperature(centroidLat, profile.meanElevation, climateDistribution);
      const precipMm = estimatePrecipitation(climateDistribution, profile.meanElevation);

      // 11. Area metrics (perimeterKm already computed by PostGIS above)
      const nsSpanKm = bbox ? Math.abs(bbox[3] - bbox[1]) * 111.32 : 0;
      const ewSpanKm = bbox
        ? Math.abs(bbox[2] - bbox[0]) * 111.32 * Math.cos((centroidLat * Math.PI) / 180)
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
          estAnnualPrecipMm: precipMm,
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
          riverCount,
          totalRiverLengthKm: Math.round(totalRiverLengthKm),
          lakeCount,
          totalLakeAreaSqKm: Math.round(totalLakeAreaSqKm),
          drainageDensity: profile.drainageDensity,
        },
        derived: {
          arableLandPercent: profile.arableLandPercent,
          isLandlocked: profile.isLandlocked,
          isIsland: profile.isIsland,
          coastlineKm: profile.coastlineKm,
          neighborCount: profile.neighborCount,
        },
        neighbors: neighborCountries.map((n) => ({
          id: n.id,
          name: n.name,
          slug: n.slug,
          sharedBorderKm: n.sharedBorderKm,
        })),
        superlatives: {
          tallestPeak,
          longestRiver,
          largestLake,
        },
        economic: economicModifiers,
        npcModifiers,
        crisisRisk,
      };
    }),

  /**
   * Admin endpoint: Recalculate and persist geographic profiles for all countries
   * (or a single country). Stores results in CountryGeoProfile table for use
   * by the economic engine and NPC personality drift.
   */
};
