// src/lib/wiki-os/bridge/http-reader.ts
// HTTP readers for external MediaWiki endpoints (IIWiki, Althistory, Commons).

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import {
  type PageImage,
  type SisterWikiSource,
  type WikiArticle,
  type WikiSearchResult,
  cacheGet,
  cacheSet,
} from "./types";

const USER_AGENT = DEFAULT_USER_AGENT;

/** How long a host that refused twice in a row (403) is skipped. */
const OFFLINE_FOR_MS = 60 * 1000;
const offlineUntil = new Map<string, number>();
/** Hosts whose last answer was a refusal. */
const refusedOnce = new Set<string>();

function isExternalHostOffline(hostname: string): boolean {
  const until = offlineUntil.get(hostname);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  offlineUntil.delete(hostname);
  return false;
}

/**
 * A 403 from `hostname`. One is as often a Cloudflare challenge of that one request (or of the relay in front of
 * iiwiki) as an outage, so only a second refusal in a row skips the host, and only for a minute.
 */
function noteRefusal(hostname: string) {
  if (!refusedOnce.delete(hostname)) {
    refusedOnce.add(hostname);
    return;
  }
  offlineUntil.set(hostname, Date.now() + OFFLINE_FOR_MS);
  console.warn(
    `[WikiBridge] External host ${hostname} refused twice in a row (403). ` +
      `Requests to it are suspended for a minute to prevent server stalling.`
  );
}

/**
 * Fetch from an external wiki API with circuit breaker resilience for 403/offline errors.
 * Returns null on persistent failures instead of throwing or polling repeatedly.
 */
export async function fetchExternalWiki(
  url: string,
  timeoutMs: number = 12000
): Promise<Response | null> {
  const hostname = new URL(url).hostname;
  if (isExternalHostOffline(hostname)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
        Accept: "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 403) {
      noteRefusal(hostname);
      return null;
    }
    refusedOnce.delete(hostname);

    if (!response.ok) {
      return null;
    }

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorName = err instanceof Error ? err.name : "";
    if (errorName === "AbortError") {
      console.warn(`[WikiBridge] ${hostname} fetch timed out (${timeoutMs / 1000}s)`);
    } else {
      console.warn(`[WikiBridge] ${hostname} fetch failed:`, errorMsg);
    }
    return null;
  }
}

// ──────────────────────────────────────────────
// IIWiki HTTP API
// ──────────────────────────────────────────────

export function getIiwikiApiBaseUrl(): string {
  return "https://iiwiki.com";
}

export function getFullIiwikiApiUrl(): string {
  return getMediaWikiApiUrl("iiwiki");
}

/** The pages of an `action=query` response, whether it came back as an array or an id-keyed map. */
export function pagesOf<T>(raw: T[] | Record<string, T> | undefined): T[] {
  return Array.isArray(raw) ? raw : Object.values(raw ?? {});
}

export async function iiwikiApiCall(params: Record<string, string>): Promise<unknown | null> {
  const url = new URL(getFullIiwikiApiUrl());
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchExternalWiki(url.toString());
  if (!res) return null;
  return res.json();
}

/** An `action=query&prop=revisions` answer with its redirects followed (`redirects=1`). */
interface WikitextQuery {
  query?: {
    redirects?: Array<{ from?: string; to?: string }>;
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        revisions?: Array<{ revid?: number; slots?: { main?: { "*"?: string } } }>;
      }
    >;
  };
}

/**
 * `title`'s wikitext on a sister wiki, read through `apiCall`. A redirect is followed: the answer is the page it
 * names, under that page's title, with `redirectedFrom` set (a title the wiki only normalised is not a redirect).
 */
async function readSisterWikitext(
  apiCall: (params: Record<string, string>) => Promise<unknown | null>,
  title: string
): Promise<WikiArticle | null> {
  const data = (await apiCall({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    redirects: "1",
  })) as WikitextQuery | null;

  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page?.pageid || page.pageid < 0) return null;

  const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
  const redirectedFrom = data?.query?.redirects?.[0]?.from;
  return {
    title: page.title ?? title,
    pageId: page.pageid,
    wikitext,
    length: wikitext.length,
    revId: page.revisions?.[0]?.revid,
    ...(redirectedFrom ? { redirectedFrom } : {}),
  };
}

export async function iiwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    return await readSisterWikitext(iiwikiApiCall, title);
  } catch (err) {
    console.error("[WikiBridge] iiwiki fetch error:", err);
    return null;
  }
}

export async function iiwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  try {
    const data = await iiwikiApiCall({
      action: "opensearch",
      search: query,
      limit: String(limit),
      namespace: "0",
    });

    if (!data || !Array.isArray(data) || data.length < 2) return [];
    return ((data[1] as string[]) ?? []).map((title: string, i: number) => ({
      title,
      pageId: i,
      length: 0,
    }));
  } catch {
    return [];
  }
}

