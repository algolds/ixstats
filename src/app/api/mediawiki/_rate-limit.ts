/**
 * Shared per-client rate limits for the unauthenticated MediaWiki-facing routes:
 *   - `wiki_proxy`: the fan-out routes (`/api/wiki/{random-articles,categories,category-articles,preview-article}`),
 *     on the default limiter config.
 *   - `wiki_media`: the two media proxies (`ixwiki/[...path]`, `[wiki]/[...path]`). A page of articles loads
 *     dozens of images at once, so this bucket is generous: 600 requests a minute per client.
 *
 * The limiter key is the trusted client identity (`resolveRateLimitIdentifier`), never the
 * client-controlled `x-forwarded-for`.
 */
import { NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

const WIKI_MEDIA_LIMIT = { maxRequests: 600, windowMs: 60_000 } as const;

async function rateLimitResponse(
  request: Request,
  label: string,
  bucket: string,
  limits?: typeof WIKI_MEDIA_LIMIT
): Promise<NextResponse | null> {
  const clientId = resolveRateLimitIdentifier(request.headers, null);
  const rateLimit = limits
    ? await rateLimiter.check(clientId, bucket, limits)
    : await rateLimiter.check(clientId, bucket);
  if (rateLimit.success) return null;

  console.warn(`[SECURITY] Rate limit exceeded for ${label}: client=${clientId}`);
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)) },
    }
  );
}

/** A 429 response when `request`'s client is over the `wiki_proxy` limit, otherwise null. */
export function wikiProxyRateLimitResponse(request: Request, label: string): Promise<NextResponse | null> {
  return rateLimitResponse(request, label, "wiki_proxy");
}

/** A 429 response when `request`'s client is over the `wiki_media` limit, otherwise null. */
export function wikiMediaRateLimitResponse(request: Request, label: string): Promise<NextResponse | null> {
  return rateLimitResponse(request, label, "wiki_media", WIKI_MEDIA_LIMIT);
}
