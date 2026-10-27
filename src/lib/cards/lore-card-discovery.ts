/**
 * Finding pages to import: category search and counts, category members (a Commons category's files too), every
 * main-namespace page, and random image-bearing pages. IxWiki's come from Postgres once WikiOS v1 is on
 * (v1-switch.ts); another wiki's from its MediaWiki API with the IxStats-Builder user agent (mwQuery).
 */
import type { MediaWikiAllCategoriesItem } from "~/lib/wiki-os/types";
import { withoutArchivedTitles } from "~/lib/wiki-os/core/archived-titles";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import type { WikiSource } from "~/lib/wiki-os/config";
import type { Pace } from "~/lib/realms/sources/wiki-discovery-client";
import type { CardWikiSource } from "./card-sources";
import { mwJson, mwQuery, type MwError } from "./lore-card-mediawiki";
import {
  ixwikiCategoryTitles,
  ixwikiMainNamespaceTitles,
  ixwikiRandomTitles,
} from "./lore-card-ixwiki";

/** IxWiki card data: from Postgres once WikiOS v1 is on, from MediaWiki before it. */
export const readsPostgres = (wikiSource: CardWikiSource) =>
  wikiSource === "ixwiki" && isWikiosV1Enabled();

export interface CategoryCounts {
  size: number;
  pages: number;
  files: number;
  subcats: number;
}

/** The titles a list read, and whether the wiki holds more than it read. */
export interface TitleList {
  titles: string[];
  /** The list was cut: by its limit, by its time running out, or with the wiki's answer still continuing. */
  truncated: boolean;
}

/** How far a list reads: at most `limit` titles, no page asked for after `deadline`, each request in `pace`'s turn. */
export interface ListReach {
  limit: number;
  /** A `Date.now()` time. */
  deadline: number;
  pace: Pace;
}

/** One page of a `list=` query's answer. */
interface ListPage extends MwError {
  query?: Record<string, Array<{ title?: string }>>;
  continue?: Record<string, string>;
}

/** The titles cut to the limit, with the pages WikiOS deleted left out first, so `truncated` holds. */
async function cutList(
  wikiSource: CardWikiSource,
  titles: string[],
  limit: number,
  more: boolean
): Promise<TitleList> {
  const kept = await withoutArchivedTitles(titles, wikiSource);
  return { titles: kept.slice(0, limit), truncated: more || kept.length > limit };
}

/**
 * Titles from a paged `list=` query, as far as `reach` goes. Every page is read through mwJson in the pace's turn, so
 * a wiki that refuses throws DiscoveryStopped and a failed page throws, rather than the list coming back empty or
 * cut short. Running out of time is not a failure: what was read comes back, truncated.
 */
async function listAll(
  wikiSource: CardWikiSource,
  params: Record<string, string>,
  listKey: string,
  continueKey: string,
  reach: ListReach
): Promise<TitleList> {
  const titles: string[] = [];
  let cont: string | undefined;
  let more = true;
  while (more && titles.length < reach.limit) {
    if (Date.now() >= reach.deadline) return cutList(wikiSource, titles, reach.limit, true);
    const asked = { ...params, ...(cont && { [continueKey]: cont }) };
    const data = await reach.pace(async () =>
      mwJson<ListPage>(await mwQuery(wikiSource, asked, 12000), wikiSource)
    );
    for (const member of data.query?.[listKey] ?? []) {
      if (member.title) titles.push(member.title);
    }
    cont = data.continue?.[continueKey];
    more = cont !== undefined;
  }
  return cutList(wikiSource, titles, reach.limit, more);
}

/** A Postgres list asked for one title past the limit, so a cut list says so. */
async function postgresList(
  read: (limit: number) => Promise<string[]>,
  limit: number
): Promise<TitleList> {
  const titles = await read(limit + 1);
  return { titles: titles.slice(0, limit), truncated: titles.length > limit };
}

/**
 * A live category's articles (namespace 0), or a Commons category's files. Subcategories never count. Another
 * wiki's failed read throws (listAll).
 */
function fetchCategoryMembers(
  category: string,
  wikiSource: CardWikiSource,
  reach: ListReach
): Promise<TitleList> {
  if (readsPostgres(wikiSource)) {
    return postgresList((limit) => ixwikiCategoryTitles(category, limit), reach.limit);
  }
  const cmtitle = /^category:/i.test(category) ? category : `Category:${category}`;
  const members: Record<string, string> =
    wikiSource === "commons" ? { cmtype: "file" } : { cmtype: "page", cmnamespace: "0" };
  return listAll(
    wikiSource,
    { list: "categorymembers", cmtitle, cmlimit: "500", ...members },
    "categorymembers",
    "cmcontinue",
    reach
  );
}

/** Every main-namespace page that is not a redirect; another wiki's failed read throws (listAll). */
function fetchAllMainNamespacePages(wikiSource: WikiSource, reach: ListReach): Promise<TitleList> {
  if (readsPostgres(wikiSource)) return postgresList(ixwikiMainNamespaceTitles, reach.limit);
  return listAll(
    wikiSource,
    { list: "allpages", apnamespace: "0", apfilterredir: "nonredirects", aplimit: "500" },
    "allpages",
    "apcontinue",
    reach
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
 * Random articles that have a page image (the daily import's draw). One request: `generator=random` with
 * `prop=pageimages`, over-fetching to cover pages without one (a per-article image check tripped the wiki's rate
 * limit). A sister wiki's answer is read through mwJson: a refusal throws DiscoveryStopped and any other failed read
 * throws, so the daily import reports the wiki instead of drawing nothing.
 */
async function fetchRandomArticlesWithImages(
  count: number,
  wikiSource: WikiSource
): Promise<string[]> {
  if (readsPostgres(wikiSource)) return ixwikiRandomTitles(count);
  const response = await mwQuery(
    wikiSource,
    {
      generator: "random",
      grnnamespace: "0",
      grnlimit: String(Math.min(count * 3, 50)),
      prop: "pageimages",
      piprop: "original",
      pilimit: "max",
    },
    12000
  );
  const data = await mwJson(response, wikiSource);
  const titles = Object.values(data.query?.pages ?? {})
    .filter((page) => page.original?.source)
    .map((page) => page.title);
  return withoutArchivedTitles(titles.slice(0, count), wikiSource);
}

export const loreCardDiscovery = {
  fetchCategoryMembers,
  fetchAllMainNamespacePages,
  searchCategories,
  getCategoriesInfo,
  fetchRandomArticlesWithImages,
};
