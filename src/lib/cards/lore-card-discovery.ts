/**
 * Finding pages to import: category search and counts, category members, every main-namespace page, and random
 * image-bearing pages. IxWiki's come from Postgres once WikiOS v1 is on (v1-switch.ts); a sister wiki's from its
 * MediaWiki API with the IxStats-Builder user agent (mwQuery).
 */
import type { MediaWikiAllCategoriesItem } from "~/lib/wiki-os/types";
import { withoutArchivedTitles } from "~/lib/wiki-os/core/archived-titles";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import type { WikiSource } from "~/lib/wiki-os/config";
import { mwQuery, type MwPage } from "./lore-card-mediawiki";
import {
  ixwikiCategoryTitles,
  ixwikiMainNamespaceTitles,
  ixwikiRandomTitles,
} from "./lore-card-ixwiki";

/** IxWiki card data: from Postgres once WikiOS v1 is on, from MediaWiki before it. */
export const readsPostgres = (wikiSource: WikiSource) =>
  wikiSource === "ixwiki" && isWikiosV1Enabled();

export interface CategoryCounts {
  size: number;
  pages: number;
  files: number;
  subcats: number;
}

/** Page titles from a paged `list=` query, up to `limit`. */
async function listAll(
  wikiSource: WikiSource,
  params: Record<string, string>,
  listKey: string,
  continueKey: string,
  limit: number
): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    try {
      const res = await mwQuery(
        wikiSource,
        { ...params, ...(cont && { [continueKey]: cont }) },
        12000
      );
      if (!res.ok) {
        console.error(`[Lore Card Discovery] ${params.list} error: ${res.status}`);
        break;
      }
      const data = (await res.json()) as {
        query?: Record<string, Array<{ title?: string }>>;
        continue?: Record<string, string>;
      };
      for (const member of data.query?.[listKey] ?? []) {
        if (member.title) titles.push(member.title);
      }
      cont = data.continue?.[continueKey];
    } catch (error) {
      console.error(`[Lore Card Discovery] ${params.list} fetch failed:`, error);
      break;
    }
  } while (cont && titles.length < limit);
  return withoutArchivedTitles(titles.slice(0, limit), wikiSource);
}

/** Page titles (and, when asked, files) in a live wiki category. */
function fetchCategoryMembers(
  category: string,
  wikiSource: WikiSource,
  limit = 10000,
  type: "page" | "file" | "page|file" = "page"
): Promise<string[]> {
  if (readsPostgres(wikiSource)) {
    const kinds: Array<"page" | "file"> = type === "page|file" ? ["page", "file"] : [type];
    return ixwikiCategoryTitles(category, kinds, limit);
  }
  const cmtitle = category.startsWith("Category:") ? category : `Category:${category}`;
  return listAll(
    wikiSource,
    { list: "categorymembers", cmtitle, cmtype: type, cmlimit: "500" },
    "categorymembers",
    "cmcontinue",
    limit
  );
}

/** Every main-namespace page that is not a redirect. */
function fetchAllMainNamespacePages(wikiSource: WikiSource, limit = 10000): Promise<string[]> {
  if (readsPostgres(wikiSource)) return ixwikiMainNamespaceTitles(limit);
  return listAll(
    wikiSource,
    { list: "allpages", apnamespace: "0", apfilterredir: "nonredirects", aplimit: "500" },
    "allpages",
    "apcontinue",
    limit
  );
}

/** Category names starting with `prefix`, for the importer's category picker. */
async function searchCategories(
  prefix: string,
  wikiSource: WikiSource,
  limit = 20
): Promise<string[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  if (readsPostgres(wikiSource)) return CategoryService.autocomplete(prefix, capped);
  try {
    const res = await mwQuery(
      wikiSource,
      { list: "allcategories", acprefix: prefix, aclimit: String(capped) },
      8000
    );
    if (!res.ok) {
      console.error(`[Lore Card Discovery] allcategories error: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      query?: { allcategories?: MediaWikiAllCategoriesItem[] };
    };
    return (data.query?.allcategories ?? []).map((c) => c["*"] || c.title || "");
  } catch (error) {
    console.error("[Lore Card Discovery] allcategories fetch failed:", error);
    return [];
  }
}

/** Page, file and subcategory counts of up to 50 categories, keyed with and without "Category:". */
async function getCategoriesInfo(
  categories: string[],
  wikiSource: WikiSource
): Promise<Record<string, CategoryCounts>> {
  const result: Record<string, CategoryCounts> = {};
  if (readsPostgres(wikiSource)) {
    const names = categories.map((c) => c.replace(/^Category:\s*/i, "")).slice(0, 50);
    for (const [name, { pages, files, subcats }] of await CategoryService.getCounts(names)) {
      const counts = { size: pages + files + subcats, pages, files, subcats };
      result[name] = result[`Category:${name}`] = counts;
    }
    return result;
  }
  const titles = categories
    .map((c) => (c.startsWith("Category:") ? c : `Category:${c}`))
    .slice(0, 50);
  if (titles.length === 0) return result;
  try {
    const res = await mwQuery(
      wikiSource,
      { prop: "categoryinfo", titles: titles.join("|") },
      10000
    );
    if (!res.ok) return result;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; categoryinfo?: CategoryCounts }> };
    };
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (!page.categoryinfo || !page.title) continue;
      result[page.title.replace(/^Category:\s*/i, "")] = page.categoryinfo;
      result[page.title] = page.categoryinfo;
    }
  } catch (error) {
    console.warn("[Lore Card Discovery] getCategoriesInfo failed:", error);
  }
  return result;
}

/**
 * Random articles that have a page image. One request: `generator=random` with `prop=pageimages`, over-fetching
 * to cover pages without one (a per-article image check tripped the wiki's rate limit).
 */
async function fetchRandomArticlesWithImages(
  count: number,
  wikiSource: WikiSource
): Promise<string[]> {
  if (readsPostgres(wikiSource)) return ixwikiRandomTitles(count);
  try {
    const res = await mwQuery(wikiSource, {
      generator: "random",
      grnnamespace: "0",
      grnlimit: String(Math.min(count * 3, 50)),
      prop: "pageimages",
      piprop: "original",
      pilimit: "max",
    });
    if (!res.ok) {
      console.error(`[Lore Card Discovery] random articles error: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { query?: { pages?: Record<string, MwPage> } };
    const titles = Object.values(data.query?.pages ?? {})
      .filter((page) => page.original?.source)
      .map((page) => page.title);
    return withoutArchivedTitles(titles.slice(0, count), wikiSource);
  } catch (error) {
    console.error("[Lore Card Discovery] random articles fetch failed:", error);
    return [];
  }
}

export const loreCardDiscovery = {
  fetchCategoryMembers,
  fetchAllMainNamespacePages,
  searchCategories,
  getCategoriesInfo,
  fetchRandomArticlesWithImages,
};
