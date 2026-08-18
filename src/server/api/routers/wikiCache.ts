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
import { wikiCacheService, cleanWikitextForDisplay } from "~/lib/services/wiki-cache-service";
import { extractDataFromWikiSections } from "~/app/builder/lib/wiki-data-extractor";
import { getArticleWikitext } from "~/lib/wiki/bridge";
import { withRetrySafe } from "~/lib/with-retry";
import type { WikiSource } from "~/lib/wiki/config";

function getApiBaseUrl(wikiSource: string): string {
  if (wikiSource === "iiwiki") return "https://iiwiki.com/api.php";
  if (wikiSource === "althistory") return "https://althistory.fandom.com/api.php";
  return "https://ixwiki.com/api.php";
}

async function fetchCategoryMembers(apiBaseUrl: string, categoryName: string): Promise<string[]> {
  const titles: string[] = [];
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: `Category:${categoryName}`,
      cmlimit: "50",
      cmnamespace: "0",
    });

    const url = `${apiBaseUrl}?${params.toString()}`;
    const result = await withRetrySafe(
      async (signal) => {
        const res = await fetch(url, {
          headers: { "User-Agent": "IxStats-Builder", "Api-User-Agent": "IxStats-Builder" },
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ query?: { categorymembers?: Array<{ title: string }> } }>;
      },
      { maxAttempts: 2, strategy: "linear" as const, baseDelayMs: 2000, timeoutMs: 15000 }
    );

    if (result.success && result.value) {
      const members = result.value.query?.categorymembers ?? [];
      for (const m of members) {
        if (m.title && !m.title.startsWith("Category:")) titles.push(m.title);
      }
    }
  } catch (err) {
    console.warn(`[builderDeepScan] No category found for ${categoryName}:`, err);
  }
  return titles;
}

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
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { countryName, includePageVariants, maxSections, customPages, wikiSource } = input;

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

      const profile = await wikiCacheService.getCountryProfile(
        countryName,
        pageVariants,
        wikiSource as "ixwiki" | "iiwiki" | "althistory"
      );

      return profile;
    }),

  /**
   * Deep scan for builder pre-population
   * Fetches multiple related pages and extracts structured builder data
   */
  builderDeepScan: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
        pageVariants: z.array(z.string()).default([]),
      })
    )
    .query(async ({ input }) => {
      const { countryName, wikiSource, pageVariants } = input;

      // Determine which pages to scan
      let pagesToScan: string[];

      if (pageVariants.length > 0) {
        pagesToScan = pageVariants;
      } else {
        // First, try to find pages in the country's own category (Category:CountryName)
        const apiBaseUrl = getApiBaseUrl(wikiSource);
        const categoryPages = await fetchCategoryMembers(apiBaseUrl, countryName);

        // Filter out the main page (we add it explicitly) and deduplicate
        const categoryRelated = categoryPages.filter(
          (p) => p.toLowerCase() !== countryName.toLowerCase()
        );

        pagesToScan = [
          countryName,
          ...categoryRelated,
          // Only add name-guessed variants if category didn't yield enough
          ...(categoryRelated.length < 2
            ? [
                `Economy of ${countryName}`,
                `Politics of ${countryName}`,
                `Government of ${countryName}`,
                `Demographics of ${countryName}`,
              ]
            : []),
        ];
      }

      // Deduplicate while preserving order
      const seen = new Set<string>();
      const uniquePages = pagesToScan.filter((p) => {
        const key = p.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Use the same wiki-bridge pattern that parses infoboxes successfully
      const pages: { title: string; content: string }[] = [];
      for (const pageName of uniquePages) {
        try {
          const article = await getArticleWikitext(pageName, wikiSource as WikiSource);
          if (article?.wikitext) {
            pages.push({
              title: article.title,
              content: cleanWikitextForDisplay(article.wikitext),
            });
          }
        } catch (err) {
          console.warn(`[builderDeepScan] Failed to fetch ${pageName}:`, err);
        }
      }

      // Run our heuristics on the cleaned wikitext
      const extractedData = extractDataFromWikiSections(pages);

      return {
        pagesScanned: pages.length,
        foundVariants: pages.map((p) => p.title),
        extractedData,
      };
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
