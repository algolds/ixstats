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
import { ArticleRepository, MediaAssetService } from "~/lib/wiki-os/core";
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import { getWikiActorLabel, requireWikiUserId, resolveWikiUsername } from "~/lib/wiki-os/auth";
import {
  authorizeAction,
  refusals,
  requireCanonicalTitle,
  requireRight,
  requireUploadTitle,
} from "~/lib/wiki-os/permissions";
import { detectEditConflict } from "~/lib/wiki-os/core/edit-conflict";
import {
  assertCanEditArticle,
  commitWikitextSave,
  deletedPage,
  requireRestorableWikitext,
} from "~/lib/wiki-os/services/edit-service";

import { executeMediaWikiWrite } from "~/lib/wiki-os/adapters/mediawiki/write-service";

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

      const conflict = await detectEditConflict(title, input.baseRevisionRef);
      if (conflict) return { success: false as const, editConflict: true as const, ...conflict };

      const saveResult = await commitWikitextSave(ctx, {
        title,
        wikitext: input.wikitext,
        summary: input.summary,
        minor: input.minor,
      });

      return {
        success: true as const,
        title,
        revisionId: saveResult.revisionId,
      };
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

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: title,
        title,
        wikitext: restoredWikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
        revisionId: saveResult.revisionId,
      });

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

      // Read-through: serve from shadow history with MySQL fallback
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

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: title,
        title,
        wikitext: restoredWikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
        revisionId: saveResult.revisionId,
      });

      void CloudflareGuardian.purgeArticleEdgeCache(title);

      return {
        success: true,
        title,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Upload a file (image/document) with Dual-Ingest (PostgreSQL wiki_assets + MediaWiki Action API).
   */
  uploadFile: lightMutationProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        // ~10 MB decoded; rejected by validation, before anything is decoded.
        fileBase64: z.string().max(15_000_000),
        description: z.string().max(10000).default(""),
        comment: z.string().max(500).default("Uploaded via WikiOS"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // The name MediaWiki will store it under: the rights are checked against that, not the raw text.
      const fileTitle = requireUploadTitle(input.filename);
      await authorizeAction(ctx, "upload", fileTitle);
      const fileName = fileTitle.slice("File:".length);

      // Validate file size (10MB max)
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit");
      }

      // 1. Dual-Ingest: Register asset in PostgreSQL wiki_assets
      try {
        const cleanName = fileName.replace(/ /g, "_");
        const ext = cleanName.split(".").pop()?.toLowerCase() || "png";
        const mimeType =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : "image/png";

        await MediaAssetService.registerAsset({
          filename: cleanName,
          title: cleanName.replace(/_/g, " "),
          mimeType,
          sizeBytes: fileBuffer.length,
        });
      } catch (assetErr) {
        console.warn("[wikiosEditingRouter] Best-effort wiki_assets registration:", assetErr);
      }

      // 2. Upload to MediaWiki Action API
      const result = await executeMediaWikiWrite(
        {
          action: "upload",
          filename: fileName,
          comment: `${input.comment} (via WikiOS)`,
          text: input.description,
          ignorewarnings: "1",
        },
        ctx
      );

      const resAny = result.result as any;
      return {
        success: result.success,
        filename: resAny?.upload?.filename ?? fileName,
        url: resAny?.upload?.imageinfo?.url ?? null,
        descriptionUrl: resAny?.upload?.imageinfo?.descriptionurl ?? null,
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
