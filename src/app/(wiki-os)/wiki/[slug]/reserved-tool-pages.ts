import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";

// Article slugs that are really WikiOS tool routes; the reader redirects them to the tool.
export const RESERVED_TOOL_PAGES: Record<string, string> = {
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

const SPECIAL_PAGE_ROUTES = new Map([
  ["specialpages", "/util"],
  ["utilities", "/util"],
  ["recentchanges", "/util/recent-changes"],
  ["recent-changes", "/util/recent-changes"],
  ["watchlist", "/util/watchlist"],
  ["random", "/util/random"],
  ["randompage", "/util/random"],
  ["categories", "/util/categories"],
  ["categorytree", "/util/categories"],
  ["search", "/util/search"],
  ["templates", "/util/templates"],
  ["diff", "/util/diff"],
]);

const withOptionalSubpage = (base: string, subpage: string) =>
  subpage ? `${base}/${encodeURIComponent(subpage)}` : base;

/**
 * Where a title that is really a tool, category, user profile or Special: page should
 * go instead of the article reader; null for ordinary articles.
 */
export function redirectTarget(title: string, reservedPath: string | null): string | null {
  if (reservedPath) return reservedPath;

  if (title.startsWith("Category:")) {
    return `/wiki/categories/${encodeURIComponent(title.slice("Category:".length).replace(/ /g, "_"))}`;
  }
  if (title.startsWith("User:") || title.startsWith("User_talk:")) {
    const userName = title.replace(/^User(_talk)?:/i, "").trim();
    return getWikiProfilePath(userName.replace(/_/g, " "));
  }
  if (!/^Special:/i.test(title)) return null;

  const spec = title.replace(/^Special:/i, "").trim();
  const subpageRoute = /^(contributions|whatlinkshere)\/?/i.exec(spec);
  if (subpageRoute) {
    const subpage = spec.slice(subpageRoute[0].length).trim();
    return withOptionalSubpage(`/util/${subpageRoute[1]!.toLowerCase()}`, subpage);
  }
  return SPECIAL_PAGE_ROUTES.get(spec.toLowerCase()) ?? "/util";
}
