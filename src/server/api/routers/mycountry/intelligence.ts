/**
 * MyCountry API Router - Dedicated endpoints for MyCountry system
 *
 * This router provides specialized endpoints for the MyCountry interface including:
 * - Intelligence feed aggregation from multiple sources
 * - Achievement system with real-time calculations
 * - Executive dashboard data compilation
 * - National vitality metrics computation
 * - Historical timeline and milestone tracking
 * - Real-time notification generation
 */

import { z } from "zod";
import { createTRPCRouter, countryOwnerProcedure } from "~/server/api/trpc";
import { generateIntelligenceFeed } from "~/server/shared/mycountry-helpers";

export const myCountryIntelligenceRouter = createTRPCRouter({
  /**
   * Get intelligence feed for executive dashboard - Requires country ownership
   */
  getIntelligenceFeed: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      // Additional security: Verify the requested country matches user's country
      if (input.countryId !== ctx.user.countryId) {
        throw new Error("FORBIDDEN: Can only access intelligence for owned country");
      }

      return generateIntelligenceFeed(input.countryId);
    }),
});
