/**
 * Read-only `api.php` proxy for every configured wiki.
 *
 * SECURITY: the action and query parameters are allow-listed (no edit/delete/block
 * actions, no arbitrary parameters), requests are rate limited per client IP, the
 * response is always JSON, and CORS is restricted to each wiki's origins.
 *
 * The wiki is called through the upstream guard (plan 2026-10-25 sister wikis, C3d) on its own `proxy` lane: a limiter
 * of its own, so anonymous traffic never spends WikiOS's budget, and the host's breaker, shared with WikiOS. The guard
 * asks for JSON only, which suits this proxy: `format=json` is forced and no callback (JSONP) is forwarded, so any
 * other answer, a Cloudflare challenge page included, and a body cut short or that does not parse, is the wiki
 * failing (the guard counts it against the breaker). A success is cacheable for five minutes and varies by Origin
 * (the CORS header echoes a listed one). A 200 that carries a MediaWiki API error (`maxlag`, `ratelimited`, a bad
 * parameter) is passed on as it is but is no success. An unreachable wiki or an open circuit is 503 and a busy one
 * 429, each with Retry-After; those and every other answer but a success are `no-store`, so no cache keeps an error.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { upstreamGuard, WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";
import { ALLOWED_API_PARAMS, apiCorsHeaders, getWiki, type WikiConfig } from "../../_config";

const UPSTREAM_TIMEOUT_MS = 15_000;
const CACHEABLE = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";
const NO_STORE = { "Cache-Control": "no-store" } as const;
/** Seconds a caller should wait: past the breaker's first cooldown for an outage, a short pause when busy. */
const RETRY_AFTER_UNAVAILABLE = "30";
const RETRY_AFTER_BUSY = "10";

/** The proxy's answer to a wiki that could not be reached (503) or said busy (429). Never cached. */
function unavailableAnswer(error: WikiUnavailableError, corsHeaders: Record<string, string>) {
  const busy = error.reason === "busy";
  return NextResponse.json(
    busy ? { error: error.message } : { error: error.message, unavailable: true },
    {
      status: busy ? 429 : 503,
      headers: {
        ...corsHeaders,
        ...NO_STORE,
        "Retry-After": busy ? RETRY_AFTER_BUSY : RETRY_AFTER_UNAVAILABLE,
      },
    }
  );
}

/** The allow-listed parameters of the caller's query, with `format=json`. */
function forwardedParams(url: URL): URLSearchParams {
  const safeParams = new URLSearchParams();
  for (const param of ALLOWED_API_PARAMS) {
    const value = url.searchParams.get(param);
    if (value !== null) safeParams.set(param, value);
  }
  safeParams.set("format", "json");
  return safeParams;
}

/** The wiki's JSON answer to `params`; throws WikiUnavailableError, or an Error for anything else unusable. */
async function readWiki(wiki: WikiConfig, params: URLSearchParams): Promise<object | null> {
  const response = await upstreamGuard.fetch(`${wiki.apiUrl()}?${params.toString()}`, {
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    lane: "proxy",
    feature: "proxy",
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as object | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ wiki: string }> }) {
  const { wiki: wikiKey } = await params;
  const wiki = getWiki(wikiKey);
  if (!wiki)
    return NextResponse.json({ error: "Unknown wiki" }, { status: 404, headers: NO_STORE });

  const corsHeaders = apiCorsHeaders(wiki, request.headers.get("origin"));
  const errorHeaders = { ...corsHeaders, ...NO_STORE };

  // A wiki that allows no action is not proxied at all (IxWiki's API is WikiOS's own, at /w/api.php).
  if (wiki.allowedActions.length === 0) {
    return NextResponse.json(
      { error: `${wiki.label}'s api.php is not proxied here` },
      { status: 410, headers: errorHeaders }
    );
  }

  try {
    const clientIp = resolveRateLimitIdentifier(request.headers, null);
    const rateLimit = await rateLimiter.check(clientIp, "wiki_proxy");
    if (!rateLimit.success) {
      console.warn(`[SECURITY] Rate limit exceeded for ${wikiKey} proxy: ip=${clientIp}`);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...errorHeaders,
            "Retry-After": String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (!action || !wiki.allowedActions.includes(action)) {
      console.warn(
        `[SECURITY] Blocked MediaWiki action "${action}" for ${wikiKey} from ${clientIp}`
      );
      return NextResponse.json(
        { error: "Invalid action", allowed: wiki.allowedActions },
        { status: 400, headers: errorHeaders }
      );
    }

    const body = await readWiki(wiki, forwardedParams(url));
    const apiError = body !== null && "error" in body;
    return NextResponse.json(body, {
      headers: apiError ? errorHeaders : { ...corsHeaders, "Cache-Control": CACHEABLE },
    });
  } catch (error) {
    if (error instanceof WikiUnavailableError) return unavailableAnswer(error, corsHeaders);
    console.error(`[${wiki.label} Proxy] api.php error:`, error);
    return NextResponse.json(
      { error: `Failed to proxy request to ${wiki.label}` },
      { status: 502, headers: errorHeaders }
    );
  }
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ wiki: string }> }
) {
  const { wiki: wikiKey } = await params;
  const wiki = getWiki(wikiKey);
  if (!wiki) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 200,
    headers: apiCorsHeaders(wiki, request.headers.get("origin")),
  });
}
