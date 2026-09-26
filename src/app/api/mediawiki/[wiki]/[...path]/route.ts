/**
 * Media proxy for the external wikis (iiwiki, althistory, commons).
 *
 * - `Special:FilePath/<file>` is resolved to a direct URL via `imageinfo`, cached
 *   for 30 days, then fetched through wsrv.nl with a direct-fetch fallback.
 * - Other sub-paths are fetched from the wiki origin with the allow-listed UA.
 *
 * The local ixwiki media route lives at `../ixwiki/[...path]` and is matched first.
 */
import { NextRequest, NextResponse } from "next/server";
import { externalApiCache } from "~/lib/cache";
import { getWiki, MEDIA_CORS_HEADERS, WIKI_USER_AGENT, type WikiConfig } from "../../_config";

const corsHeaders = MEDIA_CORS_HEADERS;
const UA_HEADERS = { "User-Agent": WIKI_USER_AGENT, "Api-User-Agent": WIKI_USER_AGENT };

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function imageResponse(buffer: ArrayBuffer, contentType: string) {
  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400", ...corsHeaders },
  });
}

/** Fetch an image through wsrv.nl, falling back to a direct fetch. */
async function fetchImage(url: string, label: string): Promise<NextResponse> {
  const attempts = [`https://wsrv.nl/?url=${encodeURIComponent(url)}`, url];
  for (const target of attempts) {
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": WIKI_USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        return imageResponse(await res.arrayBuffer(), res.headers.get("Content-Type") || "image/png");
      }
      console.warn(`[${label} Proxy] Image fetch failed (${res.status}) for ${target}`);
    } catch (err) {
      console.error(`[${label} Proxy] Image fetch error for ${target}:`, err);
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

async function resolveFilePath(wiki: WikiConfig, wikiKey: string, rawName: string) {
  let filename = decodeURIComponent(rawName);
  if (filename.includes("|")) filename = filename.split("|")[0]!.trim();
  // Strip zero-width and control characters that sneak into filenames.
  filename = filename.replace(/[​-‏ - ﻿\x00-\x1F]/g, "").trim();

  const cacheOptions = {
    service: "mediawiki" as const,
    type: "flag" as const,
    identifier: `${wikiKey}:resolution:${filename}`,
    ttl: 30 * 24 * 60 * 60 * 1000,
  };

  const cached = await externalApiCache.get<{ url: string }>(cacheOptions).catch(() => null);
  if (cached?.data?.url) return cached.data.url;

  // An absolute external URL (e.g. imgur) is used as-is; the wiki API would 403 on it.
  const directUrl = /^https?:\/\//i.test(filename)
    ? filename
    : await resolveViaImageInfo(wiki, filename);

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

  try {
    const subpath = path.join("/");
    const search = request.nextUrl.searchParams.toString();
    const queryString = search ? `?${search}` : "";

    const filePathMatch = subpath.match(/Special:Filepath\/(.+)$/i);
    if (filePathMatch?.[1]) {
      const directUrl = await resolveFilePath(wiki, wikiKey, filePathMatch[1]);
      if (directUrl) return fetchImage(directUrl, wiki.label);
      // Fall through to a direct origin fetch of the Special:FilePath URL.
    }

    if (wiki.directImagePrefix && subpath.startsWith(wiki.directImagePrefix)) {
      return fetchImage(`${wiki.siteUrl}/${subpath}${queryString}`, wiki.label);
    }

    const response = await fetch(`${wiki.siteUrl}/${subpath}${queryString}`, {
      headers: UA_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if ([403, 502, 503, 504].includes(response.status)) {
        console.warn(`[${wiki.label} Proxy] Origin returned ${response.status} for ${subpath}`);
        return new NextResponse(null, { status: 502, headers: corsHeaders });
      }
      return new NextResponse(response.body, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("Content-Type") || "text/plain", ...corsHeaders },
      });
    }

    return imageResponse(
      await response.arrayBuffer(),
      response.headers.get("Content-Type") || "application/octet-stream"
    );
  } catch (error) {
    console.error(`[${wiki.label} Proxy] Catch-all error:`, error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
