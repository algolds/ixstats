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
import { wikiCacheService, cleanWikitextForDisplay } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { extractDataFromWikiSections } from "~/lib/builder/wiki-data-extractor";
import { getArticleWikitext, getCategoryMembers } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { withRetrySafe } from "~/lib/system/with-retry";
import {
  DEFAULT_MEDIAWIKI_URL,
  getMediaWikiApiUrl,
  DEFAULT_USER_AGENT,
  type WikiSource,
} from "~/lib/wiki-os/config";

function getApiBaseUrl(wikiSource: string): string {
  return getMediaWikiApiUrl(wikiSource as any);
}

async function fetchCategoryMembers(apiBaseUrl: string, categoryName: string): Promise<string[]> {
  if (apiBaseUrl.includes("ixwiki")) {
    try {
      const members = await getCategoryMembers(categoryName, 50, "page");
      return (members?.members ?? []).map((m: any) => m.title).filter(Boolean);
    } catch (_err) {
      return [];
    }
  }

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
          headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
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
      const flagUrl = await wikiCacheService.getFlagUrl(input.countryName);

      return {
        flagUrl,
        metadata: { source: "cache", cachedAt: Date.now() },
        cached: true,
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
      const { countryName, wikiSource } = input;
      const profile = await wikiCacheService.getCountryProfile(
        countryName,
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
      wikiCacheService.clearCountryCache(input.countryName);

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
    const stats = wikiCacheService.getCacheStats();

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
      const result = await wikiCacheService.warmCache();

      return {
        ...result,
        total: input.countryNames.length,
        message: `Cache warming complete: ${result.warmed} warmed`,
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
      wikiCacheService.clearCountryCache(input.countryName);

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
    .mutation(async () => {
      const result = await wikiCacheService.refreshStaleEntries();

      return {
        success: true,
        refreshed: result.refreshed,
        message: `Refreshed ${result.refreshed} stale cache entries`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Clean up expired cache entries (admin only)
   */
  cleanupExpiredEntries: adminProcedure.mutation(async () => {
    const result = await wikiCacheService.cleanupExpiredEntries();

    return {
      success: true,
      cleaned: result.cleaned,
      message: `Cleaned up ${result.cleaned} expired cache entries`,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Warm cache for all active countries (admin only)
   */
  warmAllCountries: adminProcedure.mutation(async ({ ctx }) => {
    const countries = await ctx.db.country.findMany({
      select: {
        name: true,
      },
      take: 100,
    });

    const result = await wikiCacheService.warmCache();

    return {
      ...result,
      total: countries.length,
      message: `Warmed cache for ${result.warmed} of ${countries.length} countries`,
      timestamp: new Date().toISOString(),
    };
  }),
});
