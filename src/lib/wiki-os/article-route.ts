import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";

/** The views of one article, each its own route. */
export type ArticleTab = "read" | "edit" | "history" | "talk";

export interface ArticleRoute {
  /** The article's path segment, still percent-encoded as it appears in the URL. */
  slug: string;
  tab: ArticleTab;
}

const RESERVED_WIKI_SLUGS = new Set([
  "lorewards",
  "diff",
  "watchlist",
  "search",
  "random",
  "repository",
  "recent-changes",
  "categories",
  "whatlinkshere",
  "user",
  "history",
  "contributions",
  "utilities",
  "templates",
  "sandbox",
]);

function isToolSlug(rawSlug: string): boolean {
  const slug = safeDecodeURI(rawSlug);
  return RESERVED_WIKI_SLUGS.has(slug) || /^special:/i.test(slug);
}

/**
 * A path that is NOT an editable wiki article: the reserved /wiki/* tool routes, the Special: namespace, and
 * anything not under /wiki/<slug> (util, library and other routes). Article pages (/wiki/<Title> and their
 * /edit, /talk sub-routes) are NOT special, so the page tools render for them.
 */
export function isNonArticlePath(cleanPath: string): boolean {
  const wikiSlug = /^\/wiki\/([^/]+)/.exec(cleanPath)?.[1];
  return !wikiSlug || isToolSlug(wikiSlug);
}

/** Which article and which of its views a base-path-free pathname shows; null off the article routes. */
export function getArticleRoute(cleanPath: string): ArticleRoute | null {
  const history = /^\/util\/history\/([^/]+)\/?$/.exec(cleanPath);
  if (history) return { slug: history[1]!, tab: "history" };

  const wiki = /^\/wiki\/([^/]+)(?:\/(edit|talk))?\/?$/.exec(cleanPath);
  if (!wiki) return null;
  const slug = wiki[1]!;
  if (isToolSlug(slug) || slug === "Main_Page") return null;
  return { slug, tab: (wiki[2] as ArticleTab | undefined) ?? "read" };
}
