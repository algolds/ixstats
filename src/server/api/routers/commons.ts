/**
 * commons.ts — Wikimedia Commons tRPC router.
 * Efficient image browsing with generator search (1 API call instead of N+1),
 * category browsing, and autocomplete.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, createRateLimitMiddleware } from "~/server/api/trpc";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { Cache } from "~/lib/cache/cache";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = DEFAULT_USER_AGENT;

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function commonsApiFetch(params: Record<string, string | number>) {
  const url = new URL(COMMONS_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  return fetchMediaWikiJson<any>(url.toString(), { userAgent: USER_AGENT });
}

/** Only the extmetadata fields `parseImagePages` reads: the full set is several KB per file. */
const IMAGE_INFO_PARAMS = {
  iiprop: "url|extmetadata|size|mime",
  iiurlwidth: 300,
  iiextmetadatafilter: "ImageDescription|Artist|LicenseShortName",
  iiextmetadatalanguage: "en",
} as const;

/** A category name as it sits inside `deepcat:"..."`: a quote would end the phrase early. */
function deepcatQuery(category: string): string {
  return `deepcat:"${category.replace(/"/g, "")}"`;
}

// ---------------------------------------------------------------------------
// Parse image data from generator+imageinfo response
// ---------------------------------------------------------------------------

interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

function parseImagePages(data: any): CommonsImage[] {
  const pages = data?.query?.pages;
  if (!pages || !Array.isArray(pages)) return [];

  // generator=search numbers each page with its rank (`index`); the API lists pages in id order.
  const ranked = pages
    .map((p: any, position: number) => ({ p, position }))
    .sort((a: any, b: any) => {
      const ai = typeof a.p.index === "number" ? a.p.index : Infinity;
      const bi = typeof b.p.index === "number" ? b.p.index : Infinity;
      return ai === bi ? a.position - b.position : ai - bi;
    })
    .map((entry: any) => entry.p);

  return ranked
    .filter((p: any) => p.imageinfo && p.imageinfo.length > 0)
    .map((p: any) => {
      const info = p.imageinfo[0];
      const ext = info.extmetadata ?? {};
      return {
        pageid: p.pageid,
        title: p.title,
        thumbUrl: info.thumburl ?? info.url,
        url: info.url,
        descriptionUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        width: info.width ?? 0,
        height: info.height ?? 0,
        mime: info.mime ?? "",
        description: stripHtml(ext.ImageDescription?.value ?? ""),
        artist: stripHtml(ext.Artist?.value ?? ""),
        license: ext.LicenseShortName?.value ?? "",
      };
    });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Caching & Rate-limit/429 Handling
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_MISS_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
// Bounded LRU: public callers can submit arbitrary titles, and misses are cached too
const imageInfoCache = new Cache<CommonsImage | null>({
  maxSize: 5000,
  defaultTtlMs: CACHE_TTL_MS,
  namespace: "commons-imageinfo",
});

// Every procedure proxies the external Commons API; dedicated bucket so it doesn't drain "public"
const commonsProcedure = publicProcedure.use(
  createRateLimitMiddleware({ max: 100, windowMs: 60_000, namespace: "commons" })
);

function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ").trim();
}

/** One page of Commons file search results (thumbnails + metadata) with the continuation offset. */
async function searchCommonsFiles(gsrsearch: string, page: { limit: number; offset: number }) {
  const data = await commonsApiFetch({
    action: "query",
    generator: "search",
    gsrsearch,
    gsrnamespace: 6,
    gsrlimit: page.limit,
    gsroffset: page.offset,
    prop: "imageinfo",
    ...IMAGE_INFO_PARAMS,
  });

  const images = parseImagePages(data);
  const nextOffset = data?.continue?.gsroffset != null ? (data.continue.gsroffset as number) : null;
  const totalHits = data?.query?.searchinfo?.totalhits ?? null;

  return { images, nextOffset, totalHits };
}

