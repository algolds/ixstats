import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { upsertPeak, upsertNamedRiver, upsertNamedLake } from "~/lib/country-geo/named-features";

const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

export const geoFeaturesNamedFeaturesRouter = createTRPCRouter({
  // ─── Peak CRUD ───
  createPeak: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        coordinates: coordinatesSchema,
        elevation: z.number().min(-500).max(9000),
        prominence: z.number().min(0).max(9000).optional(),
        subdivisionId: z.string().nullish(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const peak = await upsertPeak(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("peak", input.countryId);

      return peak;
    }),

  updatePeak: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        peakId: z.string(),
        name: z.string().min(1).max(100).optional(),
        coordinates: coordinatesSchema.optional(),
        elevation: z.number().min(-500).max(9000).optional(),
        prominence: z.number().min(0).max(9000).nullish(),
        subdivisionId: z.string().nullish(),
        wikiPageTitle: z.string().max(200).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.peak.findFirst({
        where: { id: input.peakId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Peak not found" });
      }

      const peak = await upsertPeak(ctx.db, input.countryId, {
        id: input.peakId,
        name: input.name ?? existing.name,
        coordinates: input.coordinates ?? existing.coordinates,
        elevation: input.elevation ?? existing.elevation,
        prominence: input.prominence !== undefined ? input.prominence : existing.prominence,
        subdivisionId:
          input.subdivisionId !== undefined ? input.subdivisionId : existing.subdivisionId,
        wikiPageTitle:
          input.wikiPageTitle !== undefined ? input.wikiPageTitle : existing.wikiPageTitle,
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("peak", input.countryId);

      return peak;
    }),

  deletePeak: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        peakId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.peak.findFirst({
        where: { id: input.peakId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Peak not found" });
      }

      await ctx.db.peak.delete({ where: { id: input.peakId } });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("peak", input.countryId);

      return { id: input.peakId, deleted: true };
    }),

  // ─── NamedRiver CRUD ───
  createNamedRiver: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        geometry: z.record(z.string(), z.unknown()),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const river = await upsertNamedRiver(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("river", input.countryId);

      return river;
    }),

  updateNamedRiver: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        riverId: z.string(),
        name: z.string().min(1).max(100).optional(),
        geometry: z.record(z.string(), z.unknown()).optional(),
        wikiPageTitle: z.string().max(200).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.namedRiver.findFirst({
        where: { id: input.riverId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NamedRiver not found" });
      }

      const river = await upsertNamedRiver(ctx.db, input.countryId, {
        id: input.riverId,
        name: input.name ?? existing.name,
        geometry: input.geometry ?? existing.geometry,
        wikiPageTitle:
          input.wikiPageTitle !== undefined ? input.wikiPageTitle : existing.wikiPageTitle,
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("river", input.countryId);

      return river;
    }),

  deleteNamedRiver: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        riverId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.namedRiver.findFirst({
        where: { id: input.riverId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NamedRiver not found" });
      }

      await ctx.db.namedRiver.delete({ where: { id: input.riverId } });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("river", input.countryId);

      return { id: input.riverId, deleted: true };
    }),

  // ─── NamedLake CRUD ───
  createNamedLake: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        geometry: z.record(z.string(), z.unknown()),
        maxDepthM: z.number().min(0).optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const lake = await upsertNamedLake(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("lake", input.countryId);

      return lake;
    }),

  updateNamedLake: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        lakeId: z.string(),
        name: z.string().min(1).max(100).optional(),
        geometry: z.record(z.string(), z.unknown()).optional(),
        maxDepthM: z.number().min(0).nullish(),
        wikiPageTitle: z.string().max(200).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.namedLake.findFirst({
        where: { id: input.lakeId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NamedLake not found" });
      }

      const lake = await upsertNamedLake(ctx.db, input.countryId, {
        id: input.lakeId,
        name: input.name ?? existing.name,
        geometry: input.geometry ?? existing.geometry,
        maxDepthM: input.maxDepthM !== undefined ? input.maxDepthM : existing.maxDepthM,
        wikiPageTitle:
          input.wikiPageTitle !== undefined ? input.wikiPageTitle : existing.wikiPageTitle,
      });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("lake", input.countryId);

      return lake;
    }),

  deleteNamedLake: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        lakeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const existing = await ctx.db.namedLake.findFirst({
        where: { id: input.lakeId, countryId: input.countryId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NamedLake not found" });
      }

      await ctx.db.namedLake.delete({ where: { id: input.lakeId } });

      await invalidateCache(["geoCore.getAllMapFeatures", "countryGeo.getCountryGeoBundle"]);
      broadcastMapUpdate("lake", input.countryId);

      return { id: input.lakeId, deleted: true };
    }),
});
