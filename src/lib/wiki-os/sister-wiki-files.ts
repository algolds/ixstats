/**
 * sister-wiki-files.ts — the image repository's reads of iiwiki's files: one paged list (a category, a search, or
 * every file) and a batched lookup of named files, each as a single `action=query` call to the wiki's `api.php`
 * through `fetchMediaWikiJson` (5 minute cache). The `wikios` router validates and calls; the URLs and the mapping
 * to `RepositoryFile` live here.
 */

import { getMediaWikiApiUrl, DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";

export interface RepositoryFile {
  name: string;
  title: string;
  url: string;
  thumbUrl: string | null;
  size: number;
  width: number;
  height: number;
  mime: string;
  blurhash: string | null;
}

/** A sister wiki's answers are reused for 5 minutes. */
const CACHE_TTL_MS = 300_000;
const IMAGE_INFO = "prop=imageinfo&iiprop=url|size|mime&iiurlwidth=500";

interface SisterPage {
  title: string;
  index?: number;
  imageinfo?: Array<{
    url: string;
    thumburl?: string;
    size: number;
    width: number;
    height: number;
    mime: string;
  }>;
}

interface SisterResponse {
  continue?: Record<string, unknown>;
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: Record<string, SisterPage>;
  };
}

function toRepositoryFile(page: SisterPage): RepositoryFile | null {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  return {
    name: page.title.replace(/^File:/, ""),
    title: page.title,
    url: info.url,
    thumbUrl: info.thumburl ?? null,
    size: info.size,
    width: info.width ?? 0,
    height: info.height ?? 0,
    mime: info.mime,
    blurhash: null,
  };
}

function fetchSister(url: string): Promise<SisterResponse> {
  return fetchMediaWikiJson<SisterResponse>(url, {
    userAgent: DEFAULT_USER_AGENT,
    cacheTtlMs: CACHE_TTL_MS,
  });
}

function listUrl(input: { query?: string; category?: string; limit: number }): string {
  const baseUrl = getMediaWikiApiUrl("iiwiki");
  if (input.category) {
    return `${baseUrl}?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(
      input.category.replace(/ /g, "_")
    )}&gcmtype=file&gcmlimit=${input.limit}&${IMAGE_INFO}&format=json`;
  }
  if (input.query?.trim()) {
    return `${baseUrl}?action=query&generator=search&gsrsearch=${encodeURIComponent(
      input.query.trim()
    )}&gsrnamespace=6&gsrlimit=${input.limit}&${IMAGE_INFO}&format=json`;
  }
  return `${baseUrl}?action=query&generator=allimages&gailimit=${input.limit}&${IMAGE_INFO}&format=json`;
}

/** One page of iiwiki's files; `continueParams` are MediaWiki's own continuation keys from the previous page. */
export async function fetchSisterFilePage(input: {
  query?: string;
  category?: string;
  limit: number;
  continueParams: Record<string, string>;
}): Promise<{ files: RepositoryFile[]; next: Record<string, unknown> | undefined }> {
  let url = listUrl(input);
  for (const [key, value] of Object.entries(input.continueParams)) {
    url += `&${key}=${encodeURIComponent(value)}`;
  }
  const data = await fetchSister(url);
  const files = Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER))
    .map(toRepositoryFile)
    .filter((file): file is RepositoryFile => file !== null);
  return { files, next: data.continue };
}

/**
 * The named iiwiki files in one call, keyed by the title exactly as requested (MediaWiki's `normalized` list maps
 * "File:A_b.png" back from "File:A b.png"). A title that is not a file, or has no such file, is absent.
 */
export async function fetchSisterFileInfo(titles: readonly string[]): Promise<Record<string, RepositoryFile>> {
  const url = `${getMediaWikiApiUrl("iiwiki")}?action=query&titles=${encodeURIComponent(
    titles.join("|")
  )}&${IMAGE_INFO}&format=json`;
  const data = await fetchSister(url);
  const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const byTitle = new Map(Object.values(data.query?.pages ?? {}).map((page) => [page.title, page]));
  const found: Record<string, RepositoryFile> = {};
  for (const requested of titles) {
    const page = byTitle.get(normalized.get(requested) ?? requested);
    const file = page ? toRepositoryFile(page) : null;
    if (file) found[requested] = file;
  }
  return found;
}
