/**
 * src/lib/wiki-os/adapters/mediawiki/bridge/batch-reader.ts
 *
 * MediaWiki Batch Wikitext Reader with Multi-Tier Caching.
 *
 * Batches up to 50 article wikitext requests into a SINGLE pipe-delimited
 * MediaWiki API call (`action=query&titles=Page1|Page2|...&prop=revisions`),
 * reducing network connection roundtrips by up to 90%.
 */

import {
  type WikiArticle,
  type WikiSource,
  cacheGet,
  cacheSet,
} from "./types";
import { iiwikiApiCall, althistoryApiCall } from "./http-reader";
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

/**
 * Fetch wikitext for multiple articles in parallel/batch.
 * Uses pipe-delimited titles to execute a single HTTP roundtrip to MediaWiki.
 */
export async function getBatchWikitext(
  titles: string[],
  wiki: WikiSource = "ixwiki"
): Promise<Map<string, WikiArticle>> {
  const resultMap = new Map<string, WikiArticle>();
  if (!titles || titles.length === 0) return resultMap;

  const cleanTitles = Array.from(
    new Set(titles.map((t) => t.trim()).filter((t) => Boolean(t)))
  );

  const neededTitles: string[] = [];

  // 1. Check L1 Memory Cache & Negative Cache
  for (const title of cleanTitles) {
    if (intelligentLoreCache.isKnownMissingPage(wiki, title)) {
      continue;
    }

    const cached = cacheGet<WikiArticle>(`wikitext:${wiki}:${title.toLowerCase()}`);
    if (cached) {
      resultMap.set(title.toLowerCase(), cached);
      resultMap.set(cached.title.toLowerCase(), cached);
    } else {
      neededTitles.push(title);
    }
  }

  if (neededTitles.length === 0) {
    return resultMap;
  }

  // 2. Fetch IxWiki locally from PostgreSQL (<2ms)
  if (wiki === "ixwiki") {
    const pgPromises = neededTitles.map(async (t) => {
      const article = await ixwikiGetWikitext(t);
      if (article) {
        cacheSet(`wikitext:${wiki}:${t.toLowerCase()}`, article);
        resultMap.set(t.toLowerCase(), article);
        resultMap.set(article.title.toLowerCase(), article);
      } else {
        intelligentLoreCache.markMissingPage(wiki, t);
      }
    });
    await Promise.allSettled(pgPromises);
    return resultMap;
  }

  // 3. Batch fetch from sister wikis (IIWiki / AltHistory) in chunks of 50 titles
  const BATCH_CHUNK_SIZE = 50;
  for (let i = 0; i < neededTitles.length; i += BATCH_CHUNK_SIZE) {
    const chunk = neededTitles.slice(i, i + BATCH_CHUNK_SIZE);
    const titlesParam = chunk.join("|");

    try {
      const rawData =
        wiki === "althistory"
          ? await althistoryApiCall({
              action: "query",
              titles: titlesParam,
              prop: "revisions",
              rvprop: "content",
              rvslots: "main",
            })
          : await iiwikiApiCall({
              action: "query",
              titles: titlesParam,
              prop: "revisions",
              rvprop: "content",
              rvslots: "main",
            });

      const response = rawData as MediaWikiQueryBatchResponse | null;
      const rawPages = response?.query?.pages;
      const pagesList: MediaWikiQueryBatchPage[] = Array.isArray(rawPages)
        ? rawPages
        : rawPages
          ? Object.values(rawPages)
          : [];

      const returnedTitles = new Set<string>();

      for (const page of pagesList) {
        if (!page.title) continue;
        returnedTitles.add(page.title.toLowerCase());

        if (page.missing || (typeof page.pageid === "number" && page.pageid < 0)) {
          intelligentLoreCache.markMissingPage(wiki, page.title);
          continue;
        }

        const rev = page.revisions?.[0];
        const wikitext = rev?.slots?.main?.["*"] ?? rev?.content ?? rev?.["*"] ?? "";

        if (wikitext && page.pageid && page.pageid > 0) {
          const article: WikiArticle = {
            title: page.title,
            pageId: page.pageid,
            wikitext,
            length: wikitext.length,
          };

          cacheSet(`wikitext:${wiki}:${page.title.toLowerCase()}`, article);
          resultMap.set(page.title.toLowerCase(), article);
        } else {
          intelligentLoreCache.markMissingPage(wiki, page.title);
        }
      }

      // Mark any requested titles completely absent from query response as missing
      for (const requestedTitle of chunk) {
        if (!returnedTitles.has(requestedTitle.toLowerCase())) {
          intelligentLoreCache.markMissingPage(wiki, requestedTitle);
        }
      }
    } catch (err) {
      console.warn(`[WikiBatchReader] Batch query failed for ${wiki}:`, err);
    }
  }

  return resultMap;
}
