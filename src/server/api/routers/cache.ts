// src/server/api/routers/cache.ts
/**
 * Cache Management Router
 * Provides admin endpoints for managing the external API cache
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { externalApiCache } from "~/lib/external-api-cache";
import { mediaWikiCache } from "~/lib/mediawiki-cache-service";
import { imageCache } from "~/lib/image-cache-service";

export const cacheRouter = createTRPCRouter({
  /**
   * Get overall cache statistics
   */
  getStats: adminProcedure.query(async () => {
    const [overall, mediawiki, unsplash, wikimedia, flagcdn, restcountries] = await Promise.all([
      externalApiCache.getStats(),
      externalApiCache.getStats("mediawiki"),
      externalApiCache.getStats("unsplash"),
      externalApiCache.getStats("wikimedia"),
      externalApiCache.getStats("flagcdn"),
      externalApiCache.getStats("restcountries"),
    ]);

    return {
      overall,
      byService: {
        mediawiki,
        unsplash,
        wikimedia,
        flagcdn,
        restcountries,
      },
    };
  }),

  /**
   * Clear cache for a specific service
   */
  clearService: adminProcedure
    .input(
      z.object({
        service: z.enum([
          "mediawiki",
          "unsplash",
          "wikimedia",
          "flagcdn",
          "restcountries",
          "custom",
        ]),
      })
    )
    .mutation(async ({ input }) => {
      const count = await externalApiCache.clearService(input.service);
      return {
        success: true,
        clearedCount: count,
        service: input.service,
      };
    }),

  /**
   * Clear cache for a specific country
   */
  clearCountry: adminProcedure
    .input(
      z.object({
        countryName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const count = await externalApiCache.clearCountry(input.countryName);
      return {
        success: true,
        clearedCount: count,
        countryName: input.countryName,
      };
    }),

  /**
   * Clear expired cache entries
   */
  cleanupExpired: adminProcedure.mutation(async () => {
    const count = await externalApiCache.cleanupExpired();
    return {
      success: true,
      clearedCount: count,
    };
  }),

  /**
   * Clear all MediaWiki cache
   */
  clearMediaWiki: adminProcedure.mutation(async () => {
    const count = await mediaWikiCache.clearAll();
    return {
      success: true,
      clearedCount: count,
    };
  }),

  /**
   * Clear all image cache
   */
  clearImages: adminProcedure.mutation(async () => {
    const count = await imageCache.clearAllImages();
    return {
      success: true,
      clearedCount: count,
    };
  }),

  /**
   * Get cache health metrics (publicly available for monitoring)
   */
  getHealth: publicProcedure.query(async () => {
    try {
      const stats = await externalApiCache.getStats();

      if (!stats) {
        return {
          status: "error",
          message: "Failed to retrieve cache statistics",
        };
      }

      const stalePercentage =
        stats.total > 0 ? ((stats.stale / stats.total) * 100).toFixed(2) : "0.00";

      return {
        status: "healthy",
        metrics: {
          totalEntries: stats.total,
          validEntries: stats.valid,
          staleEntries: stats.stale,
          stalePercentage,
          averageHitCount: stats.averageHitCount.toFixed(2),
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),

  /**
   * Force revalidation of a specific cache entry
   */
  forceRevalidate: adminProcedure
    .input(
      z.object({
        service: z.string(),
        type: z.string(),
        identifier: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await externalApiCache.delete({
        service: input.service as any,
        type: input.type as any,
        identifier: input.identifier,
      });

      return {
        success: true,
        message: "Cache entry deleted. Next request will fetch fresh data.",
      };
    }),

  /**
   * Get top cached items by hit count
   */
  getTopHits: adminProcedure
    .input(
      z.object({
        service: z
          .enum(["mediawiki", "unsplash", "wikimedia", "flagcdn", "restcountries"])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const stats = await externalApiCache.getStats(input.service);
      return {
        topHits: stats?.topHits ?? [],
      };
    }),
});
