/**
 * deps.ts — the real dependencies of the api.php endpoint (plan 410): the Prisma store, the
 * existing rights engine, the shared rate limiter and the clock. Tests build `ApiDeps` by hand.
 */

import { rateLimiter } from "~/lib/cache/rate-limiter";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
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
import { purgeArticle } from "~/lib/wiki-os/services/purge-service";
import { ensureRendered } from "~/lib/wiki-os/services/render-service";
import { uploadFile } from "~/lib/wiki-os/services/upload-service";
import { diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";
import { capWikiPermissions, getWikiPermissions } from "~/lib/wiki-os/rights";
import { prismaAuthStore } from "./auth-store";
import { prismaApiStore } from "./store";
import { searchTitles } from "./store-lists";
import type { ApiDeps, ApiServices, SearchFn } from "./types";

/**
 * `list=search` and `opensearch`: titles by a title-only query (never reading page text), text by
 * WikiOS's weighted full-text search.
 */
const search: SearchFn = async (query, what, limit, offset) => {
  if (what === "title") {
    const titles = await searchTitles(query, limit, offset);
    return {
      hits: titles.map((title) => ({ title, snippet: "" })),
      total: offset + titles.length,
    };
  }
  const { results, total } = await NativeSearchService.fulltextSearch(query, "ixwiki", limit, offset);
  return { hits: results.map((r) => ({ title: r.title, snippet: r.snippet })), total };
};

/** How long a parse of a stale page waits for its render before answering with what is stored. */
const RENDER_WAIT_MS = 6_000;

const services: ApiServices = {
  renderWikitext: async (wikitext, title) => {
    const rendered = await renderArticleViaMediaWiki(wikitext, title);
    return rendered
      ? {
          html: rendered.html,
          templates: rendered.metadata.templates?.map((template) => template.title) ?? null,
          images: rendered.metadata.images,
        }
      : null;
  },
  purgePage: purgeArticle,
  ensureRendered: async (articleId) => {
    await ensureRendered(articleId, { waitMs: RENDER_WAIT_MS });
  },
  diff: diffWikitext,
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
  uploadFile,
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
    siteUrl: mediaWikiOrigin(),
    now: () => new Date(),
  };
}
