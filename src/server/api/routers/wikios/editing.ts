/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import { getWikiActorLabel, requireWikiUserId, resolveWikiUsername } from "~/lib/wiki-os/auth";
import {
  authorizeAction,
  refusals,
  requireCanonicalTitle,
  requireRight,
} from "~/lib/wiki-os/permissions";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import {
  assertCanEditArticle,
  commitWikitextSave,
  deletedPage,
  requireRestorableWikitext,
} from "~/lib/wiki-os/services/edit-service";

export const wikiosEditingRouter = createTRPCRouter({
  /**
   * Preview wikitext by converting it to HTML via Parsoid. Signed-in only: it forwards up to 200k
   * characters to MediaWiki's parser, so a public endpoint would be an anonymous render proxy.
   */
  previewWikitext: readOnlyProcedure
    .input(
      z.object({
        wikitext: z.string().max(200_000),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const rawHtml = await wikitextToHtml(input.wikitext, requireCanonicalTitle(input.title));
      const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
      const infoboxPrefix = transformed.infoboxHtml
        ? `<div class="wikios-infobox-container mb-4 float-right clear-right max-w-[340px] ml-4">${transformed.infoboxHtml}</div>`
        : "";
      const noticesPrefix = transformed.noticesHtml
        ? `<div class="wikios-notices-container mb-4">${transformed.noticesHtml}</div>`
        : "";
      // MediaWiki's HTML, from a user's wikitext: sanitized before it is handed back.
      return {
        html: sanitizeWikiArticleHtml(noticesPrefix + infoboxPrefix + transformed.contentHtml),
      };
    }),

  /**
   * Save wikitext directly (from source editor).
   */
  saveWikitext: lightMutationProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        // MediaWiki's own page size limit (2 MB).
        wikitext: z.string().max(2_000_000),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        /** `revisionRef` of the page when the editor loaded it; absent for a page that did not exist. */
        baseRevisionRef: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await assertCanEditArticle(ctx, title);

      // The edit-conflict check is the save's own (atomic, under the page's lock): no base means the editor
      // believes the page does not exist yet.
      try {
        const saveResult = await commitWikitextSave(ctx, {
          title,
          wikitext: input.wikitext,
          summary: input.summary,
          minor: input.minor,
          expectedHeadRef: input.baseRevisionRef ?? null,
        });
        return {
          success: true as const,
          title,
          revisionId: saveResult.revisionId,
        };
      } catch (error) {
        if (error instanceof EditConflictError) {
          return { success: false as const, editConflict: true as const, ...error.conflict };
        }
        throw error;
      }
    }),

  /**
   * Revert a page to a specific revision.
   * Fetches the old revision's wikitext and saves it as a new edit.
   */
  revertToRevision: lightMutationProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        revid: z.string().min(1).max(64),
        summary: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await assertCanEditArticle(ctx, title);

      const oldRev = await getRevisionWikitextShadow(input.revid);
      if (!oldRev) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Revision ${input.revid} not found.` });
      }
      const restoredWikitext = await requireRestorableWikitext(ctx, title, oldRev);

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const summary = input.summary || `Reverted to revision ${input.revid} via WikiOS`;

      // 1. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: title,
          title,
          wikitext: restoredWikitext,
          editSummary: summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Edge cache purge (the save queued its own MediaWiki mirror job in its transaction)
      void CloudflareGuardian.purgeArticleEdgeCache(title);

      return {
        success: true,
        title,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Quick rollback: revert all consecutive edits by the last editor.
   * Finds the most recent revision by a different user and reverts to it.
   */
  rollback: lightMutationProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await authorizeAction(ctx, "rollback", title);
      const current = await ArticleRepository.findBySlug(title, "ixwiki", { includeArchived: true });
      if (current?.status === "ARCHIVED") throw deletedPage();

      // Read-through: serve from the PostgreSQL revision history
      const history = await getArticleHistoryShadow(title, 50);
      const revisions = history.revisions;
      if (revisions.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Not enough revisions to roll back.",
        });
      }

      const lastEditor = revisions[0]!.user;
      const targetRev = revisions.find((r) => r.user !== lastEditor);
      if (!targetRev) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "All revisions are by the same user, so there is nothing to roll back to.",
        });
      }

      const oldContent = await getRevisionWikitextShadow(targetRev.revid);
      if (!oldContent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The revision to roll back to could not be found.",
        });
      }
      const restoredWikitext = await requireRestorableWikitext(ctx, title, oldContent);

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const summary = `Rolled back edits by ${lastEditor} to revision ${targetRev.revid}`;

      // 1. Primary Save: Direct to PostgreSQL
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: title,
          title,
          wikitext: restoredWikitext,
          editSummary: summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Edge cache purge (the save queued its own MediaWiki mirror job in its transaction)
      void CloudflareGuardian.purgeArticleEdgeCache(title);

      return {
        success: true,
        title,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Restore an Archived Article
   */
  restoreArticle: lightMutationProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        realm: z.string().default("ixwiki"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // The right first, so a caller without it learns nothing about which titles are valid.
      await requireRight(ctx, "undelete");
      const title = requireCanonicalTitle(input.title, input.realm);
      await authorizeAction(ctx, "undelete", title, input.realm);
      const { PageManagementService } = await import("~/lib/wiki-os/core/page-management-service");
      return refusals(
        PageManagementService.restoreArticle(
          title,
          { userId: requireWikiUserId(ctx), name: getWikiActorLabel(ctx) },
          input.realm
        )
      );
    }),
});
