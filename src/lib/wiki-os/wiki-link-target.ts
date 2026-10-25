// src/lib/wiki-os/wiki-link-target.ts
// The wiki article a link points at: for hover previews (`GlobalLinkTooltips`, `wikiLinkTarget`) and for the render
// transform that opens absolute links to a wiki WikiOS reads in the reader (`absoluteReaderTarget`, `html-links.ts`).
// Pure and client-safe: it reads the href and the base path it is given, and imports only `config.ts`'s host
// helpers and `wiki-hosts.ts`.
//
// What counts as an article link:
//   - an app link: `/wiki/<title>`, under the deployment's base path or not (article HTML carries the base path
//     at display, `withAppHrefs`); its wiki is `?source=`, read as the reader reads it (`parseWikiSource`);
//   - a legacy `/w/<title>`, IxWiki's, unless it names one of the wiki's entry points (`/w/api.php`);
//   - an absolute (or protocol-relative) http(s) link to `/wiki/<title>`, or to `/index.php?title=<title>` with
//     nothing else in the query, on IxWiki's public host or a sister reader's origin (each with its `www.` alias;
//     iiwiki also as `iiwiki.us`). A preview reads a `/wiki/` link whatever its query asks for, as it does an app
//     link; the render transform moves only a link with no query (`absoluteReaderTarget`);
//   - an absolute IxStates permalink on IxWiki's host under the base path, read as an app link (`permalinkTarget`).
// Any other first segment is not the base path (`/other/wiki/X` is no link). A title in a namespace read on the wiki's
// own site (`SITE_NAMESPACE`: no preview, and the transform leaves the link alone), an empty one or a malformed
// percent escape gives null; no href throws.

import { isMediaWikiUrl, isUrlOnHost, parseWikiSource, type WikiSource } from "./config";
import {
  READER_HOST_ALIASES,
  SISTER_READER_IDS,
  SISTER_WIKI_HOSTS,
  type SisterReaderId,
} from "./wiki-hosts";

/** A link's wiki article: its title (decoded, spaces for underscores) and the wiki it is on. */
export interface WikiLinkTarget {
  title: string;
  wiki: WikiSource;
}

/**
 * Namespaces WikiOS does not read as articles: files (`Image:` and `Media:` are `File:`'s aliases), special pages,
 * user, category, template, module, help, interface and project pages, and every talk namespace. A link to one opens
 * on that wiki's own site and gets no preview. Matches a title (`User talk:Kir`) and a link path as written
 * (`User_talk%3AKir`). `Portal:` is not here: the reader reads portals as articles. A namespace needs its colon, so
 * `Media/Press` is an article.
 */
export const SITE_NAMESPACE =
  /^(?:file|image|media|special|user|category|template|module|help|mediawiki|talk|wiki|[a-z]+[ _]talk)(?::|%3a)/iu;

/** A MediaWiki entry point under `/w/` (`api.php`, `index.php/Foo`, `load.php`): never an article. */
const ENTRY_POINT = /^[a-z_]+\.php(?:\/|$)/iu;

/** An absolute or protocol-relative http(s) href (`\\` is `/` there, as browsers read it); anything else is relative. */
const ABSOLUTE_HREF = /^\s*(?:https?:)?[/\\]{2}/iu;

/** An article on a wiki WikiOS reads, as an absolute link names it: its wiki, title and `#fragment` (or ""). */
interface ReaderTarget extends WikiLinkTarget {
  fragment: string;
}

/** What a relative href is resolved against; `.invalid` is reserved, so no real link is on it. */
const RELATIVE_HOST = "app.invalid";

function parseHref(href: string): URL | null {
  try {
    return new URL(href, `https://${RELATIVE_HOST}`);
  } catch {
    return null;
  }
}

/** The page a `/wiki/` or `/w/` path segment names, or null when it is empty or a malformed escape. */
function titled(segment: string, wiki: WikiSource): WikiLinkTarget | null {
  try {
    const title = decodeURIComponent(segment).replace(/_/g, " ").trim();
    return title ? { title, wiki } : null;
  } catch {
    return null;
  }
}

