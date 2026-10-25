import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { cachedStaticProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { unlessUnavailable } from "~/lib/wiki-os/upstream-guard";
import { searchWiki as searchWikiService } from "~/lib/wiki-os/core/native-search-service";
import { parseInfobox as parseInfoboxParser } from "~/lib/wiki-os/transformers/infobox-parser";
import {
  parseInfoboxWithTemplates,
  resolveImageUrl,
  type UnifiedInfoboxData,
} from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import {
  countryWikiPage,
  countryWikiPages,
  extractWikiIntro,
  fetchWikiIntro,
  fetchWikiPageImages,
  fetchWikiRichIntro,
  fetchWikiSectionPreviews,
  fetchWikiSections,
} from "~/server/modules/countries/countries.wiki";

/**
 * A country's wiki reader input. `countryId` reads the country's own page (its own wiki: an Eurth nation's IIWiki
 * page) instead of looking its name up; it is part of the cache key.
 */
const countryWikiInput = z.object({ countryName: z.string(), countryId: z.string().optional() });

export const wikiProcedures = {
  getWikiIntro: cachedStaticProcedure.input(countryWikiInput).query(async ({ ctx, input }) => {
    const name = input.countryName.trim();
    if (!name) return null;
    return fetchWikiIntro(name, await countryWikiPage(ctx.db, input.countryId));
  }),

  getWikiSections: cachedStaticProcedure.input(countryWikiInput).query(async ({ ctx, input }) => {
    const name = input.countryName.trim();
    if (!name) return null;
    return fetchWikiSections(name, await countryWikiPage(ctx.db, input.countryId));
  }),

  getWikiPageImages: cachedStaticProcedure.input(countryWikiInput).query(async ({ ctx, input }) => {
    const name = input.countryName.trim();
    if (!name) return null;
    return fetchWikiPageImages(name, await countryWikiPage(ctx.db, input.countryId));
  }),

  getWikiRichIntro: cachedStaticProcedure.input(countryWikiInput).query(async ({ ctx, input }) => {
    const name = input.countryName.trim();
    if (!name) return null;
    return fetchWikiRichIntro(name, await countryWikiPage(ctx.db, input.countryId));
  }),

  getBulkWikiRichIntros: cachedStaticProcedure
    .input(
      z.object({
        countries: z
          .array(z.object({ countryName: z.string(), countryId: z.string().optional() }))
          .max(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = input.countries
        .map((c) => ({ name: c.countryName.trim(), id: c.countryId }))
        .filter((c) => c.name);
      const ids = countries.flatMap((c) => (c.id ? [c.id] : []));
      const pages = await countryWikiPages(ctx.db, ids);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiRichIntro>>> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 50. (audit B5)
      await Promise.all(
        countries.map(async ({ name, id }) => {
          results[name] = await fetchWikiRichIntro(name, id ? pages.get(id) : undefined);
        })
      );
      return results;
    }),

  getWikiSectionPreviews: cachedStaticProcedure
    .input(countryWikiInput)
    .query(async ({ ctx, input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSectionPreviews(name, await countryWikiPage(ctx.db, input.countryId));
    }),

  searchWiki: rateLimitedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1, "Search query is required"),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
        categoryFilter: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { query, site, categoryFilter } = input;
      try {
        const results = await searchWikiService(query, site, categoryFilter);
        return results;
      } catch (error) {
        console.error("[WikiSearch] Search failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  parseInfobox: rateLimitedPublicProcedure
    .input(
      z.object({
        pageName: z.string().min(1, "Page name is required"),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
      })
    )
    .mutation(async ({ input }) => {
      const { pageName, site } = input;
      const cacheKey = `parsed-infobox:${site}:${pageName.trim().toLowerCase()}`;
      try {
        // Try L1/L2 cache first
        const cached = await wikiCacheService.getCustomCache<
          UnifiedInfoboxData & { wikiIntro?: string }
        >(cacheKey);
        if (cached) {
          return cached;
        }

        // A wiki that cannot be reached is NOT_FOUND here, as a missing page.
        const article = await unlessUnavailable(getArticleWikitextShadow(pageName, site));
        if (!article) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Could not fetch wikitext for "${pageName}" from ${site}`,
          });
        }

        // Use unified parser with full template processing
        const unified = parseInfoboxWithTemplates(article.wikitext, pageName);
        if (!unified) {
          // Fallback to basic parser
          const parsed = parseInfoboxParser(article.wikitext);
          if (!parsed) return null;
          const result: Record<string, unknown> = { templateName: parsed.templateName };
          for (const field of parsed.fields) {
            result[field.key] = field.cleanValue || field.rawValue;
          }
          await wikiCacheService.setCustomCache(
            cacheKey,
            "parsed-infobox",
            result,
            24 * 60 * 60 * 1000
          );
          return result;
        }

        // Extract wiki intro (first paragraph after infobox)
        const intro = extractWikiIntro(article.wikitext);
        if (intro) {
          unified.wikiIntro = intro;
        }

        // Extract category tags from article wikitext to guide background LoreScanner
        const catMatches =
          article.wikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi) || [];
        const categories = catMatches
          .map((c) =>
            c
              .replace(/^\[\[Category:/i, "")
              .replace(/\]\]$/, "")
              .split("|")[0]
              ?.trim()
          )
          .filter((c): c is string => Boolean(c));
        if (categories.length > 0) {
          unified.categories = categories;
        }
        unified.rawWikitext = article.wikitext;

        // Resolve image URLs
        const wikiSource = site as "ixwiki" | "iiwiki" | "althistory";
        if (unified.image_flag) {
          unified.flagUrl = resolveImageUrl(unified.image_flag, wikiSource);
        }
        if (unified.image_coat || unified.coat_of_arms) {
          unified.coatOfArmsUrl = resolveImageUrl(
            unified.image_coat || unified.coat_of_arms,
            wikiSource
          );
        }

        await wikiCacheService.setCustomCache(
          cacheKey,
          "parsed-infobox",
          unified,
          24 * 60 * 60 * 1000
        );
        return unified;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[WikiParse] Parse failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse infobox: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
};
