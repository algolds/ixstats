/**
 * Shared response rules for the MediaWiki media proxies.
 *
 * The proxies are image-only by contract: anything else an upstream answers with (HTML error pages,
 * JSON, scripts) is refused so the proxy can never serve attacker-influenced markup from our origin.
 * Any new caller that needs non-image content must get its own narrowly scoped route.
 */
import { NextResponse } from "next/server";
import { MEDIA_CORS_HEADERS, WIKIS } from "./_config";

/** Largest image body the proxies will relay (Content-Length checked first, then while streaming). */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** MediaWiki replaces files in place, so images are revalidated daily rather than cached as immutable. */
const IMAGE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
const MAX_REDIRECTS = 3;

/** CDN hosts the wikis' `imageinfo` lookups resolve to, in addition to the wikis' own hosts. */
const MEDIA_CDN_HOSTS = ["upload.wikimedia.org", "static.wikia.nocookie.net"] as const;

const ALLOWED_MEDIA_HOSTS: ReadonlySet<string> = new Set([
  ...Object.values(WIKIS).map((wiki) => new URL(wiki.siteUrl).hostname),
  ...MEDIA_CDN_HOSTS,
]);

/** True when `rawUrl` is an http(s) URL whose host belongs to a configured wiki or its media CDN. */
export function isAllowedMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === "https:" || url.protocol === "http:") && ALLOWED_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * A path segment the media proxies never forward: empty, `.`/`..`, or containing a slash. Segments are
 * checked after Next's single percent-decode, so `%2e%2e` and `%2F` tricks cannot slip past.
 */
export function isUnsafeSegment(segment: string): boolean {
  return segment === "" || segment === "." || segment === ".." || /[\\/]/.test(segment);
}

/** Re-encode decoded segments into an origin path; `:` stays literal so `Special:FilePath` keeps its form. */
export function encodePath(segments: string[]): string {
  return segments.map((s) => encodeURIComponent(s).replace(/%3A/gi, ":")).join("/");
}

/**
 * GET `url`, following redirects by hand so every hop is re-checked against the host allowlist.
 * Returns null when a hop leaves the allowlist or the redirect chain is too long.
 */
export async function fetchFromAllowedHost(
  url: string,
  headers: HeadersInit,
  timeoutMs: number
): Promise<Response | null> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedMediaUrl(target)) return null;
    const res = await fetch(target, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const location = res.headers.get("Location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel().catch(() => undefined);
    target = new URL(location, target).toString();
  }
  return null;
}

/**
 * True when the raw request path has a `%` sequence that does not decode. Next.js answers those itself
 * before a route runs; this keeps a malformed path a 400 rather than a 500 should one ever get through.
 */
export function hasMalformedPercentEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

function reject(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { ...MEDIA_CORS_HEADERS, "X-Content-Type-Options": "nosniff" },
  });
}

/** Read the body, aborting (and returning null) as soon as it grows past the cap. */
async function readCapped(res: Response): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** What `imageOnlyResponse` needs to know about the request being answered. */
export interface ImageRequest {
  headers: Headers;
  /** The requested file, used to name an SVG download. */
  fileName?: string;
  /** Replaces the daily revalidation: for a file that may be replaced in minutes (a staged WikiOS upload). */
  cacheControl?: string;
}

/**
 * Whether an SVG may be rendered inline for this request: only when the browser says it is loading an
 * image (`Sec-Fetch-Dest: image`), or, for clients that send no `Sec-Fetch-Dest`, when it is not asking
 * for a page. A direct navigation must download the file instead: the app CSP in `src/proxy.ts`
 * replaces the sandbox CSP set here, so an inline SVG document would run script on our origin.
 */
function mayRenderSvgInline(headers: Headers): boolean {
  const dest = headers.get("Sec-Fetch-Dest");
  if (dest !== null) return dest === "image";
  return !(headers.get("Accept") ?? "").includes("text/html");
}

function svgDownloadName(fileName: string | undefined): string {
  const base = (fileName ?? "").replace(/\.svg$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${base || "image"}.svg`;
}

/**
 * The headers of a successful image response of `contentType`: CORS, the type, caching, nosniff, and for an SVG the
 * sandbox CSP and a disposition that is inline only when the browser is loading an image (a `Vary` says so to caches).
 */
export function imageResponseHeaders(
  contentType: string,
  request: ImageRequest
): Record<string, string> {
  const headers: Record<string, string> = {
    ...MEDIA_CORS_HEADERS,
    "Content-Type": contentType,
    "Cache-Control": request.cacheControl ?? IMAGE_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  };
  if (contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] = SVG_CSP;
    headers["Content-Disposition"] = mayRenderSvgInline(request.headers)
      ? "inline"
      : `attachment; filename="${svgDownloadName(request.fileName)}"`;
    // The disposition depends on these request headers, so caches must not share it across them.
    headers["Vary"] = "Sec-Fetch-Dest, Accept";
  }
  return headers;
}

/**
 * Relay a successful upstream image response, or refuse it: 415 unless the upstream `Content-Type`
 * is `image/*`, 413 past {@link MAX_IMAGE_BYTES}. SVG is served sandboxed (no script, no network) and
 * renders inline only as an image; any other request gets it as a download.
 */
export async function imageOnlyResponse(res: Response, request: ImageRequest): Promise<NextResponse> {
  const contentType = res.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) {
    await res.body?.cancel().catch(() => undefined);
    return reject(415);
  }

  const declaredLength = Number(res.headers.get("Content-Length"));
  if (declaredLength > MAX_IMAGE_BYTES) {
    await res.body?.cancel().catch(() => undefined);
    return reject(413);
  }

  const body = await readCapped(res);
  if (!body) return reject(413);

  return new NextResponse(body, {
    status: 200,
    headers: imageResponseHeaders(contentType, request),
  });
}
