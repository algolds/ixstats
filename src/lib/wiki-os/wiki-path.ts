/**
 * wiki-path.ts — what a `/wiki/<path>?<query>` URL asks WikiOS for.
 *
 * WikiOS owns the existing `ixwiki.com/wiki/*` URLs, so every MediaWiki URL form has to land
 * somewhere sensible: subpages (`/wiki/A/B`), `?action=edit|history|info|raw`, `?oldid=`,
 * `?diff=`, `?redirect=no`, `Special:<Name>/<arg>` and the old WikiOS tool slugs
 * (`/wiki/recent-changes`, `/wiki/A/edit`, `/wiki/A/talk`). `resolveWikiPath` is pure: it parses the
 * URL into a `WikiPathTarget` and leaves everything that needs the database (does an article with
 * that title exist? which revision is "next"?) to the route.
 */

import { parseWikiSource, type WikiSource } from "./config";
import { talkPageOf } from "./core/talk";
import { canonicalizeTitle, decodeTitleParam, type CanonicalTitle } from "./core/title";
import { parseWikiTitle } from "./namespace-policy";

/** A parsed query string: `URLSearchParams`, or the `searchParams` object a Next page receives. */
export type SearchParamsLike =
  URLSearchParams | Readonly<Record<string, string | string[] | undefined>>;

/** The page-admin actions MediaWiki spells as `?action=`. */
export type PageAdminAction = "delete" | "protect" | "unprotect";

export type ArticleView =
  /** The article itself; `followRedirect` is false for `?redirect=no`. */
  | { type: "read"; followRedirect: boolean; redirectedFrom: string | null }
  | { type: "edit"; section: string | null; mode: "source" | "visual" }
  | { type: "history" }
  | { type: "info" }
  /** `?action=delete|protect|unprotect`: MediaWiki's page-admin actions, which are `/util` screens here (plan 409). */
  | { type: "admin"; action: PageAdminAction }
  /** `?oldid=<ref>`: one old revision. */
  | { type: "revision"; ref: string }
  /** `?diff=<ref|prev|next|cur>` with an optional `?oldid=<ref>`. */
  | { type: "diff"; oldid: string | null; diff: string };

/** What a `Special:` page turns into. */
export type SpecialAction =
  /** Continue at a WikiOS tool route. */
  | { type: "redirect"; href: string }
  | { type: "random" }
  | { type: "file-path"; file: string }
  | {
      type: "list-pages";
      mode: "allpages" | "prefix";
      prefix: string;
      namespace: number;
      from: string;
    }
  /** No such special page (or one this tree does not serve yet). */
  | { type: "unknown" };

/** What a title in the URL asks for: one view of its page, or its raw wikitext. */
export type TitleTarget =
  /** A title MediaWiki would refuse, or a revision reference that cannot be one. */
  | { kind: "invalid"; raw: string }
  | { kind: "article"; source: WikiSource; canon: CanonicalTitle; view: ArticleView }
  | { kind: "raw"; canon: CanonicalTitle; ref: string | null };

export type WikiPathTarget =
  | TitleTarget
  | { kind: "special"; name: string; action: SpecialAction }
  /**
   * An old WikiOS tool slug: go to `href` unless an article titled `canon.title` exists, in which
   * case the page is `ifArticle`: whatever the query string asks of that article (`?action=raw`,
   * `?oldid=`, ...) is honoured on the article before any tool redirect applies.
   */
  | { kind: "tool-redirect"; canon: CanonicalTitle; href: string; ifArticle: TitleTarget }
  /** An old `/<title>/edit` or `/<title>/talk` path: as `tool-redirect`, `href` unless an article titled `canon.title` exists. */
  | { kind: "legacy-redirect"; canon: CanonicalTitle; href: string; ifArticle: TitleTarget };

/** A redirect rule for an old URL, before the article it yields to is known. */
type LegacyRule = {
  kind: "tool-redirect" | "legacy-redirect";
  canon: CanonicalTitle;
  href: string;
};

const SPECIAL_PATH = /^special:([^/]*)(?:\/(.*))?$/i;
/** Revision references are MediaWiki rev_ids or WikiOS row ids (cuids): letters, digits, "_" and "-". */
const REVISION_REF = /^[A-Za-z0-9_-]{1,64}$/;
/** Namespace ids come from a query string: digits only. */
const NAMESPACE_ID = /^\d{1,5}$/;

