import { z } from "zod";
import { protectedProcedure } from "~/server/api/trpc";

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
};
