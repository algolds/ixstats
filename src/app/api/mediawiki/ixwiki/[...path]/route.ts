/**
 * Media proxy for the local ixwiki.com install.
 *
 * SECURITY: this is an image-only proxy, not a general reverse proxy. Only these request shapes are
 * served; everything else is a 404 and never reaches MediaWiki:
 *   - `images/...` (including `images/thumb/...`)
 *   - `wiki/Special:FilePath/<name>`
 *   - `wiki/File:<name>` / `wiki/Image:<name>` / `wiki/Special:Redirect/file/<name>` (rewritten to Special:FilePath)
 *   - a bare image file name (rewritten to Special:FilePath)
 *   - `thumb.php?f=<name>&width=<n>` (only `f` and a numeric `width`/`w` are forwarded)
 * Other than those, only a numeric `width` query parameter is forwarded, and every success response
 * goes through `imageOnlyResponse` (`image/*` only, 15 MB cap, nosniff).
 */
import { NextRequest, NextResponse } from "next/server";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { DEFAULT_USER_AGENT, mediaWikiOrigin } from "~/lib/wiki-os/config";
import { MEDIA_CORS_HEADERS } from "../../_config";
import {
  encodePath,
  fetchFromAllowedHost,
  hasMalformedPercentEncoding,
  imageOnlyResponse,
  isUnsafeSegment,
} from "../../_media-response";
import { wikiMediaRateLimitResponse } from "../../_rate-limit";

const corsHeaders = MEDIA_CORS_HEADERS;

const IMAGE_FILE = /\.(?:png|apng|jpe?g|gif|webp|svg|ico|avif|bmp|tiff?)$/i;
const WIDTH_PARAM = /^\d{1,4}$/;
/** A `wiki/File:<name>` description-page path; the captured group is the file name. */
const FILE_PAGE = /^(?:file|image):(.+)$/i;
const MAX_FILE_NAME_LENGTH = 255;
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

interface MediaTarget {
  /** Origin path segments (decoded; `encodePath` re-encodes them). */
  path: string[];
  /** The origin query string: empty, or `?` plus whitelisted parameters only. */
  query: string;
  /** The file the request is for: a thumb.php `f`, or the last path segment. */
  fileName: string;
}

/** The first of `names` whose value is a plain number of at most four digits. */
function numericParam(params: URLSearchParams, ...names: string[]): string | null {
  for (const name of names) {
    const value = params.get(name);
    if (value && WIDTH_PARAM.test(value)) return value;
  }
  return null;
}

function pathTarget(path: string[], params: URLSearchParams): MediaTarget {
  const width = numericParam(params, "width");
  return { path, query: width ? `?width=${width}` : "", fileName: path[path.length - 1] ?? "" };
}

/** `thumb.php?f=<name>[&width=<n>|&w=<n>]`: nothing but the file name and a numeric width is forwarded. */
function thumbTarget(params: URLSearchParams): MediaTarget | null {
  const file = params.get("f")?.trim();
  if (!file || file.length > MAX_FILE_NAME_LENGTH || isUnsafeSegment(file) || /[\x00-\x1F]/.test(file)) {
    return null;
  }
  const width = numericParam(params, "width", "w");
  const query = `?f=${encodeURIComponent(file)}${width ? `&width=${width}` : ""}`;
  return { path: ["thumb.php"], query, fileName: file };
}

/**
 * Map the request onto the origin resource it may fetch, or null when it is not a media request.
 * `segments` were already percent-decoded once by Next and are not decoded again (a literal `%41`
 * stays `%41`); every segment, and any file name taken from a rewritten shape, is checked for
 * traversal and slashes.
 */
function resolveMediaTarget(segments: string[], params: URLSearchParams): MediaTarget | null {
  if (segments.some(isUnsafeSegment)) return null;

  const [first, second, ...rest] = segments;
  if (segments.length === 1 && first === "thumb.php") return thumbTarget(params);
  if (segments.length === 1 && first && IMAGE_FILE.test(first)) {
    return pathTarget(["wiki", "Special:FilePath", first], params);
  }
  if (first === "images" && second) return pathTarget(segments, params);
  if (first === "wiki" && second) return wikiPageTarget(second, rest, params);
  return null;
}

/** The `wiki/...` shapes: Special:FilePath as-is; File:, Image: and Special:Redirect/file/ rewritten to it. */
function wikiPageTarget(second: string, rest: string[], params: URLSearchParams): MediaTarget | null {
  const namespace = second.toLowerCase();
  if (namespace === "special:filepath") {
    return rest.length > 0 ? pathTarget(["wiki", second, ...rest], params) : null;
  }

  let fileName: string | undefined;
  if (namespace === "special:redirect") {
    if (rest.length === 2 && rest[0]?.toLowerCase() === "file") fileName = rest[1];
  } else if (rest.length === 0) {
    fileName = FILE_PAGE.exec(second)?.[1];
  }
  return fileName && !isUnsafeSegment(fileName)
    ? pathTarget(["wiki", "Special:FilePath", fileName], params)
    : null;
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
  const filePathRes = await fetchFromAllowedHost(
    `${baseUrl}/wiki/Special:FilePath/${encodeURIComponent(cleanFilename)}`,
    headers,
    10000
  ).catch(() => null);
  if (filePathRes?.ok) return filePathRes;

  const { getMd5ShardPath } = await import("~/lib/wiki-os/transformers/image-url");
  const { fullPath } = getMd5ShardPath(cleanFilename);
  const commonsRes = await fetchFromAllowedHost(
    `https://upload.wikimedia.org/wikipedia/commons/${fullPath}`,
    headers,
    10000
  ).catch(() => null);
  return commonsRes?.ok ? commonsRes : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const limited = await wikiMediaRateLimitResponse(request, "ixwiki media");
  if (limited) return limited;
  if (hasMalformedPercentEncoding(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 400, headers: corsHeaders });
  }

  try {
    const { path } = await params;
    const target = resolveMediaTarget(path, request.nextUrl.searchParams);
    if (!target) return notFound();

    const baseUrl = mediaWikiOrigin();
    const targetUrl = `${baseUrl}/${encodePath(target.path)}${target.query}`;

    // Thumbnail names (`300px-Foo.png`) map back to the original file name.
    const isImageFile = IMAGE_FILE.test(target.fileName);
    const cleanFilename = target.fileName
      .replace(/^(\d+px-)/i, "")
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "")
      .trim();

    let response: Response | null = await fetchFromAllowedHost(
      targetUrl,
      { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
      10000
    ).catch(() => null);

    if (!response?.ok && isImageFile && cleanFilename) {
      response = (await fetchImageFallback(baseUrl, cleanFilename).catch(() => null)) ?? response;
    }

    if (!response?.ok) {
      // The upstream error body is never relayed: it could be HTML served from our origin.
      return new NextResponse(null, { status: response?.status || 404, headers: corsHeaders });
    }

    const result = await imageOnlyResponse(response, { headers: request.headers, fileName: target.fileName });
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
