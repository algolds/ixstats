/**
 * Shared per-client rate limit for the unauthenticated routes that fan out to MediaWiki
 * (`/api/wiki/{random-articles,categories,category-articles,preview-article}`).
 *
 * The limiter key is the trusted client identity (`resolveRateLimitIdentifier`), never the
 * client-controlled `x-forwarded-for`.
 */
import { NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

/** A 429 response when `request`'s client is over the `wiki_proxy` limit, otherwise null. */
export async function wikiProxyRateLimitResponse(
  request: Request,
  label: string
): Promise<NextResponse | null> {
  const clientId = resolveRateLimitIdentifier(request.headers, null);
  const rateLimit = await rateLimiter.check(clientId, "wiki_proxy");
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
