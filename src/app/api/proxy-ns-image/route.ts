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
 * - Only nationstates.net / Wikimedia domains are ever fetched.
 * - Responses are cached for 24h so NS is not repeatedly re-hit.
 */

import { NextRequest, NextResponse } from "next/server";
import { withBasePath } from "~/lib/base-path";
import { corsPreflight, fetchImage, imageResponse, IMAGE_PROXY_CORS, parseAllowedUrl } from "../_lib/image-proxy";

const ALLOWED_HOSTS = [
  "www.nationstates.net",
  "nationstates.net",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
];
const CACHE_DURATION = 24 * 60 * 60;

export const OPTIONS = corsPreflight;

/**
 * GET /api/proxy-ns-image?url=<encoded_ns_image_url>
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400, headers: IMAGE_PROXY_CORS });
  }
  const url = parseAllowedUrl(raw, ALLOWED_HOSTS);
  if (!url) {
    return NextResponse.json(
      { error: "URL must be from nationstates.net or Wikimedia" },
      { status: 403, headers: IMAGE_PROXY_CORS }
    );
  }

  const image = await fetchImage(url.toString(), { next: { revalidate: CACHE_DURATION } });
  if (!image) {
    // Fall back to a local placeholder instead of bypassing NS's block.
    return NextResponse.redirect(
      new URL(withBasePath("/images/cards/lore-placeholder.svg"), request.url),
      { status: 307, headers: IMAGE_PROXY_CORS }
    );
  }

  return imageResponse(image, CACHE_DURATION, { "X-Proxied-From": url.hostname });
}
