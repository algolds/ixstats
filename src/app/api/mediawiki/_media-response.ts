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

function reject(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { ...MEDIA_CORS_HEADERS, "X-Content-Type-Options": "nosniff" },
  });
}

/** Read the body, aborting (and returning null) as soon as it grows past the cap. */
async function readCapped(res: Response): Promise<Uint8Array | null> {
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

/**
 * Relay a successful upstream image response, or refuse it: 415 unless the upstream `Content-Type`
 * is `image/*`, 413 past {@link MAX_IMAGE_BYTES}. SVG is served sandboxed (no script, no network).
 */
export async function imageOnlyResponse(res: Response): Promise<NextResponse> {
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

  const headers: Record<string, string> = {
    ...MEDIA_CORS_HEADERS,
    "Content-Type": contentType,
    "Cache-Control": IMAGE_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  };
  if (contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] = SVG_CSP;
    headers["Content-Disposition"] = "inline";
  }
  return new NextResponse(body, { status: 200, headers });
}
