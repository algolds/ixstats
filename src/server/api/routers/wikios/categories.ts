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
import { wikiSourceSchema } from "./_shared";

type CategoryMember = {
  pageid: number;
  title: string;
  type: "page" | "subcat" | "file";
  ns: number;
  isSubcategory: boolean;
  imageUrl?: string | null;
};

async function loadCategoryMembers(input: {
  category: string;
  limit: number;
  type?: "page" | "subcat" | "file";
}): Promise<{ members: CategoryMember[]; hasMore: boolean }> {
  // 1. Fast-path: Native PostgreSQL Category DAG
  const nativeDetails = await CategoryService.getCategoryDetails(input.category);
  if (
    nativeDetails.category &&
    (nativeDetails.articles.length > 0 || nativeDetails.subcategories.length > 0)
  ) {
    const members: CategoryMember[] = [];
    if (!input.type || input.type === "subcat") {
      for (const c of nativeDetails.subcategories) {
        members.push({
          pageid: 0,
          title: `Category:${c.name}`,
          type: "subcat",
          ns: 14,
          isSubcategory: true,
          imageUrl: null,
        });
      }
    }
    if (!input.type || input.type === "page") {
      for (const a of nativeDetails.articles) {
        members.push({
          pageid: 0,
          title: a.title,
          type: "page",
          ns: 0,
          isSubcategory: false,
          imageUrl: null,
        });
      }
    }
    return { members: members.slice(0, input.limit), hasMore: members.length > input.limit };
  }

  // 2. Resilient Bridge Fallback (MySQL IxWiki / HTTP Sister Wikis)
  const bridgeResult = await getCategoryMembers(input.category, input.limit, input.type);
  return {
    members: bridgeResult.members.map((m) => ({
      pageid: m.pageId ?? 0,
      title: m.title,
      type: (m.type ?? "page") as CategoryMember["type"],
      ns: m.ns ?? 0,
      isSubcategory: m.isSubcategory ?? false,
      imageUrl: null,
    })),
    hasMore: bridgeResult.hasMore ?? false,
  };
}

const spaced = (title: string) => title.replace(/_/g, " ");

function leadImageOf(art: { leadImageUrl: string | null; wikitext: string | null }) {
  const raw = art.leadImageUrl || (art.wikitext && extractLeadImageFromWikitext(art.wikitext));
  return raw ? normalizeWikiImageUrl(raw) || raw : null;
}

/** Batch lead-image resolution (local articles first, then MediaWiki thumbnails) for page members. */
async function attachMemberImages(members: CategoryMember[]) {
  const pageMembers = members.filter((m) => m.type === "page" || m.ns === 0);
  if (pageMembers.length === 0) return;

  const titles = pageMembers.map((m) => m.title);
  const imageMap = new Map<string, string>();
  const lookup = (title: string) =>
    imageMap.get(title) ?? imageMap.get(toArticleSlug(title)) ?? imageMap.get(spaced(title));

  try {
    const articles = await db.wikiArticle.findMany({
      where: {
        OR: [
          { title: { in: titles } },
          { title: { in: titles.map(spaced) } },
          { slug: { in: titles.map((t) => toArticleSlug(t)) } },
        ],
      },
      select: { title: true, slug: true, leadImageUrl: true, wikitext: true },
    });

    for (const art of articles) {
      const img = leadImageOf(art);
      if (img) {
        imageMap.set(art.title, img);
        imageMap.set(art.slug, img);
        imageMap.set(art.title.replace(/ /g, "_"), img);
      }
    }
  } catch {
    // Non-fatal
  }

  const missingTitles = titles.filter((t) => !lookup(t));
  if (missingTitles.length > 0) {
    try {
      for (const [title, url] of (await batchFetchThumbnails(missingTitles)).entries()) {
        const norm = normalizeWikiImageUrl(url) || url;
        imageMap.set(title, norm);
        imageMap.set(toArticleSlug(title), norm);
      }
    } catch {
      // Non-fatal
    }
  }

  for (const member of pageMembers) {
    member.imageUrl = lookup(member.title) ?? null;
  }
}

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
      const { members, hasMore } = await loadCategoryMembers(input);
      await attachMemberImages(members);
      return { members, continueToken: hasMore ? "more" : null };
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
   * Search wiki categories by prefix or letter.
   */
  searchCategories: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional().default(""),
        from: z.string().max(200).optional(),
        limit: z.number().min(1).max(100).default(30),
        wiki: wikiSourceSchema,
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
        wiki: wikiSourceSchema,
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
        wiki: wikiSourceSchema,
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
        wiki: wikiSourceSchema,
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
        wiki: wikiSourceSchema,
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
