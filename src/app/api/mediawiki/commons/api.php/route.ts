import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/rate-limiter";

const ALLOWED_ACTIONS = ["query", "opensearch", "parse"] as const;
type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

const ALLOWED_ORIGINS = [
  "https://commons.wikimedia.org",
  "https://upload.wikimedia.org",
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3550"]
    : []),
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitResult = await rateLimiter.check(clientIp, "wiki_proxy");
    if (!rateLimitResult.success) {
      console.warn(`[SECURITY] Rate limit exceeded for Commons proxy: ip=${clientIp}`);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (!action || !ALLOWED_ACTIONS.includes(action as AllowedAction)) {
      return NextResponse.json(
        { error: "Invalid action", allowed: ALLOWED_ACTIONS },
        { status: 400, headers: corsHeaders }
      );
    }

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

    safeParams.set("format", "json");
    const queryString = safeParams.toString();
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?${queryString}`;

    const response = await fetch(commonsUrl, {
      method: "GET",
      headers: {
        "User-Agent": "IxStats-Builder",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Commons proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to Wikimedia Commons" },
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
