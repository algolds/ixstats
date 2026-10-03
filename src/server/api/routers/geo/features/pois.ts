import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { ActivityGenerator } from "~/lib/activity";
import {
  validatePointContainment,
  checkPointCollision,
  checkNameUniqueness,
} from "~/lib/maps/geo-validation";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

import { syncResourcePoolModifiers } from "~/server/shared/geo-resource-sync";
import { assertOwnCountry } from "../_owner";

export const geoFeaturesPoisRouter = createTRPCRouter({
  /**
   * Create a point of interest within the user's country.
   * Auto-approved if point is inside borders.
   */
  createPOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        category: z.string().default("landmark"),
        coordinates: coordinatesSchema,
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);

      // Validate containment + collision + name uniqueness
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Point of interest"
      );
      await checkPointCollision(
        ctx.db as any,
        "pointOfInterest",
        input.countryId,
        input.coordinates[0],
        input.coordinates[1]
      );
      await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi");

      const poi = await ctx.db.pointOfInterest.create({
        data: {
          name: input.name,
          countryId: input.countryId,
          category: input.category,
          coordinates: input.coordinates,
          description: input.description,
          icon: input.icon,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
          metadata: (input.metadata ?? {}) as any,
        },
      });

      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { name: true },
        });
        await ActivityGenerator.createActivity({
          type: "meta",
          category: "game",
          countryId: input.countryId,
          title: `New Point of Interest: ${poi.name}`,
          description: `${country?.name ?? "A country"} added a new point of interest: ${poi.name} (${poi.category}).`,
          priority: "low",
          visibility: "public",
          metadata: {
            poiId: poi.id,
            poiName: poi.name,
            category: poi.category,
            wikiPageTitle: poi.wikiPageTitle,
            description: poi.description,
          },
        });
      } catch (e) {
        console.error("[geo.createPOI] Failed to create activity for POI:", e);
      }

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: poi.id, name: poi.name, status: "approved" as const };
    }),

  /**
   * Update a point of interest within the user's country.
   */
  updatePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
        name: z.string().min(1).max(100).optional(),
        category: z.string().optional(),
        coordinates: coordinatesSchema.optional(),
        description: z.string().max(500).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Point of interest"
        );
        await checkPointCollision(
          ctx.db as any,
          "pointOfInterest",
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          input.poiId
        );
      }
      if (input.name) {
        await checkNameUniqueness(ctx.db as any, input.countryId, input.name, "poi", input.poiId);
      }

      const updated = await ctx.db.pointOfInterest.update({
        where: { id: input.poiId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.category && { category: input.category }),
          ...(input.coordinates && { coordinates: input.coordinates }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.wikiPageTitle !== undefined && { wikiPageTitle: input.wikiPageTitle }),
          ...(input.metadata !== undefined && { metadata: input.metadata as any }),
        },
      });

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource" || updated.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: updated.id, name: updated.name };
    }),

  /**
   * Delete a point of interest from the user's country.
   */
  deletePOI: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        poiId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);

      const poi = await ctx.db.pointOfInterest.findFirst({
        where: { id: input.poiId, countryId: input.countryId },
      });
      if (!poi) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Point of interest not found" });
      }

      await ctx.db.pointOfInterest.delete({ where: { id: input.poiId } });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("poi", input.countryId);

      if (poi.category === "resource") {
        await syncResourcePoolModifiers(ctx.db, input.countryId);
      }

      return { id: input.poiId, deleted: true };
    }),
});