/** A root-relative link in the app: `/wiki/…` with its `?source=`, or legacy `/w/…`. */
function appTarget(url: URL, basePath: string): WikiLinkTarget | null {
  // What is left must start with /wiki/ or /w/, so the base path counts only at a segment boundary.
  const path = url.pathname.startsWith(basePath)
    ? url.pathname.slice(basePath.length)
    : url.pathname;
  if (path.startsWith("/wiki/")) {
    return titled(path.slice("/wiki/".length), parseWikiSource(url.searchParams.get("source")));
  }
  if (!path.startsWith("/w/")) return null;
  const segment = path.slice("/w/".length);
  return ENTRY_POINT.test(segment) ? null : titled(segment, "ixwiki");
}

/** The wiki whose public host an origin is on: IxWiki's, or a sister reader's (or an alias). */
function readerWiki(origin: string): WikiSource | null {
  if (isMediaWikiUrl(origin)) return "ixwiki";
  const onReader = (id: SisterReaderId): boolean =>
    [new URL(SISTER_WIKI_HOSTS[id].origin).host, ...(READER_HOST_ALIASES[id] ?? [])].some((host) =>
      isUrlOnHost(origin, host)
    );
  return SISTER_READER_IDS.find(onReader) ?? null;
}

/** The title part of `index.php?title=<title>` when it is the query's only parameter, `+` read as a space. */
function indexPhpTitle(search: string): string | null {
  if (!search.startsWith("?title=") || search.includes("&")) return null;
  return search.slice("?title=".length).replaceAll("+", "%20");
}

/**
 * An absolute http(s) link to an article on a wiki WikiOS reads: `/wiki/<title>`, with no query unless `anyQuery`,
 * or `/index.php?title=<title>` alone.
 */
function readerArticle(url: URL, anyQuery: boolean): ReaderTarget | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const wiki = readerWiki(url.origin); // the origin, not the whole href: a host check never re-reads a long path
  if (!wiki) return null;
  let segment: string | null = null;
  if (url.pathname.startsWith("/wiki/")) {
    segment = anyQuery || !url.search ? url.pathname.slice("/wiki/".length) : null;
  } else if (url.pathname === "/index.php") {
    segment = indexPhpTitle(url.search);
  }
  const target = segment === null ? null : titled(segment, wiki);
  return target && { ...target, fragment: url.hash };
}

/**
 * The article an absolute (or protocol-relative) link names on IxWiki's public host or a sister reader's origin:
 * `/wiki/<title>` with no query, or `/index.php` with `title=` as its only parameter. The title is decoded, with
 * spaces for underscores; a malformed escape, a relative link or any other link is null. Namespaces are not
 * filtered: the caller decides (`SITE_NAMESPACE`).
 */
export function absoluteReaderTarget(href: string): ReaderTarget | null {
  // Most of a page's links are relative: they are not parsed at all (a page of them is one URL parse per link).
  const url = ABSOLUTE_HREF.test(href) ? parseHref(href) : null;
  return url ? readerArticle(url, false) : null;
}

/**
 * An absolute IxStates permalink (`https://ixwiki.com/projects/ixstates/wiki/X`, or its `/w/` form), as feeds and
 * Discord emit them (`appUrl`): IxStates is served on IxWiki's host under the base path, so it reads as an app link,
 * `?source=` included. Null without a base path, where the prefix would be just another first segment.
 */
function permalinkTarget(url: URL, basePath: string): WikiLinkTarget | null {
  if (!basePath || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  // appTarget then needs /wiki/ or /w/ right after the base path, so it counts only at a segment boundary.
  if (!url.pathname.startsWith(basePath) || !isMediaWikiUrl(url.origin)) return null;
  return appTarget(url, basePath);
}

/** The article a hovered link's `href` points at, under the deployment's `basePath` ("" for none), or null. */
export function wikiLinkTarget(href: string, basePath: string): WikiLinkTarget | null {
  const url = parseHref(href);
  if (!url) return null;
  const target =
    href.startsWith("/") && url.host === RELATIVE_HOST
      ? appTarget(url, basePath)
      : (permalinkTarget(url, basePath) ?? readerArticle(url, true));
  return target && !SITE_NAMESPACE.test(target.title)
    ? { title: target.title, wiki: target.wiki }
    : null;
}
