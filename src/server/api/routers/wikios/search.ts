/**
 * search.ts — WikiOS Search & Media Endpoints
 *
 * Provides endpoints for full-text search, prefix search, file search,
 * business search, recent changes, random page, and site stats.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, createRateLimitMiddleware } from "~/server/api/trpc";
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
import { assetUrl } from "~/lib/base-path";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { getMediaWikiApiUrl, DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";
import { wikiSourceSchema } from "./_shared";

/** File search reads a sister wiki's API on a miss: one bucket shared with the sister-wiki category reads. */
const sisterWikiProcedure = publicProcedure.use(
  createRateLimitMiddleware({ max: 120, windowMs: 60_000, namespace: "sisterwiki" })
);

/** A sister wiki's answers are reused for 5 minutes. */
const SISTER_CACHE_TTL_MS = 300_000;

const searchWikiTitles = publicProcedure
  .input(
    z.object({
      query: z.string().min(1).max(200),
      limit: z.number().min(1).max(50).default(10),
      wiki: wikiSourceSchema,
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
  });

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
   * Get recent changes from the wiki feed: the edits that went live. `includeParked` adds the ones
   * that did not (MediaWiki edits that conflicted with WikiOS's head), flagged `parked`.
   */
  getRecentChanges: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        includeParked: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      return getRecentChanges(input.limit, { includeParked: input.includeParked });
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
   * Title typeahead for the search boxes: titles that start with, contain or resemble the text
   * (id, title, summary and lead image only; never the wikitext), at most 10.
   */
  typeahead: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(10).default(10),
      })
    )
    .query(async ({ input }) => {
      const results = await NativeSearchService.spotlightSearch(input.query, "ixwiki", input.limit);
      return {
        results: results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          thumbnail: r.leadImageUrl ?? null,
        })),
      };
    }),

  /**
   * Full-text search with weighted relevance scoring — native PostgreSQL tsvector primary.
   * `snippetRanges` are the character ranges of `snippet` that matched (the client marks them).
   */
  advancedSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(256),
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
          input.offset,
          input.namespace
        );
        return {
          results: native.results.map((r) => ({
            title: r.title,
            namespace: input.namespace ?? 0,
            snippet: r.snippet,
            snippetRanges: r.snippetRanges,
            titleSnippet: null,
            sectionSnippet: null,
            categorySnippet: null,
            size: (r.readingTime || 1) * 200,
            wordCount: (r.readingTime || 1) * 200,
            timestamp: new Date().toISOString(),
            thumbnail: r.leadImageUrl ?? null,
          })),
          totalHits: native.total,
          hasMore: input.offset + native.results.length < native.total,
        };
      } catch {
        // The native search could not answer: fall back to the bridge's reader
      }

      const result = await fullTextSearch(input.query, input.limit, input.offset, input.namespace);
      return {
        results: (result.results || []).map((r) => ({
          title: r.title,
          namespace: r.namespace,
          snippet: r.snippet,
          snippetRanges: [] as Array<[number, number]>,
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

  /** Search articles with the PostgreSQL shadow full-text/trigram engine (ixwiki), else the live wiki. */
  searchArticles: searchWikiTitles,

  /** Same search, kept under its older name for existing callers. */
  searchPages: searchWikiTitles,

  /**
   * Search wiki files/images by name (full text) or category.
   */
  searchFiles: sisterWikiProcedure
    .input(
      z.object({
        query: z.string().max(200).optional(),
        category: z.string().max(200).optional(),
        limit: z.number().min(1).max(50).default(20),
        fileTypes: z.array(z.string().max(100)).max(20).optional(),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      // IxWiki's files are the assets Postgres holds (a category limits them to the files it lists).
      if (input.wiki === "ixwiki") {
        const assets = await MediaAssetService.search(input);
        return assets.map((a) => ({
          name: a.filename || a.title,
          title: `File:${a.title}`,
          // An upload only WikiOS holds is a path on this site (`/api/wiki/file/<name>`): it needs the base path.
          url: assetUrl(a.url) ?? a.url,
          // The small rendition the grids show; null when none was computed (the tile falls back to `url`).
          thumbUrl: a.thumbnailUrl ? (assetUrl(a.thumbnailUrl) ?? a.thumbnailUrl) : null,
          size: a.sizeBytes || 0,
          // 0 when unknown: the picker lays the tile out by aspect ratio only when it has one.
          width: a.width ?? 0,
          height: a.height ?? 0,
          mime: a.mimeType || "image/png",
          // The placeholder pickers show while the thumbnail loads (WK-17); null when none was computed
          blurhash: a.blurhash,
        }));
      }

      // A sister wiki's files are read from that wiki.
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      // Full-text and case-insensitive (not a name prefix); each page carries a 500px thumbnail.
      const imageInfo = "prop=imageinfo&iiprop=url|size|mime&iiurlwidth=500";
      let url: string;
      if (input.category) {
        url = `${baseUrl}?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(
          input.category.replace(/ /g, "_")
        )}&gcmtype=file&gcmlimit=${input.limit}&${imageInfo}&format=json`;
      } else if (input.query?.trim()) {
        url = `${baseUrl}?action=query&generator=search&gsrsearch=${encodeURIComponent(
          input.query.trim()
        )}&gsrnamespace=6&gsrlimit=${input.limit}&${imageInfo}&format=json`;
      } else {
        // Nothing typed: browse the wiki's files (generator=search refuses an empty search).
        url = `${baseUrl}?action=query&generator=allimages&gailimit=${input.limit}&${imageInfo}&format=json`;
      }

      const data = await fetchMediaWikiJson<{
        query?: {
          pages?: Record<
            string,
            {
              title: string;
              index?: number;
              imageinfo?: Array<{
                url: string;
                thumburl?: string;
                size: number;
                width: number;
                height: number;
                mime: string;
              }>;
            }
          >;
        };
      }>(url, { userAgent: DEFAULT_USER_AGENT, cacheTtlMs: SISTER_CACHE_TTL_MS });

      // The pages object is keyed by page id; `index` is the generator's own order (search rank).
      return Object.values(data.query?.pages ?? {})
        .filter((p) => p.imageinfo && p.imageinfo[0])
        .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER))
        .map((p) => {
          const info = p.imageinfo![0]!;
          return {
            name: p.title.replace(/^File:/, ""),
            title: p.title,
            url: info.url,
            thumbUrl: info.thumburl ?? null,
            size: info.size,
            width: info.width ?? 0,
            height: info.height ?? 0,
            mime: info.mime,
          };
        });
    }),

  /**
   * Search approved businesses for template modals.
   */
  searchBusinesses: publicProcedure
    .input(
      z.object({
        query: z.string().max(256).optional(),
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
