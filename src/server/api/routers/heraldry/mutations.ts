import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { compositionSchema } from "~/lib/heraldry/composition-schema";
import { validateComposition } from "~/lib/heraldry/validation";
import { generateBlazon } from "~/lib/heraldry/blazon";
import { isSystemOwner } from "~/lib/auth";
import { invalidateCache } from "~/lib/trpc-cache";
import { clearLayerCache } from "~/server/shared/layer-cache";

export const heraldryMutationsRouter = createTRPCRouter({
  saveAchievement: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        subjectType: z.enum(["COUNTRY", "CHARACTER", "INSTITUTION", "DYNASTY"]),
        subjectId: z.string().nullable(),
        compositionData: compositionSchema,
        svgData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const generatedBlazon = generateBlazon(input.compositionData);
      const warnings = validateComposition(input.compositionData);

      let achievement;

      if (input.id) {
        const existing = await ctx.db.heraldryAchievement.findUnique({
          where: { id: input.id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Achievement with ID ${input.id} not found`,
          });
        }

        if (existing.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to update this achievement.",
          });
        }

        achievement = await ctx.db.heraldryAchievement.update({
          where: { id: input.id },
          data: {
            title: input.title,
            compositionData: input.compositionData as any,
            generatedBlazon,
            svgData: input.svgData,
            validationWarnings: warnings as any,
          },
        });
      } else {
        achievement = await ctx.db.heraldryAchievement.create({
          data: {
            ownerId: ctx.auth.userId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            title: input.title,
            compositionData: input.compositionData as any,
            generatedBlazon,
            svgData: input.svgData,
            validationWarnings: warnings as any,
          },
        });
      }

      // Create revision snapshot
      await ctx.db.heraldryRevision.create({
        data: {
          achievementId: achievement.id,
          compositionData: input.compositionData as any,
          generatedBlazon,
        },
      });

      return achievement;
    }),

  publishAchievement: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Achievement with ID ${input.id} not found`,
        });
      }

      if (existing.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to publish this achievement.",
        });
      }

      return ctx.db.heraldryAchievement.update({
        where: { id: input.id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });
    }),

  unpublishAchievement: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Achievement with ID ${input.id} not found`,
        });
      }

      if (existing.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to unpublish this achievement.",
        });
      }

      return ctx.db.heraldryAchievement.update({
        where: { id: input.id },
        data: {
          isPublished: false,
          publishedAt: null,
        },
      });
    }),

  deleteAchievement: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Achievement with ID ${input.id} not found`,
        });
      }

      if (existing.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete this achievement.",
        });
      }

      return ctx.db.heraldryAchievement.delete({
        where: { id: input.id },
      });
    }),

  importCommonsCharge: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: z.enum([
          "ANIMALS",
          "BIRDS",
          "MYTHICAL_CREATURES",
          "FISH",
          "INSECTS",
          "PLANTS",
          "TREES",
          "FLOWERS",
          "CELESTIAL",
          "WEAPONS",
          "BUILDINGS",
          "CROWNS",
          "RELIGIOUS",
          "MARITIME",
          "AGRICULTURAL",
          "GEOMETRIC",
          "HUMAN_FIGURES",
          "OBJECTS",
          "LETTERS",
          "NUMBERS",
          "IXNAY_SPECIFIC",
          "MISCELLANEOUS",
        ]),
        subcategory: z.string().optional(),
        keywords: z.array(z.string()).default([]),
        url: z.string().url(),
        sourceUrl: z.string().url().optional(),
        author: z.string().optional(),
        license: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const res = await fetch(input.url);
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to download SVG from ${input.url}: ${res.statusText}`,
        });
      }
      const svgData = await res.text();

      return ctx.db.heraldryCharge.create({
        data: {
          name: input.name,
          category: input.category,
          subcategory: input.subcategory,
          keywords: input.keywords,
          svgData,
          source: "COMMONS",
          sourceUrl: input.sourceUrl || input.url,
          author: input.author,
          license: input.license,
        },
      });
    }),

  attachToCountry: protectedProcedure
    .input(
      z.object({
        achievementId: z.string().uuid(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const achievement = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.achievementId },
      });

      if (!achievement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Achievement with ID ${input.achievementId} not found`,
        });
      }

      if (achievement.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this achievement.",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (
        !isSystemOwner(ctx.auth.userId) &&
        (!userProfile || userProfile.countryId !== input.countryId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this country.",
        });
      }

      const coatOfArmsUrl = achievement.thumbnailUrl || achievement.largeUrl || "";

      await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          coatOfArms: coatOfArmsUrl,
          updatedAt: new Date(),
        },
      });

      await invalidateCache(["countries."]);
      clearLayerCache("political");

      return { success: true };
    }),
});
