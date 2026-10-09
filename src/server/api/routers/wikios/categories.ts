/**
 * categories.ts — WikiOS Category DAG & Taxonomy Router
 *
 * Provides endpoints for category members, parent categories, category tree,
 * category search, subcategories, and category auto-completion.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, createRateLimitMiddleware } from "~/server/api/trpc";
import {
  getCategoryMembers,
  getParentCategories,
  batchFetchThumbnails,
  type WikiSource,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import {
  extractLeadImagePath,
  normalizeWikiImageUrl,
  resolveStoredImageUrl,
} from "~/lib/wiki-os/transformers/image-url";
import { getMediaWikiApiUrl, DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";
import { wikiSourceSchema } from "./_shared";

/** Category lists and counts are read-mostly and, for a sister wiki, cost an outbound call: one shared bucket. */
const sisterWikiProcedure = publicProcedure.use(
  createRateLimitMiddleware({ max: 120, windowMs: 60_000, namespace: "sisterwiki" })
);

/** A sister wiki's answers are reused for 5 minutes. */
const SISTER_CACHE_TTL_MS = 300_000;

const sisterJson = <T>(url: string) =>
  fetchMediaWikiJson<T>(url, { userAgent: DEFAULT_USER_AGENT, cacheTtlMs: SISTER_CACHE_TTL_MS });

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

  // 2. Resilient Bridge Fallback (PostgreSQL for IxWiki / HTTP for the sister wikis)
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
  return resolveStoredImageUrl(art.leadImageUrl || extractLeadImagePath(art.wikitext));
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
        status: "PUBLISHED",
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
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      const categories = await getParentCategories(input.title);
      return { categories };
    }),

  /**
   * Search wiki categories by prefix or letter.
   */
  searchCategories: sisterWikiProcedure
    .input(
      z.object({
        query: z.string().max(200).optional().default(""),
        from: z.string().max(200).optional(),
        limit: z.number().min(1).max(100).default(30),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      // IxWiki's categories are Postgres's: a category MediaWiki hides (the maintenance and tracking
      // ones) is not listed, and the counts tell pages, subcategories and files apart.
      if (input.wiki === "ixwiki") {
        const found = await CategoryService.search({
          query: input.query.trim(),
          from: (input.from ?? "").trim(),
          limit: input.limit,
        });
        return found.map((cat) => ({
          name: cat.name,
          title: `Category:${cat.name}`,
          size: cat.pages + cat.subcats + cat.files,
          pages: cat.pages,
          files: cat.files,
          subcats: cat.subcats,
        }));
      }

      // A sister wiki's categories are read from that wiki.
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

      const data = await sisterJson<{
        query?: {
          allcategories?: Array<{
            "*": string;
            size?: number;
            pages?: number;
            files?: number;
            subcats?: number;
          }>;
        };
      }>(`${baseUrl}?${params.toString()}`);

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
  getCategories: sisterWikiProcedure
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
            where: { hidden: false },
            take: input.limit,
            orderBy: { members: { _count: "desc" } },
          });
          // "fileCount" is files, not every published member: count the namespace-6 members.
          const names = (categories || []).map((c) => String(c.name || "").replace(/_/g, " "));
          const counts = await CategoryService.getCounts(names);
          return names
            .map((name) => ({ name, fileCount: counts.get(name)?.files ?? 0 }))
            .filter((cat) => cat.fileCount > 0)
            .sort((a, b) => b.fileCount - a.fileCount);
        } catch (err) {
          console.error("[wikiosCategories] Failed to fetch ixwiki categories from DB:", err);
          return [];
        }
      } else {
        const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
        const url = `${baseUrl}?action=query&list=allcategories&acmin=1&aclimit=${input.limit}&acprop=size&format=json`;
        const data = await sisterJson<{
          query?: { allcategories?: Array<{ "*": string; files: number }> };
        }>(url);
        return (data.query?.allcategories ?? [])
          .filter((cat) => (cat.files ?? 0) > 0)
          .map((cat) => ({ name: cat["*"], fileCount: cat.files }));
      }
    }),

  /**
   * Get total file counts for a list of categories.
   */
  getCategoryTotalCounts: sisterWikiProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(25),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      if (input.wiki === "ixwiki") {
        const counts = await CategoryService.getCounts(input.categories);
        return Object.fromEntries(
          input.categories.map((cat) => [cat, counts.get(cat)?.files ?? 0])
        );
      }

      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const titles = input.categories.map((c) => `Category:${c.replace(/ /g, "_")}`).join("|");
      const data = await sisterJson<{
        query?: {
          normalized?: Array<{ from: string; to: string }>;
          pages?: Record<string, { title: string; categoryinfo?: { files?: number } }>;
        };
      }>(
        `${baseUrl}?action=query&prop=categoryinfo&titles=${encodeURIComponent(titles)}&format=json`
      );

      // The wiki answers under its normalized titles ("Category:Flag images"): map each back to the name asked.
      const normalizedTo = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]));
      const filesByTitle = new Map<string, number>();
      for (const page of Object.values(data.query?.pages ?? {})) {
        filesByTitle.set(spaced(page.title ?? ""), page.categoryinfo?.files ?? 0);
      }

      // A category the wiki did not answer for is left out: the client reads a missing key as "no count".
      const results: Record<string, number> = {};
      for (const cat of input.categories) {
        const asked = `Category:${cat.replace(/ /g, "_")}`;
        const count = filesByTitle.get(spaced(normalizedTo.get(asked) ?? asked));
        if (count !== undefined) results[cat] = count;
      }
      return results;
    }),

  /**
   * Get subcategories of a category.
   */
  getSubcategories: sisterWikiProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(200).default(50),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      if (input.wiki === "ixwiki") {
        const titles = await CategoryService.getMemberTitles(
          input.category,
          ["subcat"],
          input.limit
        );
        return titles.map((title) => title.replace(/^Category:/, ""));
      }

      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const data = await sisterJson<{ query?: { categorymembers?: Array<{ title: string }> } }>(
        `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(
          input.category.replace(/ /g, "_")
        )}&cmnamespace=14&cmtype=subcat&cmlimit=${input.limit}&format=json`
      );
      return (data.query?.categorymembers ?? []).map((m) =>
        String(m.title).replace(/^Category:/, "")
      );
    }),

  /**
   * Autocomplete categories by prefix.
   */
  autocompleteCategories: sisterWikiProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().min(1).max(30).default(15),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      if (input.wiki === "ixwiki") return CategoryService.autocomplete(input.prefix, input.limit);

      const baseUrl = getMediaWikiApiUrl(input.wiki as WikiSource);
      const data = await sisterJson<{ query?: { allcategories?: Array<{ "*": string }> } }>(
        `${baseUrl}?action=query&list=allcategories&acprefix=${encodeURIComponent(
          input.prefix
        )}&aclimit=${input.limit}&format=json`
      );
      return (data.query?.allcategories ?? []).map((c) => c["*"]);
    }),
});
