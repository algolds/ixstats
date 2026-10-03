/**
 * Batch wikitext reader with a memory cache and a known-missing-page cache.
 *
 * Batches up to 50 article wikitext requests into a single pipe-delimited
 * MediaWiki API call (`action=query&titles=Page1|Page2|...&prop=revisions`).
 */

import { type WikiArticle, type WikiSource, cacheGet, cacheSet } from "./types";
import { iiwikiApiCall, althistoryApiCall, pagesOf } from "./http-reader";
import { ixwikiGetWikitext } from "./pg-reader";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";

interface MediaWikiQueryBatchPage {
  pageid?: number;
  title?: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { "*"?: string } }; content?: string; "*"?: string }>;
}

interface MediaWikiQueryBatchResponse {
  query?: {
    pages?: Record<string, MediaWikiQueryBatchPage> | MediaWikiQueryBatchPage[];
  };
}

const BATCH_CHUNK_SIZE = 50;

const cacheKey = (wiki: WikiSource, title: string): string =>
  `wikitext:${wiki}:${title.toLowerCase()}`;

/** IxWiki articles live in PostgreSQL, so each title is a local lookup. */
async function loadIxwikiArticles(titles: string[], results: Map<string, WikiArticle>) {
  await Promise.allSettled(
    titles.map(async (title) => {
      const article = await ixwikiGetWikitext(title);
      if (!article) {
        intelligentLoreCache.markMissingPage("ixwiki", title);
        return;
      }
      cacheSet(cacheKey("ixwiki", title), article);
      results.set(title.toLowerCase(), article);
      results.set(article.title.toLowerCase(), article);
    })
  );
}

/** One pipe-delimited `action=query` request to a sister wiki (IIWiki / AltHistory). */
async function loadSisterWikiChunk(
  chunk: string[],
  wiki: WikiSource,
  results: Map<string, WikiArticle>
) {
  const apiCall = wiki === "althistory" ? althistoryApiCall : iiwikiApiCall;
  const response = (await apiCall({
    action: "query",
    titles: chunk.join("|"),
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  })) as MediaWikiQueryBatchResponse | null;

  const returnedTitles = new Set<string>();
  for (const page of pagesOf(response?.query?.pages)) {
    if (!page.title) continue;
    returnedTitles.add(page.title.toLowerCase());

    const rev = page.revisions?.[0];
    const wikitext = rev?.slots?.main?.["*"] ?? rev?.content ?? rev?.["*"] ?? "";
    const isPresent = !page.missing && wikitext && page.pageid && page.pageid > 0;
    if (!isPresent) {
      intelligentLoreCache.markMissingPage(wiki, page.title);
      continue;
    }

    const article: WikiArticle = {
      title: page.title,
      pageId: page.pageid!,
      wikitext,
      length: wikitext.length,
    };
    cacheSet(cacheKey(wiki, page.title), article);
    results.set(page.title.toLowerCase(), article);
  }

  // Requested titles completely absent from the response are missing pages.
  for (const requestedTitle of chunk) {
    if (!returnedTitles.has(requestedTitle.toLowerCase())) {
      intelligentLoreCache.markMissingPage(wiki, requestedTitle);
    }
  }
}

/**
 * Fetch wikitext for multiple articles in parallel/batch.
 * Sister wikis get one pipe-delimited MediaWiki request per 50 titles.
 */
export async function getBatchWikitext(
  titles: string[],
  wiki: WikiSource = "ixwiki"
): Promise<Map<string, WikiArticle>> {
  const results = new Map<string, WikiArticle>();
  if (!titles || titles.length === 0) return results;

  const neededTitles: string[] = [];
  for (const title of new Set(titles.map((t) => t.trim()).filter(Boolean))) {
    if (intelligentLoreCache.isKnownMissingPage(wiki, title)) continue;

    const cached = cacheGet<WikiArticle>(cacheKey(wiki, title));
    if (cached) {
      results.set(title.toLowerCase(), cached);
      results.set(cached.title.toLowerCase(), cached);
    } else {
      neededTitles.push(title);
    }
  }

  if (wiki === "ixwiki") {
    await loadIxwikiArticles(neededTitles, results);
    return results;
  }

  for (let i = 0; i < neededTitles.length; i += BATCH_CHUNK_SIZE) {
    try {
      await loadSisterWikiChunk(neededTitles.slice(i, i + BATCH_CHUNK_SIZE), wiki, results);
    } catch (err) {
      console.warn(`[WikiBatchReader] Batch query failed for ${wiki}:`, err);
    }
  }

  return results;
}
