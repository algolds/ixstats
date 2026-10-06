import { isTalkNamespace, subjectPageOf, talkPageOf } from "~/lib/wiki-os/core/talk";
import { canonicalizeTitle, decodeTitleParam, type CanonicalTitle } from "~/lib/wiki-os/core/title";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { articleHref } from "~/lib/wiki-os/wiki-path";

/** The views of one page: MediaWiki's URL forms, which the `/wiki/[...slug]` route serves (plan 412). */
export type ArticleTab = "read" | "edit" | "history" | "talk";

/** A view the page itself knows it shows (the route's `?action=`), beyond what its path says. */
export type ArticleView = "read" | "edit" | "history";

interface ArticleRoute {
  /** The canonical title of the page the URL shows (a talk page is a page of its own). */
  title: string;
  tab: ArticleTab;
}

/** The canonical title of a `/wiki/<title>` path (subpages included), or null for any other path. */
function wikiPathTitle(cleanPath: string): CanonicalTitle | null {
  const raw = /^\/wiki\/(.+?)\/?$/.exec(cleanPath)?.[1];
  if (!raw) return null;
  return canonicalizeTitle(raw.split("/").map(decodeTitleParam).join("/"));
}

/**
 * A path that is NOT an editable wiki page: the Special: namespace, and anything not under
 * /wiki/<title> (util, library and other routes). Every other /wiki/<title> is a page (a title that
 * used to be a tool route, such as "Search", is an article now: the old lower-case slugs redirect
 * before a page renders), so the page tools render for it.
 */
export function isNonArticlePath(cleanPath: string): boolean {
  const wikiSlug = /^\/wiki\/([^/]+)/.exec(cleanPath)?.[1];
  if (!wikiSlug) return true;
  return /^special:/i.test(decodeTitleParam(wikiSlug));
}

/**
 * Which page and which of its views a base-path-free pathname shows; null off the page routes (and
 * on the Main Page). `view` is what the page knows beyond its path (`?action=edit|history`).
 */
export function getArticleRoute(cleanPath: string, view: ArticleView = "read"): ArticleRoute | null {
  const history = /^\/util\/history\/([^/]+)\/?$/.exec(cleanPath);
  if (history) {
    const canon = canonicalizeTitle(decodeTitleParam(history[1]!));
    return canon ? { title: canon.title, tab: "history" } : null;
  }

  if (isNonArticlePath(cleanPath)) return null;
  const canon = wikiPathTitle(cleanPath);
  if (!canon || canon.title === "Main Page") return null;
  if (view !== "read") return { title: canon.title, tab: view };
  return { title: canon.title, tab: isTalkNamespace(canon.namespaceId) ? "talk" : "read" };
}

/** Where each view of `title` (a page or its talk page) lives; `addTopic` only for a talk page. */
export function articleTabHrefs(title: string): {
  read: string;
  edit: string;
  history: string;
  talk: string | null;
  addTopic: string | null;
} | null {
  const canon = canonicalizeTitle(title);
  if (!canon) return null;
  const subject = subjectPageOf(canon);
  const page = subject ?? canon;
  const talk = subject ? canon : talkPageOf(canon);
  return {
    read: articleHref(page),
    edit: pageEditHref(canon.title),
    history: articleHref(canon, { action: "history" }),
    talk: talk ? articleHref(talk) : null,
    addTopic: subject ? articleHref(canon, { action: "edit", section: "new" }) : null,
  };
}
