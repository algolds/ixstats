// src/server/api/routers/cache.ts
/**
 * Cache Management Router
 * Provides admin endpoints for managing the external API cache
 */

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { externalApiCache } from "~/lib/cache";

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
});
