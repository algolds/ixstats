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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const subpath = resolvedParams.path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";

    const cacheKey = `${subpath}${queryString}`;
    const cachedMedia = mediaBufferCache.get(cacheKey);
    if (cachedMedia) {
      return new NextResponse(cachedMedia.buffer, {
        status: 200,
        headers: {
          "Content-Type": cachedMedia.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          ...corsHeaders,
        },
      });
    }

    const baseUrl = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
    const targetUrl = `${baseUrl}/${subpath}${queryString}`;

    // Extract filename if this is an image or thumbnail path
    const lastSegment = resolvedParams.path[resolvedParams.path.length - 1] || "";
    let decodedLastSegment = lastSegment;
    try {
      decodedLastSegment = decodeURIComponent(lastSegment);
    } catch {}

    const isImageFile = /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i.test(decodedLastSegment);
    const cleanFilename = decodedLastSegment
      .replace(/^(\d+px-)/i, "")
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "")
      .trim();

    // 1. Check & Auto-register in PostgreSQL `wiki_assets` if new
    if (isImageFile && cleanFilename) {
      void MediaAssetService.findAsset(cleanFilename).then(async (existing) => {
        if (!existing) {
          await MediaAssetService.registerAsset({
            filename: cleanFilename,
            originBaseUrl: baseUrl,
          }).catch(() => null);
        }
      }).catch(() => null);
    }

    // 2. Fetch from origin media source
    let response: Response | null = null;
    try {
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      response = null;
    }

    // If direct target was 404 and it's an image, resolve via MediaWiki Special:FilePath & MD5 sharding
    if ((!response || !response.ok) && isImageFile && cleanFilename) {
      try {
        // 1. Try MediaWiki canonical Special:FilePath (handles both local uploads and InstantCommons redirects)
        const filePathUrl = `${baseUrl}/wiki/Special:FilePath/${encodeURIComponent(cleanFilename)}`;
        const fpRes = await fetch(filePathUrl, {
          method: "GET",
          headers: {
            "User-Agent": "IxStats/1.4 (https://ixwiki.com; info@ixwiki.com)",
            "Accept": "image/*,*/*",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        }).catch(() => null);

        if (fpRes && fpRes.ok) {
          response = fpRes;
        }

        // 2. If Special:FilePath didn't resolve, try direct Wikimedia Commons MD5 shard
        if (!response || !response.ok) {
          const { getMd5ShardPath } = await import("~/lib/wiki-os/transformers/image-url");
          const { fullPath } = getMd5ShardPath(cleanFilename);
          const commonsUrl = `https://upload.wikimedia.org/wikipedia/commons/${fullPath}`;
          const commonsRes = await fetch(commonsUrl, {
            headers: {
              "User-Agent": "IxStats/1.4 (https://ixwiki.com; info@ixwiki.com)",
              "Accept": "image/*,*/*",
            },
            signal: AbortSignal.timeout(10000),
          }).catch(() => null);

          if (commonsRes && commonsRes.ok) {
            response = commonsRes;
          }
        }
      } catch {
        // Fall through
      }
    }

    if (!response || !response.ok) {
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

    if (isImageFile) {
      mediaBufferCache.set(cacheKey, { buffer: arrayBuffer, contentType });
    }

    // 4. Cache media files with immutable cache controls
    const cacheControl = isImageFile
      ? "public, max-age=31536000, immutable"
      : "public, max-age=86400, stale-while-revalidate=604800";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[IxWiki Proxy] Catch-all error:", error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
