/**
 * deps.ts — the real dependencies of the api.php endpoint (plan 410): the Prisma store, the
 * existing rights engine, the shared rate limiter and the clock. Tests build `ApiDeps` by hand.
 */

import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { detectEditConflict } from "~/lib/wiki-os/core/edit-conflict";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { RightsAdminService } from "~/lib/wiki-os/core/rights-admin-service";
import { authorizeAction, authorizeMove, authorizeProtection, requireRight } from "~/lib/wiki-os/permissions";
import {
  assertCanEditArticle,
  commitWikitextSave,
  requireRestorableWikitext,
} from "~/lib/wiki-os/services/edit-service";
import { computeWikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";
import { capWikiPermissions, getWikiPermissions } from "~/lib/wiki-os/rights";
import { prismaAuthStore } from "./auth-store";
import { prismaApiStore } from "./store";
import type { ApiDeps, ApiServices, SearchFn } from "./types";

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

const services: ApiServices = {
  renderWikitext: wikitextToHtml,
  diff: computeWikitextDiff,
  assertCanEdit: (ctx, title) => assertCanEditArticle(ctx, title),
  authorize: (ctx, action, title) => authorizeAction(ctx, action, title),
  requireRight: async (ctx, right) => {
    await requireRight(ctx, right);
  },
  authorizeMove,
  authorizeProtection,
  requireRestorableWikitext,
  detectEditConflict: (title, baseRef) => detectEditConflict(title, baseRef),
  saveWikitext: async (ctx, save) => ({
    revisionRowId: (await commitWikitextSave(ctx, save)).revisionId,
  }),
  movePage: (from, to, reason, actor, options) =>
    PageManagementService.movePage(from, to, reason, actor, "ixwiki", options),
  archivePage: async (title, reason, actor) => {
    await PageManagementService.archiveArticle(title, reason, actor);
  },
  restorePage: async (title, reason, actor) => {
    await PageManagementService.restoreArticle(title, actor, "ixwiki", reason || undefined);
  },
  protectPage: (params) => RightsAdminService.protect(params),
};

export function createApiDeps(): ApiDeps {
  return {
    auth: prismaAuthStore,
    loadPermissions: (ctx, ceiling) =>
      ceiling ? capWikiPermissions(ctx, ceiling) : getWikiPermissions(ctx),
    rateLimit: (identity, bucket, limits) => rateLimiter.check(identity, bucket, limits),
    store: prismaApiStore,
    services,
    search,
    siteUrl: getWikiBaseUrl().replace(/\/+$/, ""),
    now: () => new Date(),
  };
}
