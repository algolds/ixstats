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
  getParentCategories,
  getCategoryInfo,
  type WikiSource,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";

import { saveToMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import { searchShadowArticles, NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import {
  extractLeadImageFromWikitext,
  normalizeWikiImageUrl,
  getImageUrl,
} from "~/lib/wiki-os/transformers/image-url";
import { batchFetchThumbnails } from "~/lib/wiki-os/adapters/mediawiki/bridge";

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

      if (wikiSource === "ixwiki") {
        const shadowResults = await searchShadowArticles(query, limit);
        if (shadowResults.length > 0) {
          return shadowResults.map((r) => ({
            title: r.title,
            snippet: r.snippet,
            wikiSource: "ixwiki" as const,
          }));
        }
        return searchPages(query, limit, "ixwiki");
      }

      if (wikiSource !== "all") {
        return searchPages(query, limit, wikiSource as WikiSource);
      }

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
   * Get members of a category with automatic lead thumbnail image resolution.
   */
  getCategoryMembers: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        limit: z.number().min(1).max(500).default(500),
        offset: z.string().optional(),
        type: z.enum(["page", "subcat", "file"]).optional(),
      })
    )
    .query(async ({ input }) => {
      let rawMembers: Array<{
        pageid: number;
        title: string;
        type: "page" | "subcat" | "file";
        ns: number;
        isSubcategory: boolean;
        imageUrl?: string | null;
      }> = [];
      let hasMore = false;

      // 1. Fast-path: Native PostgreSQL Category DAG
      const nativeDetails = await CategoryService.getCategoryDetails(input.category);
      if (nativeDetails.category && (nativeDetails.articles.length > 0 || nativeDetails.subcategories.length > 0)) {
        if (!input.type || input.type === "subcat") {
          for (const c of nativeDetails.subcategories) {
            rawMembers.push({
              pageid: 0,
              title: `Category:${c.name}`,
              type: "subcat" as const,
              ns: 14,
              isSubcategory: true,
              imageUrl: null,
            });
          }
        }

        if (!input.type || input.type === "page") {
          for (const a of nativeDetails.articles) {
            rawMembers.push({
              pageid: 0,
              title: a.title,
              type: "page" as const,
              ns: 0,
              isSubcategory: false,
              imageUrl: null,
            });
          }
        }

        hasMore = rawMembers.length > input.limit;
        rawMembers = rawMembers.slice(0, input.limit);
      } else {
        // 2. Resilient Bridge Fallback (MySQL IxWiki / HTTP Sister Wikis)
        const bridgeResult = await getCategoryMembers(input.category, input.limit, input.type);
        rawMembers = bridgeResult.members.map((m) => ({
          pageid: m.pageId ?? 0,
          title: m.title,
          type: (m.type ?? "page") as "page" | "subcat" | "file",
          ns: m.ns ?? 0,
          isSubcategory: m.isSubcategory ?? false,
          imageUrl: null,
        }));
        hasMore = bridgeResult.hasMore ?? false;
      }

      // 3. Batch Image Resolution for Page Members
      const pageMembers = rawMembers.filter((m) => m.type === "page" || m.ns === 0);
      if (pageMembers.length > 0) {
        const titles = pageMembers.map((m) => m.title);
        const slugs = titles.map((t) => toArticleSlug(t));
        const imageMap = new Map<string, string>();

        try {
          const articles = await db.wikiArticle.findMany({
            where: {
              OR: [
                { title: { in: titles } },
                { title: { in: titles.map((t) => t.replace(/_/g, " ")) } },
                { slug: { in: slugs } },
              ],
            },
            select: {
              title: true,
              slug: true,
              leadImageUrl: true,
              wikitext: true,
            },
          });

          for (const art of articles) {
            let img: string | null = null;
            if (art.leadImageUrl) {
              img = normalizeWikiImageUrl(art.leadImageUrl) || art.leadImageUrl;
            } else if (art.wikitext) {
              const lead = extractLeadImageFromWikitext(art.wikitext);
              if (lead) {
                img = normalizeWikiImageUrl(lead) || lead;
              }
            }

            if (img) {
              imageMap.set(art.title, img);
              imageMap.set(art.slug, img);
              imageMap.set(art.title.replace(/ /g, "_"), img);
            }
          }
        } catch {
          // Non-fatal
        }

        const missingTitles = titles.filter(
          (t) => !imageMap.has(t) && !imageMap.has(toArticleSlug(t)) && !imageMap.has(t.replace(/_/g, " "))
        );
        if (missingTitles.length > 0) {
          try {
            const mwImages = await batchFetchThumbnails(missingTitles);
            for (const [title, url] of mwImages.entries()) {
              const norm = normalizeWikiImageUrl(url) || url;
              imageMap.set(title, norm);
              imageMap.set(toArticleSlug(title), norm);
            }
          } catch {
            // Non-fatal
          }
        }

        // Assign resolved images back to members
        for (const member of rawMembers) {
          if (member.type === "page" || member.ns === 0) {
            const memberSlug = toArticleSlug(member.title);
            member.imageUrl =
              imageMap.get(member.title) ??
              imageMap.get(memberSlug) ??
              imageMap.get(member.title.replace(/_/g, " ")) ??
              null;
          }
        }
      }

      return {
        members: rawMembers,
        continueToken: hasMore ? "more" : null,
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
   * Full-text search with weighted relevance scoring — native PostgreSQL tsvector primary.
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
      try {
        const native = await NativeSearchService.fulltextSearch(
          input.query,
          "ixwiki",
          input.limit,
          input.offset
        );
        if (native && native.results.length > 0) {
          return {
            results: native.results.map((r) => ({
              title: r.title,
              namespace: 0,
              snippet: r.snippet,
              titleSnippet: null,
              sectionSnippet: null,
              categorySnippet: null,
              size: r.readingTime * 200,
              wordCount: r.readingTime * 200,
              timestamp: new Date().toISOString(),
              thumbnail: r.leadImageUrl ?? null,
            })),
            totalHits: native.total,
            hasMore: native.results.length >= input.limit,
          };
        }
      } catch {
        // Fallback to legacy MySQL fulltext search
      }

      const result = await fullTextSearch(input.query, input.limit, input.offset, input.namespace);
      return {
        results: (result.results || []).map((r: any) => ({
          title: r.title,
          namespace: r.namespace,
          snippet: r.snippet,
          titleSnippet: null,
          sectionSnippet: null,
          categorySnippet: null,
          size: r.size,
          wordCount: r.wordCount,
          timestamp: r.timestamp,
          thumbnail: r.thumbnail ?? null,
        })),
        totalHits: result.totalHits || 0,
        hasMore: (result.results || []).length >= input.limit,
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
      const categories = await getParentCategories(input.title);
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
      const info = await getCategoryInfo(input.category);

      let children: Array<{
        title: string;
        fullTitle: string;
        subcategories?: Array<{ title: string; fullTitle: string }>;
      }> = (info?.subcategories || []).map((name: string) => ({
        title: name,
        fullTitle: `Category:${name}`,
      }));

      // Depth > 1: fetch one more level for each subcategory
      if (input.depth > 1 && children.length > 0 && children.length <= 20) {
        children = await Promise.all(
          children.map(async (sc) => {
            try {
              const childInfo = await getCategoryInfo(sc.fullTitle);
              return {
                ...sc,
                subcategories: (childInfo?.subcategories || []).map((cName: string) => ({
                  title: cName,
                  fullTitle: `Category:${cName}`,
                })),
              };
            } catch {
              return sc;
            }
          })
        );
      }

      return {
        title: info?.title || input.category,
        totalPages: info?.totalPages || 0,
        totalSubcats: info?.totalSubcats || 0,
        totalFiles: info?.totalFiles || 0,
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
      // 1. Primary: Direct PostgreSQL Prisma Asset Search
      if (input.wiki === "ixwiki" && (db as any).wikiAsset) {
        const where: any = {};
        if (input.query && input.query.trim().length > 0) {
          where.OR = [
            { title: { contains: input.query.trim(), mode: "insensitive" } },
            { filename: { contains: input.query.trim(), mode: "insensitive" } },
          ];
        }
        if (input.fileTypes && input.fileTypes.length > 0) {
          where.mimeType = { in: input.fileTypes };
        }

        const assets: any[] = await (db as any).wikiAsset.findMany({
          where,
          take: input.limit,
          orderBy: { title: "asc" },
        });

        if (assets && assets.length > 0) {
          return assets.map((a) => ({
            name: a.filename || a.title,
            title: `File:${a.title}`,
            url: a.url,
            size: a.sizeBytes || 0,
            width: a.width ?? 800,
            height: a.height ?? 600,
            mime: a.mimeType || "image/png",
          }));
        }
      }

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
   * Search wiki categories by prefix or letter.
   */
  searchCategories: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional().default(""),
        from: z.string().max(200).optional(),
        limit: z.number().min(1).max(100).default(30),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      // 1. Primary: Direct PostgreSQL Category Search via wikiCategory model (4,008 categories)
      if (input.wiki === "ixwiki") {
        const queryTerm = input.query ? input.query.trim() : "";
        const fromTerm = input.from ? input.from.trim() : "";

        const whereCat: any = {};
        if (queryTerm) {
          whereCat.OR = [
            { name: { contains: queryTerm, mode: "insensitive" } },
            { slug: { contains: toArticleSlug(queryTerm), mode: "insensitive" } },
          ];
        } else if (fromTerm) {
          whereCat.name = { gte: fromTerm, mode: "insensitive" };
        }

        const categories = await db.wikiCategory.findMany({
          where: whereCat,
          include: {
            _count: { select: { members: true, children: true } },
          },
          orderBy: { name: "asc" },
          take: input.limit,
        });

        if (categories.length > 0) {
          return categories.map((cat) => ({
            name: cat.name,
            title: `Category:${cat.name}`,
            size: cat._count.members + cat._count.children,
            pages: cat._count.members,
            files: 0,
            subcats: cat._count.children,
          }));
        }
      }

      const { getMediaWikiApiUrl, DEFAULT_USER_AGENT } = await import("~/lib/wiki-os/config");
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const params = new URLSearchParams({
        action: "query",
        list: "allcategories",
        aclimit: String(input.limit),
        acprop: "size",
        format: "json",
      });

      if (input.query && input.query.trim().length > 0) {
        params.set("acprefix", input.query.trim().replace(/ /g, "_"));
      } else if (input.from && input.from.trim().length > 0) {
        params.set("acfrom", input.from.trim().replace(/ /g, "_"));
      }

      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        query?: {
          allcategories?: Array<{
            "*": string;
            size?: number;
            pages?: number;
            files?: number;
            subcats?: number;
          }>;
        };
      };

      return (
        data.query?.allcategories?.map((cat) => ({
          name: cat["*"],
          title: `Category:${cat["*"]}`,
          size: cat.size ?? 0,
          pages: cat.pages ?? 0,
          files: cat.files ?? 0,
          subcats: cat.subcats ?? 0,
        })) ?? []
      );
    }),

  /**
   * Get direct static image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(async ({ input }) => {
      const url = getImageUrl(input.filename);
      return { url };
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
          const categories = await db.wikiCategory.findMany({
            take: input.limit,
            include: {
              _count: { select: { members: true } },
            },
            orderBy: { members: { _count: "desc" } },
          });
          return (categories || []).map((c) => ({
            name: String(c.name || "").replace(/_/g, " "),
            fileCount: Number(c._count?.members || 0),
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

