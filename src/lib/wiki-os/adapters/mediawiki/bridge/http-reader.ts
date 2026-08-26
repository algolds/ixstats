// src/lib/wiki-os/bridge/http-reader.ts
// HTTP readers for external MediaWiki endpoints (IIWiki, Althistory, Commons).

import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import {
  type WikiArticle,
  type WikiSearchResult,
  type WikiSource,
  cacheGet,
  cacheSet,
} from "./types";

const USER_AGENT = DEFAULT_USER_AGENT;

const offlineExternalHosts = new Map<string, number>();

export function isExternalHostOffline(hostname: string): boolean {
  const offlineTime = offlineExternalHosts.get(hostname);
  if (offlineTime) {
    if (Date.now() - offlineTime > 5 * 60 * 1000) {
      offlineExternalHosts.delete(hostname);
      return false;
    }
    return true;
  }
  return false;
}

export function markExternalHostOffline(hostname: string) {
  if (!offlineExternalHosts.has(hostname)) {
    offlineExternalHosts.set(hostname, Date.now());
    console.warn(
      `[WikiBridge] External host ${hostname} is returning 403 (Forbidden). ` +
        `Requests to this host are suspended for 5 minutes in development to prevent server stalling.`
    );
  }
}

/**
 * Fetch from an external wiki API with circuit breaker resilience for 403/offline errors.
 * Returns null on persistent failures instead of throwing or polling repeatedly.
 */
export async function fetchExternalWiki(url: string, timeoutMs: number = 12000): Promise<Response | null> {
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
      markExternalHostOffline(hostname);
      return null;
    }

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
  if (process.env.IIWIKI_DEV_PROXY_URL) {
    return process.env.IIWIKI_DEV_PROXY_URL;
  }
  if (process.env.NODE_ENV === "development") {
    return "https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php";
  }
  return "https://iiwiki.com/api.php";
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

export async function iiwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  try {
    const data = (await iiwikiApiCall({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    })) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
          }
        >;
      };
    } | null;

    if (!data) return null;
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || !page.pageid || page.pageid < 0) return null;

    const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
    return {
      title: page.title ?? title,
      pageId: page.pageid,
      wikitext,
      length: wikitext.length,
    };
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
  type?: "page" | "subcat" | "file",
  wiki: WikiSource = "ixwiki"
): Promise<{ members: Array<{ pageid: number; title: string; type: "page" | "subcat" | "file" }> }> {
  const cleanCat = category.replace(/^Category:/i, "");
  const base =
    wiki === "iiwiki"
      ? getIiwikiApiBaseUrl()
      : wiki === "althistory"
        ? ALTHISTORY_API
        : DEFAULT_MEDIAWIKI_URL;

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
 * Fetch full revision lineage from MediaWiki to accurately identify the original page creator,
 * creation timestamp, latest editor, and all historical contributors.
 */
export async function fetchMediaWikiPageAuthorsAndRevisions(
  title: string,
  wiki: WikiSource = "ixwiki",
  limit: number = 250
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
  const cleanTitle = decodeURIComponent(title).replace(/_/g, " ").trim();
  const rawBase =
    wiki === "iiwiki"
      ? getIiwikiApiBaseUrl()
      : wiki === "althistory"
        ? ALTHISTORY_API
        : DEFAULT_MEDIAWIKI_URL;
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
      signal: AbortSignal.timeout(8000),
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
    const data = (await althistoryApiCall({
      action: "query",
      titles: title,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
    })) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid?: number;
            title?: string;
            revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
          }
        >;
      };
    } | null;

    if (!data) return null;
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || !page.pageid || page.pageid < 0) return null;

    const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
    return {
      title: page.title ?? title,
      pageId: page.pageid,
      wikitext,
      length: wikitext.length,
    };
  } catch (err) {
    console.error("[WikiBridge] althistory fetch error:", err);
    return null;
  }
}

