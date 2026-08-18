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
  fullTextSearch,
  getParentCategories as getParentCategoriesMySQL,
  getCategoryInfo,
  type WikiSource,
} from "~/lib/wiki/bridge";

import { saveToMediaWiki } from "~/lib/wiki-os/wiki-write-service";
import { searchShadowArticles } from "~/lib/wiki-os/search-service";

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
  // Search & Media endpoints (Consolidated from legacy wiki router)
  // ---------------------------------------------------------------------------

  /**
   * Search articles with PostgreSQL shadow full-text/trigram engine for ixwiki.
   */
  searchArticles: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const source = input.wiki as WikiSource;
      if (source === "ixwiki") {
        const shadowResults = await searchShadowArticles(input.query, input.limit, source);
        if (shadowResults.length > 0) {
          return shadowResults.map((r) => ({
            title: r.title,
            pageId: 0,
            length: 0,
            snippet: r.snippet,
            source: "ixwiki" as const,
          }));
        }
      }
      const live = await searchPages(input.query, input.limit, source);
      return live.map((r) => ({ ...r, source }));
    }),

  /**
   * Search pages alias for backward compatibility.
   */
  searchPages: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const source = input.wiki as WikiSource;
      if (source === "ixwiki") {
        const shadowResults = await searchShadowArticles(input.query, input.limit, source);
        if (shadowResults.length > 0) {
          return shadowResults.map((r) => ({
            title: r.title,
            pageId: 0,
            length: 0,
            snippet: r.snippet,
            source: "ixwiki" as const,
          }));
        }
      }
      return searchPages(input.query, input.limit, source);
    }),

  /**
   * Search wiki files/images by name prefix or category.
   */
  searchFiles: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional(),
        category: z.string().max(200).optional(),
        limit: z.number().min(1).max(50).default(20),
        fileTypes: z.array(z.string()).optional(),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      let url = "";
      if (input.category) {
        url = `${baseUrl}?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(
          input.category.replace(/ /g, "_")
        )}&gcmtype=file&gcmlimit=${input.limit}&prop=imageinfo&iiprop=url|size|mime&format=json`;
      } else {
        const q = input.query || "";
        url = `${baseUrl}?action=query&list=allimages&aiprefix=${encodeURIComponent(
          q.replace(/ /g, "_")
        )}&ailimit=${input.limit}&aiprop=url|size|mime&format=json`;
      }

      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        query?: {
          allimages?: Array<{ name: string; url: string; size: number; width: number; height: number; mime: string }>;
          pages?: Record<string, { title: string; imageinfo?: Array<{ url: string; size: number; width: number; height: number; mime: string }> }>;
        };
      };

      if (data.query?.allimages) {
        return data.query.allimages.map((img) => ({
          name: img.name,
          title: `File:${img.name}`,
          url: img.url,
          size: img.size,
          width: img.width,
          height: img.height,
          mime: img.mime,
        }));
      }

      if (data.query?.pages) {
        return Object.values(data.query.pages)
          .filter((p) => p.imageinfo && p.imageinfo[0])
          .map((p) => {
            const info = p.imageinfo![0]!;
            const name = p.title.replace(/^File:/, "");
            return {
              name,
              title: p.title,
              url: info.url,
              size: info.size,
              width: info.width,
              height: info.height,
              mime: info.mime,
            };
          });
      }

      return [];
    }),

  /**
   * Search wiki categories by prefix.
   */
  searchCategories: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const url = `${baseUrl}?action=query&list=allcategories&acprefix=${encodeURIComponent(
        input.query.replace(/ /g, "_")
      )}&aclimit=${input.limit}&acprop=size&format=json`;

      const res = await fetch(url, { headers: { "User-Agent": DEFAULT_USER_AGENT } });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        query?: {
          allcategories?: Array<{ "*": string; size: number; pages: number; files: number; subcats: number }>;
        };
      };

      return (
        data.query?.allcategories?.map((cat) => ({
          name: cat["*"],
          title: `Category:${cat["*"]}`,
          size: cat.size,
          pages: cat.pages,
          files: cat.files,
          subcats: cat.subcats,
        })) ?? []
      );
    }),

  /**
   * Get image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(async ({ input }) => {
      const { getWikiBaseUrl } = await import("~/lib/wiki-os/config");
      const origin = getWikiBaseUrl("ixwiki");
      const name = encodeURIComponent(input.filename.replace(/^File:/, "").replace(/ /g, "_"));
      return { url: `${origin}/wiki/Special:FilePath/${name}` };
    }),

  /**
   * Get dynamic list of categories containing files.
   */
  getCategories: publicProcedure
    .input(
      z.object({
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
        limit: z.number().int().min(1).max(500).default(500),
      })
    )
    .query(async ({ input }) => {
      if (input.wiki === "ixwiki") {
        try {
          const { getIxWikiPool } = await import("~/lib/wiki/bridge");
          const pool = getIxWikiPool();
          const [rows] = await pool.query(
            `
            SELECT cat_title AS name, cat_files AS fileCount
            FROM category
            WHERE cat_files > 0
            ORDER BY cat_files DESC
            LIMIT ?
          `,
            [input.limit]
          );
          return (rows as Array<{ name: string; fileCount: number }>).map((r) => ({
            name: String(r.name).replace(/_/g, " "),
            fileCount: Number(r.fileCount),
          }));
        } catch (err) {
          console.error("[wikiosSearchCategories] Failed to fetch ixwiki categories from DB:", err);
          return [];
        }
      } else {
        const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
        const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
        const url = `${baseUrl}?action=query&list=allcategories&acmin=1&aclimit=${input.limit}&acprop=size&format=json`;
        try {
          const res = await fetch(url, { headers: { "User-Agent": DEFAULT_USER_AGENT } });
          if (!res.ok) return [];
          const data = (await res.json()) as {
            query?: { allcategories?: Array<{ "*": string; files: number }> };
          };
          return (
            data.query?.allcategories?.map((cat) => ({
              name: cat["*"],
              fileCount: cat.files,
            })) ?? []
          );
        } catch {
          return [];
        }
      }
    }),

  /**
   * Get total file counts for a list of categories.
   */
  getCategoryTotalCounts: publicProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(25),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      const results: Record<string, number> = {};
      const titles = input.categories.map((c) => `Category:${c.replace(/ /g, "_")}`).join("|");
      const url = `${baseUrl}?action=query&prop=categoryinfo&titles=${encodeURIComponent(
        titles
      )}&format=json`;

      try {
        const res = await fetch(url, {
          headers: { "User-Agent": DEFAULT_USER_AGENT },
        });
        if (!res.ok) return {};
        const data = (await res.json()) as {
          query?: { pages?: Record<string, { title: string; categoryinfo?: { files?: number } }> };
        };
        const pages = data.query?.pages ?? {};

        for (const page of Object.values(pages)) {
          const catName = page.title?.replace(/^Category:/, "") ?? "";
          results[catName] = page.categoryinfo?.files ?? 0;
        }
      } catch (e) {
        console.error("[wikios] getCategoryTotalCounts error:", e);
      }

      for (const cat of input.categories) {
        if (results[cat] === undefined) {
          results[cat] = 0;
        }
      }

      return results;
    }),

  /**
   * Get subcategories of a category.
   */
  getSubcategories: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(200).default(50),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const url = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(
        input.category.replace(/ /g, "_")
      )}&cmnamespace=14&cmtype=subcat&cmlimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": DEFAULT_USER_AGENT },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          query?: { categorymembers?: Array<{ title: string }> };
        };
        return (data.query?.categorymembers ?? []).map((m) =>
          String(m.title).replace(/^Category:/, "")
        );
      } catch {
        return [];
      }
    }),

  /**
   * Autocomplete categories by prefix.
   */
  autocompleteCategories: publicProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().min(1).max(30).default(15),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const url = `${baseUrl}?action=query&list=allcategories&acprefix=${encodeURIComponent(
        input.prefix
      )}&aclimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": DEFAULT_USER_AGENT } });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          query?: { allcategories?: Array<{ "*": string }> };
        };
        return (data.query?.allcategories ?? []).map((c) => c["*"]);
      } catch {
        return [];
      }
    }),

  /**
   * Search approved businesses for template modals.
   */
  searchBusinesses: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        countryId: z.string().optional(),
        limit: z.number().min(1).max(50).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: {
        status: string;
        category: { in: string[] };
        countryId?: string;
        name?: { contains: string; mode: "insensitive" };
      } = {
        status: "approved",
        category: { in: ["commercial", "office", "industrial", "factory"] },
      };
      if (input.countryId) {
        where.countryId = input.countryId;
      }
      if (input.query) {
        where.name = {
          contains: input.query,
          mode: "insensitive",
        };
      }
      return ctx.db.pointOfInterest.findMany({
        where,
        take: input.limit,
        select: {
          id: true,
          name: true,
          category: true,
          coordinates: true,
          countryId: true,
        },
      });
    }),
});

