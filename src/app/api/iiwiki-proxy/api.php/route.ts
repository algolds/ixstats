import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/rate-limiter";

/**
 * SECURITY: Whitelist of allowed MediaWiki API actions
 * Only read-only actions that IxStats actually needs are permitted
 * This prevents SSRF attacks that could probe internal services or
 * trigger dangerous MediaWiki actions (edit, delete, block, etc.)
 */
const ALLOWED_ACTIONS = ["query", "opensearch", "parse"] as const;
type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

/**
 * SECURITY: Allowed CORS origins
 * Restricts cross-origin requests to trusted domains only
 */
const ALLOWED_ORIGINS = [
  "https://iiwiki.com",
  "https://www.iiwiki.com",
  // Allow localhost in development
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3550"]
    : []),
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "https://iiwiki.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // SECURITY: Rate limit proxy requests (by IP since this is public)
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitResult = await rateLimiter.check(clientIp, "wiki_proxy");
    if (!rateLimitResult.success) {
      console.warn(
        `[SECURITY] Rate limit exceeded for iiwiki proxy: ip=${clientIp}`
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(
              Math.ceil(
                (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
              )
            ),
          },
        }
      );
    }

    const url = new URL(request.url);

    // SECURITY: Validate the action parameter against whitelist
    const action = url.searchParams.get("action");
    if (!action || !ALLOWED_ACTIONS.includes(action as AllowedAction)) {
      console.warn(
        `[SECURITY] Blocked invalid MediaWiki action: ${action} from ${request.headers.get("x-forwarded-for") || "unknown"}`
      );
      return NextResponse.json(
        {
          error: "Invalid action",
          allowed: ALLOWED_ACTIONS,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Build sanitized query string with only safe parameters
    const safeParams = new URLSearchParams();
    const allowedParams = [
      "action",
      "format",
      "formatversion",
      "prop",
      "titles",
      "search",
      "srsearch",
      "srprop",
      "srlimit",
      "srnamespace",
      "srwhat",
      "limit",
      "exintro",
      "explaintext",
      "piprop",
      "rvprop",
      "rvslots",
      "rvsection",
      "iiprop",
      "iilimit",
      "iiurlwidth",
      "origin",
      "list",
      "generator",
      "gcmtitle",
      "gcmlimit",
      "cmtitle",
      "cmlimit",
      "cmprop",
      "cmnamespace",
      "cmtype",
      "cmcontinue",
      "aiprefix",
      "aiprop",
      "ailimit",
      "aisort",
      "aicontinue",
      "redirects",
    ];

    for (const param of allowedParams) {
      const value = url.searchParams.get(param);
      if (value !== null) {
        safeParams.set(param, value);
      }
    }

    // Always force JSON format for security
    safeParams.set("format", "json");

    const queryString = safeParams.toString();

    // Proxy to iiwiki.com with proper User-Agent
    const iiwikiUrl = `https://iiwiki.com/api.php?${queryString}`;

    const response = await fetch(iiwikiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "IxStats-Builder",
        "Api-User-Agent": "IxStats-Builder",
        Accept: "application/json",
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      // Check if it's a Cloudflare challenge
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        const body = await response.text();
        if (
          body.includes("Just a moment") ||
          body.includes("cf_chl_opt") ||
          body.includes("challenge-platform")
        ) {
          console.warn(
            "[IIWiki Proxy] Cloudflare challenge detected. iiwiki may be blocking automated requests."
          );
          return NextResponse.json(
            {
              error: "Cloudflare protection active on iiwiki.com. Please try again later.",
              cloudflare: true,
            },
            { status: 503, headers: corsHeaders }
          );
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("IIWiki proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to IIWiki" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}
