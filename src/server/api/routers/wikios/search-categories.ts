/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  searchPages,
  getRecentChanges,
  getCategoryMembers,
  getSiteStats,
  getRandomPage,
  getRevisionWikitext as getRevisionWikitextMySQL,
  fullTextSearch,
  getParentCategories as getParentCategoriesMySQL,
  getCategoryInfo,
  type WikiSource,
} from "~/lib/wiki/bridge";

import { saveToMediaWiki } from "~/lib/wiki-os/wiki-write-service";

export const wikiosSearchCategoriesRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  /**
   * Search articles by title prefix.
   * Supports multi-wiki search: specify a single source or "all" to query
   * ixwiki, iiwiki, and althistory in parallel.
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory", "all"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { query, limit, wikiSource } = input;

      if (wikiSource !== "all") {
        const results = await searchPages(query, limit, wikiSource as WikiSource);
        return results.map((r) => ({
          ...r,
          source: wikiSource as "ixwiki" | "iiwiki" | "althistory",
        }));
      }

      // Query all 3 wikis in parallel
      const sources: WikiSource[] = ["ixwiki", "iiwiki", "althistory"];
      const settled = await Promise.allSettled(
        sources.map((src) => searchPages(query, limit, src))
      );

      const merged: Array<{
        title: string;
        pageId: number;
        length: number;
        source: "ixwiki" | "iiwiki" | "althistory";
      }> = [];
      for (let i = 0; i < sources.length; i++) {
        const result = settled[i]!;
        if (result.status === "fulfilled") {
          for (const r of result.value) {
            merged.push({ ...r, source: sources[i]! });
          }
        }
      }

      return merged;
    }),

  /**
   * Get recent changes for the Recent Changes special page.
   */
  getRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      return getRecentChanges(input.limit);
    }),

  /**
   * Get a random article title.
   */
  getRandomPage: publicProcedure.query(async () => {
    // Direct MySQL — ~10ms vs ~200ms via API
    const title = await getRandomPage();
    return { title };
  }),

  /**
   * Get site statistics (total articles, edits, active users).
   */
  getSiteStats: publicProcedure.query(async () => {
    // Direct MySQL — ~5ms vs ~200ms via API
    return getSiteStats();
  }),

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Get members of a category.
   */
  getCategoryMembers: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
        type: z.enum(["page", "subcat", "file"]).optional(),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~30ms vs ~400ms via API
      const result = await getCategoryMembers(input.category, input.limit, input.type);
      return {
        members: result.members,
        continueToken: result.hasMore ? "more" : null,
      };
    }),

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Template Registry (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Lore Stash — save-for-later with color-coded collections
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // User Info (for WikiOS profiles)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Rollback / Undo endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Page Properties & Protection (direct MySQL)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Advanced Search (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Full-text search with faceted filtering — namespace, snippets, highlights.
   */
  advancedSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
        namespace: z.number().optional(),
        sort: z.enum(["relevance", "timestamp"]).default("relevance"),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL FULLTEXT search — ~100ms vs ~500ms via API
      const result = await fullTextSearch(input.query, input.limit, input.offset, input.namespace);
      return {
        results: result.results.map((r) => ({
          title: r.title,
          namespace: r.namespace,
          snippet: r.snippet,
          titleSnippet: null,
          sectionSnippet: null,
          categorySnippet: null,
          size: r.size,
          wordCount: r.wordCount,
          timestamp: r.timestamp,
        })),
        totalHits: result.totalHits,
        hasMore: result.results.length >= input.limit,
      };
    }),

  // ---------------------------------------------------------------------------
  // Category Tree (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Get parent categories for a page (for breadcrumb navigation).
   */
  getParentCategories: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      // Direct MySQL — ~20ms vs ~400ms via API
      const categories = await getParentCategoriesMySQL(input.title);
      return { categories };
    }),

  /**
   * Get category tree — subcategories and pages with counts.
   * Supports lazy loading via depth parameter.
   */
  getCategoryTree: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        depth: z.number().min(1).max(3).default(1),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~50ms vs ~1500ms via API (eliminates 2-3 API calls)
      const info = await getCategoryInfo(input.category);

      let children: Array<{
        title: string;
        fullTitle: string;
        subcategories?: Array<{ title: string; fullTitle: string }>;
      }> = info.subcategories;

      // Depth > 1: fetch one more level for each subcategory
      if (input.depth > 1 && info.subcategories.length > 0 && info.subcategories.length <= 20) {
        children = await Promise.all(
          info.subcategories.map(async (sc) => {
            try {
              const childInfo = await getCategoryInfo(sc.fullTitle);
              return { ...sc, subcategories: childInfo.subcategories };
            } catch {
              return sc;
            }
          })
        );
      }

      return {
        title: info.title,
        totalPages: info.totalPages,
        totalSubcats: info.totalSubcats,
        totalFiles: info.totalFiles,
        subcategories: children,
      };
    }),

  // ---------------------------------------------------------------------------
  // Watchlist endpoints (backed by the LoreStash "Watchlist" stash)
  // ---------------------------------------------------------------------------
});

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}
