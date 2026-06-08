/**
 * commons.ts — Wikimedia Commons tRPC router.
 * Efficient image browsing with generator search (1 API call instead of N+1),
 * category browsing, and autocomplete.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "IxStats/2.0 (https://ixwiki.com; WikiOS Commons Browser)";

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function commonsApiFetch(params: Record<string, string | number>) {
  const url = new URL(COMMONS_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
  });

  if (!res.ok) throw new Error(`Commons API error: ${res.status}`);
  return res.json() as Promise<any>;
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

  return pages
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
// Router
// ---------------------------------------------------------------------------

export const commonsRouter = createTRPCRouter({
  /**
   * Full-text search using generator pattern — returns thumbnails + metadata in one call.
   * Supports Commons search operators like `incategory:"Category Name"`.
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        limit: z.number().min(1).max(50).default(40),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const data = await commonsApiFetch({
        action: "query",
        generator: "search",
        gsrsearch: input.query,
        gsrnamespace: 6,
        gsrlimit: input.limit,
        gsroffset: input.offset,
        prop: "imageinfo",
        iiprop: "url|extmetadata|size|mime",
        iiurlwidth: 300,
      });

      const images = parseImagePages(data);
      const nextOffset =
        data?.continue?.gsroffset != null ? (data.continue.gsroffset as number) : null;
      const totalHits = data?.query?.searchinfo?.totalhits ?? null;

      return { images, nextOffset, totalHits };
    }),

  /**
   * Files in a Commons category — uses deepcat: for recursive search through all subcategories.
   * Returns files from the entire category tree with total count.
   */
  getCategoryFiles: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(50).default(40),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const data = await commonsApiFetch({
        action: "query",
        generator: "search",
        gsrsearch: `deepcat:"${input.category}"`,
        gsrnamespace: 6,
        gsrlimit: input.limit,
        gsroffset: input.offset,
        prop: "imageinfo",
        iiprop: "url|extmetadata|size|mime",
        iiurlwidth: 300,
      });

      const images = parseImagePages(data);
      const nextOffset =
        data?.continue?.gsroffset != null ? (data.continue.gsroffset as number) : null;
      const totalHits = data?.query?.searchinfo?.totalhits ?? null;

      return { images, nextOffset, totalHits };
    }),

  /**
   * Get total recursive file count for categories using deepcat: search.
   * Batches up to 10 categories with individual queries (cached aggressively).
   */
  getCategoryTotalCounts: publicProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(10),
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
              srsearch: `deepcat:"${cat}"`,
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
  getSubcategories: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(200).default(50),
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
   * File/subcategory counts for up to 20 categories (batched).
   */
  getCategoryInfo: publicProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(20),
      })
    )
    .query(async ({ input }) => {
      const titles = input.categories.map((c) => `Category:${c}`).join("|");

      const data = await commonsApiFetch({
        action: "query",
        prop: "categoryinfo",
        titles,
      });

      const result: Record<string, { files: number; subcats: number }> = {};
      for (const page of data?.query?.pages ?? []) {
        const name = String(page.title).replace(/^Category:/, "");
        const info = page.categoryinfo ?? {};
        result[name] = {
          files: info.files ?? 0,
          subcats: info.subcats ?? 0,
        };
      }

      return result;
    }),

  /**
   * Category prefix autocomplete.
   */
  autocompleteCategories: publicProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().min(1).max(30).default(15),
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
        (c: any) => c["*"] ?? c.title ?? ""
      ) as string[];
    }),

  /**
   * Get image info (thumbnails, dimensions, descriptions, license, etc) for a batch of file titles.
   */
  getImageInfoByTitles: publicProcedure
    .input(
      z.object({
        titles: z.array(z.string().min(1)).max(50),
      })
    )
    .query(async ({ input }) => {
      if (input.titles.length === 0) return [];

      const data = await commonsApiFetch({
        action: "query",
        titles: input.titles.join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata|size|mime",
        iiurlwidth: 300,
      });

      return parseImagePages(data);
    }),
});
