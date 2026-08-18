/**
 * wikiMediaRouter — tRPC router for all wiki media/file access.
 *
 * Single entry point for file search, category lookups, file downloads, and image resolution.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure, publicProcedure } from "~/server/api/trpc";
import { getImageUrl, getPageImages } from "~/lib/wiki/bridge";
import { getMediaWikiApiUrl, DEFAULT_USER_AGENT, type WikiSource } from "~/lib/wiki/config";
import type {
  MediaWikiQueryResponse,
  MediaWikiPageItem,
  MediaWikiAllImagesItem,
  MediaWikiAllCategoriesItem,
  MediaWikiCategoryMemberItem,
  WikiFileSearchResult,
} from "~/lib/wiki/types";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiMediaRouter = createTRPCRouter({
  /**
   * Get image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(({ input }) => {
      return { url: getImageUrl(input.filename) };
    }),

  /**
   * Search wiki files/images by name prefix.
   * Direct MySQL for ixwiki, HTTP API for iiwiki.
   */
  searchFiles: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional(),
        category: z.string().max(200).optional(),
        limit: z.number().min(1).max(50).default(20),
        fileTypes: z.array(z.string()).optional(), // e.g., ["svg", "png"]
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }): Promise<WikiFileSearchResult[]> => {
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
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as MediaWikiQueryResponse;

      let images: Array<{
        name: string;
        size: number;
        width: number;
        height: number;
        mime: string;
        url: string;
      }> = [];

      if (input.category) {
        const pagesObj = data?.query?.pages ?? {};
        images = (Object.values(pagesObj) as MediaWikiPageItem[]).map((p) => {
          const info = p.imageinfo?.[0] ?? {};
          return {
            name: p.title ?? "",
            size: info.size ?? 0,
            width: info.width ?? 0,
            height: info.height ?? 0,
            mime: info.mime ?? "",
            url: info.url ?? "",
          };
        });
      } else {
        images = (data?.query?.allimages ?? []).map((img: MediaWikiAllImagesItem) => ({
          name: img.name ?? img.title ?? "",
          size: img.size ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          mime: img.mime ?? "",
          url: img.url ?? "",
        }));
      }

      return images
        .filter((img) => {
          if (!input.fileTypes || input.fileTypes.length === 0) return true;
          const ext = img.name?.split(".")?.pop()?.toLowerCase() ?? "";
          return input.fileTypes.includes(ext);
        })
        .map((img) => ({
          name: img.name ?? "",
          size: img.size ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          mediaType: "",
          mime: img.mime ?? "",
          url: img.url ?? "",
          pageUrl:
            input.wiki === "iiwiki"
              ? `https://iiwiki.com/wiki/File:${encodeURIComponent(img.name ?? "")}`
              : `/wiki/File:${encodeURIComponent(img.name ?? "")}`,
        }));
    }),

  /**
   * Get dynamic list of categories containing files.
   * Direct MySQL for ixwiki, HTTP API for iiwiki.
   */
  getCategories: cachedPublicProcedure
    .input(
      z.object({
        wiki: wikiSourceSchema,
        limit: z.number().int().min(1).max(500).default(500),
      })
    )
    .query(async ({ input }) => {
      const isIiwiki = input.wiki === "iiwiki";

      if (!isIiwiki) {
        try {
          const { getIxWikiPool } = await import("~/lib/wiki/bridge");
          const pool = getIxWikiPool();
          const [rows] = await pool.query<Array<{ name: string; fileCount: number }>>(
            `
            SELECT cat_title AS name, cat_files AS fileCount
            FROM category
            WHERE cat_files > 0
            ORDER BY cat_files DESC
            LIMIT ?
          `,
            [input.limit]
          );
          return rows.map((r) => ({
            name: String(r.name).replace(/_/g, " "),
            fileCount: Number(r.fileCount),
          }));
        } catch (err) {
          console.error("[wikiRouter] Failed to fetch ixwiki categories from DB:", err);
          return [];
        }
      } else {
        try {
          const baseUrl = getMediaWikiApiUrl("iiwiki");
          const url = `${baseUrl}?action=query&list=allcategories&aclimit=${input.limit}&acmin=1&acprop=size&format=json&origin=*`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": DEFAULT_USER_AGENT,
              "Api-User-Agent": DEFAULT_USER_AGENT,
            },
          });
          if (!res.ok) return [];
          const data = (await res.json()) as MediaWikiQueryResponse;
          const categories = (data?.query?.allcategories ?? []) as MediaWikiAllCategoriesItem[];
          return categories
            .filter((c) => (c.files ?? 0) > 0)
            .map((c) => ({
              name: String(c["*"] || c.title).replace(/_/g, " "),
              fileCount: Number(c.files || 0),
            }));
        } catch (err) {
          console.error("[wikiRouter] Failed to fetch iiwiki categories from API:", err);
          return [];
        }
      }
    }),

  /**
   * Download a wiki file's content as base64 — server-side proxy to avoid CORS.
   * Reads directly from /ixwiki/shared/images/ when possible (same server, instant).
   */
  downloadFile: publicProcedure
    .input(z.object({ filename: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const fs = await import("fs/promises");
      const crypto = await import("crypto");
      const name = input.filename.replace(/ /g, "_");

      // MediaWiki hash-based path: md5(filename), take first 1 and 2 chars
      const md5 = crypto.createHash("md5").update(name).digest("hex");
      const hashDir1 = md5.substring(0, 1);
      const hashDir2 = md5.substring(0, 2);
      const localPath = `/ixwiki/shared/images/${hashDir1}/${hashDir2}/${name}`;

      try {
        // Try local filesystem first (instant, no HTTP)
        const buffer = await fs.readFile(localPath);
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "png"
              ? "image/png"
              : "application/octet-stream";

        return {
          filename: name,
          content: buffer.toString("base64"),
          mime,
          size: buffer.length,
          source: "local" as const,
        };
      } catch {
        // Fallback: fetch via HTTP (handles edge cases like redirects)
        try {
          const url = `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(name)}`;
          const res = await fetch(url, {
            headers: { "User-Agent": DEFAULT_USER_AGENT },
            redirect: "follow",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get("content-type") ?? "application/octet-stream";

          return {
            filename: name,
            content: buffer.toString("base64"),
            mime: contentType,
            size: buffer.length,
            source: "http" as const,
          };
        } catch (e) {
          throw new Error(
            `Failed to download ${name}: ${e instanceof Error ? e.message : "Unknown"}`
          );
        }
      }
    }),

  /** Get images from a wiki page with thumbnail URLs. */
  getPageImages: cachedPublicProcedure
    .input(
      z.object({
        title: z.string(),
        limit: z.number().int().min(1).max(50).default(12),
        excludeIcons: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const excludePatterns = input.excludeIcons
        ? [/Flag_of/i, /Coat_of_arms/i, /Icon/i, /Logo/i, /Pictogram/i]
        : [];
      const images = await getPageImages(input.title, {
        limit: input.limit,
        excludePatterns,
        thumbWidth: 400,
      });
      return images ?? [];
    }),

  /** Get total file counts for a list of categories on a specific wiki. */
  getCategoryTotalCounts: cachedPublicProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(25),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      const results: Record<string, number> = {};
      const titles = input.categories.map((c) => `Category:${c.replace(/ /g, "_")}`).join("|");
      const url = `${baseUrl}?action=query&prop=categoryinfo&titles=${encodeURIComponent(
        titles
      )}&format=json`;

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            "Api-User-Agent": DEFAULT_USER_AGENT,
          },
        });
        if (!res.ok) return {};
        const data = (await res.json()) as MediaWikiQueryResponse;
        const pages = (data?.query?.pages ?? {}) as Record<
          string,
          MediaWikiPageItem & { categoryinfo?: { files?: number } }
        >;

        for (const page of Object.values(pages)) {
          const catName = page.title?.replace(/^Category:/, "") ?? "";
          results[catName] = page.categoryinfo?.files ?? 0;
        }
      } catch (e) {
        console.error("[wikiRouter] getCategoryTotalCounts error:", e);
      }

      // Fill in zeros for any missing categories
      for (const cat of input.categories) {
        if (results[cat] === undefined) {
          results[cat] = 0;
        }
      }

      return results;
    }),

  /** Get subcategories of a category on a specific wiki. */
  getSubcategories: cachedPublicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(200).default(50),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      const url = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(
        input.category.replace(/ /g, "_")
      )}&cmnamespace=14&cmtype=subcat&cmlimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            "Api-User-Agent": DEFAULT_USER_AGENT,
          },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as MediaWikiQueryResponse;
        return ((data?.query?.categorymembers ?? []) as MediaWikiCategoryMemberItem[]).map((m) =>
          String(m.title).replace(/^Category:/, "")
        );
      } catch {
        return [];
      }
    }),

  /** Autocomplete categories by prefix on a specific wiki. */
  autocompleteCategories: cachedPublicProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().min(1).max(30).default(15),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);

      const url = `${baseUrl}?action=query&list=allcategories&acprefix=${encodeURIComponent(
        input.prefix
      )}&aclimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            "Api-User-Agent": DEFAULT_USER_AGENT,
          },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as MediaWikiQueryResponse;
        return ((data?.query?.allcategories ?? []) as MediaWikiAllCategoriesItem[]).map(
          (c) => (c.category ?? c["*"] ?? c.title ?? "") as string
        );
      } catch {
        return [];
      }
    }),
});
