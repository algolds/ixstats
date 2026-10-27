/**
 * Media proxy for the external wikis (iiwiki, althistory, commons).
 *
 * - `Special:FilePath/<file>` is resolved to a direct URL via `imageinfo` (names only, never a
 *   caller-supplied URL), cached for 30 days, then fetched through wsrv.nl with a direct-fetch
 *   fallback. Only allow-listed wiki/CDN hosts are ever fetched.
 * - Other sub-paths are fetched from the wiki origin with the allow-listed UA.
 * - Every success path is image-only (`imageOnlyResponse`): non-images are refused, bodies are capped.
 *
 * The local ixwiki media route lives at `../ixwiki/[...path]` and is matched first.
 */
import { NextRequest, NextResponse } from "next/server";
import { externalApiCache } from "~/lib/cache";
import { getWiki, MEDIA_CORS_HEADERS, WIKI_USER_AGENT, type WikiConfig } from "../../_config";
import {
  encodePath,
  fetchFromAllowedHost,
  hasMalformedPercentEncoding,
  imageOnlyResponse,
  isUnsafeSegment,
  type ImageRequest,
} from "../../_media-response";
import { isAllowedMediaUrl } from "~/lib/wiki-os/media-hosts";
import { wikiMediaRateLimitResponse } from "../../_rate-limit";

const corsHeaders = MEDIA_CORS_HEADERS;
const UA_HEADERS = { "User-Agent": WIKI_USER_AGENT, "Api-User-Agent": WIKI_USER_AGENT };

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const ABSOLUTE_URL = /^https?:/i;

/** Fetch an image through wsrv.nl, falling back to a direct fetch. Only allow-listed hosts are fetched. */
async function fetchImage(url: string, label: string, image: ImageRequest): Promise<NextResponse> {
  if (!isAllowedMediaUrl(url)) return new NextResponse(null, { status: 400, headers: corsHeaders });

  const attempts: Array<() => Promise<Response | null>> = [
    () =>
      fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": WIKI_USER_AGENT },
        signal: AbortSignal.timeout(15000),
      }),
    () => fetchFromAllowedHost(url, UA_HEADERS, 15000),
  ];
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (res?.ok) return await imageOnlyResponse(res, image);
      console.warn(`[${label} Proxy] Image fetch failed (${res?.status ?? "blocked"}) for ${url}`);
    } catch (err) {
      console.error(`[${label} Proxy] Image fetch error for ${url}:`, err);
    }
  }
  return new NextResponse(null, { status: 502, headers: corsHeaders });
}

/** Resolve `File:<name>` to a direct URL via `imageinfo`, with 403 retries for fandom. */
async function resolveViaImageInfo(wiki: WikiConfig, filename: string): Promise<string | null> {
  const apiUrl = new URL(wiki.imageInfoApiUrl());
  apiUrl.searchParams.set("action", "query");
  apiUrl.searchParams.set("titles", `File:${filename}`);
  apiUrl.searchParams.set("prop", "imageinfo");
  apiUrl.searchParams.set("iiprop", "url");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("formatversion", "2");
  apiUrl.searchParams.set("origin", "*");

  for (let attempt = 0; attempt <= wiki.resolveRetries; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        headers: { ...UA_HEADERS, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          query?: { pages?: Array<{ imageinfo?: Array<{ url?: string }> }> };
        };
        return data.query?.pages?.[0]?.imageinfo?.[0]?.url ?? null;
      }
      if (res.status !== 403 || attempt === wiki.resolveRetries) return null;
    } catch (err) {
      if (attempt === wiki.resolveRetries) {
        console.error(`[${wiki.label} Proxy] imageinfo lookup failed for ${filename}:`, err);
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return null;
}

/**
 * Clean a `Special:FilePath` tail to a bare file name (no `|` options, no control characters). The path
 * was already percent-decoded once by Next, so it is not decoded again: a literal `%41` stays `%41`.
 */
function cleanFilename(rawName: string): string {
  const filename = rawName.includes("|") ? rawName.split("|")[0]!.trim() : rawName;
  // Strip zero-width and control characters that sneak into filenames.
  return filename.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "").trim();
}

/** Resolve a file name (never a URL) to its direct upload URL, cached for 30 days. */
async function resolveFilePath(wiki: WikiConfig, wikiKey: string, filename: string) {
  const cacheOptions = {
    service: "mediawiki" as const,
    type: "flag" as const,
    identifier: `${wikiKey}:resolution:${filename}`,
    ttl: 30 * 24 * 60 * 60 * 1000,
  };

  const cached = await externalApiCache.get<{ url: string }>(cacheOptions).catch(() => null);
  if (cached?.data?.url) return cached.data.url;

  const directUrl = await resolveViaImageInfo(wiki, filename);
  if (directUrl) await externalApiCache.set(cacheOptions, { url: directUrl }).catch(() => {});
  return directUrl;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wiki: string; path: string[] }> }
) {
  const { wiki: wikiKey, path } = await params;
  const wiki = getWiki(wikiKey);
  if (!wiki) return new NextResponse(null, { status: 404, headers: corsHeaders });

  const limited = await wikiMediaRateLimitResponse(request, `${wikiKey} media`);
  if (limited) return limited;
  if (hasMalformedPercentEncoding(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 400, headers: corsHeaders });
  }

  if (path.some(isUnsafeSegment)) return new NextResponse(null, { status: 404, headers: corsHeaders });

  try {
    const subpath = path.join("/");
    const search = request.nextUrl.searchParams.toString();
    const queryString = search ? `?${search}` : "";
    const originPath = encodePath(path);
    const image: ImageRequest = { headers: request.headers, fileName: path[path.length - 1] };

    const filePathMatch = subpath.match(/Special:Filepath\/(.+)$/i);
    if (filePathMatch?.[1]) {
      const filename = cleanFilename(filePathMatch[1]);
      // `Special:Filepath/<url>` is never resolved: only file names go through imageinfo.
      if (ABSOLUTE_URL.test(filename)) return new NextResponse(null, { status: 404, headers: corsHeaders });
      const directUrl = await resolveFilePath(wiki, wikiKey, filename);
      if (directUrl) return fetchImage(directUrl, wiki.label, image);
      // Fall through to a direct origin fetch of the Special:FilePath URL.
    }

    if (wiki.directImagePrefix && subpath.startsWith(wiki.directImagePrefix)) {
      return fetchImage(`${wiki.siteUrl}/${originPath}${queryString}`, wiki.label, image);
    }

    const response = await fetchFromAllowedHost(`${wiki.siteUrl}/${originPath}${queryString}`, UA_HEADERS, 15000);
    if (!response) return new NextResponse(null, { status: 502, headers: corsHeaders });

    if (!response.ok) {
      if ([403, 502, 503, 504].includes(response.status)) {
        console.warn(`[${wiki.label} Proxy] Origin returned ${response.status} for ${subpath}`);
        return new NextResponse(null, { status: 502, headers: corsHeaders });
      }
      // The upstream error body is never relayed: it could be HTML served from our origin.
      return new NextResponse(null, { status: response.status, headers: corsHeaders });
    }

    return await imageOnlyResponse(response, image);
  } catch (error) {
    console.error(`[${wiki.label} Proxy] Catch-all error:`, error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
