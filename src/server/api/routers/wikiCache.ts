/**
 * Wiki Cache tRPC Router
 *
 * Provides efficient cached access to MediaWiki API data through tRPC endpoints.
 * Uses WikiCacheService for 3-layer caching (Redis → Database → API).
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  wikiCacheService,
  cleanWikitextForDisplay,
} from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { extractDataFromWikiSections } from "~/lib/builder/wiki-data-extractor";
import { getCategoryMembers, getBatchWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";
import { type WikiSource } from "~/lib/wiki-os/config";

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
   * Deep scan for builder pre-population
   * Fetches multiple related pages and extracts structured builder data
   * Powered by IntelligentLoreCache & single-flight batch requests.
   */
  builderDeepScan: publicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
        officialName: z.string().optional(),
        categoryTags: z.array(z.string()).default([]),
        pageVariants: z.array(z.string()).default([]),
        /** Accepted for older clients and ignored: the main article is fetched from the wiki. */
        mainWikitext: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { countryName, wikiSource, officialName, categoryTags, pageVariants } = input;

      // 1. Check Multi-Tier Intelligent Cache (Memory + DB: <2ms hit)
      const cached = await intelligentLoreCache.getDeepScan(wikiSource as WikiSource, countryName);
      if (cached) {
        return {
          pagesScanned: cached.pagesScanned,
          foundVariants: cached.foundVariants,
          categoryUsed: cached.categoryUsed,
          extractedData: cached.extractedData,
          pages: cached.pages,
          fromCache: true,
        };
      }

      let pagesToScan: string[];
      let matchedCategory = "";

      if (pageVariants.length > 0) {
        pagesToScan = pageVariants;
      } else {
        // Collect candidate category names: strictly country-specific hubs
        const GENERIC_CATEGORY_PATTERN =
          /^(countries|nations|sovereign states|member states|micronations|articles with|pages with|all articles|cs1|good articles|featured articles|stubs|redirects|capitals|cities)$/i;

        const nameLower = countryName.toLowerCase();
        const officialLower = officialName?.toLowerCase();

        const relevantCategoryTags = categoryTags
          .map((c) => c.replace(/^Category:/i, "").trim())
          .filter((c) => {
            const cLower = c.toLowerCase();
            if (GENERIC_CATEGORY_PATTERN.test(c)) return false;
            return (
              cLower.includes(nameLower) || (officialLower ? cLower.includes(officialLower) : false)
            );
          });

        const candidateCategories = Array.from(
          new Set([
            countryName,
            ...(officialName && officialLower !== nameLower ? [officialName] : []),
            ...relevantCategoryTags,
          ])
        ).slice(0, 3);

        let rawMembers: Array<{ title: string }> = [];

        // 2. Parallel Category Probing with Single-Flight Coalesce
        const probePromises = candidateCategories.map((cat) =>
          intelligentLoreCache.coalesce(`probe:${wikiSource}:${cat.toLowerCase()}`, async () => {
            const cachedMembers = await intelligentLoreCache.getCategoryMembers(
              wikiSource as WikiSource,
              cat
            );
            if (cachedMembers) return { cat, members: cachedMembers };

            const membersResult = await getCategoryMembers(
              cat,
              50,
              "page",
              wikiSource as WikiSource
            );
            const members = Array.isArray(membersResult)
              ? membersResult
              : membersResult &&
                  typeof membersResult === "object" &&
                  "members" in membersResult &&
                  Array.isArray(membersResult.members)
                ? (membersResult.members as Array<{ title: string }>)
                : [];

            await intelligentLoreCache.setCategoryMembers(wikiSource as WikiSource, cat, members);
            return { cat, members };
          })
        );

        const probeResults = await Promise.allSettled(probePromises);
        for (const res of probeResults) {
          if (res.status === "fulfilled" && res.value.members.length > 0) {
            matchedCategory = res.value.cat;
            rawMembers = res.value.members;
            break;
          }
        }

        const categoryPages = rawMembers
          .map((m) => m.title)
          .filter(
            (t) =>
              Boolean(t) &&
              !t.startsWith("Category:") &&
              t.toLowerCase() !== countryName.toLowerCase()
          );

        // Score category pages by high-value builder domain relevance
        const TOPIC_PRIORITIES = [
          "economy",
          "economic",
          "government",
          "politics",
          "demographics",
          "military",
          "armed forces",
          "foreign relations",
          "constitution",
          "parliament",
          "senate",
          "ministry",
          "cabinet",
          "industry",
          "geography",
        ];

        const scoredCategoryPages = categoryPages.sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          const aScore = TOPIC_PRIORITIES.some((k) => aLower.includes(k)) ? 1 : 0;
          const bScore = TOPIC_PRIORITIES.some((k) => bLower.includes(k)) ? 1 : 0;
          return bScore - aScore;
        });

        // Always scan main country page, top category members, and synthetic fallbacks if needed
        pagesToScan = [
          countryName,
          ...scoredCategoryPages.slice(0, 8),
          ...(scoredCategoryPages.length < 3
            ? [
                `Economy of ${countryName}`,
                `Politics of ${countryName}`,
                `Government of ${countryName}`,
                `Demographics of ${countryName}`,
                `Military of ${countryName}`,
                `Foreign relations of ${countryName}`,
              ]
            : []),
        ];
      }

      // Deduplicate while preserving order and limit to top 8 distinct pages
      const seen = new Set<string>();
      const uniquePages = pagesToScan
        .filter((p) => {
          const key = p.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8);

      // Every page, the main article included, is read from the wiki: the result is cached for
      // everyone, so caller-supplied text (mainWikitext) must not end up in it.
      const pages: { title: string; content: string }[] = [];
      const subpagesToFetch = uniquePages;

      // 3. Single Native MediaWiki Batch Query (1 HTTP request instead of N)
      if (subpagesToFetch.length > 0) {
        const batchMap = await getBatchWikitext(subpagesToFetch, wikiSource as WikiSource);

        for (const title of subpagesToFetch) {
          const article = batchMap.get(title.toLowerCase()) || batchMap.get(title);
          if (article?.wikitext) {
            pages.push({
              title: article.title,
              content: cleanWikitextForDisplay(article.wikitext),
            });
          }
        }
      }

      // Run heuristics on the cleaned wikitext
      const extractedData = extractDataFromWikiSections(pages);

      const result = {
        pagesScanned: pages.length,
        foundVariants: pages.map((p) => p.title),
        categoryUsed: matchedCategory || null,
        extractedData,
        pages,
      };

      // 4. Persist in Multi-Tier Lore Cache (Memory + DB)
      await intelligentLoreCache.setDeepScan(wikiSource as WikiSource, countryName, result);

      return result;
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
