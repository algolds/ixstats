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
const WIKI_HEADERS = { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT };
const OFFLINE_HOST_TTL_MS = 5 * 60 * 1000;

const offlineExternalHosts = new Map<string, number>();

function isExternalHostOffline(hostname: string): boolean {
  const offlineSince = offlineExternalHosts.get(hostname);
  if (!offlineSince) return false;
  if (Date.now() - offlineSince <= OFFLINE_HOST_TTL_MS) return true;
  offlineExternalHosts.delete(hostname);
  return false;
}

function markExternalHostOffline(hostname: string) {
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
async function fetchExternalWiki(url: string, timeoutMs: number = 12000): Promise<Response | null> {
  const hostname = new URL(url).hostname;
  if (isExternalHostOffline(hostname)) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        ...WIKI_HEADERS,
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
    return response.ok ? response : null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[WikiBridge] ${hostname} fetch timed out (${timeoutMs / 1000}s)`);
    } else {
      console.warn(
        `[WikiBridge] ${hostname} fetch failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
    return null;
  }
}

const IIWIKI_BASE_URL = "https://iiwiki.com";
export const ALTHISTORY_API = "https://althistory.fandom.com/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** The `api.php` URL of a wiki's own site (not the iiwiki dev proxy). */
function wikiApiUrl(wiki: WikiSource): URL {
  const rawBase =
    wiki === "iiwiki"
      ? IIWIKI_BASE_URL
      : wiki === "althistory"
        ? ALTHISTORY_API
        : DEFAULT_MEDIAWIKI_URL;
  const base = rawBase.replace(/\/+$/, "");
  return new URL(base.endsWith("api.php") ? base : `${base}/api.php`);
}

/** GET a JSON `action=query` from the live ixwiki API; null on a non-OK response, throws on network errors. */
export async function fetchIxwikiLive<T>(
  params: Record<string, string>,
  timeoutMs: number
): Promise<T | null> {
  const query = new URLSearchParams({ ...params, format: "json" });
  const res = await fetch(`${DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php?${query}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.ok ? ((await res.json()) as T) : null;
}

/** MediaWiki returns `pages` as an array (formatversion 2) or an id-keyed object. */
export function pagesOf<T>(raw: T[] | Record<string, T> | undefined): T[] {
  return Array.isArray(raw) ? raw : Object.values(raw ?? {});
}

/** GET JSON from a wiki API URL; null on a non-OK response, throws on network errors. */
async function fetchWikiJson<T>(url: URL | string, timeoutMs: number): Promise<T | null> {
  const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  return res.ok ? ((await res.json()) as T) : null;
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

async function mediaWikiApiCall(
  apiUrl: string,
  params: Record<string, string>
): Promise<unknown | null> {
  const url = new URL(apiUrl);
  for (const [k, v] of Object.entries({ format: "json", origin: "*", ...params })) {
    url.searchParams.set(k, v);
  }

  const res = await fetchExternalWiki(url.toString());
  return res ? res.json() : null;
}

type WikiApiCall = (params: Record<string, string>) => Promise<unknown | null>;

async function mediaWikiGetWikitext(
  apiCall: WikiApiCall,
  title: string,
  label: string
): Promise<WikiArticle | null> {
  try {
    const data = (await apiCall({
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
    console.error(`[WikiBridge] ${label} fetch error:`, err);
    return null;
  }
}

async function mediaWikiSearch(
  apiCall: WikiApiCall,
  query: string,
  limit: number
): Promise<WikiSearchResult[]> {
  try {
    const data = await apiCall({
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

export function iiwikiApiCall(params: Record<string, string>): Promise<unknown | null> {
  return mediaWikiApiCall(getFullIiwikiApiUrl(), params);
}

export function iiwikiGetWikitext(title: string): Promise<WikiArticle | null> {
  return mediaWikiGetWikitext(iiwikiApiCall, title, "iiwiki");
}

export function iiwikiSearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  return mediaWikiSearch(iiwikiApiCall, query, limit);
}

type CategoryMemberType = "page" | "subcat" | "file";
const MEMBER_TYPE_BY_NAMESPACE: Record<number, CategoryMemberType> = { 14: "subcat", 6: "file" };

export async function httpGetCategoryMembers(
  category: string,
  limit: number = 50,
  type?: CategoryMemberType,
  wiki: WikiSource = "ixwiki"
): Promise<{
  members: Array<{ pageid: number; title: string; type: CategoryMemberType }>;
}> {
  const url = wikiApiUrl(wiki);
  url.search = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category.replace(/^Category:/i, "")}`,
    cmlimit: String(Math.min(limit, 100)),
    format: "json",
    ...(type && { cmtype: type }),
  }).toString();

  try {
    const data = await fetchWikiJson<{
      query?: { categorymembers?: Array<{ pageid: number; title: string; ns: number }> };
    }>(url, 8000);
    const members = (data?.query?.categorymembers ?? []).map((m) => ({
      pageid: m.pageid,
      title: m.title,
      type: MEMBER_TYPE_BY_NAMESPACE[m.ns] ?? "page",
    }));
    return { members };
  } catch (err) {
    console.error(`[WikiBridge] Error fetching category members for ${category} on ${wiki}:`, err);
    return { members: [] };
  }
}

