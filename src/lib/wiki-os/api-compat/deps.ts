/**
 * deps.ts — the real dependencies of the api.php endpoint (plan 410): the Prisma store, the
 * existing rights engine, the shared rate limiter and the clock. Tests build `ApiDeps` by hand.
 */

import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { capWikiPermissions, getWikiPermissions } from "~/lib/wiki-os/rights";
import { prismaAuthStore } from "./auth-store";
import { prismaApiStore } from "./store";
import type { ApiDeps, SearchFn } from "./types";

/** `list=search` over WikiOS's own search: titles by prefix and similarity, text by weighted full-text. */
const search: SearchFn = async (query, what, limit, offset) => {
  if (what === "title") {
    const results = await NativeSearchService.spotlightSearch(query, "ixwiki", offset + limit);
    return {
      hits: results.slice(offset, offset + limit).map((r) => ({ title: r.title, snippet: r.snippet })),
      total: results.length,
    };
  }
  const { results, total } = await NativeSearchService.fulltextSearch(query, "ixwiki", limit, offset);
  return { hits: results.map((r) => ({ title: r.title, snippet: r.snippet })), total };
};

export function createApiDeps(): ApiDeps {
  return {
    auth: prismaAuthStore,
    loadPermissions: (ctx, ceiling) =>
      ceiling ? capWikiPermissions(ctx, ceiling) : getWikiPermissions(ctx),
    rateLimit: (identity, bucket, limits) => rateLimiter.check(identity, bucket, limits),
    store: prismaApiStore,
    search,
    siteUrl: getWikiBaseUrl().replace(/\/+$/, ""),
    now: () => new Date(),
  };
}
