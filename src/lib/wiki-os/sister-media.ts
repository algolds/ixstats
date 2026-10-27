/**
 * sister-media.ts: where a file of a sister wiki (IIWiki, AltHistory) is loaded from in IxStates: that wiki's media
 * proxy (`/api/mediawiki/<wiki>/…`, under the base path), never its own host or a CDN. The proxy fetches only from the
 * wiki's allow-listed hosts, image bytes only, so a reader's browser never contacts a host the wiki's editors chose.
 *
 * `sisterMediaPath` maps what a sister page names to that proxy:
 *  - a path already under the wiki's proxy, as it is;
 *  - a relative `/images/…`, `/thumb/…` (under `/images/thumb/…`), `/data/…` or `/wiki/Special:FilePath/…`;
 *  - an absolute or protocol-relative URL on the wiki's origin (or `www.`) with such a path;
 *  - a file on one of the wiki's upload CDNs (`mediaHosts`, Fandom's `/<wiki>/images/[thumb/]<h>/<hh>/<File>[/…]`),
 *    as `Special:FilePath/<File>` (the proxy resolves the name through the wiki's api.php; a thumbnail loads full size).
 * Anything else is null. Every result is read the way a browser resolves it: a dot segment that would climb out of
 * the files (`/images/../api.php`, `%2e%2e`) is null.
 *
 * Client-safe: pure, no environment read but the base path.
 */
import { withBasePath } from "~/lib/base-path";
import { SISTER_WIKI_HOSTS, type SisterReaderId } from "~/lib/wiki-os/wiki-hosts";

/** What paths and URLs are resolved against, to read them the way a browser does. */
const LOCAL_BASE = "https://sister-media.invalid";
/** A URL that names a host: a scheme, or `//`. */
const NAMES_HOST = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const HASH_DIR = /^[0-9a-f]$/;
const HASH_SUBDIR = /^[0-9a-f]{2}$/;
const FILE_PATH_PREFIX = "/wiki/special:filepath/";

function proxyBase(wiki: SisterReaderId): string {
  return withBasePath(`/api/mediawiki/${wiki}`);
}

/** Whether `path` (from the root of the wiki) is one of its files: `/images/…`, `/data/…` or `Special:FilePath/…`. */
function isFilePath(path: string): boolean {
  return (
    path.startsWith("/images/") ||
    path.startsWith("/data/") ||
    path.toLowerCase().startsWith(FILE_PATH_PREFIX)
  );
}

/** `path` (a file path of the wiki) under the proxy at `base`, resolved as a browser would; null when it is not a file there. */
function underProxy(base: string, path: string): string | null {
  // (a root-relative path always parses; `base` is root-relative, so the result stays on this origin; a dot segment can still climb out of the proxy)
  const resolved = new URL(`${base}${path}`, LOCAL_BASE);
  if (!resolved.pathname.startsWith(`${base}/`)) return null;
  const rest = resolved.pathname.slice(base.length);
  return isFilePath(rest) ? `${base}${rest}${resolved.search}` : null;
}

/** A relative path of the wiki as a file path (`/thumb/` lives under `/images/`), or null. */
function relativeFilePath(url: string): string | null {
  if (url.startsWith("/thumb/")) return `/images${url}`;
  return isFilePath(url) ? url : null;
}

/** The file named by a path on Fandom's CDN (`/<slug>/images/[thumb/]<h>/<hh>/<File>[/…]`), or null. */
function cdnFileName(pathname: string, slug: string): string | null {
  const segments = pathname.split("/");
  if (segments[1] !== slug || segments[2] !== "images") return null;
  const at = segments[3] === "thumb" ? 4 : 3;
  const [dir = "", subdir = "", file = ""] = segments.slice(at, at + 3);
  const hashed = HASH_DIR.test(dir) && HASH_SUBDIR.test(subdir) && subdir.startsWith(dir);
  // (a `.` or `..` segment never gets here: the URL parser resolved it)
  return hashed && file !== "" ? file : null;
}

/** An absolute URL of the wiki's origin or upload CDN as a file path of the wiki, or null. */
function absoluteFilePath(url: string, wiki: SisterReaderId): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, LOCAL_BASE);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = SISTER_WIKI_HOSTS[wiki];
  const ownHost = new URL(host.origin).hostname;
  if (parsed.hostname === ownHost || parsed.hostname === `www.${ownHost}`) {
    return isFilePath(parsed.pathname) ? parsed.pathname : null;
  }
  const cdns: readonly string[] = host.mediaHosts;
  if (!cdns.includes(parsed.hostname)) return null;
  const file = cdnFileName(parsed.pathname, ownHost.split(".")[0] ?? "");
  return file === null ? null : `/wiki/Special:FilePath/${file}`;
}

/** Where `url`, named by a page of `wiki`, loads from in IxStates: that wiki's media proxy, or null (see the file header). */
export function sisterMediaPath(url: string, wiki: SisterReaderId): string | null {
  const base = proxyBase(wiki);
  if (url.startsWith(`${base}/`)) return underProxy(base, url.slice(base.length));
  if (NAMES_HOST.test(url)) {
    const path = absoluteFilePath(url, wiki);
    return path === null ? null : underProxy(base, path);
  }
  if (!url.startsWith("/")) return null;
  const path = relativeFilePath(url);
  return path === null ? null : underProxy(base, path);
}

/** Whether `url` already is a file path under `wiki`'s media proxy (what a sister page may load). */
export function isSisterMediaPath(url: string, wiki: SisterReaderId): boolean {
  const base = proxyBase(wiki);
  return url.startsWith(`${base}/`) && underProxy(base, url.slice(base.length)) !== null;
}