export async function httpGetCategoryMembers(
  category: string,
  limit: number = 50,
  type: "page" | "subcat" | "file" | undefined,
  wiki: SisterWikiSource
): Promise<{
  members: Array<{ pageid: number; title: string; type: "page" | "subcat" | "file" }>;
}> {
  const cleanCat = category.replace(/^Category:/i, "");
  const base = wiki === "iiwiki" ? getIiwikiApiBaseUrl() : ALTHISTORY_API;

  const url = new URL(base.endsWith("api.php") ? base : `${base}/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "categorymembers");
  url.searchParams.set("cmtitle", `Category:${cleanCat}`);
  url.searchParams.set("cmlimit", String(Math.min(limit, 100)));
  url.searchParams.set("format", "json");
  if (type) {
    url.searchParams.set("cmtype", type);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { members: [] };
    const data = (await res.json()) as {
      query?: {
        categorymembers?: Array<{ pageid: number; title: string; ns: number }>;
      };
    };
    const members = (data.query?.categorymembers ?? []).map((m) => ({
      pageid: m.pageid,
      title: m.title,
      type: (m.ns === 14 ? "subcat" : m.ns === 6 ? "file" : "page") as "page" | "subcat" | "file",
    }));
    return { members };
  } catch (err) {
    console.error(`[WikiBridge] Error fetching category members for ${category} on ${wiki}:`, err);
    return { members: [] };
  }
}

/**
 * Fetch a sister wiki page's revision lineage to identify the original page creator, creation
 * timestamp, latest editor, and all historical contributors. IxWiki's own come from Postgres.
 */
export async function fetchMediaWikiPageAuthorsAndRevisions(
  title: string,
  wiki: SisterWikiSource,
  limit: number = 250,
  timeoutMs: number = 8000
): Promise<{
  creator: { username: string; timestamp: string; avatar?: string | null } | null;
  lastEditor: { username: string; timestamp: string; avatar?: string | null } | null;
  revisions: Array<{
    revid: number;
    timestamp: string;
    user: string;
    comment: string;
    size: number;
  }>;
  contributors: Array<{ username: string; editCount: number; lastContributedAt?: string }>;
  totalContributors: number;
} | null> {
  // `title` arrives already URL-decoded (a "%" in it is part of the title): never decode again.
  const cleanTitle = title.replace(/_/g, " ").trim();
  const rawBase = wiki === "iiwiki" ? getIiwikiApiBaseUrl() : ALTHISTORY_API;
  const base = rawBase.replace(/\/+$/, "");

  const url = new URL(base.endsWith("api.php") ? base : `${base}/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("titles", cleanTitle);
  url.searchParams.set("rvprop", "ids|timestamp|user|comment|size");
  url.searchParams.set("rvlimit", String(Math.min(limit, 500)));
  url.searchParams.set("rvdir", "older"); // newest to oldest
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageKey = Object.keys(pages)[0];
    if (!pageKey || pageKey === "-1") return null;

    const revList = pages[pageKey]?.revisions;
    if (!Array.isArray(revList) || revList.length === 0) return null;

    const newest = revList[0];
    const oldest = revList[revList.length - 1];

    const counts = new Map<string, { editCount: number; lastContributedAt: string }>();
    const formattedRevs = revList.map((r: any) => {
      const user = r.user || "MediaWiki Contributor";
      const ts = r.timestamp || new Date().toISOString();
      const existing = counts.get(user);
      if (existing) {
        existing.editCount += 1;
      } else {
        counts.set(user, { editCount: 1, lastContributedAt: ts });
      }
      return {
        revid: r.revid || 0,
        timestamp: ts,
        user,
        comment: r.comment || "",
        size: r.size || 0,
      };
    });

    const contributors = Array.from(counts.entries())
      .map(([username, val]) => ({
        username,
        editCount: val.editCount,
        lastContributedAt: val.lastContributedAt,
      }))
      .sort((a, b) => b.editCount - a.editCount);

    return {
      creator: oldest ? { username: oldest.user, timestamp: oldest.timestamp } : null,
      lastEditor: newest ? { username: newest.user, timestamp: newest.timestamp } : null,
      revisions: formattedRevs,
      contributors,
      totalContributors: counts.size,
    };
  } catch (err) {
    console.error(`[WikiBridge] Error fetching revisions for "${title}" on ${wiki}:`, err);
    return null;
  }
}

// ──────────────────────────────────────────────
// AltHistory Wiki HTTP API
// ──────────────────────────────────────────────

export const ALTHISTORY_API = "https://althistory.fandom.com/api.php";

export async function althistoryApiCall(params: Record<string, string>): Promise<unknown | null> {
  const url = new URL(ALTHISTORY_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchExternalWiki(url.toString());
  if (!res) return null;
  return res.json();
}

export async function althistoryGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    return await readSisterWikitext(althistoryApiCall, title);
  } catch (err) {
    console.error("[WikiBridge] althistory fetch error:", err);
    return null;
  }
}

