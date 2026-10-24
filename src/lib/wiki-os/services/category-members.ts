/**
 * category-members.ts — the pages, subcategories and files of a category, for the category router and for server
 * modules that list a category (a country's lore pieces). The native PostgreSQL category DAG first, then the bridge.
 */

import { getCategoryMembers } from "../adapters/mediawiki/bridge";
import { CategoryService } from "../core/category-service";

export type CategoryListMember = {
  pageid: number;
  title: string;
  type: "page" | "subcat" | "file";
  ns: number;
  isSubcategory: boolean;
  imageUrl?: string | null;
};

export async function loadCategoryMembers(input: {
  category: string;
  limit: number;
  type?: "page" | "subcat" | "file";
}): Promise<{ members: CategoryListMember[]; hasMore: boolean }> {
  // 1. Fast-path: Native PostgreSQL Category DAG
  const nativeDetails = await CategoryService.getCategoryDetails(input.category);
  if (
    nativeDetails.category &&
    (nativeDetails.articles.length > 0 || nativeDetails.subcategories.length > 0)
  ) {
    const members: CategoryListMember[] = [];
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
      type: (m.type ?? "page") as CategoryListMember["type"],
      ns: m.ns ?? 0,
      isSubcategory: m.isSubcategory ?? false,
      imageUrl: null,
    })),
    hasMore: bridgeResult.hasMore ?? false,
  };
}
