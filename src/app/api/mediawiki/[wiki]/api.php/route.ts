/**
 * Read-only `api.php` proxy for every configured wiki.
 *
 * SECURITY: the action and query parameters are allow-listed (no edit/delete/block
 * actions, no arbitrary parameters), requests are rate limited per client IP, the
 * response is always JSON, and CORS is restricted to each wiki's origins.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";
import { ALLOWED_API_PARAMS, apiCorsHeaders, getWiki, WIKI_USER_AGENT } from "../../_config";

const CLOUDFLARE_MARKERS = ["Just a moment", "cf_chl_opt", "challenge-platform"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wiki: string }> }
) {
  const { wiki: wikiKey } = await params;
  const wiki = getWiki(wikiKey);
  if (!wiki) return NextResponse.json({ error: "Unknown wiki" }, { status: 404 });

  const corsHeaders = apiCorsHeaders(wiki, request.headers.get("origin"));

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
            ...corsHeaders,
            "Retry-After": String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (!action || !wiki.allowedActions.includes(action)) {
      console.warn(`[SECURITY] Blocked MediaWiki action "${action}" for ${wikiKey} from ${clientIp}`);
      return NextResponse.json(
        { error: "Invalid action", allowed: wiki.allowedActions },
        { status: 400, headers: corsHeaders }
      );
    }

    const safeParams = new URLSearchParams();
    for (const param of ALLOWED_API_PARAMS) {
      const value = url.searchParams.get(param);
      if (value !== null) safeParams.set(param, value);
    }
    safeParams.set("format", "json");

    const response = await fetch(`${wiki.apiUrl()}?${safeParams.toString()}`, {
      headers: {
        "User-Agent": WIKI_USER_AGENT,
        "Api-User-Agent": WIKI_USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (wiki.detectCloudflare && (response.headers.get("content-type") || "").includes("text/html")) {
        const body = await response.text();
        if (CLOUDFLARE_MARKERS.some((m) => body.includes(m))) {
          console.warn(`[${wiki.label} Proxy] Cloudflare challenge detected.`);
          return NextResponse.json(
            { error: `Cloudflare protection active on ${wiki.siteUrl}. Please try again later.`, cloudflare: true },
            { status: 503, headers: corsHeaders }
          );
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return NextResponse.json(await response.json(), { headers: corsHeaders });
  } catch (error) {
    console.error(`[${wiki.label} Proxy] api.php error:`, error);
    return NextResponse.json(
      { error: `Failed to proxy request to ${wiki.label}` },
      { status: 500, headers: corsHeaders }
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
