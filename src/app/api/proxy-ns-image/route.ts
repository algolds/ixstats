/**
 * NationStates Image Proxy API Route
 *
 * Proxies NationStates card images so the flag of a nation imported by its
 * owner can be displayed on IxCards. Fetches server-side with a proper
 * User-Agent and serves to the frontend.
 *
 * Compliance notes:
 * - No Referer header is spoofed. NS may block image requests that do not
 *   originate from its own pages (403); when that happens we fall back to a
 *   local placeholder rather than circumventing the block.
 * - Only nationstates.net domains are ever fetched.
 * - Responses are cached for 24h so NS is not repeatedly re-hit.
 */

import { NextRequest, NextResponse } from "next/server";
import { withBasePath } from "~/lib/base-path";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Cache successful image fetches for 24 hours
const CACHE_DURATION = 24 * 60 * 60; // 24 hours in seconds

/**
 * GET /api/proxy-ns-image?url=<encoded_ns_image_url>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get("url");

    // Validate URL parameter
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing 'url' parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Security: Only allow trusted card image domains (NationStates & Wikimedia Commons)
    const allowedDomains = [
      "www.nationstates.net",
      "nationstates.net",
      "upload.wikimedia.org",
      "commons.wikimedia.org",
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: "URL must be from nationstates.net domain" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Fetch image from NationStates with a proper User-Agent.
    // We deliberately do NOT send a Referer header: NS restricts card images
    // to its own pages, and bypassing that with a spoofed Referer would
    // violate the API Terms of Use ("Be Transparent").
    const userAgent = "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)";

    const nsResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": userAgent,
      },
      // Use Next.js fetch cache for 24 hours
      next: {
        revalidate: CACHE_DURATION,
      },
    });

    if (!nsResponse.ok) {
      console.error(
        `[NS-PROXY] Failed to fetch image: ${nsResponse.status} ${nsResponse.statusText}`
      );

      // Fall back to a local placeholder instead of bypassing NS's block.
      // The placeholder is served from our own domain, so no NS asset is
      // embedded against NS's wishes.
      return NextResponse.redirect(
        new URL(withBasePath("/images/cards/lore-placeholder.svg"), request.url),
        { status: 307, headers: corsHeaders }
      );
    }

    // Get image data and content type
    const imageBuffer = await nsResponse.arrayBuffer();
    const contentType = nsResponse.headers.get("content-type") ?? "image/jpeg";

    // Return proxied image with caching headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
        "X-Proxied-From": "nationstates.net",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[NS-PROXY] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
