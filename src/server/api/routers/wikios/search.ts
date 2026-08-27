/**
 * search.ts — WikiOS Search & Media Endpoints
 *
 * Provides endpoints for full-text search, prefix search, file search,
 * business search, recent changes, random page, and site stats.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  searchPages,
  getRecentChanges,
  getSiteStats,
  getRandomPage,
  fullTextSearch,
  type WikiSource,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import {
  searchShadowArticles,
  NativeSearchService,
} from "~/lib/wiki-os/core/native-search-service";
import { db } from "~/server/db";
import { getImageUrl } from "~/lib/wiki-os/transformers/image-url";

export const wikiosSearchRouter = createTRPCRouter({
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
            wordcount: 0,
            timestamp: new Date().toISOString(),
            source: "ixwiki" as const,
          }));
        }
      }

      if (wikiSource === "all") {
        const [ix, ii, alt] = await Promise.all([
          searchPages(query, limit, "ixwiki"),
          searchPages(query, limit, "iiwiki"),
          searchPages(query, limit, "althistory"),
        ]);
        return [
          ...ix.map((r) => ({ ...r, source: "ixwiki" as const })),
          ...ii.map((r) => ({ ...r, source: "iiwiki" as const })),
          ...alt.map((r) => ({ ...r, source: "althistory" as const })),
        ];
      }

      const results = await searchPages(query, limit, wikiSource as WikiSource);
      return results.map((r) => ({ ...r, source: wikiSource as WikiSource }));
    }),

  /**
   * Get recent changes from the wiki feed.
   */
  getRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      return getRecentChanges(input.limit);
    }),

  /**
   * Get a random published article title.
   */
  getRandomPage: publicProcedure.query(async () => {
    const title = await getRandomPage();
    return { title };
  }),

  /**
   * Get MediaWiki site statistics.
   */
  getSiteStats: publicProcedure.query(async () => {
    return getSiteStats();
  }),

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
              size: (r.readingTime || 1) * 200,
              wordCount: (r.readingTime || 1) * 200,
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
        results: (result.results || []).map((r) => ({
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
      if (input.wiki === "ixwiki") {
        const where: {
          OR?: Array<{
            title?: { contains: string; mode: "insensitive" };
            filename?: { contains: string; mode: "insensitive" };
          }>;
          mimeType?: { in: string[] };
        } = {};
        if (input.query && input.query.trim().length > 0) {
          where.OR = [
            { title: { contains: input.query.trim(), mode: "insensitive" } },
            { filename: { contains: input.query.trim(), mode: "insensitive" } },
          ];
        }
        if (input.fileTypes && input.fileTypes.length > 0) {
          where.mimeType = { in: input.fileTypes };
        }

        const assets = await db.wikiAsset.findMany({
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
          allimages?: Array<{
            name: string;
            url: string;
            size: number;
            width: number;
            height: number;
            mime: string;
          }>;
          pages?: Record<
            string,
            {
              title: string;
              imageinfo?: Array<{
                url: string;
                size: number;
                width: number;
                height: number;
                mime: string;
              }>;
            }
          >;
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
   * Get direct static image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(async ({ input }) => {
      const url = getImageUrl(input.filename);
      return { url };
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
