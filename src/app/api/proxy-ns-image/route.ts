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
 * - Only nationstates.net / Wikimedia domains are ever fetched, redirects
 *   included, and only images are served (`_lib/image-proxy.ts`).
 * - Responses are cached for 24h so NS is not repeatedly re-hit.
 */

import { NextRequest, NextResponse } from "next/server";
import { withBasePath } from "~/lib/base-path";
import {
  fetchImage,
  imageProxyRateLimitResponse,
  imageResponse,
  parseAllowedUrl,
} from "../_lib/image-proxy";

const ALLOWED_HOSTS = [
  "www.nationstates.net",
  "nationstates.net",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
];
const CACHE_DURATION = 24 * 60 * 60;

/**
 * GET /api/proxy-ns-image?url=<encoded_ns_image_url>
 */
export async function GET(request: NextRequest) {
  const limited = await imageProxyRateLimitResponse(request, "image_proxy_ns");
  if (limited) return limited;

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }
  const url = parseAllowedUrl(raw, ALLOWED_HOSTS);
  if (!url) {
    return NextResponse.json(
      { error: "URL must be from nationstates.net or Wikimedia" },
      { status: 403 }
    );
  }

  const image = await fetchImage(url, ALLOWED_HOSTS, { next: { revalidate: CACHE_DURATION } });
  if (!image) {
    // Fall back to a local placeholder instead of bypassing NS's block.
    return NextResponse.redirect(
      new URL(withBasePath("/images/cards/lore-placeholder.svg"), request.url),
      { status: 307 }
    );
  }

  return imageResponse(image, CACHE_DURATION, request.headers, { "X-Proxied-From": url.hostname });
}