interface RevisionRow {
  revid: number;
  timestamp: string;
  user: string;
  comment: string;
  size: number;
}

/**
 * Fetch full revision lineage from MediaWiki to accurately identify the original page creator,
 * creation timestamp, latest editor, and all historical contributors.
 */
export async function fetchMediaWikiPageAuthorsAndRevisions(
  title: string,
  wiki: WikiSource = "ixwiki",
  limit: number = 250,
  timeoutMs: number = 8000
): Promise<{
  creator: { username: string; timestamp: string; avatar?: string | null } | null;
  lastEditor: { username: string; timestamp: string; avatar?: string | null } | null;
  revisions: RevisionRow[];
  contributors: Array<{ username: string; editCount: number; lastContributedAt?: string }>;
  totalContributors: number;
} | null> {
  const url = wikiApiUrl(wiki);
  url.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    titles: decodeURIComponent(title).replace(/_/g, " ").trim(),
    rvprop: "ids|timestamp|user|comment|size",
    rvlimit: String(Math.min(limit, 500)),
    rvdir: "older", // newest to oldest
    format: "json",
  }).toString();

  try {
    const data = await fetchWikiJson<{
      query?: { pages?: Record<string, { revisions?: RevisionRow[] }> };
    }>(url, timeoutMs);
    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageKey = Object.keys(pages)[0];
    if (!pageKey || pageKey === "-1") return null;

    const revList = pages[pageKey]?.revisions;
    if (!Array.isArray(revList) || revList.length === 0) return null;

    const newest = revList[0];
    const oldest = revList[revList.length - 1];

    const contributors = new Map<
      string,
      { username: string; editCount: number; lastContributedAt: string }
    >();
    const revisions = revList.map((r) => {
      const user = r.user || "MediaWiki Contributor";
      const timestamp = r.timestamp || new Date().toISOString();
      const existing = contributors.get(user);
      if (existing) existing.editCount += 1;
      else contributors.set(user, { username: user, editCount: 1, lastContributedAt: timestamp });
      return {
        revid: r.revid || 0,
        timestamp,
        user,
        comment: r.comment || "",
        size: r.size || 0,
      };
    });

    return {
      creator: oldest ? { username: oldest.user, timestamp: oldest.timestamp } : null,
      lastEditor: newest ? { username: newest.user, timestamp: newest.timestamp } : null,
      revisions,
      contributors: Array.from(contributors.values()).sort((a, b) => b.editCount - a.editCount),
      totalContributors: contributors.size,
    };
  } catch (err) {
    console.error(`[WikiBridge] Error fetching revisions for "${title}" on ${wiki}:`, err);
    return null;
  }
}

export function althistoryApiCall(params: Record<string, string>): Promise<unknown | null> {
  return mediaWikiApiCall(ALTHISTORY_API, params);
}

export function althistoryGetWikitext(title: string): Promise<WikiArticle | null> {
  return mediaWikiGetWikitext(althistoryApiCall, title, "althistory");
}

export function althistorySearch(query: string, limit: number = 10): Promise<WikiSearchResult[]> {
  return mediaWikiSearch(althistoryApiCall, query, limit);
}