/** The first value of the query parameter `key`, or null when it is absent. */
export function queryParam(query: SearchParamsLike, key: string): string | null {
  if (query instanceof URLSearchParams) return query.get(key);
  const value = query[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? null;
}

/** `path` with `params` as its query string (empty values left out). */
function withQuery(path: string, params: Record<string, string | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

/** Every pair of `query` as a plain record (first value of a repeated key). */
function paramsOf(query: SearchParamsLike): Record<string, string> {
  const pairs = query instanceof URLSearchParams ? Array.from(query.keys()) : Object.keys(query);
  const all: Record<string, string> = {};
  for (const key of pairs) all[key] = queryParam(query, key) ?? "";
  return all;
}

// ---------------------------------------------------------------------------
// Articles and their views
// ---------------------------------------------------------------------------

/** `?oldid=` / `?diff=` refs: null when absent, false when present but not a revision reference. */
function readRef(query: SearchParamsLike, key: string): string | null | false {
  const value = queryParam(query, key);
  if (value === null || value === "" || value === "0") return null;
  return REVISION_REF.test(value) ? value : false;
}

function readView(query: SearchParamsLike): ArticleView | null {
  const oldid = readRef(query, "oldid");
  const diffValue = queryParam(query, "diff");
  const diff = diffValue === "0" ? "cur" : diffValue || null;
  if (oldid === false || (diff !== null && !REVISION_REF.test(diff))) return null;

  if (diff !== null) return { type: "diff", oldid, diff };
  if (oldid !== null) return { type: "revision", ref: oldid };

  const redirectedFrom = canonicalizeTitle(queryParam(query, "rdfrom") ?? "")?.title ?? null;
  return { type: "read", followRedirect: queryParam(query, "redirect") !== "no", redirectedFrom };
}

/** The view an IxWiki page's query string asks for, or null for a malformed revision reference. */
function resolveView(query: SearchParamsLike): ArticleView | null {
  const action = queryParam(query, "action");
  const visualEdit = queryParam(query, "veaction") === "edit";
  if (action === "edit" || visualEdit) {
    const section = queryParam(query, "section");
    const visual = section === null && (visualEdit || queryParam(query, "mode") === "visual");
    return { type: "edit", section, mode: visual ? "visual" : "source" };
  }
  if (action === "history") return { type: "history" };
  if (action === "info") return { type: "info" };
  if (action === "delete" || action === "protect" || action === "unprotect") {
    return { type: "admin", action };
  }
  return readView(query);
}

// ---------------------------------------------------------------------------
// Old WikiOS URLs
// ---------------------------------------------------------------------------

/** Lower-case WikiOS tool slugs that used to be routes of their own (`/wiki/recent-changes`). */
const TOOL_PAGES: Readonly<Record<string, string>> = {
  categories: "/util/categories",
  "category-index": "/util/categories",
  "categories-index": "/util/categories",
  contributions: "/util/contributions",
  utilities: "/util",
  templates: "/util/templates",
  "template-palette": "/util/templates",
  diff: "/util/diff",
  "diff-viewer": "/util/diff",
  watchlist: "/util/watchlist",
  random: "/util/random",
  randompage: "/util/random",
  search: "/util/search",
  "recent-changes": "/util/recent-changes",
  recentchanges: "/util/recent-changes",
  repository: "/util/repository",
  whatlinkshere: "/util/whatlinkshere",
  "what-links-here": "/util/whatlinkshere",
  lorewards: "/util/lorewards",
  specialpages: "/util",
  "special-pages": "/util",
};

/** Tool slugs that took an argument: `/wiki/history/<title>` and friends. */
function toolArgumentHref(tool: string, rest: readonly string[]): string | null {
  const argument = rest.join("/");
  switch (tool) {
    case "categories":
      return `/util/categories/${rest.map(encodeURIComponent).join("/")}`;
    case "contributions":
      return `/util/contributions/${encodeURIComponent(argument)}`;
    case "history":
      return `/util/history/${encodeURIComponent(argument)}`;
    case "whatlinkshere":
      return `/util/whatlinkshere/${encodeURIComponent(argument)}`;
    case "user": {
      const user = canonicalizeTitle(`User:${argument}`);
      return user && `/wiki/${user.urlPath}`;
    }
    default:
      return null;
  }
}

function resolveToolRedirect(
  parts: readonly string[],
  canon: CanonicalTitle,
  query: SearchParamsLike
): LegacyRule | null {
  const first = parts[0] ?? "";
  const tool = first.replace(/[\s_]+/g, "-");
  if (tool !== tool.toLowerCase()) return null;

  const href =
    parts.length === 1 && Object.hasOwn(TOOL_PAGES, tool)
      ? TOOL_PAGES[tool]
      : parts.length > 1
        ? toolArgumentHref(tool, parts.slice(1))
        : null;
  return href ? { kind: "tool-redirect", canon, href: withQuery(href, paramsOf(query)) } : null;
}

/** `/wiki/<title>/edit` and `/wiki/<title>/talk`, which WikiOS used to serve as routes of their own. */
function resolveLegacySuffix(
  text: string,
  canon: CanonicalTitle,
  query: SearchParamsLike
): LegacyRule | null {
  const match = /^(.+)\/(edit|talk)$/.exec(text);
  const base = match && canonicalizeTitle(match[1] ?? "");
  if (!match || !base) return null;

  if (match[2] === "edit") {
    const href = withQuery(`/wiki/${base.urlPath}`, { ...paramsOf(query), action: "edit" });
    return { kind: "legacy-redirect", canon, href };
  }
  const talk = talkPageOf(base);
  return talk ? { kind: "legacy-redirect", canon, href: `/wiki/${talk.urlPath}` } : null;
}

// ---------------------------------------------------------------------------
// Special pages
// ---------------------------------------------------------------------------

const SPECIAL_TOOLS: Readonly<Record<string, string>> = {
  specialpages: "/util",
  utilities: "/util",
  recentchanges: "/util/recent-changes",
  watchlist: "/util/watchlist",
  categories: "/util/categories",
  categorytree: "/util/categories",
  templates: "/util/templates",
  listfiles: "/util/repository",
  upload: "/util/upload",
  export: "/util/export",
  import: "/util/import",
  blocklist: "/util/blocklist",
};

/** The page-admin screen for `canon` (`?action=delete|protect|unprotect`; unprotecting is a protection of level "none"). */
export function pageAdminHref(canon: CanonicalTitle, action: PageAdminAction): string {
  const path = action === "delete" ? "/util/delete" : "/util/protect";
  return withQuery(path, { title: canon.title });
}

/** "Recent_changes", "recent-changes" and "RecentChanges" are the same special page. */
function specialKey(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

function redirectTo(href: string): SpecialAction {
  return { type: "redirect", href };
}

/** `Special:Diff/<to>` and `Special:Diff/<from>/<to>`. */
function diffAction(argument: string, query: SearchParamsLike): SpecialAction {
  const refs = argument === "" ? [] : argument.split("/");
  if (refs.length > 2 || !refs.every((ref) => REVISION_REF.test(ref))) return { type: "unknown" };
  const [first, second] = refs;
  const params = { from: second ? (first ?? null) : null, to: second ?? first ?? null };
  return redirectTo(withQuery("/util/diff", { ...paramsOf(query), ...params }));
}

function searchAction(argument: string, query: SearchParamsLike): SpecialAction {
  const term = queryParam(query, "search") ?? queryParam(query, "q") ?? argument;
  return redirectTo(withQuery("/util/search", { q: term }));
}

/** `Special:AllPages[/<from>]`: every page of a namespace, starting at `from`. */
function allPagesAction(argument: string, query: SearchParamsLike): SpecialAction {
  const namespaceParam = queryParam(query, "namespace");
  const namespace =
    namespaceParam && NAMESPACE_ID.test(namespaceParam) ? Number(namespaceParam) : 0;
  const from = queryParam(query, "from") ?? argument;
  return {
    type: "list-pages",
    mode: "allpages",
    prefix: "",
    namespace,
    from: from.replace(/_/g, " "),
  };
}

/** `Special:PrefixIndex/<prefix>` (the prefix may carry a namespace: `Talk:Foo`): the pages whose title starts with it. */
function prefixIndexAction(argument: string, query: SearchParamsLike): SpecialAction {
  const text = queryParam(query, "prefix") ?? argument;
  const typed = parseWikiTitle(text);
  const namespaceParam = queryParam(query, "namespace");
  const namespace =
    namespaceParam && NAMESPACE_ID.test(namespaceParam)
      ? Number(namespaceParam)
      : (typed?.namespaceId ?? 0);
  const prefix = typed && typed.namespaceId !== 0 ? typed.base : text.replace(/_/g, " ");
  const from = (queryParam(query, "from") ?? "").replace(/_/g, " ");
  return { type: "list-pages", mode: "prefix", prefix, namespace, from };
}

/** `Special:Contributions/<user>`; MediaWiki user names have spaces, not underscores. */
function contributionsAction(argument: string): SpecialAction {
  const user = argument.replace(/_/g, " ").trim();
  return redirectTo(
    user ? `/util/contributions/${encodeURIComponent(user)}` : "/util/contributions"
  );
}

/** `Special:WhatLinksHere/<title>` and `Special:WhatLinksHere?target=<title>`. */
function whatLinksHereAction(argument: string, query: SearchParamsLike): SpecialAction {
  if (argument) return redirectTo(`/util/whatlinkshere/${encodeURIComponent(argument)}`);
  return redirectTo(withQuery("/util/whatlinkshere", { target: queryParam(query, "target") }));
}

/** A page-admin screen that takes a page: `Special:Move/<title>` is `/util/move?title=<title>`. */
function pageAdminSpecial(path: string): SpecialHandler {
  return (argument, query) => {
    const raw = argument || queryParam(query, "target") || queryParam(query, "title") || "";
    if (raw === "") return redirectTo(path);
    const canon = canonicalizeTitle(raw);
    return canon ? redirectTo(withQuery(path, { title: canon.title })) : { type: "unknown" };
  };
}

/** A page-admin screen that takes a user: `Special:Block/<user>` is `/util/block?user=<user>`. */
function userAdminSpecial(path: string): SpecialHandler {
  return (argument, query) => {
    const raw = argument || queryParam(query, "user") || queryParam(query, "wpTarget") || "";
    const user = raw
      .replace(/^user:/i, "")
      .replace(/_/g, " ")
      .trim();
    return redirectTo(withQuery(path, { user }));
  };
}

/** `Special:Log[/<type>]` with MediaWiki's `?type=`, `?page=` and `?user=`: `/util/log`. */
const logSpecial: SpecialHandler = (argument, query) =>
  redirectTo(
    withQuery("/util/log", {
      type: argument || queryParam(query, "type"),
      title: queryParam(query, "page") ?? queryParam(query, "title"),
      user: queryParam(query, "user"),
    })
  );

type SpecialHandler = (argument: string, query: SearchParamsLike) => SpecialAction;

/** The rights-model special pages (plan 409): each is a `/util` screen. */
const ADMIN_SPECIALS: Readonly<Record<string, SpecialHandler>> = {
  move: pageAdminSpecial("/util/move"),
  movepage: pageAdminSpecial("/util/move"),
  delete: pageAdminSpecial("/util/delete"),
  undelete: pageAdminSpecial("/util/undelete"),
  protect: pageAdminSpecial("/util/protect"),
  block: userAdminSpecial("/util/block"),
  userrights: userAdminSpecial("/util/userrights"),
  log: logSpecial,
};

function specialAction(key: string, argument: string, query: SearchParamsLike): SpecialAction {
  // Own keys only: "constructor" and "toString" are not special pages.
  const tool = Object.hasOwn(SPECIAL_TOOLS, key) ? SPECIAL_TOOLS[key] : undefined;
  const admin = Object.hasOwn(ADMIN_SPECIALS, key) ? ADMIN_SPECIALS[key] : undefined;
  if (key === "") return redirectTo("/util");
  if (tool) return redirectTo(withQuery(tool, paramsOf(query)));
  if (admin) return admin(argument, query);

  switch (key) {
    case "random":
    case "randompage":
      return { type: "random" };
    case "search":
      return searchAction(argument, query);
    case "diff":
      return diffAction(argument, query);
    case "contributions":
      return contributionsAction(argument);
    case "whatlinkshere":
      return whatLinksHereAction(argument, query);
    case "filepath": {
      const file = (queryParam(query, "file") ?? argument).replace(/^(?:file|image):/i, "").trim();
      return file ? { type: "file-path", file: file.replace(/_/g, " ") } : { type: "unknown" };
    }
    case "allpages":
      return allPagesAction(argument, query);
    case "prefixindex":
      return prefixIndexAction(argument, query);
    default:
      return { type: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/** What the query string asks of the IxWiki page `canon`: its raw wikitext or one view of it. */
function titleTarget(text: string, canon: CanonicalTitle, query: SearchParamsLike): TitleTarget {
  if (queryParam(query, "action") === "raw") {
    const ref = readRef(query, "oldid");
    return ref === false ? { kind: "invalid", raw: text } : { kind: "raw", canon, ref };
  }
  const view = resolveView(query);
  return view ? { kind: "article", source: "ixwiki", canon, view } : { kind: "invalid", raw: text };
}

function resolveIxWikiPath(
  text: string,
  parts: readonly string[],
  query: SearchParamsLike
): WikiPathTarget {
  const special = SPECIAL_PATH.exec(text);
  if (special) {
    const name = special[1] ?? "";
    return {
      kind: "special",
      name,
      action: specialAction(specialKey(name), special[2] ?? "", query),
    };
  }

  const canon = canonicalizeTitle(text);
  if (!canon) return { kind: "invalid", raw: text };

  const target = titleTarget(text, canon, query);
  const legacy =
    resolveLegacySuffix(text, canon, query) ?? resolveToolRedirect(parts, canon, query);
  return legacy ? { ...legacy, ifArticle: target } : target;
}

/**
 * The target of `/wiki/<segments>?<query>`. `segments` are the route's path segments as Next hands
 * them over (still percent-encoded): each is decoded exactly once and they are joined with "/", so
 * `/wiki/A/B` and `/wiki/A%2FB` are the same page. Another wiki's page (`?source=`) is only ever
 * read, under that wiki's own title rules.
 */
export function resolveWikiPath(
  segments: readonly string[],
  query: SearchParamsLike = {}
): WikiPathTarget {
  const parts = segments.map(decodeTitleParam);
  const text = parts.join("/");
  const source = parseWikiSource(queryParam(query, "source"));

  if (source !== "ixwiki") {
    const canon = canonicalizeTitle(text, { source });
    const view: ArticleView = { type: "read", followRedirect: true, redirectedFrom: null };
    return canon ? { kind: "article", source, canon, view } : { kind: "invalid", raw: text };
  }
  return resolveIxWikiPath(text, parts, query);
}

/** `/wiki/<title>` for `canon`, with `query` (empty values left out) and the section fragment, if any. */
export function articleHref(
  canon: CanonicalTitle,
  query: Record<string, string | null> = {}
): string {
  const hash = canon.fragment ? `#${encodeURIComponent(canon.fragment.replace(/ /g, "_"))}` : "";
  return `${withQuery(`/wiki/${canon.urlPath}`, query)}${hash}`;
}

/** `query` as a query string without the "?" (every value of a repeated key kept), leaving out the `omit` keys. */
export function queryStringOf(query: SearchParamsLike, omit: readonly string[] = []): string {
  const search = new URLSearchParams();
  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => {
      if (!omit.includes(key)) search.append(key, value);
    });
  } else {
    for (const [key, value] of Object.entries(query)) {
      if (omit.includes(key)) continue;
      for (const each of Array.isArray(value) ? value : [value]) {
        if (each !== undefined) search.append(key, each);
      }
    }
  }
  return search.toString();
}

/**
 * Where `/wiki/<segments>` really lives when the URL is not `canon`'s spelling (`/wiki/foo_bar` for
 * "Foo bar"), keeping the query string and carrying a section typed into the path (`Foo%23Bar`) as
 * the fragment; null when it already is. Segments are compared decoded, so `Portal%3AEurth` and
 * `Portal:Eurth` are both fine and nothing can loop.
 */
export function canonicalPathRedirect(
  segments: readonly string[],
  canon: CanonicalTitle,
  query: SearchParamsLike
): string | null {
  const requested = segments.map(decodeTitleParam).join("/");
  if (requested === canon.title.replace(/ /g, "_")) return null;
  const search = queryStringOf(query);
  const hash = canon.fragment ? `#${encodeURIComponent(canon.fragment.replace(/ /g, "_"))}` : "";
  return `/wiki/${canon.urlPath}${search ? `?${search}` : ""}${hash}`;
}

/** The targets of each kind, for the route's per-kind renderers. */
export type ArticleTarget = Extract<WikiPathTarget, { kind: "article" }>;
export type SpecialTarget = Extract<WikiPathTarget, { kind: "special" }>;
export type LegacyTarget = Extract<WikiPathTarget, { kind: "tool-redirect" | "legacy-redirect" }>;
export type ReadView = Extract<ArticleView, { type: "read" }>;
