/**
 * Media proxy for the local ixwiki.com install.
 *
 * SECURITY: this is an image-only proxy, not a general reverse proxy. Only three path shapes are
 * served (`images/...`, `wiki/Special:FilePath/<name>`, or a bare image file name which is rewritten
 * to Special:FilePath); everything else is a 404 and never reaches MediaWiki. Only a numeric `width`
 * query parameter is forwarded, and every success response goes through `imageOnlyResponse`
 * (`image/*` only, 15 MB cap, nosniff).
 */
import { NextRequest, NextResponse } from "next/server";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { MEDIA_CORS_HEADERS } from "../../_config";
import { imageOnlyResponse } from "../../_media-response";

const corsHeaders = MEDIA_CORS_HEADERS;

const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i;
const WIDTH_PARAM = /^\d{1,4}$/;
const FALLBACK_USER_AGENT = "IxStats/1.4 (https://ixwiki.com; info@ixwiki.com)";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: corsHeaders });
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // malformed percent-encoding — keep the raw segment
    return segment;
  }
}

/**
 * Map the requested sub-path onto the origin path it may fetch, or null when it is not a media path.
 * Segments are decoded first so `%2e%2e` / `%2F` tricks cannot smuggle a traversal past the prefix check.
 */
function resolveMediaPath(rawSegments: string[]): string[] | null {
  const segments = rawSegments.map(safeDecode);
  if (segments.some((s) => s === "" || s === "." || s === ".." || /[\\/]/.test(s))) return null;

  const [first, second, ...rest] = segments;
  if (segments.length === 1 && first && IMAGE_FILE.test(first)) {
    return ["wiki", "Special:FilePath", first];
  }
  if (first === "images" && second) return segments;
  if (first === "wiki" && second?.toLowerCase() === "special:filepath" && rest.length > 0) {
    return segments;
  }
  return null;
}

/** `:` stays literal so `Special:FilePath` keeps its canonical form. */
function encodePath(segments: string[]): string {
  return segments.map((s) => encodeURIComponent(s).replace(/%3A/gi, ":")).join("/");
}

function registerAssetOnce(filename: string, originBaseUrl: string): void {
  void MediaAssetService.findAsset(filename)
    .then(async (existing) => {
      if (!existing) await MediaAssetService.registerAsset({ filename, originBaseUrl }).catch(() => null);
    })
    .catch(() => null);
}

/** Try MediaWiki's canonical Special:FilePath (local uploads, InstantCommons), then the Commons MD5 shard. */
async function fetchImageFallback(baseUrl: string, cleanFilename: string): Promise<Response | null> {
  const headers = { "User-Agent": FALLBACK_USER_AGENT, Accept: "image/*,*/*" };
  const filePathRes = await fetch(`${baseUrl}/wiki/Special:FilePath/${encodeURIComponent(cleanFilename)}`, {
    method: "GET",
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (filePathRes?.ok) return filePathRes;

  const { getMd5ShardPath } = await import("~/lib/wiki-os/transformers/image-url");
  const { fullPath } = getMd5ShardPath(cleanFilename);
  const commonsRes = await fetch(`https://upload.wikimedia.org/wikipedia/commons/${fullPath}`, {
    headers,
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  return commonsRes?.ok ? commonsRes : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const mediaPath = resolveMediaPath(path);
    if (!mediaPath) return notFound();

    const width = request.nextUrl.searchParams.get("width");
    const queryString = width && WIDTH_PARAM.test(width) ? `?width=${width}` : "";

    const baseUrl = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
    const targetUrl = `${baseUrl}/${encodePath(mediaPath)}${queryString}`;

    // Thumbnail names (`300px-Foo.png`) map back to the original file name.
    const lastSegment = mediaPath[mediaPath.length - 1] ?? "";
    const isImageFile = IMAGE_FILE.test(lastSegment);
    const cleanFilename = lastSegment
      .replace(/^(\d+px-)/i, "")
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "")
      .trim();

    let response: Response | null = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (!response?.ok && isImageFile && cleanFilename) {
      response = (await fetchImageFallback(baseUrl, cleanFilename).catch(() => null)) ?? response;
    }

    if (!response?.ok) {
      // The upstream error body is never relayed: it could be HTML served from our origin.
      return new NextResponse(null, { status: response?.status || 404, headers: corsHeaders });
    }

    const result = await imageOnlyResponse(response);
    // Register in `wiki_assets` only for files that really answered with an image.
    if (result.status === 200 && isImageFile && cleanFilename) {
      registerAssetOnce(cleanFilename, baseUrl);
    }
    return result;
  } catch (error) {
    console.error("[IxWiki Proxy] Catch-all error:", error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
