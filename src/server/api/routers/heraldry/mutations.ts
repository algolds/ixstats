import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { compositionSchema } from "~/lib/heraldry/composition-schema";
import { validateComposition } from "~/lib/heraldry/validation";
import { generateBlazon } from "~/lib/heraldry/blazon";
import { isSystemOwner } from "~/lib/auth";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

/** The achievement, or NOT_FOUND / FORBIDDEN unless the caller owns it (or is a system owner). */
async function loadOwnedAchievement(
  ctx: { db: PrismaClient; auth: { userId: string } },
  id: string,
  forbiddenMessage: string
) {
  const achievement = await ctx.db.heraldryAchievement.findUnique({ where: { id } });
  if (!achievement) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Achievement with ID ${id} not found` });
  }
  if (achievement.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  }
  return achievement;
}

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
        await loadOwnedAchievement(
          ctx,
          input.id,
          "You do not have permission to update this achievement."
        );

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
      await loadOwnedAchievement(
        ctx,
        input.id,
        "You do not have permission to publish this achievement."
      );

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
      await loadOwnedAchievement(
        ctx,
        input.id,
        "You do not have permission to unpublish this achievement."
      );

      return ctx.db.heraldryAchievement.update({
        where: { id: input.id },
        data: {
          isPublished: false,
          publishedAt: null,
        },
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
      const achievement = await loadOwnedAchievement(
        ctx,
        input.achievementId,
        "You do not own this achievement."
      );

      await assertCountryWriteAccess(ctx, input.countryId);

      // Nothing renders a design to an image yet; writing "" would blank the country's coat of arms.
      const coatOfArmsUrl = achievement.thumbnailUrl || achievement.largeUrl;
      if (!coatOfArmsUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This design has no rendered image yet, so it can't be used as a coat of arms. The country's current coat of arms is unchanged.",
        });
      }

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
