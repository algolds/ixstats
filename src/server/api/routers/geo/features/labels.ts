import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { TRPCError } from "@trpc/server";
import { GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { validatePointContainment } from "~/lib/maps/geo-validation";
import { assertOwnCountry, coordinatesSchema } from "../core/shared";

export const geoFeaturesLabelsRouter = createTRPCRouter({
  createMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        text: z.string().min(1).max(100),
        labelType: z.enum([
          "mountain_range",
          "strait",
          "bay",
          "peninsula",
          "plateau",
          "valley",
          "desert",
          "sea",
          "region",
          "historical",
        ]),
        coordinates: coordinatesSchema,
        fontSize: z.number().min(8).max(48).default(14),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#374151"),
        rotation: z.number().min(-180).max(180).default(0),
        letterSpacing: z.number().min(0).max(1).default(0),
        fontWeight: z.enum(["normal", "bold"]).default("normal"),
        opacity: z.number().min(0.1).max(1).default(1),
        minZoom: z.number().min(0).max(18).default(4),
        maxZoom: z.number().min(0).max(22).default(18),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      await validatePointContainment(
        ctx.db as any,
        input.countryId,
        input.coordinates[0],
        input.coordinates[1],
        "Map label"
      );

      const label = await ctx.db.mapLabel.create({
        data: {
          text: input.text,
          countryId: input.countryId,
          labelType: input.labelType,
          coordinates: input.coordinates,
          fontSize: input.fontSize,
          color: input.color,
          rotation: input.rotation,
          letterSpacing: input.letterSpacing,
          fontWeight: input.fontWeight,
          opacity: input.opacity,
          minZoom: input.minZoom,
          maxZoom: input.maxZoom,
          wikiPageTitle: input.wikiPageTitle,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
      });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: label.id, text: label.text, status: "approved" as const };
    }),

  updateMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        labelId: z.string(),
        text: z.string().min(1).max(100).optional(),
        labelType: z
          .enum([
            "mountain_range",
            "strait",
            "bay",
            "peninsula",
            "plateau",
            "valley",
            "desert",
            "sea",
            "region",
            "historical",
          ])
          .optional(),
        coordinates: coordinatesSchema.optional(),
        fontSize: z.number().min(8).max(48).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        rotation: z.number().min(-180).max(180).optional(),
        letterSpacing: z.number().min(0).max(1).optional(),
        fontWeight: z.enum(["normal", "bold"]).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        minZoom: z.number().min(0).max(18).optional(),
        maxZoom: z.number().min(0).max(22).optional(),
        wikiPageTitle: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });

      if (input.coordinates) {
        await validatePointContainment(
          ctx.db as any,
          input.countryId,
          input.coordinates[0],
          input.coordinates[1],
          "Map label"
        );
      }

      const { countryId: _, labelId: __, ...updateData } = input;
      const updated = await ctx.db.mapLabel.update({
        where: { id: input.labelId },
        data: Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined)),
      });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: updated.id, text: updated.text };
    }),

  deleteMapLabel: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), labelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const label = await ctx.db.mapLabel.findFirst({
        where: { id: input.labelId, countryId: input.countryId },
      });
      if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Map label not found" });
      await ctx.db.mapLabel.delete({ where: { id: input.labelId } });
      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
      broadcastMapUpdate("mapLabel", input.countryId);
      return { id: input.labelId, deleted: true };
    }),

  getAllMapLabels: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const labels = await ctx.db.mapLabel.findMany({
        where: { status: "approved", country: { realmId: await viewerRealmId(ctx, input?.realm) } },
        take: 2000,
        include: { country: { select: { name: true, slug: true } } },
      });

      return {
        type: "FeatureCollection" as const,
        features: labels
          .filter((l) => Array.isArray(l.coordinates) && (l.coordinates as number[]).length >= 2)
          .map((l) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: l.coordinates as [number, number] },
            properties: {
              id: l.id,
              text: l.text,
              labelType: l.labelType,
              fontSize: l.fontSize,
              color: l.color,
              rotation: l.rotation,
              letterSpacing: l.letterSpacing,
              fontWeight: l.fontWeight,
              opacity: l.opacity,
              minZoom: l.minZoom,
              maxZoom: l.maxZoom,
              wikiPageTitle: l.wikiPageTitle,
              countryId: l.countryId,
              countryName: l.country.name,
            },
          })),
      };
    }),
});
