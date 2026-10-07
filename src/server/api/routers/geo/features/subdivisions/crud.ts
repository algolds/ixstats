import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { getTerrainForArea } from "~/lib/country-geo";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { clipAndValidatePolygon, checkNameUniqueness } from "~/lib/maps/geo-validation";
import { syncGeographicDemographics } from "~/lib/country-geo/sync";
import { assertFound, assertOwnCountry } from "../../core/shared";
import { assertOwnerMayEdit } from "~/server/shared/map-feature-lock";

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

      // Get terrain breakdown for the subdivision from its country's realm (informational)
      let terrainInfo: Awaited<ReturnType<typeof getTerrainForArea>> | null = null;
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { realmId: true },
        });
        terrainInfo = await getTerrainForArea(
          ctx.db as any,
          alignedGeometry as unknown as import("geojson").Geometry,
          country?.realmId ?? DEFAULT_REALM_ID
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

      const existing = assertFound(
        await ctx.db.subdivision.findFirst({
          where: { id: input.subdivisionId, countryId: input.countryId },
        }),
        "Subdivision not found"
      );
      assertOwnerMayEdit(ctx, existing, "subdivision");
      // A topology cascade may only reshape this country's own subdivisions: the ids come
      // from the client, so check them (a foreign id would edit another nation's map).
      const cascaded = [...new Set(input.cascadedNeighbors?.map((n) => n.subdivisionId) ?? [])];
      if (cascaded.length > 0) {
        const own = await ctx.db.subdivision.count({
          where: { id: { in: cascaded }, countryId: input.countryId },
        });
        if (own !== cascaded.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cascaded neighbours must be subdivisions of this country",
          });
        }
      }
      // ...and may not reshape a neighbour the owner cannot edit either
      if (ctx.country && cascaded.length > 0) {
        const locked = await ctx.db.subdivision.findFirst({
          where: { id: { in: cascaded }, editableByOwner: false },
          select: { editableByOwner: true },
        });
        assertOwnerMayEdit(ctx, locked, "neighbouring subdivision");
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
            ctx.db.subdivision.updateMany({
              where: { id: neighbor.subdivisionId, countryId: input.countryId },
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

      const existing = assertFound(
        await ctx.db.subdivision.findFirst({
          where: { id: input.subdivisionId, countryId: input.countryId },
        }),
        "Subdivision not found"
      );
      assertOwnerMayEdit(ctx, existing, "subdivision");

      await ctx.db.subdivision.delete({ where: { id: input.subdivisionId } });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);

      await syncGeographicDemographics(ctx.db, input.countryId);

      return { id: input.subdivisionId, deleted: true };
    }),
});
