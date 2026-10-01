/**
 * list-pages.ts — `list=allpages|categorymembers|backlinks|random|search|allcategories` (plan 410).
 *
 * These list pages (or categories), so most also run as generators. Continuation values are the
 * position of the first row of the next page.
 */

import { encodeCursor, optionalCursor, takePage } from "../continuation";
import { ApiError, missingOneOf } from "../errors";
import type { JsonObject } from "../format";
import { mwTimestamp } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import {
  baseOf,
  canonicalTitle,
  directionParam,
  namespaceParam,
  namespacesParam,
  pageItem,
  titleIn,
} from "./list-common";
import type { ListModule, ListResult } from "./query-list";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

const REDIRECT_FILTERS = ["all", "redirects", "nonredirects"] as const;
const DIRECTION_WORDS = ["asc", "desc", "ascending", "descending", "newer", "older"] as const;

/** A cursor with the page name written the way MediaWiki writes `apcontinue`: underscores. */
const underscored = (name: string) => name.replace(/ /g, "_");

// ---------------------------------------------------------------------------
// allpages
// ---------------------------------------------------------------------------

async function runAllPages(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const namespace = namespaceParam(p);
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["ascending", "descending"], "ascending");
  const fromBase = p.string("continue") ?? p.string("from");
  const toBase = p.string("to");
  const prefix = p.string("prefix");

  const rows = await rc.deps.store.listPages({
    namespace,
    start: fromBase ? titleIn(namespace, fromBase) : undefined,
    end: toBase ? titleIn(namespace, toBase) : undefined,
    prefix: prefix ? titleIn(namespace, prefix) : undefined,
    filterRedirects: p.oneOf("filterredir", REDIRECT_FILTERS, "all"),
    dir,
    limit,
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return { items: page.map(pageItem), next: next ? underscored(baseOf(next.title)) : null };
}

export const allPages: ListModule = { prefix: "ap", resultKey: "allpages", generator: true, run: runAllPages };

// ---------------------------------------------------------------------------
// categorymembers
// ---------------------------------------------------------------------------

const MEMBER_PROPS = ["ids", "title", "sortkey", "sortkeyprefix", "type", "timestamp"] as const;

const memberType = (namespace: number) => (namespace === 14 ? "subcat" : namespace === 6 ? "file" : "page");

async function categoryTitle(rc: ApiContext, p: ApiParams): Promise<string> {
  const title = p.string("title");
  const pageId = p.optionalInteger("pageid", 1);
  if (title === undefined && pageId === undefined) throw missingOneOf([p.fullName("title"), p.fullName("pageid")]);
  const resolved =
    pageId !== undefined
      ? (await rc.deps.store.pagesById([pageId]))[0]?.title
      : canonicalizeTitle(title ?? "")?.title;
  if (pageId !== undefined && !resolved) {
    throw new ApiError("nosuchpageid", `There is no page with ID ${pageId}.`);
  }
  const canon = resolved ? canonicalizeTitle(resolved) : null;
  if (!canon || canon.namespaceId !== 14) {
    throw new ApiError("invalidcategory", "The category name you entered is not valid.");
  }
  return canon.title;
}

async function runCategoryMembers(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const category = await categoryTitle(rc, p);
  const props = new Set(p.listOf("prop", MEMBER_PROPS, ["ids", "title"]));
  const types = p.listOf("type", ["page", "subcat", "file"] as const, ["page", "subcat", "file"]);
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const sort = p.oneOf("sort", ["sortkey", "timestamp"], "sortkey");
  const cursor = optionalCursor(p.raw("continue"), ["s", "n"] as const);

  const rows = await rc.deps.store.listCategoryMembers({
    category,
    namespaces: namespacesParam(p),
    types,
    sort,
    dir: directionParam(p, DIRECTION_WORDS, "ascending"),
    limit,
    cursor: cursor ? { sortValue: cursor[0], pageId: cursor[1] } : undefined,
    start: sort === "timestamp" ? p.timestamp("start", rc.now) : undefined,
    end: sort === "timestamp" ? p.timestamp("end", rc.now) : undefined,
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((row) => ({
      ...(props.has("ids") ? { pageid: row.pageId } : {}),
      ns: row.namespace,
      ...(props.has("title") ? { title: row.title } : {}),
      ...(props.has("sortkey") ? { sortkey: Buffer.from((row.sortKey ?? row.title).toUpperCase()).toString("hex") } : {}),
      ...(props.has("sortkeyprefix") ? { sortkeyprefix: row.sortKey ?? "" } : {}),
      ...(props.has("type") ? { type: memberType(row.namespace) } : {}),
      ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.addedAt) } : {}),
    })),
    next: next ? encodeCursor([next.sortValue, next.pageId]) : null,
  };
}

export const categoryMembers: ListModule = {
  prefix: "cm",
  resultKey: "categorymembers",
  generator: true,
  run: runCategoryMembers,
};

