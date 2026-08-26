import { z } from "zod";
import { protectedProcedure, cachedStaticProcedure } from "~/server/api/trpc";

export const geographyProcedures = {
  // Get custom geography (continents and regions)
  // Using cachedStaticProcedure - geography data rarely changes (1hr TTL)
  getCustomGeography: cachedStaticProcedure.query(async ({ ctx: _ctx }) => {
    // For now, return empty custom geography
    // In the future, this could fetch from a CustomGeography table
    return {
      continents: [] as string[],
      regions: {} as Record<string, string[]>,
    };
  }),

  // Add custom continent
  addContinent: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx: _ctx, input }) => {
      // For now, just return success
      // In the future, this could store in a CustomGeography table
      return { success: true, name: input.name };
    }),

  // Add custom region to a continent
  addRegion: protectedProcedure
    .input(
      z.object({
        continent: z.string(),
        region: z.string(),
      })
    )
    .mutation(async ({ ctx: _ctx, input }) => {
      // For now, just return success
      // In the future, this could store in a CustomGeography table
      return { success: true, continent: input.continent, region: input.region };
    }),
};
