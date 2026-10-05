import { z } from "zod";
import { adminProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { TRPCError } from "@trpc/server";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import type { PrismaClient } from "@prisma/client";
import { buildGeoProfile, computeEconomicGeoModifiers } from "~/lib/maps/geo-analytics";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import { buildClimateZones, buildElevationZones, LAYER_SELECT, type Extent } from "./profile-zones";
import { requirePoliticalLayer } from "./shared";

/** Computes and stores one country's geo profile; throws "no geometry" when it has none. */
async function recalculateGeoProfile(db: PrismaClient, countryId: string) {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      coastlineKm: true,
      landArea: true,
      areaSqMi: true,
      geometry: true,
      boundingBox: true,
      realmId: true,
    },
  });
  if (!country?.geometry) throw new Error("no geometry");

  const coastlineKm = country.coastlineKm ?? 0;
  const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);
  const extent: Extent = (country.boundingBox as [number, number, number, number] | null) ?? [
    -180, -90, 180, 90,
  ];

  // Climate/altitude layers of the country's own realm
  const layersOfType = (layerType: "climate" | "altitudes") =>
    db.mapLayer.findMany({
      where: { layerType, isActive: true, realmId: country.realmId },
      select: LAYER_SELECT,
    });
  const [climateLayers, altitudeLayers] = await Promise.all([
    layersOfType("climate"),
    layersOfType("altitudes"),
  ]);
  const climateDistribution = buildClimateZones(climateLayers, extent, false);
  const elevationProfile = buildElevationZones(altitudeLayers, extent);

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

  const fields = {
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
  };
  await db.countryGeoProfile.upsert({
    where: { countryId },
    create: {
      countryId,
      riverKm: 0,
      lakeAreaSqKm: 0,
      neighborCount: profile.neighborCount,
      ...fields,
    },
    update: fields,
  });
}

export const adminOpsProcedures = {
  recalculateArea: adminProcedure
    .input(z.object({ featureId: z.string(), ...realmScopeInput.shape }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await requirePoliticalLayer(
        ctx.db,
        input.featureId,
        await viewerRealmId(ctx, input.realm)
      );

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
   * Admin: recompute stored geo profiles (one country, or every country with geometry), and with
   * them the country's map-derived `GeographicResource` rows (AT-9).
   */
  recalculateGeoProfiles: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: input?.countryId ? { id: input.countryId } : { geometry: { not: null } as any },
        select: { id: true, name: true },
      });

      let processed = 0;
      let resourcesWritten = 0;
      const errors: string[] = [];
      const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
      for (const country of countries) {
        try {
          await recalculateGeoProfile(ctx.db, country.id);
          processed++;
        } catch (err) {
          errors.push(`${country.name}: ${message(err)}`);
          continue;
        }
        try {
          resourcesWritten += await refreshGeographicResources(ctx.db, country.id);
        } catch (err) {
          errors.push(`${country.name} (resources): ${message(err)}`);
        }
      }

      return {
        processed,
        resourcesWritten,
        failed: errors.length,
        total: countries.length,
        errors: errors.slice(0, 20),
      };
    }),
};
