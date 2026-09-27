import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * National Identity Router
 *
 * Read access to a country's national identity record (owner only).
 */

export const nationalIdentityRouter = createTRPCRouter({
  /**
   * Get national identity data for a country
   */
  getByCountryId: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new Error("You do not have permission to view this country.");
      }

      try {
        const result = await ctx.db.nationalIdentity.findUnique({
          where: { countryId: input.countryId },
        });

        return result;
      } catch (error) {
        console.error("[NationalIdentity API] Get failed:", error);
        throw new Error(
          `Failed to get national identity: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
      }
    }),
});
