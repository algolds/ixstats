/**
 * categories.ts — WikiOS Category DAG & Taxonomy Router
 *
 * Provides endpoints for category members, parent categories, category tree,
 * category search, subcategories, and category auto-completion.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  getCategoryMembers,
  getParentCategories,
  getCategoryInfo,
  batchFetchThumbnails,
  type WikiSource,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import {
  extractLeadImageFromWikitext,
  normalizeWikiImageUrl,
} from "~/lib/wiki-os/transformers/image-url";

export const wikiosCategoriesRouter = createTRPCRouter({
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
      if (
        nativeDetails.category &&
        (nativeDetails.articles.length > 0 || nativeDetails.subcategories.length > 0)
      ) {
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
          (t) =>
            !imageMap.has(t) &&
            !imageMap.has(toArticleSlug(t)) &&
            !imageMap.has(t.replace(/_/g, " "))
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

  /**
   * Get parent categories of a page.
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

        const whereCat: {
          OR?: Array<{
            name?: { contains: string; mode: "insensitive" };
            slug?: { contains: string; mode: "insensitive" };
          }>;
          name?: { gte: string; mode: "insensitive" };
        } = {};
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
          console.error("[wikiosCategories] Failed to fetch ixwiki categories from DB:", err);
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
});
