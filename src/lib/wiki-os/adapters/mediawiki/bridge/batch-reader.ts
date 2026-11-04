/**
 * Batch wikitext reader with a memory cache and a known-missing-page cache.
 *
 * Batches up to 50 article wikitext requests into a single pipe-delimited
 * MediaWiki API call (`action=query&titles=Page1|Page2|...&prop=revisions`).
 */

import {
  type SisterWikiSource,
  type WikiArticle,
  type WikiSource,
  cacheGet,
  cacheSet,
} from "./types";
import { pagesOf, sisterApiCall } from "./http-reader";
import { ixwikiGetWikitext } from "./pg-reader";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";

interface MediaWikiQueryBatchPage {
  pageid?: number;
  title?: string;
  missing?: boolean;
  revisions?: Array<{
    revid?: number;
    slots?: { main?: { "*"?: string } };
    content?: string;
    "*"?: string;
  }>;
}

interface MediaWikiQueryBatchResponse {
  query?: {
    normalized?: Array<{ from?: string; to?: string }>;
    redirects?: Array<{ from?: string; to?: string }>;
    pages?: Record<string, MediaWikiQueryBatchPage> | MediaWikiQueryBatchPage[];
  };
}

const BATCH_CHUNK_SIZE = 50;
const SISTER_MISSING_TTL_MS = 10 * 60 * 1000;

const cacheKey = (wiki: WikiSource, title: string): string =>
  `wikitext:${wiki}:${title.replace(/_/g, " ").trim().toLowerCase()}`;

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

/**
 * One pipe-delimited `action=query` request to a sister wiki (IIWiki / AltHistory). A wiki that cannot be reached
 * throws WikiUnavailableError, so its titles are never remembered as missing.
 */
async function loadSisterWikiChunk(
  chunk: string[],
  wiki: SisterWikiSource,
  results: Map<string, WikiArticle>
) {
  const response = await sisterApiCall<MediaWikiQueryBatchResponse>(wiki, {
    action: "query",
    titles: chunk.join("|"),
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    redirects: "1",
  });

  const normalizedMap = new Map<string, string>();
  for (const n of response?.query?.normalized ?? []) {
    if (n.from && n.to) normalizedMap.set(n.from.toLowerCase(), n.to.toLowerCase());
  }
  const redirectMap = new Map<string, string>();
  for (const r of response?.query?.redirects ?? []) {
    if (r.from && r.to) redirectMap.set(r.from.toLowerCase(), r.to.toLowerCase());
  }

  const returnedTitles = new Set<string>();
  const byResolvedTitle = new Map<string, WikiArticle>();
  for (const page of pagesOf(response?.query?.pages)) {
    if (!page.title) continue;
    const lowerTitle = page.title.toLowerCase();
    returnedTitles.add(lowerTitle);

    const rev = page.revisions?.[0];
    const wikitext = rev?.slots?.main?.["*"] ?? rev?.content ?? rev?.["*"] ?? "";
    const isPresent = !page.missing && wikitext && page.pageid && page.pageid > 0;
    if (!isPresent) {
      intelligentLoreCache.markMissingPage(wiki, page.title);
      cacheSet(cacheKey(wiki, page.title), { missing: true }, SISTER_MISSING_TTL_MS);
      continue;
    }

    const article: WikiArticle = {
      title: page.title,
      pageId: page.pageid!,
      wikitext,
      length: wikitext.length,
      ...(rev?.revid !== undefined ? { revId: rev.revid } : {}),
    };
    cacheSet(cacheKey(wiki, page.title), article);
    results.set(lowerTitle, article);
    byResolvedTitle.set(lowerTitle, article);
  }

  // Map requested titles through normalization/redirects and mark truly absent ones as missing.
  for (const requestedTitle of chunk) {
    const reqLower = requestedTitle.toLowerCase();
    const normTarget = normalizedMap.get(reqLower) ?? reqLower;
    const finalTarget = redirectMap.get(normTarget) ?? redirectMap.get(reqLower) ?? normTarget;
    const resolvedArticle = byResolvedTitle.get(finalTarget);
    if (resolvedArticle) {
      const redirected =
        redirectMap.has(normTarget) || redirectMap.has(reqLower)
          ? { ...resolvedArticle, redirectedFrom: requestedTitle }
          : resolvedArticle;
      cacheSet(cacheKey(wiki, requestedTitle), redirected);
      results.set(reqLower, redirected);
    } else if (!returnedTitles.has(finalTarget) || !byResolvedTitle.has(finalTarget)) {
      intelligentLoreCache.markMissingPage(wiki, requestedTitle);
      cacheSet(cacheKey(wiki, requestedTitle), { missing: true }, SISTER_MISSING_TTL_MS);
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

    const cached = cacheGet<WikiArticle | { readonly missing: true }>(cacheKey(wiki, title));
    if (cached) {
      if (!("missing" in cached)) {
        results.set(title.toLowerCase(), cached);
        results.set(cached.title.toLowerCase(), cached);
      }
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
