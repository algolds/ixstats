/**
 * pg-taxonomy.ts — ixwiki backlinks and category membership.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { LinkGraphService, CategoryService } from "~/lib/wiki-os/core";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { warnDev, type WikiCategoryMembers } from "./types";

export async function ixwikiGetBacklinks(
  title: string,
  limit: number = 50,
  _offset?: number
): Promise<
  Array<{
    page_title: string;
    page_namespace: number;
    page_is_redirect: number;
    page_len: number;
    page_latest: number;
  }>
> {
  try {
    const backlinks = await LinkGraphService.getBacklinks(title, "ixwiki", limit);
    return backlinks.map((l) => ({
      page_title: l.title,
      page_namespace: 0,
      page_is_redirect: 0,
      page_len: 0,
      page_latest: 0,
    }));
  } catch {
    return [];
  }
}

export async function ixwikiGetCategoryMembers(
  category: string,
  limit: number = 50,
  type?: "page" | "subcat" | "file"
): Promise<WikiCategoryMembers> {
  const cleanCat = category.replace(/^Category:/i, "");
  const result: WikiCategoryMembers = {
    category: cleanCat,
    pages: [],
    subcategories: [],
    files: [],
    hasMore: false,
  };

  try {
    const members = await CategoryService.getCategoryMembers(cleanCat, limit);
    for (const m of members) {
      if (m.type === "subcat" && (!type || type === "subcat")) {
        result.subcategories.push(m.title.replace(/^Category:/i, ""));
      } else if (m.type === "file" && (!type || type === "file")) {
        result.files.push(m.title.replace(/^File:/i, ""));
      } else if ((!type || type === "page") && m.type === "page") {
        result.pages.push({ title: m.title, ns: 0 });
      }
    }
  } catch (err) {
    warnDev(err);
  }

  return result;
}

export async function ixwikiGetParentCategories(title: string): Promise<string[]> {
  try {
    const members: any[] = await (db as any).wikiCategoryMember.findMany({
      where: {
        article: {
          source: "ixwiki",
          OR: [{ title }, { slug: toArticleSlug(title) }],
        },
      },
      include: {
        category: { select: { name: true } },
      },
    });
    return members.map((m) => m.category?.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function ixwikiGetCategoryInfo(category: string): Promise<{
  title: string;
  totalPages: number;
  totalSubcats: number;
  totalFiles: number;
  subcategories: string[];
}> {
  const cleanCat = category.replace(/^Category:/i, "").trim();
  try {
    const details = await CategoryService.getCategoryDetails(cleanCat, "ixwiki");
    const subcategories = details.subcategories.map((s) => s.name);

    return {
      title: cleanCat,
      totalPages: details.articles.length,
      totalSubcats: details.subcategories.length,
      totalFiles: 0,
      subcategories,
    };
  } catch (err) {
    warnDev(err);
    return {
      title: cleanCat,
      totalPages: 0,
      totalSubcats: 0,
      totalFiles: 0,
      subcategories: [],
    };
  }
}
