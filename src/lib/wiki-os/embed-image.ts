/**
 * embed-image.ts: where a wiki embed card's image (`data-imageurl`, stored in post HTML, so user content) loads from.
 *
 *  - A sister wiki's image only through that wiki's media proxy (`sisterMediaPath`).
 *  - An IxWiki image only as IxWiki's article images are served (`transformImages`): a file under `/images/` or
 *    `/data/` on IxWiki's own host (or `www.`), loaded from its origin; or a same-origin upload, root-relative
 *    (`/images/uploads/…`, WikiOS's staged files under `/api/wiki/file/…`), under the deployment's base path.
 *
 * Anything else (another host, `data:`, `javascript:`, a path that climbs out of the files) gives null: no image.
 * Every URL is read the way a browser resolves it. Client-safe: pure, no environment read but the base path and the
 * wiki's configured host.
 */
import { getBasePath, withBasePath } from "~/lib/base-path";
import { STAGED_FILE_PATH, isMediaWikiUrl, mediaWikiOrigin, type WikiSource } from "./config";
import { sisterMediaPath } from "./sister-media";

/** What paths are resolved against, to read them the way a browser does; `.invalid` is reserved. */
const LOCAL_BASE = "https://embed-image.invalid";
/** Root-relative paths the app itself serves images from (uploads, WikiOS's staged files). */
const UPLOAD_PREFIXES = ["/images/uploads/", STAGED_FILE_PATH] as const;
/** Paths of IxWiki's own host that are its files. */
const WIKI_FILE_PREFIXES = ["/images/", "/data/"] as const;

function parse(url: string): URL | null {
  try {
    return new URL(url, LOCAL_BASE);
  } catch {
    return null;
  }
}

const under = (path: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);

/** A root-relative upload path (with or without the base path), under the base path; else null. */
function uploadSrc(url: string): string | null {
  const parsed = parse(url);
  if (!parsed || parsed.host !== new URL(LOCAL_BASE).host) return null;
  const basePath = getBasePath();
  const path =
    basePath && parsed.pathname.startsWith(`${basePath}/`)
      ? parsed.pathname.slice(basePath.length)
      : parsed.pathname;
  return under(path, UPLOAD_PREFIXES) ? withBasePath(`${path}${parsed.search}`) : null;
}

/** An absolute (or protocol-relative) file URL on IxWiki's own host, from its origin; else null. */
function wikiFileSrc(url: string): string | null {
  const parsed = parse(url);
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) return null;
  if (!isMediaWikiUrl(parsed.origin) || !under(parsed.pathname, WIKI_FILE_PREFIXES)) return null;
  return `${mediaWikiOrigin().replace(/\/+$/, "")}${parsed.pathname}${parsed.search}`;
}

/** Where an embed card on `source` loads its stored image `url` from, or null for none (see the file header). */
export function embedImageSrc(url: string, source: WikiSource): string | null {
  const trimmed = url.trim();
  if (source !== "ixwiki") return sisterMediaPath(trimmed, source);
  const rootRelative = trimmed.startsWith("/") && !/^[/\\]{2}/.test(trimmed);
  return rootRelative ? uploadSrc(trimmed) : wikiFileSrc(trimmed);
}
