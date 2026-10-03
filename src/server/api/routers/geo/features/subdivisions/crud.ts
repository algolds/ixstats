import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { getTerrainForArea } from "~/lib/country-geo";
import { clipAndValidatePolygon, checkNameUniqueness } from "~/lib/maps/geo-validation";
import { syncGeographicDemographics } from "~/lib/country-geo/sync";
import { assertOwnCountry } from "../../_owner";

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
      assertOwnCountry(ctx, input.countryId);

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
      assertOwnCountry(ctx, input.countryId);

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
      assertOwnCountry(ctx, input.countryId);

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
});
