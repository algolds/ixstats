import { type NextRequest, NextResponse } from "next/server";
import { MEDIAWIKI_CONFIG, buildApiUrl } from "~/lib/wiki-os/config";
import { getArticleWikitext, getInfobox } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { invalidateCache } from "~/lib/cache";

// Use values from the shared configuration
const RATE_LIMIT_WINDOW = MEDIAWIKI_CONFIG.rateLimit.windowMs; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = MEDIAWIKI_CONFIG.rateLimit.maxRequests; // 30 requests per minute

// Simple in-memory rate limiting with cleanup (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired rate limit entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, limit] of rateLimitMap.entries()) {
      if (now > limit.resetTime) rateLimitMap.delete(key);
    }
  },
  5 * 60 * 1000
);

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  return `mediawiki_${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    // Reset window
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime };
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime };
  }

  limit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - limit.count,
    resetTime: limit.resetTime,
  };
}

type RateLimit = ReturnType<typeof checkRateLimit>;

const rateLimitHeaders = (rateLimit: RateLimit) => ({
  "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
  "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  "X-RateLimit-Reset": rateLimit.resetTime.toString(),
});

const publicCache = (ttlSeconds: number) => `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

/** Enhanced infobox extraction endpoint. */
async function handleInfobox(pageName: string, rateLimit: RateLimit) {
  try {
    console.log(`[MediaWiki API] Getting complete infobox for: ${pageName}`);
    const infobox = await getInfobox(pageName, "ixwiki");

    if (!infobox) {
      return NextResponse.json(
        {
          error: "No infobox found",
          message: `Could not find or parse infobox for ${pageName}`,
          page: pageName,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        fields: infobox.fields,
        templateName: infobox.templateName,
        meta: {
          page: pageName,
          extractionSuccessful: true,
          hasParsedData: !!infobox.fields,
          parsedDataKeys: infobox.fields ? infobox.fields.length : 0,
          timestamp: new Date().toISOString(),
          extractionMethod: "complete_template_parsing",
        },
      },
      {
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Cache-Control": publicCache(MEDIAWIKI_CONFIG.cache.infoboxTtl / 1000),
        },
      }
    );
  } catch (error) {
    console.error(`[MediaWiki API] Error getting infobox for ${pageName}:`, error);
    return NextResponse.json(
      {
        error: "Failed to parse infobox",
        message: errorMessage(error),
        page: pageName,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/** Full content endpoint for debugging/development. */
async function handleFullContent(pageName: string, rateLimit: RateLimit) {
  try {
    const res = await getArticleWikitext(pageName, "ixwiki");
    const wikitext = res?.wikitext ?? null;

    if (!wikitext || typeof wikitext !== "string") {
      return NextResponse.json(
        {
          error: "Failed to get page wikitext",
          page: pageName,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        wikitext,
        meta: {
          page: pageName,
          wikitextLength: wikitext.length,
          method: "query_revisions_section_0",
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Cache-Control": publicCache(MEDIAWIKI_CONFIG.cache.pageTtl / 1000),
        },
      }
    );
  } catch (error) {
    console.error(`[MediaWiki API] Exception getting wikitext for ${pageName}:`, error);
    return NextResponse.json(
      {
        error: "Exception during wikitext retrieval",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        page: pageName,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

const LONG_CONTENT_CHARS = 1500;

/** Fetches the MediaWiki API: POST for long content (avoids URI-too-long), GET otherwise. */
async function fetchMediaWiki(params: Record<string, string>, text: string | undefined) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEDIAWIKI_CONFIG.timeout);
  const headers = { "User-Agent": MEDIAWIKI_CONFIG.userAgent, Accept: "application/json" };

  try {
    if (text && text.length > LONG_CONTENT_CHARS) {
      console.log(`[MediaWiki API] Making POST request for long content (${text.length} chars)`);
      return await fetch(`${MEDIAWIKI_CONFIG.baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
        signal: controller.signal,
      });
    }

    const apiUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);
    console.log(`[MediaWiki API] Making GET request to: ${apiUrl}`);
    return await fetch(apiUrl, { method: "GET", headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function fetchFailureResponse(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[MediaWiki API] Request failed:", error);
  }
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error occurred" }, { status: 500 });
  }
  if (error.name === "AbortError") {
    return NextResponse.json(
      { error: "Request timeout", message: "MediaWiki API request timed out" },
      { status: 408 }
    );
  }
  return NextResponse.json(
    { error: "Failed to fetch from MediaWiki API", message: error.message, type: error.name },
    { status: 500 }
  );
}

async function handleMediaWikiRequest(
  request: NextRequest,
  searchParams: URLSearchParams,
  requestBody?: any
) {
  const rateLimit = checkRateLimit(getRateLimitKey(request));

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
        resetTime: rateLimit.resetTime,
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const wantsInfobox = searchParams.get("getInfoboxHtml") === "true";
  if (wantsInfobox || searchParams.get("getFullContent") === "true") {
    const pageName = searchParams.get("page");
    if (!pageName) {
      return NextResponse.json({ error: "Missing required parameter: page" }, { status: 400 });
    }
    return wantsInfobox
      ? handleInfobox(pageName, rateLimit)
      : handleFullContent(pageName, rateLimit);
  }

  // Standard API proxy
  if (!searchParams.get("action")) {
    return NextResponse.json({ error: "Missing required parameter: action" }, { status: 400 });
  }

  // Query parameters, overridden by any defined request-body fields (POST requests)
  const params: Record<string, string> = {
    ...Object.fromEntries(searchParams),
    ...Object.fromEntries(
      Object.entries(requestBody ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ),
  };
  params.format ||= "json";
  params.formatversion ||= "2";

  let response;
  try {
    response = await fetchMediaWiki(params, requestBody?.text);
  } catch (error) {
    return fetchFailureResponse(error);
  }

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[MediaWiki API] HTTP Error: ${response.status} ${response.statusText}`);
    }
    const notFound = response.status === 404;
    return NextResponse.json(
      {
        error: `MediaWiki API returned status ${response.status}`,
        message: response.statusText,
        status: response.status,
        ...(notFound && { notFound: true }),
      },
      { status: notFound ? 200 : response.status, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const data = await response.json();

  if (data.error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[MediaWiki API] API Error:`, data.error);
    }
    return NextResponse.json(
      {
        error: "MediaWiki API Error",
        code: data.error.code,
        message: data.error.info || data.error.message,
        details: data.error,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(data, {
    headers: {
      ...rateLimitHeaders(rateLimit),
      "Cache-Control": publicCache(MEDIAWIKI_CONFIG.cache.pageTtl / 1000 / 12), // 5 minute cache
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return handleMediaWikiRequest(request, searchParams);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let requestBody = {};

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      requestBody = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      requestBody = Object.fromEntries(formData.entries());
    }
  } catch (error) {
    console.error("[MediaWiki API] Error parsing request body:", error);
  }

  return handleMediaWikiRequest(request, searchParams, requestBody);
}

/**
 * Clear cache for a specific country
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryName = searchParams.get("country");

    if (!countryName) {
      return NextResponse.json(
        {
          success: false,
          error: "Country name is required",
        },
        { status: 400 }
      );
    }

    // Clear cache for the specific country
    invalidateCache([`wiki:${countryName}`]);

    console.log(
      `[MediaWiki API] Cache cleared for country: ${countryName} - will use enhanced template and wikilink processing`
    );

    return NextResponse.json({
      success: true,
      message: `Cache cleared for ${countryName}. The country will now use enhanced template and wikilink processing with clickable links.`,
      country: countryName,
      features: [
        "Enhanced template processing ({{wp}}, {{link}}, etc.)",
        "Clickable wikilinks with color #429284",
        "Proper HTML rendering with hover effects",
        "XSS protection and URL normalization",
      ],
    });
  } catch (error) {
    console.error("[MediaWiki API] Error clearing cache:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
