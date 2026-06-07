import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import {
  getCountryGeoBundle,
  upsertCity,
  upsertSubdivision,
  setCapital,
  upsertPoi,
  upsertStoryPin,
  upsertMapLabel,
  updateGeoRollupMode,
  rebaseNationalFromGeography,
} from "~/lib/country-geo-service";

export const countryGeoRouter = createTRPCRouter({
  /**
   * Get the unified geographic data bundle for a country.
   * Cached public query to reduce database load.
   */
  getCountryGeoBundle: cachedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getCountryGeoBundle(ctx.db, input.countryId);
    }),

  /**
   * Create or update a City.
   */
  upsertCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        type: z.string().default("city"),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().optional(),
        isSubdivisionCapital: z.boolean().optional(),
        subdivisionId: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
        gdpContribution: z.number().min(0).optional(),
        economyOutput: z.number().min(0).optional(),
        specialization: z.string().max(100).optional(),
        infrastructureLevel: z.number().int().min(0).max(10).optional(),
        mayorName: z.string().max(100).optional(),
        isPort: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const city = await upsertCity(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      // Invalidate caches
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      if (input.isNationalCapital || city.isNationalCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      return city;
    }),

  /**
   * Create or update a Subdivision (attributes only).
   */
  upsertSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()).optional(),
        governorName: z.string().max(100).optional(),
        budgetShare: z.number().min(0).max(100).optional(),
        governmentType: z.string().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        population: z.number().min(0).optional(),
        gdpContribution: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const subdivision = await upsertSubdivision(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("subdivision", input.countryId);

      return subdivision;
    }),

  /**
   * Set the national capital of the country.
   */
  setCapital: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      await setCapital(ctx.db, input.countryId, input.cityId);

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      await invalidateCache(["geoCore.getCapitalCities"]);
      broadcastMapUpdate("city", input.countryId);

      return { success: true };
    }),

  /**
   * Create or update a Point of Interest (POI).
   */
  upsertPoi: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        category: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        description: z.string().max(1000).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await upsertPoi(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoCore.getAllMapFeatures"]);
      broadcastMapUpdate("poi", input.countryId);

      return poi;
    }),

  /**
   * Create or update a Story Pin.
   */
  upsertStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(15000),
        category: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        ixTimeYear: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const storyPin = await upsertStoryPin(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoFeatures.getAllStoryPins"]);
      broadcastMapUpdate("storyPin", input.countryId);

      return storyPin;
    }),

  /**
   * Create or update a Map Label.
   */
  upsertMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        text: z.string().min(1).max(100),
        labelType: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        fontSize: z.number().min(8).max(48).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const mapLabel = await upsertMapLabel(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoFeatures.getAllMapLabels"]);
      broadcastMapUpdate("mapLabel", input.countryId);

      return mapLabel;
    }),

  /**
   * Update the geographic rollup mode for a country.
   */
  updateGeoRollupMode: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        mode: z.enum(["hybrid", "top-down", "bottom-up"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const updated = await updateGeoRollupMode(ctx.db, input.countryId, input.mode);

      // Invalidate caches
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      await invalidateCache(["countries.getByIdWithEconomicData"]);
      broadcastMapUpdate("rollup-mode", input.countryId);

      return updated;
    }),

  /**
   * Rebase national totals from geographic sums.
   */
  rebaseNationalFromGeography: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const updated = await rebaseNationalFromGeography(ctx.db, input.countryId);

      // Invalidate caches
      await invalidateCache(["geoCore.getAllMapFeatures"]);
      await invalidateCache(["countries.getByIdWithEconomicData"]);
      broadcastMapUpdate("national-rebase", input.countryId);

      return updated;
    }),
});
