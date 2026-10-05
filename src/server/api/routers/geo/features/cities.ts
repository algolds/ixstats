import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import {
  validatePointContainment,
  checkPointCollision,
  checkNameUniqueness,
} from "~/lib/maps/geo-validation";

import { syncGeographicDemographics } from "~/lib/country-geo/sync";
import { assertFound, assertOwnCountry, coordinatesSchema } from "../core/shared";
import { assertOwnerMayEdit } from "~/server/shared/map-feature-lock";

export const geoFeaturesCitiesRouter = createTRPCRouter({
  /**
   * Create a city within the user's country.
   * Auto-approved if the point is inside the country's borders.
   */
  createCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        cityType: z.string().default("city"),
        coordinates: coordinatesSchema,
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().default(false),
        isSubdivisionCapital: z.boolean().default(false),
        subdivisionId: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      assertOwnCountry(ctx, input.countryId);

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "City"
      );
      await checkPointCollision(
        ctx.db as any,
        "city",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city");

      // If marking as capital, clear any existing capital for this country
      if (input.isNationalCapital) {
        await ctx.db.city.updateMany({
          where: { countryId: input.countryId, isNationalCapital: true },
          data: { isNationalCapital: false },
        });
      }

      const city = await ctx.db.city.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          type: input.cityType,
          coordinates: input.coordinates,
          population: input.population,
          isNationalCapital: input.isNationalCapital,
          isSubdivisionCapital: input.isSubdivisionCapital,
          subdivisionId: input.subdivisionId,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });

      // Invalidate map caches so the public map updates
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      if (input.isNationalCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      if (city.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, city.subdivisionId);
      }

      return { id: city.id, name: city.name, status: "approved" as const };
    }),

  /**
   * Update a city within the user's country.
   */
  updateCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
        name: z.string().min(1).max(100).optional(),
        cityType: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().optional(),
        isSubdivisionCapital: z.boolean().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);

      // Verify city belongs to country
      const existing = assertFound(
        await ctx.db.city.findFirst({
          where: { id: input.cityId, countryId: input.countryId },
        }),
        "City not found"
      );
      assertOwnerMayEdit(ctx, existing, "city");

      // If coordinates changed, validate containment + collision
      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "City"
        );
        await checkPointCollision(
          ctx.db as any,
          "city",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.cityId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "city", input.cityId);
      }

      const updated = await ctx.db.city.update({
        where: { id: input.cityId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.cityType && { type: input.cityType }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.population !== undefined && { population: input.population }),
          ...(input.isNationalCapital !== undefined && {
            isNationalCapital: input.isNationalCapital,
          }),
          ...(input.isSubdivisionCapital !== undefined && {
            isSubdivisionCapital: input.isSubdivisionCapital,
          }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
        },
      });

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("city", input.countryId);

      if (updated.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, updated.subdivisionId);
      }

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a city from the user's country.
   */
  deleteCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);

      const city = assertFound(
        await ctx.db.city.findFirst({
          where: { id: input.cityId, countryId: input.countryId },
        }),
        "City not found"
      );
      assertOwnerMayEdit(ctx, city, "city");

      const wasCapital = city.isNationalCapital;
      await ctx.db.city.delete({ where: { id: input.cityId } });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      if (wasCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      if (city.subdivisionId) {
        await syncGeographicDemographics(ctx.db, input.countryId, city.subdivisionId);
      }

      return { id: input.cityId, deleted: true };
    }),
});
