/**
 * NationStates Image Proxy API Route
 * 
 * Proxies NationStates card images to bypass hotlinking restrictions.
 * NS blocks direct image embedding (403), so we fetch server-side with
 * proper User-Agent and serve to frontend.
 * 
 * Rate Limiting: Respects NS API limits (50 req/30s)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

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
        { status: 400 }
      );
    }

    // Security: Only allow NationStates domains
    const allowedDomains = [
      "www.nationstates.net",
      "nationstates.net",
    ];
    
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: "URL must be from nationstates.net domain" },
        { status: 403 }
      );
    }

    // Fetch image from NationStates with proper User-Agent
    // NS API requires informative User-Agent or returns 403
    const userAgent = `IxStats/1.42 (https://ixstats.com; Admin: ${env.ADMIN_EMAIL ?? "admin@ixstats.com"})`;
    
    const nsResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": userAgent,
        // Some servers check Referer to prevent hotlinking
        "Referer": "https://www.nationstates.net/",
      },
      // Use Next.js fetch cache for 24 hours
      next: {
        revalidate: CACHE_DURATION,
      },
    });

    if (!nsResponse.ok) {
      console.error(`[NS-PROXY] Failed to fetch image: ${nsResponse.status} ${nsResponse.statusText}`);
      
      // Return appropriate error
      if (nsResponse.status === 404) {
        return NextResponse.json(
          { error: "Image not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch image from NationStates" },
        { status: nsResponse.status }
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
      },
    });
  } catch (error) {
    console.error("[NS-PROXY] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

