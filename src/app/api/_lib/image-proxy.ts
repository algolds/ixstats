/**
 * Shared pieces for the image proxy routes (`/api/proxy-discord-image`, `/api/proxy-ns-image`).
 * Underscore-prefixed folders are not routed by Next.js.
 *
 * The proxies are image-only, as the MediaWiki media proxies are (`mediawiki/_media-response.ts`): every redirect hop is
 * re-checked against the route's host allowlist, the body is capped while it streams, and what is served is what the
 * bytes are (`sniffFile`), never the upstream `Content-Type`: a PNG, JPEG, GIF or WebP, or a script-free SVG that
 * renders inline only as an image (a direct visit downloads it, since the app CSP in `src/proxy.ts` replaces the sandbox
 * CSP set here). Anything else is refused. Both routes are only loaded by the app's own pages, so no CORS.
 */
import { NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { sniffFile } from "~/lib/wiki-os/core/file-sniff";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

export const IMAGE_PROXY_USER_AGENT = "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)";

/** Largest image body relayed (Content-Length checked first, then while streaming). */
export const MAX_PROXIED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const RASTER_TYPES = new Set(["png", "jpeg", "gif", "webp"]);
const SANDBOX_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
/** A feed page loads a few dozen proxied images; this is per client, per route. */
const IMAGE_PROXY_LIMIT = { maxRequests: 300, windowMs: 60_000 } as const;

/** Parse and host-check a `?url=` parameter: `https:` on one of `allowedHosts`. */
export function parseAllowedUrl(raw: string | null, allowedHosts: readonly string[]): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export interface FetchedImage {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
}

/** Read the body, cancelling (and returning null) as soon as it grows past the cap. */
async function readCapped(
  res: Response,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
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

/** GET `url` with redirects followed by hand, every hop on `allowedHosts`; null when one leaves it or there are too many. */
async function fetchFromAllowedHost(
  url: URL,
  allowedHosts: readonly string[],
  init: { timeoutMs?: number; next?: { revalidate: number } }
): Promise<Response | null> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (target.protocol !== "https:" || !allowedHosts.includes(target.hostname)) return null;
    const res = await fetch(target, {
      headers: {
        "User-Agent": IMAGE_PROXY_USER_AGENT,
        Accept: "image/webp,image/png,image/jpeg,image/gif;q=0.9,image/svg+xml;q=0.5",
      },
      redirect: "manual",
      signal: init.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined,
      next: init.next,
    });
    const location = res.headers.get("Location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel().catch(() => undefined);
    target = new URL(location, target);
  }
  return null;
}

/**
 * Fetch an image from `allowedHosts` (every redirect hop too); null on any failure, a body past the cap, or bytes that
 * are not a PNG, JPEG, GIF, WebP or safe SVG.
 */
export async function fetchImage(
  url: URL,
  allowedHosts: readonly string[],
  init: { timeoutMs?: number; next?: { revalidate: number } } = {}
): Promise<FetchedImage | null> {
  try {
    const response = await fetchFromAllowedHost(url, allowedHosts, init);
    if (!response?.ok) {
      await response?.body?.cancel().catch(() => undefined);
      return null;
    }
    if (Number(response.headers.get("Content-Length")) > MAX_PROXIED_IMAGE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const body = await readCapped(response, MAX_PROXIED_IMAGE_BYTES);
    if (!body) return null;
    const sniffed = sniffFile(body);
    if (!sniffed.ok) return null;
    if (!RASTER_TYPES.has(sniffed.file.kind) && sniffed.file.kind !== "svg") return null;
    return { body, contentType: sniffed.file.mime };
  } catch {
    return null;
  }
}

/** Whether an SVG may render inline: only when the browser is loading an image (or, lacking Sec-Fetch-Dest, not a page). */
function mayRenderSvgInline(headers: Headers): boolean {
  const dest = headers.get("Sec-Fetch-Dest");
  if (dest !== null) return dest === "image";
  return !(headers.get("Accept") ?? "").includes("text/html");
}

/** The headers every proxied image carries: our own sniffed type, nosniff and a sandbox CSP; an SVG's disposition. */
export function imageHeaders(
  contentType: string,
  requestHeaders: Headers,
  cacheControl: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": SANDBOX_CSP,
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
  if (contentType === "image/svg+xml") {
    headers["Content-Disposition"] = mayRenderSvgInline(requestHeaders)
      ? "inline"
      : 'attachment; filename="image.svg"';
    headers["Vary"] = "Sec-Fetch-Dest, Accept";
  }
  return headers;
}

export function imageResponse(
  image: FetchedImage,
  maxAgeSeconds: number,
  requestHeaders: Headers,
  extra: Record<string, string> = {}
) {
  return new NextResponse(image.body, {
    status: 200,
    headers: {
      ...imageHeaders(
        image.contentType,
        requestHeaders,
        `public, max-age=${maxAgeSeconds}, immutable`
      ),
      ...extra,
    },
  });
}

/** A 429 when `request`'s client is over the image proxy limit for `bucket`, otherwise null. */
export async function imageProxyRateLimitResponse(
  request: Request,
  bucket: string
): Promise<NextResponse | null> {
  const clientId = resolveRateLimitIdentifier(request.headers, null);
  const rateLimit = await rateLimiter.check(clientId, bucket, IMAGE_PROXY_LIMIT);
  if (rateLimit.success) return null;
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))
        ),
      },
    }
  );
}
