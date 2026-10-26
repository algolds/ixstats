// src/lib/wiki-os/bridge/http-reader.ts
// HTTP readers for external MediaWiki endpoints (IIWiki, Althistory, Commons).
//
// Every sister wiki read is a JSON API call through the wiki's configured api.php (`getMediaWikiApiUrl`: iiwiki's
// development relay when one is set) and through the upstream guard (upstream-guard.ts: a breaker and a limiter per
// host). A missing page is null, a search with no match is empty and a page with no images is null; a wiki that gives
// no usable answer throws WikiUnavailableError. IxWiki's own engine is never read here: its loopback must never meet
// the sister guard. Callers outside WikiOS's read surfaces that want the old "unreachable reads as missing" outcome
// wrap their call in `unlessUnavailable`.

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { upstreamGuard, WikiUnavailableError, wikiNameForUrl } from "~/lib/wiki-os/upstream-guard";
import {
  type PageImage,
  type SisterWikiSource,
  type WikiArticle,
  type WikiSearchResult,
  cacheGet,
  cacheSet,
} from "./types";

/** How long a sister wiki's answer is waited for, unless the call says otherwise. */
const SISTER_TIMEOUT_MS = 12_000;

/** The API errors (in a 200) by which a wiki asks to be called less: busy, not down. */
const BUSY_API_ERRORS: ReadonlySet<string> = new Set(["ratelimited", "maxlag"]);
/** The API errors (in a 200) that refuse the request itself, a bad title or category name: no such page, no members. */
const INPUT_REFUSALS: ReadonlySet<string> = new Set(["invalidtitle", "invalidcategory"]);

/** What any api.php answer may carry besides its data: an API error, in a 200. */
interface ApiAnswer {
  error?: { code?: string } | null;
}

/** The `error.code` an api.php answer carries in a 200 ("" when it names none), or null when it carries no error. */
function apiErrorCode(answer: ApiAnswer | null): string | null {
  if (!answer?.error) return null;
  return typeof answer.error.code === "string" ? answer.error.code : "";
}

/**
 * The parsed JSON answer to `url`, a sister wiki's API call, through the upstream guard. Throws WikiUnavailableError
 * when there is no usable answer: the guard's failures (a timeout, a network error, HTTP 403, 429 or 5xx, a 2xx that
 * is not JSON or does not parse, a circuit at rest), a status that is not OK (api.php answers 200, even for a missing
 * page), or an API error in the 200 (`busy` for `ratelimited` and `maxlag`), so a refusal is never read as a missing
 * page or an empty list. Only the codes in `pageErrors` (by default a bad title or category name) are the page's own
 * answer, handed back for the caller to read.
 * Never for IxWiki's loopback, file bytes or `action=raw`.
 */
export async function readSisterJson<T>(
  url: string,
  timeoutMs: number = SISTER_TIMEOUT_MS,
  pageErrors: ReadonlySet<string> = INPUT_REFUSALS
): Promise<T> {
  const response = await upstreamGuard.fetch(url, { timeoutMs });
  const wiki = wikiNameForUrl(url);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WikiUnavailableError(wiki, "unreachable");
  }
  const answer = (await response.json()) as T;
  const code = apiErrorCode(answer as ApiAnswer | null);
  if (code === null || pageErrors.has(code)) return answer;
  throw new WikiUnavailableError(wiki, BUSY_API_ERRORS.has(code) ? "busy" : "unreachable");
}

/** The pages of an `action=query` response, whether it came back as an array or an id-keyed map. */
export function pagesOf<T>(raw: T[] | Record<string, T> | undefined): T[] {
  return Array.isArray(raw) ? raw : Object.values(raw ?? {});
}

