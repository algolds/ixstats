import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import { globalCache } from "~/lib/cache";

export const managementStorytellerProcedures = {
  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives

  // General update mutation for country fields (used by editor)

  // Toggle atomic government mode for a country

  // Recalculate atomic effectiveness

  // Create a new country from builder

  // Storyteller effects endpoints

  getStorytellerEffects: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.storytellerEffect.findMany({
        where: input.countryId ? { countryId: input.countryId } : undefined,
        include: {
          country: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { ixTimeTimestamp: "desc" },
      });
    }),

  addStorytellerEffect: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        inputType: z.string(),
        value: z.number(),
        description: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.storytellerEffect.create({
        data: {
          countryId: input.countryId || null,
          inputType: input.inputType,
          value: input.value,
          description: input.description,
          duration: input.duration || null,
          isActive: true,
          ixTimeTimestamp: new Date(),
        },
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),

  updateStorytellerEffect: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        inputType: z.string().optional(),
        value: z.number().optional(),
        description: z.string().optional(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db.storytellerEffect.update({
        where: { id },
        data,
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),

  deleteStorytellerEffect: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.storytellerEffect.delete({
        where: { id: input.id },
      });

      await invalidateCache(["countries."]);
      await globalCache.deleteByPattern("user_profile:*");

      return result;
    }),
};