export async function althistorySearch(
  query: string,
  limit: number = 10
): Promise<WikiSearchResult[]> {
  try {
    const data = await althistoryApiCall({
      action: "opensearch",
      search: query,
      limit: String(limit),
      namespace: "0",
    });

    if (!data || !Array.isArray(data) || data.length < 2) return [];
    return ((data[1] as string[]) ?? []).map((title: string, i: number) => ({
      title,
      pageId: i,
      length: 0,
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Page Images Multi-Source Resolver
// ──────────────────────────────────────────────

export async function fetchPageImagesHttp(
  title: string,
  wiki: SisterWikiSource,
  opts?: {
    excludePatterns?: RegExp[];
    thumbWidth?: number;
    limit?: number;
  }
): Promise<PageImage[] | null> {
  const cacheKey = `pageimages:${wiki}:${title}`;
  const cached = cacheGet<PageImage[]>(cacheKey);
  if (cached) return cached;

  // The wiki's configured api.php: iiwiki's development relay gets past the Cloudflare 403 this server meets.
  const apiUrl = getMediaWikiApiUrl(wiki);
  const thumbWidth = opts?.thumbWidth ?? 200;
  const maxImages = opts?.limit ?? 50;
  const excludePatterns = opts?.excludePatterns ?? [];
  const query = (params: Record<string, string>) =>
    fetchExternalWiki(`${apiUrl}?${new URLSearchParams({ ...params, format: "json" })}`, 5000);

  try {
    const listRes = await query({
      action: "query",
      titles: title,
      prop: "images",
      imlimit: String(maxImages),
      redirects: "1",
    });
    if (!listRes) return null;
    const listData = (await listRes.json()) as {
      query?: {
        pages?: Record<string, { missing?: boolean; images?: Array<{ title: string }> }>;
      };
    };
    const pages = listData?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (page?.missing || !page?.images?.length) return null;

    const imageTitles = page.images
      .map((img) => img.title)
      .filter((t) => !excludePatterns.some((p) => p.test(t)));
    if (imageTitles.length === 0) return null;

    const infoRes = await query({
      action: "query",
      titles: imageTitles.slice(0, maxImages).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: String(thumbWidth),
    });
    if (!infoRes) return null;
    const infoData = (await infoRes.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            missing?: boolean;
            imageinfo?: Array<{
              url: string;
              thumburl?: string;
              width: number;
              height: number;
              mime?: string;
            }>;
          }
        >;
      };
    };
    const infoPages = infoData?.query?.pages;
    if (!infoPages) return null;

    const images: PageImage[] = [];
    for (const p of Object.values(infoPages)) {
      if (p?.missing || !p?.imageinfo?.[0]) continue;
      const info = p.imageinfo[0];
      if (info.width < 100 && info.height < 100) continue;
      if (info.mime && !info.mime.startsWith("image/")) continue;
      images.push({
        title: p.title ?? "",
        url: info.url,
        thumbUrl: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
      });
    }

    if (images.length > 0) {
      cacheSet(cacheKey, images);
      return images;
    }
  } catch {
    return null;
  }
  return null;
}

// ──────────────────────────────────────────────
// Commons Media & Batch Fetchers
// ──────────────────────────────────────────────

export async function fetchMediaWikiImageBatch(
  fileTitles: string[],
  endpoint: string = "https://commons.wikimedia.org/w/api.php",
  options?: { thumbWidth?: number; signal?: AbortSignal }
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!fileTitles.length) return result;

  const chunkSize = 25;
  for (let i = 0; i < fileTitles.length; i += chunkSize) {
    const chunk = fileTitles.slice(i, i + chunkSize);
    const titlesParam = chunk.map((t) => (t.startsWith("File:") ? t : `File:${t}`)).join("|");
    const thumbParam = options?.thumbWidth ? `&iiurlwidth=${options.thumbWidth}` : "";
    const url = `${endpoint}?action=query&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(titlesParam)}&prop=imageinfo&iiprop=url${thumbParam}`;

    try {
      const resp = await fetch(url, {
        signal: options?.signal ?? AbortSignal.timeout(10000),
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });

      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        query?: {
          pages?: Array<{
            title?: string;
            missing?: boolean;
            imageinfo?: Array<{ url?: string; thumburl?: string }>;
          }>;
        };
      };

      const pages = data?.query?.pages ?? [];
      for (const page of pages) {
        if (page.missing || !page.imageinfo?.[0]) continue;
        const imgUrl = page.imageinfo[0].url ?? page.imageinfo[0].thumburl;
        if (imgUrl && page.title) {
          result.set(page.title, imgUrl);
          result.set(page.title.replace(/^File:/i, ""), imgUrl);
        }
      }
    } catch (err) {
      console.warn("[WikiBridge] Error in fetchMediaWikiImageBatch:", err);
    }
  }

  return result;
}