export async function althistorySearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
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
  opts?: {
    excludePatterns?: RegExp[];
    thumbWidth?: number;
    limit?: number;
  }
): Promise<Array<{
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}> | null> {
  const cacheKey = `pageimages:${title}`;
  const cached =
    cacheGet<
      Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }>
    >(cacheKey);
  if (cached) return cached;

  const sources = [
    { wiki: "ixwiki" as WikiSource, base: DEFAULT_MEDIAWIKI_URL },
    { wiki: "iiwiki" as WikiSource, base: getIiwikiApiBaseUrl() },
  ];

  const thumbWidth = opts?.thumbWidth ?? 200;
  const maxImages = opts?.limit ?? 50;
  const excludePatterns = opts?.excludePatterns ?? [];

  for (const source of sources) {
    try {
      const listRes = await fetch(
        `${source.base}/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&imlimit=${maxImages}&format=json&redirects=1`,
        { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) }
      );
      if (!listRes.ok) continue;
      const listData = (await listRes.json()) as {
        query?: {
          pages?: Record<string, { missing?: boolean; images?: Array<{ title: string }> }>;
        };
      };
      const pages = listData?.query?.pages;
      if (!pages) continue;
      const page = Object.values(pages)[0];
      if (page?.missing || !page?.images?.length) continue;

      const imageTitles = page.images
        .map((img) => img.title)
        .filter((t) => !excludePatterns.some((p) => p.test(t)));
      if (imageTitles.length === 0) continue;

      const titlesParam = imageTitles.slice(0, maxImages).map(encodeURIComponent).join("|");
      const infoRes = await fetch(
        `${source.base}/api.php?action=query&titles=${titlesParam}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${thumbWidth}&format=json`,
        { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) }
      );
      if (!infoRes.ok) continue;
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
      if (!infoPages) continue;

      const images: Array<{
        title: string;
        url: string;
        thumbUrl: string;
        width: number;
        height: number;
      }> = [];
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
      continue;
    }
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
    const titlesParam = chunk
      .map((t) => (t.startsWith("File:") ? t : `File:${t}`))
      .join("|");
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

export interface CommonsCategoryItem {
  pageId: number;
  title: string;
  cleanTitle: string;
  fileUrl: string;
  thumbUrl: string;
  descriptionUrl: string;
  category: string;
}

export async function fetchCommonsCategoryMembers(
  categoryName: string,
  limit = 100
): Promise<CommonsCategoryItem[]> {
  const endpoint = "https://commons.wikimedia.org/w/api.php";
  let cleaned = categoryName.trim();
  if (cleaned.includes("/wiki/")) {
    cleaned = cleaned.split("/wiki/").pop() || cleaned;
  }
  cleaned = decodeURIComponent(cleaned).replace(/\s+/g, "_");
  if (!cleaned.toLowerCase().startsWith("category:")) {
    cleaned = `Category:${cleaned}`;
  }

  const params = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: cleaned,
    cmtype: "file|subcat",
    cmlimit: String(limit),
    format: "json",
    origin: "*",
  });

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Wikimedia Commons API error: ${response.statusText}`);
  }

  const data = await response.json();
  const rawMembers: Array<{ pageid: number; ns: number; title: string }> =
    data?.query?.categorymembers || [];

  const fileMembers = rawMembers.filter(
    (m) => m.ns === 6 || m.title.toLowerCase().startsWith("file:")
  );

  const imageFiles = fileMembers.filter((m) => {
    const t = m.title.toLowerCase();
    return (
      t.endsWith(".svg") ||
      t.endsWith(".png") ||
      t.endsWith(".jpg") ||
      t.endsWith(".jpeg") ||
      t.endsWith(".webp")
    );
  });

  if (imageFiles.length === 0) return [];

  const titles = imageFiles.map((f) => f.title);
  const imageMap = await fetchMediaWikiImageBatch(titles, endpoint);

  const items: CommonsCategoryItem[] = [];
  for (const file of imageFiles) {
    const url = imageMap.get(file.title) || imageMap.get(file.title.replace(/^File:/i, ""));
    if (!url) continue;

    let cleanTitle = file.title
      .replace(/^File:/i, "")
      .replace(/\.(svg|png|jpg|jpeg|webp)$/i, "")
      .replace(/_/g, " ")
      .trim();

    cleanTitle = cleanTitle.replace(/^Flag of /i, "Flag of ").replace(/^Flag /i, "Flag ");

    items.push({
      pageId: file.pageid,
      title: file.title,
      cleanTitle,
      fileUrl: url,
      thumbUrl: url,
      descriptionUrl: url,
      category: cleaned,
    });
  }

  return items;
}
