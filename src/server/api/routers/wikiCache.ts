/**
 * Wiki Cache tRPC Router
 *
 * Provides efficient cached access to MediaWiki API data through tRPC endpoints.
 * Uses WikiCacheService for 3-layer caching (Redis → Database → API).
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { wikiCacheService } from "~/lib/services/wiki-cache-service";

export const wikiCacheRouter = createTRPCRouter({
  /**
   * Get country infobox from cache
   */
  getCountryInfobox: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const entry = await wikiCacheService.getCountryInfobox(input.countryName);

      return {
        infobox: entry.data,
        metadata: entry.metadata,
        cached: entry.metadata.source !== "api",
      };
    }),

  /**
   * Get page wikitext from cache
   */
  getPageWikitext: publicProcedure
    .input(
      z.object({
        pageName: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const entry = await wikiCacheService.getPageWikitext(input.pageName);

      return {
        wikitext: entry.data,
        metadata: entry.metadata,
        cached: entry.metadata.source !== "api",
      };
    }),

  /**
   * Get flag URL from cache
   */
  getCountryFlag: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const entry = await wikiCacheService.getFlagUrl(input.countryName);

      return {
        flagUrl: entry.data,
        metadata: entry.metadata,
        cached: entry.metadata.source !== "api",
      };
    }),

  /**
   * Get full country profile (batched)
   * This is the main endpoint that replaces multiple API calls in WikiIntelligenceTab
   */
  getCountryProfile: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
        includePageVariants: z.boolean().default(true),
        maxSections: z.number().min(1).max(20).default(8),
        customPages: z.array(z.string()).default([]),
      })
    )
    .query(async ({ input }) => {
      const { countryName, includePageVariants, maxSections, customPages } = input;

      // Build page variants based on settings
      const pageVariants: string[] = [countryName];

      if (includePageVariants) {
        const topics = [
          `Economy of ${countryName}`,
          `Politics of ${countryName}`,
          `History of ${countryName}`,
          `Geography of ${countryName}`,
          `Demographics of ${countryName}`,
          `Foreign relations of ${countryName}`,
          `Military of ${countryName}`,
          `Education in ${countryName}`,
          `Culture of ${countryName}`,
        ];

        pageVariants.push(...topics.slice(0, maxSections - 1));
      }

      // Add custom pages from settings
      if (customPages.length > 0) {
        pageVariants.push(...customPages);
      }

      const profile = await wikiCacheService.getCountryProfile(countryName, pageVariants);

      return profile;
    }),

  /**
   * Refresh country cache (authenticated users only)
   */
  refreshCountryCache: protectedProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await wikiCacheService.clearCountryCache(input.countryName);

      // Immediately warm the cache
      await wikiCacheService.warmCache([input.countryName]);

      return {
        success: true,
        message: `Cache refreshed for ${input.countryName}`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Get cache statistics (admin only)
   */
  getCacheStats: adminProcedure.query(async () => {
    const stats = await wikiCacheService.getCacheStats();

    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Warm cache for multiple countries (admin only)
   */
  warmCache: adminProcedure
    .input(
      z.object({
        countryNames: z.array(z.string()).min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const result = await wikiCacheService.warmCache(input.countryNames);

      return {
        ...result,
        total: input.countryNames.length,
        message: `Cache warming complete: ${result.success} succeeded, ${result.failed} failed`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Clear cache for specific country (admin only)
   */
  clearCountryCache: adminProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await wikiCacheService.clearCountryCache(input.countryName);

      return {
        success: true,
        message: `Cache cleared for ${input.countryName}`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Refresh stale cache entries (admin only)
   */
  refreshStaleEntries: adminProcedure
    .input(
      z.object({
        thresholdHours: z.number().min(1).max(24).default(2),
      })
    )
    .mutation(async ({ input }) => {
      const refreshed = await wikiCacheService.refreshStaleEntries(input.thresholdHours);

      return {
        success: true,
        refreshed,
        message: `Refreshed ${refreshed} stale cache entries`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Clean up expired cache entries (admin only)
   */
  cleanupExpiredEntries: adminProcedure.mutation(async () => {
    const cleaned = await wikiCacheService.cleanupExpiredEntries();

    return {
      success: true,
      cleaned,
      message: `Cleaned up ${cleaned} expired cache entries`,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Warm cache for all active countries (admin only)
   */
  warmAllCountries: adminProcedure.mutation(async ({ ctx }) => {
    // Get all active countries from database
    const countries = await ctx.db.country.findMany({
      select: {
        name: true,
      },
      take: 100, // Limit to avoid overwhelming the system
    });

    const countryNames = countries.map((c) => c.name);
    const result = await wikiCacheService.warmCache(countryNames);

    return {
      ...result,
      total: countryNames.length,
      message: `Warmed cache for ${result.success} of ${countryNames.length} countries`,
      timestamp: new Date().toISOString(),
    };
  }),
});
