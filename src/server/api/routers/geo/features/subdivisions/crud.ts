import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { getTerrainForArea } from "~/lib/country-geo";
import { clipAndValidatePolygon, checkNameUniqueness } from "~/lib/maps/geo-validation";
import { syncGeographicDemographics } from "~/lib/country-geo/sync";

export const geoFeaturesSubdivisionsCrudRouter = createTRPCRouter({
  /**
   * Create a subdivision within the user's country.
   * Auto-approved if polygon is inside country borders.
   */
  createSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Validate containment + clip polygon to country borders
      const clippedGeometry = await clipAndValidatePolygon(
        ctx.db as any,
        input.countryId,
        input.geometry,
        "Subdivision"
      );
      const { alignSubdivisionBorders } = await import("~/lib/country-geo");
      const alignedGeometry = await alignSubdivisionBorders(
        ctx.db as any,
        input.countryId,
        null,
        clippedGeometry
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "subdivision");

      const subdivision = await ctx.db.subdivision.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.type,
          level: input.level,
          geometry: alignedGeometry,
          capital: input.capital,
          population: input.population,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Get terrain breakdown for the subdivision (informational)
      let terrainInfo: Awaited<ReturnType<typeof getTerrainForArea>> | null = null;
      try {
        terrainInfo = await getTerrainForArea(
          ctx.db as any,
          alignedGeometry as unknown as import("geojson").Geometry
        );
      } catch {
        // Terrain query failed — non-blocking
      }

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return {
        id: subdivision.id,
        name: subdivision.name,
        status: "approved" as const,
        terrain: terrainInfo,
      };
    }),

  /**
   * Update a subdivision within the user's country.
   */
  updateSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
        name: z.string().min(1).max(100).optional(),
        type: z.string().optional(),
        level: z.number().int().min(1).max(5).optional(),
        geometry: z.record(z.string(), z.unknown()).optional(),
        capital: z.string().optional(),
        population: z.number().int().min(0).optional(),
        /** Topology-cascaded neighbor geometries to write transactionally */
        cascadedNeighbors: z
          .array(
            z.object({
              subdivisionId: z.string(),
              geometry: z.record(z.string(), z.unknown()),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      // Validate new geometry if provided
      let clippedGeometry = undefined;
      if (input.geometry) {
        clippedGeometry = await clipAndValidatePolygon(
          ctx.db as any,
          input.countryId,
          input.geometry,
          "Subdivision"
        );
        const { alignSubdivisionBorders } = await import("~/lib/country-geo");
        clippedGeometry = await alignSubdivisionBorders(
          ctx.db as any,
          input.countryId,
          input.subdivisionId,
          clippedGeometry
        );
      }
      if (input.name) {
        await checkNameUniqueness(
          ctx.db as any,
          input.countryId,
          input.name,
          "subdivision",
          input.subdivisionId
        );
      }

      const updated = await ctx.db.subdivision.update({
        where: { id: input.subdivisionId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.type && { type: input.type }),
          ...(input.level !== undefined && { level: input.level }),
          ...(clippedGeometry && { geometry: clippedGeometry }),
          ...(input.capital !== undefined && { capital: input.capital }),
          ...(input.population !== undefined && { population: input.population }),
        },
      });

      // Save cascaded neighbor geometries in a transaction
      if (input.cascadedNeighbors && input.cascadedNeighbors.length > 0) {
        await ctx.db.$transaction(
          input.cascadedNeighbors.map((neighbor) =>
            ctx.db.subdivision.update({
              where: { id: neighbor.subdivisionId },
              data: { geometry: neighbor.geometry as any },
            })
          )
        );
      }

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a subdivision from the user's country.
   */
  deleteSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        subdivisionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const sub = await ctx.db.subdivision.findFirst({
        where: { id: input.subdivisionId, countryId: input.countryId },
      });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
      }

      await ctx.db.subdivision.delete({ where: { id: input.subdivisionId } });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return { id: input.subdivisionId, deleted: true };
    }),

  /**
   * Get per-subdivision stats for the Province Painter map mode.
   * Returns population, area, feature counts, development score, etc.
   */
  getSubdivisionStats: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId, status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          population: true,
          areaSqKm: true,
          geometry: true,
          color: true,
        },
      });

      if (subdivisions.length === 0) return [];

      // Fetch related features for the country
      const [cities, pois, resources, routes] = await Promise.all([
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, population: true, wikiPageTitle: true },
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, coordinates: true, wikiPageTitle: true },
        }),
        ctx.db.geographicResource.findMany({
          where: { countryId: input.countryId },
          select: { id: true, coordinates: true, resourceType: true },
        }),
        ctx.db.transportRoute.findMany({
          where: { countryId: input.countryId },
          select: { id: true, geometry: true },
        }),
      ]);

      // Simple bbox containment check (no PostGIS needed)
      function pointInBbox(pt: unknown, bbox: [number, number, number, number]): boolean {
        if (!Array.isArray(pt) || pt.length < 2) return false;
        const [lng, lat] = pt as [number, number];
        return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
      }

      function geoBbox(geo: any): [number, number, number, number] | null {
        if (!geo || !geo.coordinates) return null;
        const coords = geo.type === "Polygon" ? geo.coordinates[0] : geo.coordinates?.[0]?.[0];
        if (!Array.isArray(coords) || coords.length === 0) return null;
        let minLng = Infinity,
          maxLng = -Infinity,
          minLat = Infinity,
          maxLat = -Infinity;
        for (const c of coords) {
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        }
        return [minLng, minLat, maxLng, maxLat];
      }

      return subdivisions.map((sub) => {
        const bbox = geoBbox(sub.geometry);

        // Count features within this subdivision's bbox
        let cityCount = 0,
          poiCount = 0,
          resourceCount = 0,
          wikiLinked = 0;
        const resourceTypes = new Set<string>();

        if (bbox) {
          for (const c of cities) {
            if (pointInBbox(c.coordinates, bbox)) {
              cityCount++;
              if (c.wikiPageTitle) wikiLinked++;
            }
          }
          for (const p of pois) {
            if (pointInBbox(p.coordinates, bbox)) {
              poiCount++;
              if (p.wikiPageTitle) wikiLinked++;
            }
          }
          for (const r of resources) {
            if (pointInBbox(r.coordinates, bbox)) {
              resourceCount++;
              if (r.resourceType) resourceTypes.add(r.resourceType);
            }
          }
        }

        const totalFeatures = cityCount + poiCount;
        const routeCount = routes.length; // simplified: all routes count for all regions

        // Development score (0-10): weighted combination of metrics
        const popScore = Math.min((sub.population ?? 0) / 1_000_000, 3); // up to 3 pts for 1M+ pop
        const cityScore = Math.min(cityCount * 1.5, 3); // up to 3 pts for 2+ cities
        const resourceScore = Math.min(resourceCount * 0.5, 2); // up to 2 pts for 4+ resources
        const infraScore = Math.min(routeCount * 0.3, 1); // up to 1 pt for routes
        const wikiScore = totalFeatures > 0 ? wikiLinked / totalFeatures : 0; // up to 1 pt
        const developmentScore = Math.min(
          10,
          Math.round((popScore + cityScore + resourceScore + infraScore + wikiScore) * 10) / 10
        );

        return {
          id: sub.id,
          name: sub.name,
          type: sub.type,
          population: sub.population,
          areaSqKm: sub.areaSqKm,
          color: sub.color,
          cityCount,
          poiCount,
          resourceCount,
          resourceTypes: Array.from(resourceTypes),
          wikiLinked,
          totalFeatures,
          developmentScore,
        };
      });
    }),

  /**
   * Delete all subdivisions for a country. Admin forge operation.
   */
  deleteAllSubdivisions: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete regions for your own country",
        });
      }
      const result = await ctx.db.subdivision.deleteMany({
        where: { countryId: input.countryId },
      });
      return { deleted: result.count };
    }),
});
