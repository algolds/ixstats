/**
 * Media proxy for the local ixwiki.com install.
 *
 * SECURITY: this is an image-only proxy, not a general reverse proxy. Only these request shapes are
 * served; everything else is a 404 and never reaches MediaWiki:
 *   - `images/...` (including `images/thumb/...`)
 *   - `wiki/Special:FilePath/<name>`
 *   - `wiki/File:<name>` / `wiki/Image:<name>` (rewritten to Special:FilePath)
 *   - a bare image file name (rewritten to Special:FilePath)
 *   - `thumb.php?f=<name>&width=<n>` (only `f` and a numeric `width`/`w` are forwarded)
 * Other than those, only a numeric `width` query parameter is forwarded, and every success response
 * goes through `imageOnlyResponse` (`image/*` only, 15 MB cap, nosniff).
 */
import { NextRequest, NextResponse } from "next/server";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { MEDIA_CORS_HEADERS } from "../../_config";
import { imageOnlyResponse } from "../../_media-response";

const corsHeaders = MEDIA_CORS_HEADERS;

const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i;
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

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // malformed percent-encoding — keep the raw segment
    return segment;
  }
}

interface MediaTarget {
  /** Origin path segments (decoded; `encodePath` re-encodes them). */
  path: string[];
  /** The origin query string: empty, or `?` plus whitelisted parameters only. */
  query: string;
  /** The file the request is for: a thumb.php `f`, or the last path segment. */
  fileName: string;
}

function isUnsafeSegment(segment: string): boolean {
  return segment === "" || segment === "." || segment === ".." || /[\\/]/.test(segment);
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
  if (!file || file.length > MAX_FILE_NAME_LENGTH || /[\\/\x00-\x1F]/.test(file)) return null;
  const width = numericParam(params, "width", "w");
  const query = `?f=${encodeURIComponent(file)}${width ? `&width=${width}` : ""}`;
  return { path: ["thumb.php"], query, fileName: file };
}

/**
 * Map the request onto the origin resource it may fetch, or null when it is not a media request.
 * Segments are decoded first so `%2e%2e` / `%2F` tricks cannot smuggle a traversal past the prefix check.
 */
function resolveMediaTarget(rawSegments: string[], params: URLSearchParams): MediaTarget | null {
  const segments = rawSegments.map(safeDecode);
  if (segments.some(isUnsafeSegment)) return null;

  const [first, second, ...rest] = segments;
  if (segments.length === 1 && first === "thumb.php") return thumbTarget(params);
  if (segments.length === 1 && first && IMAGE_FILE.test(first)) {
    return pathTarget(["wiki", "Special:FilePath", first], params);
  }
  if (first === "images" && second) return pathTarget(segments, params);
  if (first === "wiki" && second) {
    if (rest.length > 0) {
      return second.toLowerCase() === "special:filepath" ? pathTarget(segments, params) : null;
    }
    const fileName = FILE_PAGE.exec(second)?.[1];
    return fileName ? pathTarget(["wiki", "Special:FilePath", fileName], params) : null;
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
    const target = resolveMediaTarget(path, request.nextUrl.searchParams);
    if (!target) return notFound();

    const baseUrl = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
    const targetUrl = `${baseUrl}/${encodePath(target.path)}${target.query}`;

    // Thumbnail names (`300px-Foo.png`) map back to the original file name.
    const isImageFile = IMAGE_FILE.test(target.fileName);
    const cleanFilename = target.fileName
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
