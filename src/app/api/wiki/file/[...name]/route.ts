/**
 * src/app/api/wiki/file/[...name]/route.ts — a file uploaded to WikiOS, served from WikiOS (plan 411).
 *
 * An upload is served from here at once (`wiki_assets.url` is `/api/wiki/file/<name>`), straight from the staging
 * directory, while the `upload` mirror job puts the same bytes in MediaWiki. Once MediaWiki holds them the asset's URL is
 * its `/images/...` path and this route answers 302 to it; a name WikiOS knows no file for, or whose `File:` page was
 * deleted, is 404.
 *
 * What is served is only what the upload checked it to be (core/file-sniff.ts): `Content-Type` is the stored,
 * sniffed type, never one taken from the name, with `nosniff`. An SVG is a document: its own sandbox CSP is replaced by the
 * app's (src/proxy.ts), so it renders inline only when the browser says it is loading an image and is a download
 * otherwise (the same rules as the media proxies: `imageResponseHeaders`). A PDF is always a download.
 *
 * ponytail: `?width=` is ignored and the original is sent (a browser scales it); no thumbnails are made in the window
 * before MediaWiki holds the file. Add sharp-based thumbnails here if that window ever matters.
 */

import { NextRequest, NextResponse } from "next/server";
import { MEDIA_CORS_HEADERS } from "~/app/api/mediawiki/_config";
import {
  hasMalformedPercentEncoding,
  imageResponseHeaders,
} from "~/app/api/mediawiki/_media-response";
import { wikiMediaRateLimitResponse } from "~/app/api/mediawiki/_rate-limit";
import { archivedTitlesAmong } from "~/lib/wiki-os/core/archived-titles";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { readStaged } from "~/lib/wiki-os/services/upload-staging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A staged file may be replaced by a new version in minutes, so it is revalidated rather than cached for a day. */
const CACHE_CONTROL = "public, max-age=300";
/** A staged SVG is the one document an upload may be: no shared cache (an edge, a proxy) keeps a copy that may be deleted next. */
const SVG_CACHE_CONTROL = "private, no-store";
/** The types an upload can be (core/file-sniff.ts): anything else in a row is not served. */
const IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const PDF_TYPE = "application/pdf";

const status = (code: number): NextResponse =>
  new NextResponse(null, { status: code, headers: MEDIA_CORS_HEADERS });

export function OPTIONS(): NextResponse {
  return status(200);
}

/** Whether the request's `If-None-Match` already names `etag`. */
function isCached(request: NextRequest, etag: string): boolean {
  const given = request.headers.get("If-None-Match");
  return given !== null && given.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag);
}

/** `name` as a download name: no quote, slash or control character can end the header's value early. */
function downloadName(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]+/g, "_") || "file";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string[] }> }
): Promise<NextResponse> {
  const limited = await wikiMediaRateLimitResponse(request, "wiki file");
  if (limited) return limited;
  if (hasMalformedPercentEncoding(request.nextUrl.pathname)) return status(400);

  const { name } = await params;
  const canon = canonicalizeTitle(`File:${name.join("/")}`);
  if (!canon || canon.namespaceId !== 6) return status(404);

  const asset = await MediaAssetService.findByFileName(canon.base);
  if (!asset || (await archivedTitlesAmong([canon.title])).has(canon.title)) return status(404);

  // MediaWiki holds the bytes now: it serves them (nginx, static files).
  if (!MediaAssetService.isStagedUrl(asset.url)) {
    return new NextResponse(null, {
      status: 302,
      headers: {
        ...MEDIA_CORS_HEADERS,
        Location: new URL(asset.url, request.url).toString(),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  }

  const isImage = IMAGE_TYPES.has(asset.mimeType);
  if (!asset.sha1 || (!isImage && asset.mimeType !== PDF_TYPE)) return status(404);
  const etag = `"${asset.sha1}"`;
  const bytes = await readStaged(asset.sha1);
  if (!bytes) return status(404);

  const headers = isImage
    ? imageResponseHeaders(asset.mimeType, {
        headers: request.headers,
        fileName: asset.filename,
        cacheControl: asset.mimeType === "image/svg+xml" ? SVG_CACHE_CONTROL : CACHE_CONTROL,
      })
    : {
        ...MEDIA_CORS_HEADERS,
        "Content-Type": PDF_TYPE,
        "Content-Disposition": `attachment; filename="${downloadName(asset.filename)}"`,
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      };
  if (isCached(request, etag))
    return new NextResponse(null, { status: 304, headers: { ...headers, ETag: etag } });
  // `readFile` gives a Buffer over an ordinary ArrayBuffer (never a shared one): the same bytes, no copy.
  return new NextResponse(
    new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength),
    {
      status: 200,
      headers: { ...headers, ETag: etag, "Content-Length": String(bytes.byteLength) },
    }
  );
}
