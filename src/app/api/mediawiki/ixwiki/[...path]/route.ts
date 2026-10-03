import { NextRequest, NextResponse } from "next/server";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { Cache } from "~/lib/cache";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

const mediaBufferCache = new Cache<{ buffer: ArrayBuffer; contentType: string }>({
  defaultTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 500,
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

const IMAGE_FILE = /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i;
const FALLBACK_HEADERS = {
  "User-Agent": "IxStats/1.4 (https://ixwiki.com; info@ixwiki.com)",
  Accept: "image/*,*/*",
};

/** A successful response, or null on any failure. */
async function fetchOk(url: string, init: RequestInit): Promise<Response | null> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) }).catch(() => null);
  return res?.ok ? res : null;
}

/** Registers a newly seen image in the `wiki_assets` table; failures are ignored. */
function registerAssetIfNew(filename: string, originBaseUrl: string) {
  void MediaAssetService.findAsset(filename)
    .then(
      (existing) =>
        existing || MediaAssetService.registerAsset({ filename, originBaseUrl }).catch(() => null)
    )
    .catch(() => null);
}

/**
 * Resolves a missing image through MediaWiki's canonical Special:FilePath (local uploads and
 * InstantCommons redirects), then the direct Wikimedia Commons MD5 shard.
 */
async function fetchImageFallback(filename: string, baseUrl: string): Promise<Response | null> {
  try {
    const viaFilePath = await fetchOk(
      `${baseUrl}/wiki/Special:FilePath/${encodeURIComponent(filename)}`,
      { method: "GET", headers: FALLBACK_HEADERS, redirect: "follow" }
    );
    if (viaFilePath) return viaFilePath;

    const { getMd5ShardPath } = await import("~/lib/wiki-os/transformers/image-url");
    const { fullPath } = getMd5ShardPath(filename);
    return await fetchOk(`https://upload.wikimedia.org/wikipedia/commons/${fullPath}`, {
      headers: FALLBACK_HEADERS,
    });
  } catch {
    return null;
  }
}

/** Image-ness and the bare filename (no `123px-` thumbnail prefix) of a media path's last segment. */
function parseMediaFilename(lastSegment: string) {
  let decoded = lastSegment;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    // malformed percent-encoding — keep the raw segment
  }
  return {
    isImageFile: IMAGE_FILE.test(decoded),
    cleanFilename: decoded
      .replace(/^(\d+px-)/i, "")
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "")
      .trim(),
  };
}

function mediaResponse(body: ArrayBuffer, contentType: string, cacheControl: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": contentType, "Cache-Control": cacheControl, ...corsHeaders },
  });
}

const IMMUTABLE = "public, max-age=31536000, immutable";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";

    const cacheKey = `${subpath}${queryString}`;
    const cachedMedia = mediaBufferCache.get(cacheKey);
    if (cachedMedia) return mediaResponse(cachedMedia.buffer, cachedMedia.contentType, IMMUTABLE);

    const baseUrl = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");

    const { isImageFile, cleanFilename } = parseMediaFilename(path[path.length - 1] || "");
    const isNamedImage = isImageFile && cleanFilename;

    if (isNamedImage) registerAssetIfNew(cleanFilename, baseUrl);

    // Fetch from the origin media source, falling back for missing images
    let response = await fetch(`${baseUrl}/${subpath}${queryString}`, {
      method: "GET",
      headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (!response?.ok && isNamedImage) {
      response = (await fetchImageFallback(cleanFilename, baseUrl)) ?? response;
    }

    if (!response?.ok) {
      return new NextResponse(response?.body || "Not Found", {
        status: response?.status || 404,
        headers: {
          "Content-Type": response?.headers.get("Content-Type") || "text/plain",
          ...corsHeaders,
        },
      });
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    if (isImageFile) mediaBufferCache.set(cacheKey, { buffer: arrayBuffer, contentType });

    return mediaResponse(
      arrayBuffer,
      contentType,
      isImageFile ? IMMUTABLE : "public, max-age=86400, stale-while-revalidate=604800"
    );
  } catch (error) {
    console.error("[IxWiki Proxy] Catch-all error:", error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
