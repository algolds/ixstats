import { z } from "zod";
import { adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line unused-imports/no-unused-imports
import type { Geometry } from "geojson";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo-service";
import {
  buildGeoProfile,
  computeEconomicGeoModifiers,
  getAgricultureFactor,
  resolveClimateFromColor,
  ELEVATION_ZONES,
  type ClimateZoneEntry,
  type ElevationZoneEntry,
} from "~/lib/geo-analytics";
import { estimateBboxOverlap } from "./geometry";

export const adminOpsProcedures = {
  recalculateArea: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ area_sqkm: number }>>(
          `SELECT ST_Area(geom_postgis::geography) / 1000000.0 as area_sqkm
           FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
          mapLayer.id
        );

        if (result.length > 0 && result[0].area_sqkm) {
          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { areaSqKm: result[0].area_sqkm },
          });
          if (mapLayer.countryId) {
            await syncCountryGeometryFromMapLayer(ctx.db, mapLayer.countryId);
          }
          return {
            featureId: input.featureId,
            areaSqKm: result[0].area_sqkm,
          };
        }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "PostGIS area calculation failed",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No geometry available for area calculation",
      });
    }),

  /**
   * Admin: Bulk recalculate areas for all political features.
   */
  recalculateAllAreas: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ctx.db.$executeRawUnsafe(`
        UPDATE map_layers
        SET "areaSqKm" = ST_Area(geom_postgis::geography) / 1000000.0
        WHERE "layerType" = 'political'
          AND geom_postgis IS NOT NULL
      `);
      return { updated: result };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "PostGIS bulk area recalculation failed",
      });
    }
  }),

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  /**
   * Validate that a point is inside the user's country borders (PostGIS).
   * Returns true/false.
   */
  recalculateGeoProfiles: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get countries to process
      const countries = await ctx.db.country.findMany({
        where: input?.countryId ? { id: input.countryId } : { geometry: { not: null } as any },
        select: { id: true, name: true },
      });

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const country of countries) {
        try {
          // Call the profile computation endpoint internally (reuse logic)
          // We directly compute here to avoid circular calls
          const profileResult = await ctx.db.country.findUnique({
            where: { id: country.id },
            select: {
              coastlineKm: true,
              landArea: true,
              areaSqMi: true,
              geometry: true,
              centroid: true,
              boundingBox: true,
            },
          });

          if (!profileResult?.geometry) {
            errors.push(`${country.name}: no geometry`);
            failed++;
            continue;
          }

          const coastlineKm = profileResult.coastlineKm ?? 0;
          const areaKm2 =
            profileResult.landArea ??
            (profileResult.areaSqMi ? profileResult.areaSqMi / 0.386102 : 0);
          const bbox = profileResult.boundingBox as [number, number, number, number] | null;

          // Get climate/altitude layers for this country's bbox
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
              select: { featureId: true, geometry: true, properties: true, areaSqKm: true },
            }),
          ]);

          const countryMinLng = bbox?.[0] ?? -180;
          const countryMinLat = bbox?.[1] ?? -90;
          const countryMaxLng = bbox?.[2] ?? 180;
          const countryMaxLat = bbox?.[3] ?? 90;

          // Build climate distribution
          const climateDistribution: ClimateZoneEntry[] = [];
          for (const cl of climateLayers) {
            const props = cl.properties as Record<string, unknown> | null;
            if (!props) continue;
            const clGeo = cl.geometry as import("geojson").Geometry | null;
            if (!clGeo || !cl.areaSqKm || cl.areaSqKm <= 0) continue;

            const clFill = (props["fill"] as string) ?? "";
            const climateName = resolveClimateFromColor(clFill);
            if (!climateName) continue;

            const overlapFraction = estimateBboxOverlap(
              clGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            climateDistribution.push({
              type: climateName,
              percentArea: 0,
              areaSqKm: cl.areaSqKm * overlapFraction,
              agricultureFactor: getAgricultureFactor(climateName),
            });
          }
          const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of climateDistribution) {
            z.percentArea =
              totalClimateArea > 0
                ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10
                : 0;
          }

          // Build elevation profile
          const elevationProfile: ElevationZoneEntry[] = [];
          for (const al of altitudeLayers) {
            const props = al.properties as Record<string, unknown> | null;
            if (!props) continue;
            const alGeo = al.geometry as import("geojson").Geometry | null;
            if (!alGeo || !al.areaSqKm || al.areaSqKm <= 0) continue;

            const overlapFraction = estimateBboxOverlap(
              alGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            const fill = (props["fill"] as string) ?? "";
            const zoneMatch = ELEVATION_ZONES.find(
              (ez) => ez.color.toLowerCase() === fill.toLowerCase()
            );
            if (!zoneMatch) continue;

            const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
            if (existing) {
              existing.areaSqKm += al.areaSqKm * overlapFraction;
            } else {
              elevationProfile.push({
                zone: zoneMatch.zoneId,
                name: zoneMatch.zoneName,
                percentArea: 0,
                areaSqKm: al.areaSqKm * overlapFraction,
                minElev: zoneMatch.elevationMin,
                maxElev: zoneMatch.elevationMax,
              });
            }
          }
          const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of elevationProfile) {
            z.percentArea =
              totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
          }

          const profile = buildGeoProfile({
            climateDistribution,
            elevationProfile,
            coastlineKm,
            neighborCount: 0,
            totalRiverLengthKm: 0,
            totalLakeAreaSqKm: 0,
            areaKm2,
          });
          const econ = computeEconomicGeoModifiers(profile);

          // Upsert the profile
          await ctx.db.countryGeoProfile.upsert({
            where: { countryId: country.id },
            create: {
              countryId: country.id,
              climateDistribution: climateDistribution as any,
              elevationProfile: elevationProfile as any,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              riverKm: 0,
              lakeAreaSqKm: 0,
              neighborCount: profile.neighborCount,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
            update: {
              climateDistribution: climateDistribution as any,
              elevationProfile: elevationProfile as any,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
          });

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${country.name}: ${msg}`);
          failed++;
        }
      }

      return { processed, failed, total: countries.length, errors: errors.slice(0, 20) };
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────

  /**
   * 4.5 — Choropleth: Return per-country metric values with geometries
   * for data-driven fill coloring on the map.
   */
};