/** `source`'s api.php answer to `params` (`format=json` and `origin=*` added), parsed; see `readSisterJson`. */
export function sisterApiCall<T>(
  source: SisterWikiSource,
  params: Record<string, string>,
  timeoutMs: number = SISTER_TIMEOUT_MS
): Promise<T> {
  const url = new URL(getMediaWikiApiUrl(source));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return readSisterJson<T>(url.toString(), timeoutMs);
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
 * `title`'s wikitext on `source`. A redirect is followed: the answer is the page it names, under that page's title,
 * with `redirectedFrom` set (a title the wiki only normalised is not a redirect). Null only for a missing page (no
 * page, or a negative page id); a wiki that cannot be reached throws WikiUnavailableError.
 */
export async function readSisterWikitext(
  source: SisterWikiSource,
  title: string
): Promise<WikiArticle | null> {
  const data = await sisterApiCall<WikitextQuery>(source, {
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    redirects: "1",
  });

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

/** An `action=opensearch` answer: the search, then the matching titles (descriptions and URLs follow). */
type OpenSearchAnswer = [search?: string, titles?: string[]];

/** Titles on `source` that start with `query`; empty when none matches, WikiUnavailableError when it cannot be reached. */
export async function searchSisterWiki(
  source: SisterWikiSource,
  query: string,
  limit: number = 10
): Promise<WikiSearchResult[]> {
  const data = await sisterApiCall<OpenSearchAnswer | null>(source, {
    action: "opensearch",
    search: query,
    limit: String(limit),
    namespace: "0",
  });
  const titles = data?.[1] ?? [];
  return titles.map((title, i) => ({ title, pageId: i, length: 0 }));
}

type CategoryMemberType = "page" | "subcat" | "file";

/** An `action=query&list=categorymembers` answer. */
interface CategoryMembersAnswer {
  query?: { categorymembers?: Array<{ pageid: number; title: string; ns: number }> };
}

function memberType(ns: number): CategoryMemberType {
  if (ns === 14) return "subcat";
  return ns === 6 ? "file" : "page";
}

/** A sister wiki's category members (at most 100); WikiUnavailableError when it cannot be reached. */
export async function httpGetCategoryMembers(
  category: string,
  limit: number = 50,
  type: CategoryMemberType | undefined,
  wiki: SisterWikiSource
): Promise<{ members: Array<{ pageid: number; title: string; type: CategoryMemberType }> }> {
  const data = await sisterApiCall<CategoryMembersAnswer>(wiki, {
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category.replace(/^Category:/i, "")}`,
    cmlimit: String(Math.min(limit, 100)),
    ...(type ? { cmtype: type } : {}),
  });
  const members = (data?.query?.categorymembers ?? []).map((m) => ({
    pageid: m.pageid,
    title: m.title,
    type: memberType(m.ns),
  }));
  return { members };
}

/** One revision as an `action=query&prop=revisions` answer lists it (a hidden user or comment is absent). */
interface RevisionEntry {
  revid?: number;
  timestamp?: string;
  user?: string;
  comment?: string;
  size?: number;
}

interface RevisionsAnswer {
  query?: { pages?: Record<string, { missing?: string | boolean; revisions?: RevisionEntry[] }> };
}

export interface SisterPageRevision {
  revid: number;
  timestamp: string;
  user: string;
  comment: string;
  size: number;
}

export interface SisterPageAuthors {
  creator: { username: string; timestamp: string; avatar?: string | null } | null;
  lastEditor: { username: string; timestamp: string; avatar?: string | null } | null;
  revisions: SisterPageRevision[];
  contributors: Array<{ username: string; editCount: number; lastContributedAt?: string }>;
  totalContributors: number;
}

function revisionOf(entry: RevisionEntry): SisterPageRevision {
  return {
    revid: entry.revid || 0,
    timestamp: entry.timestamp || new Date().toISOString(),
    user: entry.user || "MediaWiki Contributor",
    comment: entry.comment || "",
    size: entry.size || 0,
  };
}

/** Who wrote a page, from its revisions newest first: the oldest is its creator, the newest its last editor. */
function authorsOf(revisions: SisterPageRevision[]): SisterPageAuthors {
  const counts = new Map<string, { editCount: number; lastContributedAt: string }>();
  for (const { user, timestamp } of revisions) {
    const existing = counts.get(user);
    if (existing) existing.editCount += 1;
    else counts.set(user, { editCount: 1, lastContributedAt: timestamp });
  }
  const contributors = Array.from(counts, ([username, val]) => ({ username, ...val })).sort(
    (a, b) => b.editCount - a.editCount
  );
  const newest = revisions[0]!;
  const oldest = revisions[revisions.length - 1]!;
  return {
    creator: { username: oldest.user, timestamp: oldest.timestamp },
    lastEditor: { username: newest.user, timestamp: newest.timestamp },
    revisions,
    contributors,
    totalContributors: counts.size,
  };
}

/**
 * A sister wiki page's revision lineage: its creator and creation time, its latest editor, and every contributor.
 * Null for a missing page or one with no revisions; WikiUnavailableError when the wiki cannot be reached (the
 * authors decoration, `getSisterWikiAuthorsCached`, turns any error into null). IxWiki's own come from Postgres.
 */
export async function fetchMediaWikiPageAuthorsAndRevisions(
  title: string,
  wiki: SisterWikiSource,
  limit: number = 250,
  timeoutMs: number = 8000
): Promise<SisterPageAuthors | null> {
  // `title` arrives already URL-decoded (a "%" in it is part of the title): never decode again.
  const data = await sisterApiCall<RevisionsAnswer>(
    wiki,
    {
      action: "query",
      prop: "revisions",
      titles: title.replace(/_/g, " ").trim(),
      rvprop: "ids|timestamp|user|comment|size",
      rvlimit: String(Math.min(limit, 500)),
      rvdir: "older", // newest to oldest
    },
    timeoutMs
  );
  const page = Object.values(data?.query?.pages ?? {})[0];
  const revisions = page?.revisions ?? [];
  if (revisions.length === 0) return null;
  return authorsOf(revisions.map(revisionOf));
}

// ──────────────────────────────────────────────
// Page Images Multi-Source Resolver
// ──────────────────────────────────────────────

/** A page's own images do not hold a reader up for long. */
const PAGE_IMAGES_TIMEOUT_MS = 5000;

/** An `action=query&prop=images` answer: the files a page uses. */
interface PageImagesAnswer {
  query?: { pages?: Record<string, { images?: Array<{ title: string }> }> };
}

/** An `action=query&prop=imageinfo` answer for a list of files. */
interface ImageInfoAnswer {
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
}

/** The files `title` uses on `wiki`, less those `excludePatterns` match; empty for a missing page. */
async function pageImageTitles(
  title: string,
  wiki: SisterWikiSource,
  maxImages: number,
  excludePatterns: RegExp[]
): Promise<string[]> {
  const listData = await sisterApiCall<PageImagesAnswer>(
    wiki,
    { action: "query", titles: title, prop: "images", imlimit: String(maxImages), redirects: "1" },
    PAGE_IMAGES_TIMEOUT_MS
  );
  // A missing page lists no images.
  const page = Object.values(listData?.query?.pages ?? {})[0];
  return (page?.images ?? [])
    .map((img) => img.title)
    .filter((t) => !excludePatterns.some((p) => p.test(t)));
}

/** The images among `infoPages` worth showing: real images, at least 100 px on one side. */
function shownImages(infoPages: NonNullable<ImageInfoAnswer["query"]>["pages"]): PageImage[] {
  const images: PageImage[] = [];
  for (const p of Object.values(infoPages ?? {})) {
    const info = p?.missing ? undefined : p?.imageinfo?.[0];
    if (!info) continue;
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
  return images;
}

/**
 * The images on a sister wiki's page, through the wiki's configured api.php (iiwiki's development relay gets past the
 * Cloudflare 403 this server meets). Null when the page is missing or has no images worth showing;
 * WikiUnavailableError when the wiki cannot be reached.
 */
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

  const maxImages = opts?.limit ?? 50;
  const imageTitles = await pageImageTitles(title, wiki, maxImages, opts?.excludePatterns ?? []);
  if (imageTitles.length === 0) return null;

  const infoData = await sisterApiCall<ImageInfoAnswer>(
    wiki,
    {
      action: "query",
      titles: imageTitles.slice(0, maxImages).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: String(opts?.thumbWidth ?? 200),
    },
    PAGE_IMAGES_TIMEOUT_MS
  );
  const images = shownImages(infoData?.query?.pages);
  if (images.length === 0) return null;
  cacheSet(cacheKey, images);
  return images;
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