// ---------------------------------------------------------------------------
// backlinks
// ---------------------------------------------------------------------------

async function runBacklinks(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const target = p.has("title") ? canonicalTitle(p.required("title")) : null;
  if (!target) throw missingOneOf([p.fullName("title"), p.fullName("pageid")]);
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const cursor = optionalCursor(p.raw("continue"), ["n"] as const);
  const rows = await rc.deps.store.listBacklinks({
    target,
    namespaces: namespacesParam(p),
    filterRedirects: p.oneOf("filterredir", REDIRECT_FILTERS, "all"),
    limit,
    cursor: cursor?.[0],
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((row) => ({ ...pageItem(row), ...(row.isRedirect ? { redirect: true } : {}) })),
    next: next ? encodeCursor([next.pageId]) : null,
  };
}

export const backlinks: ListModule = { prefix: "bl", resultKey: "backlinks", generator: true, run: runBacklinks };

// ---------------------------------------------------------------------------
// random
// ---------------------------------------------------------------------------

async function runRandom(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const limit = p.limit("limit", { fallback: 1, high: rc.highLimits });
  const rows = await rc.deps.store.randomPages({
    namespaces: namespacesParam(p) ?? [0],
    filterRedirects: p.oneOf("filterredir", REDIRECT_FILTERS, "nonredirects"),
    limit,
  });
  // MediaWiki's random list names the page id `id`, not `pageid`.
  return { items: rows.map((row) => ({ id: row.pageId, ns: row.namespace, title: row.title })), next: null };
}

export const random: ListModule = { prefix: "rn", resultKey: "random", generator: true, run: runRandom };

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

const SEARCH_PROPS = ["size", "wordcount", "timestamp", "snippet", "titlesnippet", "redirecttitle", "sectiontitle", "isfilematch", "categorysnippet", "score", "hasrelated", "extensiondata"] as const;
const DEFAULT_SEARCH_PROPS = ["size", "wordcount", "timestamp", "snippet"] as const;

async function runSearch(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const query = p.required("search");
  const props = new Set(p.listOf("prop", SEARCH_PROPS, DEFAULT_SEARCH_PROPS));
  const what = p.oneOf("what", ["text", "title", "nearmatch"], "text") === "text" ? "text" : "title";
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const offset = p.integer("offset", { fallback: 0, min: 0 });
  const namespaces = namespacesParam(p) ?? [0];
  if (namespaces.some((namespace) => namespace !== 0)) {
    p.addWarning("WikiOS searches the main namespace only; other namespaces are ignored.");
  }

  const { hits, total } = await rc.deps.search(query, what, limit, offset);
  const pages = await rc.deps.store.pagesByTitle(hits.map((hit) => hit.title));
  const byTitle = new Map(pages.map((row) => [row.title, row]));
  const items: JsonObject[] = hits.flatMap((hit) => {
    const row = byTitle.get(hit.title);
    if (!row) return [];
    return [
      {
        ns: row.namespace,
        title: row.title,
        pageid: row.pageId,
        ...(props.has("size") ? { size: row.length } : {}),
        ...(props.has("wordcount") ? { wordcount: row.wordCount } : {}),
        ...(props.has("snippet") ? { snippet: hit.snippet } : {}),
        ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.touched) } : {}),
      },
    ];
  });
  const info = new Set(p.listOf("info", ["totalhits", "suggestion", "rewrittenquery"] as const, ["totalhits", "suggestion"]));
  return {
    items,
    // A full page may be followed by more; the next request answers none and ends it if not.
    next: hits.length === limit ? String(offset + limit) : null,
    extra: info.has("totalhits") ? { searchinfo: { totalhits: Math.max(total, offset + hits.length) } } : undefined,
  };
}

export const search: ListModule = {
  prefix: "sr",
  resultKey: "search",
  generator: true,
  // MediaWiki continues a search with `sroffset`, which the module reads as its own parameter.
  continueParam: "offset",
  run: runSearch,
};

// ---------------------------------------------------------------------------
// allcategories
// ---------------------------------------------------------------------------

async function runAllCategories(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set(p.listOf("prop", ["size", "hidden"] as const));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["ascending", "descending"], "ascending");
  const from = p.string("continue") ?? p.string("from");
  const rows = await rc.deps.store.listCategories({
    start: from?.replace(/_/g, " "),
    end: p.string("to")?.replace(/_/g, " "),
    prefix: p.string("prefix")?.replace(/_/g, " "),
    dir,
    limit,
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((row) => ({
      ...(rc.version === 1 ? { "*": row.name } : { category: row.name }),
      ...(props.has("size") ? { size: row.members, pages: row.members, files: 0, subcats: 0 } : {}),
      ...(props.has("hidden") ? { hidden: false } : {}),
    })),
    next: next ? underscored(next.name) : null,
  };
}

export const allCategories: ListModule = {
  prefix: "ac",
  resultKey: "allcategories",
  generator: false,
  run: runAllCategories,
};
