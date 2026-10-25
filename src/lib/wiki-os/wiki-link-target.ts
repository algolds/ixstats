// src/lib/wiki-os/wiki-link-target.ts
// The wiki article a link points at, for hover previews (`GlobalLinkTooltips`). Pure and client-safe: it reads
// the href and the base path it is given, and imports only `config.ts`'s host helpers and `wiki-hosts.ts`.
//
// What counts as an article link:
//   - an app link: `/wiki/<title>`, under the deployment's base path or not (article HTML carries the base path
//     at display, `withAppHrefs`); its wiki is `?source=`, read as the reader reads it (`parseWikiSource`);
//   - a legacy `/w/<title>`, IxWiki's, unless it names one of the wiki's entry points (`/w/api.php`);
//   - an absolute (or protocol-relative) http(s) link to `/wiki/<title>` on IxWiki's public host or a sister
//     reader's origin (each with its `www.` alias; iiwiki also as `iiwiki.us`).
// Any other first segment is not the base path (`/other/wiki/X` is no link). A title WikiOS has no preview for
// (`NO_PREVIEW_TITLE`), an empty one or a malformed percent escape gives null; no href throws.

import { isMediaWikiUrl, isUrlOnHost, parseWikiSource, type WikiSource } from "./config";
import { SISTER_READER_IDS, SISTER_WIKI_HOSTS, type SisterReaderId } from "./wiki-hosts";

/** A link's wiki article: its title (decoded, spaces for underscores) and the wiki it is on. */
export interface WikiLinkTarget {
  title: string;
  wiki: WikiSource;
}

/** Namespaces and special pages that have no useful preview (`Image:` and `Media:` are `File:`'s aliases). */
const NO_PREVIEW_TITLE =
  /^(?:(?:special|file|image|media|category)[:/]|(?:template|help|user|talk|wiki):)/i;

/** A MediaWiki entry point under `/w/` (`api.php`, `index.php`, `load.php`): never an article. */
const ENTRY_POINT = /^[a-z_]+\.php$/i;

/** Other hosts a sister reader is reached at, besides its origin and `www.`. */
const READER_HOST_ALIASES: Partial<Record<SisterReaderId, readonly string[]>> = {
  iiwiki: ["iiwiki.us"],
};

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

/** An absolute http(s) link to an article on a wiki WikiOS reads. */
function absoluteTarget(url: URL): WikiLinkTarget | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.pathname.startsWith("/wiki/")) return null;
  const wiki = readerWiki(url.origin); // the origin, not the whole href: a host check never re-reads a long path
  return wiki ? titled(url.pathname.slice("/wiki/".length), wiki) : null;
}

/** The article a hovered link's `href` points at, under the deployment's `basePath` ("" for none), or null. */
export function wikiLinkTarget(href: string, basePath: string): WikiLinkTarget | null {
  const url = parseHref(href);
  if (!url) return null;
  const target =
    href.startsWith("/") && url.host === RELATIVE_HOST
      ? appTarget(url, basePath)
      : absoluteTarget(url);
  return target && !NO_PREVIEW_TITLE.test(target.title) ? target : null;
}