interface PageImage {
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

interface PageImageOptions {
  excludePatterns?: RegExp[];
  thumbWidth?: number;
  limit?: number;
}

type MediaWikiPages<P> = { query?: { pages?: Record<string, P> } };

/** Images used on `title` at one wiki, excluding patterns and tiny or non-image files. */
async function fetchPageImagesFromSource(
  base: string,
  title: string,
  { excludePatterns = [], thumbWidth = 200, limit = 50 }: PageImageOptions
): Promise<PageImage[]> {
  const fetchJson = async <T>(query: string): Promise<T | null> => {
    const res = await fetch(`${base}/api.php?action=query&${query}&format=json`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  };

  const listData = await fetchJson<
    MediaWikiPages<{ missing?: boolean; images?: Array<{ title: string }> }>
  >(`titles=${encodeURIComponent(title)}&prop=images&imlimit=${limit}&redirects=1`);
  const page = Object.values(listData?.query?.pages ?? {})[0];
  if (page?.missing || !page?.images?.length) return [];

  const imageTitles = page.images
    .map((img) => img.title)
    .filter((t) => !excludePatterns.some((p) => p.test(t)))
    .slice(0, limit);
  if (imageTitles.length === 0) return [];

  const infoData = await fetchJson<
    MediaWikiPages<{
      title?: string;
      missing?: boolean;
      imageinfo?: Array<{
        url: string;
        thumburl?: string;
        width: number;
        height: number;
        mime?: string;
      }>;
    }>
  >(
    `titles=${imageTitles.map(encodeURIComponent).join("|")}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${thumbWidth}`
  );

  return Object.values(infoData?.query?.pages ?? {}).flatMap((p) => {
    const info = p?.imageinfo?.[0];
    if (p?.missing || !info) return [];
    if (info.width < 100 && info.height < 100) return [];
    if (info.mime && !info.mime.startsWith("image/")) return [];
    return [
      {
        title: p.title ?? "",
        url: info.url,
        thumbUrl: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
      },
    ];
  });
}

export async function fetchPageImagesHttp(
  title: string,
  opts?: PageImageOptions
): Promise<PageImage[] | null> {
  const cacheKey = `pageimages:${title}`;
  const cached = cacheGet<PageImage[]>(cacheKey);
  if (cached) return cached;

  for (const base of [DEFAULT_MEDIAWIKI_URL, IIWIKI_BASE_URL]) {
    try {
      const images = await fetchPageImagesFromSource(base, title, opts ?? {});
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

export async function fetchMediaWikiImageBatch(
  fileTitles: string[],
  endpoint: string = COMMONS_API,
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

export interface CommonsCategoryItem {
  pageId: number;
  title: string;
  cleanTitle: string;
  fileUrl: string;
  thumbUrl: string;
  descriptionUrl: string;
  category: string;
}

const IMAGE_EXTENSION = /\.(svg|png|jpe?g|webp)$/i;

export async function fetchCommonsCategoryMembers(
  categoryName: string,
  limit = 100
): Promise<CommonsCategoryItem[]> {
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

  const response = await fetch(`${COMMONS_API}?${params}`, {
    headers: { "User-Agent": DEFAULT_USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Wikimedia Commons API error: ${response.statusText}`);
  }

  const data = await response.json();
  const rawMembers: Array<{ pageid: number; ns: number; title: string }> =
    data?.query?.categorymembers || [];

  const imageFiles = rawMembers.filter(
    (m) =>
      (m.ns === 6 || m.title.toLowerCase().startsWith("file:")) && IMAGE_EXTENSION.test(m.title)
  );
  if (imageFiles.length === 0) return [];

  const imageMap = await fetchMediaWikiImageBatch(
    imageFiles.map((f) => f.title),
    COMMONS_API
  );

  const items: CommonsCategoryItem[] = [];
  for (const file of imageFiles) {
    const url = imageMap.get(file.title) || imageMap.get(file.title.replace(/^File:/i, ""));
    if (!url) continue;

    const cleanTitle = file.title
      .replace(/^File:/i, "")
      .replace(IMAGE_EXTENSION, "")
      .replace(/_/g, " ")
      .trim()
      .replace(/^Flag of /i, "Flag of ")
      .replace(/^Flag /i, "Flag ");

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
