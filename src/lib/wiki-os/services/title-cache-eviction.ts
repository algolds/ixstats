/**
 * title-cache-eviction.ts — forget what every cache holds about one page.
 *
 * A page that was deleted, restored or moved must read as it is now, not as it was up to a day ago:
 * the bridge's intro/wikitext cache, the country profile and parsed-infobox cache, the lore scan
 * caches (memory and `external_api_cache`), the geo and countries wiki readers' tRPC cache and the article view
 * cache. Called by `PageManagementService` after the change commits; an inbound-sync archive calls it too.
 * Best effort: a cache that cannot be reached is logged and the others are still cleared, since a failed
 * eviction must not fail the operation that already happened (the entries age out on their TTL).
 */

import { evictBridgeCacheForTitle, type WikiSource } from "../adapters/mediawiki/bridge/types";
import { intelligentLoreCache } from "../core/intelligent-lore-cache";
import { invalidateCache } from "~/lib/cache/trpc-cache";
import { evictArticleView } from "./article-view-service";

/**
 * The wiki readers of the geo and countries routers cache their results through the tRPC cache under a
 * hash of the input, so the title is not in the key: those procedures are cleared whole (they are cheap
 * to refill). Each name is followed by the `:` that ends a path in a cache key.
 */
const TRPC_CACHED_WIKI_READERS = [
  // geo
  "getFeatureWikiIntro",
  "parseWikiInfobox",
  "searchWikiPages",
  // countries
  "getWikiIntro",
  "getWikiSections",
  "getWikiPageImages",
  "getWikiRichIntro",
  "getBulkWikiRichIntros",
  "getWikiSectionPreviews",
].map((procedure) => `${procedure}:`);

async function attempt(what: string, work: () => unknown): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.warn(`[WikiOS] Evicting the ${what} cache failed:`, error);
  }
}

/**
 * Evict `title` (any spelling) of `source` from every cache. `articleId` also clears the article
 * view cache, which is keyed by id.
 */
export async function evictWikiTitleCaches(
  title: string,
  source = "ixwiki",
  articleId?: string | null
): Promise<void> {
  const wiki = source as WikiSource;
  await Promise.all([
    attempt("bridge", () => evictBridgeCacheForTitle(title, wiki)),
    attempt("country profile", async () => {
      // Loaded on demand: the profile cache's module reads articles, and the service that calls this
      // is one of the modules it reads through.
      const { wikiCacheService } = await import("../adapters/ixstates/cache-service");
      wikiCacheService.invalidate(title, wiki);
    }),
    attempt("lore scan", () => intelligentLoreCache.evictTitle(wiki, title)),
    attempt("geo wiki reader", () => invalidateCache(TRPC_CACHED_WIKI_READERS)),
    attempt("article view", () => (articleId ? evictArticleView(articleId) : 0)),
  ]);
}