export const commonsRouter = createTRPCRouter({
  /**
   * Full-text search using generator pattern — returns thumbnails + metadata in one call.
   * Supports Commons search operators like `incategory:"Category Name"`.
   */
  search: commonsProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(50).default(40),
        offset: z.number().int().min(0).max(9_950).default(0),
      })
    )
    .query(async ({ input }) => {
      return searchCommonsFiles(input.query, input);
    }),

  /**
   * Files in a Commons category — uses deepcat: for recursive search through all subcategories.
   * Returns files from the entire category tree with total count.
   */
  getCategoryFiles: commonsProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(50).default(40),
        offset: z.number().int().min(0).max(9_950).default(0),
      })
    )
    .query(async ({ input }) => {
      return searchCommonsFiles(deepcatQuery(input.category), input);
    }),

  /**
   * Get total recursive file count for categories using deepcat: search.
   * Batches up to 10 categories with individual queries (cached aggressively).
   */
  getCategoryTotalCounts: commonsProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(25),
      })
    )
    .query(async ({ input }) => {
      const results: Record<string, number> = {};

      // Run in parallel for speed
      await Promise.all(
        input.categories.map(async (cat) => {
          try {
            const data = await commonsApiFetch({
              action: "query",
              list: "search",
              srsearch: deepcatQuery(cat),
              srnamespace: 6,
              srlimit: 0,
            });
            results[cat] = data?.query?.searchinfo?.totalhits ?? 0;
          } catch {
            results[cat] = 0;
          }
        })
      );

      return results;
    }),

  /**
   * Subcategories of a Commons category.
   */
  getSubcategories: commonsProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const data = await commonsApiFetch({
        action: "query",
        list: "categorymembers",
        cmtitle: `Category:${input.category}`,
        cmnamespace: 14,
        cmtype: "subcat",
        cmlimit: input.limit,
      });

      const subcats: string[] = (data?.query?.categorymembers ?? []).map((m: any) =>
        String(m.title).replace(/^Category:/, "")
      );

      return subcats;
    }),

  /**
   * Category prefix autocomplete.
   */
  autocompleteCategories: commonsProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(30).default(15),
      })
    )
    .query(async ({ input }) => {
      const data = await commonsApiFetch({
        action: "query",
        list: "allcategories",
        acprefix: input.prefix,
        aclimit: input.limit,
      });

      return (data?.query?.allcategories ?? []).map(
        (c: any) => c.category ?? c["*"] ?? c.title ?? ""
      ) as string[];
    }),

  /**
   * Get image info (thumbnails, dimensions, descriptions, license, etc) for a batch of file titles.
   */
  getImageInfoByTitles: commonsProcedure
    .input(
      z.object({
        titles: z.array(z.string().min(1)).max(50),
      })
    )
    .query(async ({ input }) => {
      if (input.titles.length === 0) return [];

      const results: CommonsImage[] = [];
      const titlesToFetch: string[] = [];

      for (const title of input.titles) {
        const normKey = normalizeTitle(title);
        const cached = imageInfoCache.get(normKey);
        if (cached !== undefined) {
          if (cached !== null) results.push(cached);
          continue;
        }
        titlesToFetch.push(title);
      }

      if (titlesToFetch.length > 0) {
        try {
          const data = await commonsApiFetch({
            action: "query",
            titles: titlesToFetch.join("|"),
            prop: "imageinfo",
            ...IMAGE_INFO_PARAMS,
          });

          const fetchedImages = parseImagePages(data);
          const fetchedNormTitles = new Set<string>();

          for (const img of fetchedImages) {
            const normTitle = normalizeTitle(img.title);
            imageInfoCache.set(normTitle, img, CACHE_TTL_MS);
            fetchedNormTitles.add(normTitle);
          }

          for (const rawTitle of titlesToFetch) {
            const normTitle = normalizeTitle(rawTitle);
            if (!fetchedNormTitles.has(normTitle)) {
              imageInfoCache.set(normTitle, null, CACHE_MISS_TTL_MS);
            }
          }
        } catch (error) {
          console.error("[Commons Router] Failed to fetch image info batch from Commons:", error);
          for (const rawTitle of titlesToFetch) {
            const normTitle = normalizeTitle(rawTitle);
            if (!imageInfoCache.has(normTitle)) {
              imageInfoCache.set(normTitle, null, CACHE_MISS_TTL_MS);
            }
          }
        }
      }

      return input.titles
        .map((title) => imageInfoCache.get(normalizeTitle(title)) ?? null)
        .filter((img): img is CommonsImage => img !== null);
    }),
});
