/**
 * Wiki Cache tRPC Router
 *
 * Provides efficient cached access to MediaWiki API data through tRPC endpoints.
 * Uses WikiCacheService for 3-layer caching (Redis → Database → API).
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";

export const wikiCacheRouter = createTRPCRouter({
  /**
   * Get full country profile (batched)
   * This is the main endpoint that replaces multiple API calls in WikiIntelligenceTab
   */
  getCountryProfile: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { countryName, wikiSource } = input;
      const profile = await wikiCacheService.getCountryProfile(
        countryName,
        wikiSource as "ixwiki" | "iiwiki" | "althistory"
      );

      return profile;
    }),

  /**
   * Refresh country cache (authenticated users only)
   */
  refreshCountryCache: rateLimitedMutationProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      wikiCacheService.clearCountryCache(input.countryName);

      return {
        success: true,
        message: `Cache refreshed for ${input.countryName}`,
        timestamp: new Date().toISOString(),
      };
    }),
});
