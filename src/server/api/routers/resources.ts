/**
 * Resources Router — Geographic resource management.
 *
 * Manages procedurally generated resources (fisheries, forests, minerals,
 * oil/gas, freshwater, agricultural) derived from country geography.
 * Resources are placed based on climate zones, elevation, and hydrology.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
  countryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { generateResourcesForCountry } from "~/lib/resource-generator";
import { buildGeoProfile } from "~/lib/geo-analytics";
import type { ClimateZoneEntry, ElevationZoneEntry } from "~/lib/geo-analytics";

export const resourcesRouter = createTRPCRouter({
  /** Get all resources for a country */
  getCountryResources: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.geographicResource.findMany({
        where: { countryId: input.countryId },
        orderBy: { resourceType: "asc" },
      });
    }),

  /** Get all resources as GeoJSON FeatureCollection for map display */
  getResourceMap: publicProcedure.query(async ({ ctx }) => {
    const resources = await ctx.db.geographicResource.findMany({
      where: { isDiscovered: true },
      include: { country: { select: { name: true, slug: true } } },
    });

    return {
      type: "FeatureCollection" as const,
      features: resources
        .filter((r) => Array.isArray(r.coordinates) && (r.coordinates as number[]).length >= 2)
        .map((r) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: r.coordinates as [number, number],
          },
          properties: {
            id: r.id,
            name: r.name,
            resourceType: r.resourceType,
            quantity: r.quantity,
            quality: r.quality,
            exploitedPercent: r.exploitedPercent,
            countryId: r.countryId,
            countryName: r.country.name,
            countrySlug: r.country.slug,
            climateZone: r.climateZone,
            elevationZone: r.elevationZone,
          },
        })),
    };
  }),

  /** Aggregate resource stats for a country */
  getResourceStats: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const resources = await ctx.db.geographicResource.findMany({
        where: { countryId: input.countryId },
      });

      const byType: Record<
        string,
        { count: number; avgQuantity: number; avgQuality: number; avgExploited: number }
      > = {};

      for (const r of resources) {
        if (!byType[r.resourceType]) {
          byType[r.resourceType] = { count: 0, avgQuantity: 0, avgQuality: 0, avgExploited: 0 };
        }
        const entry = byType[r.resourceType]!;
        entry.count++;
        entry.avgQuantity += r.quantity;
        entry.avgQuality += r.quality;
        entry.avgExploited += r.exploitedPercent;
      }

      // Compute averages
      for (const entry of Object.values(byType)) {
        if (entry.count > 0) {
          entry.avgQuantity = Math.round((entry.avgQuantity / entry.count) * 100) / 100;
          entry.avgQuality = Math.round((entry.avgQuality / entry.count) * 100) / 100;
          entry.avgExploited = Math.round((entry.avgExploited / entry.count) * 100) / 100;
        }
      }

      return {
        total: resources.length,
        discovered: resources.filter((r) => r.isDiscovered).length,
        byType,
      };
    }),

  /** Admin: Generate resources for a country (or all countries) */
  generateResources: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: input?.countryId ? { id: input.countryId } : { geometry: { not: null } },
        select: {
          id: true,
          name: true,
          centroid: true,
          boundingBox: true,
          coastlineKm: true,
          landArea: true,
          areaSqMi: true,
        },
      });

      let generated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const country of countries) {
        try {
          const centroid = country.centroid as [number, number] | null;
          const bbox = country.boundingBox as [number, number, number, number] | null;
          if (!centroid || !bbox) {
            errors.push(`${country.name}: no geometry`);
            failed++;
            continue;
          }

          // Load geo profile if available
          const geoProfile = await ctx.db.countryGeoProfile.findUnique({
            where: { countryId: country.id },
          });

          // Build profile from stored data or use defaults
          const profile = geoProfile
            ? buildGeoProfile({
                climateDistribution: (geoProfile.climateDistribution as unknown as ClimateZoneEntry[]) ?? [],
                elevationProfile: (geoProfile.elevationProfile as unknown as ElevationZoneEntry[]) ?? [],
                coastlineKm: geoProfile.coastlineKm,
                neighborCount: geoProfile.neighborCount,
                totalRiverLengthKm: geoProfile.riverKm,
                totalLakeAreaSqKm: geoProfile.lakeAreaSqKm,
                areaKm2:
                  country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 1000),
              })
            : buildGeoProfile({
                climateDistribution: [],
                elevationProfile: [],
                coastlineKm: country.coastlineKm ?? 0,
                neighborCount: 0,
                totalRiverLengthKm: 0,
                totalLakeAreaSqKm: 0,
                areaKm2: country.landArea ?? 1000,
              });

          const resources = generateResourcesForCountry(
            profile,
            centroid,
            bbox,
            hashCountryId(country.id)
          );

          // Delete existing resources and insert new ones
          await ctx.db.geographicResource.deleteMany({
            where: { countryId: country.id },
          });

          if (resources.length > 0) {
            await ctx.db.geographicResource.createMany({
              data: resources.map((r) => ({
                countryId: country.id,
                resourceType: r.resourceType,
                name: r.name,
                coordinates: r.coordinates,
                quantity: r.quantity,
                quality: r.quality,
                climateZone: r.climateZone,
                elevationZone: r.elevationZone,
              })),
            });
          }

          generated += resources.length;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${country.name}: ${msg}`);
          failed++;
        }
      }

      return {
        countriesProcessed: countries.length - failed,
        countriesFailed: failed,
        resourcesGenerated: generated,
        errors: errors.slice(0, 20),
      };
    }),

  /** Update resource exploitation level (country owner) */
  updateExploitation: countryOwnerProcedure
    .input(
      z.object({
        id: z.string(),
        exploitedPercent: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await ctx.db.geographicResource.findUnique({
        where: { id: input.id },
      });

      if (!resource) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      return ctx.db.geographicResource.update({
        where: { id: input.id },
        data: { exploitedPercent: input.exploitedPercent },
      });
    }),

  /** Mark a resource as discovered (country owner) */
  discoverResource: countryOwnerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.geographicResource.update({
        where: { id: input.id },
        data: { isDiscovered: true },
      });
    }),
});

/** Hash a country ID string to a seed number */
function hashCountryId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return hash;
}
