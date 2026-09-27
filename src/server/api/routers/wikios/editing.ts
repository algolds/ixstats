/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ArticleRepository, MediaAssetService } from "~/lib/wiki-os/core";
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import {
  canEditProtectedArticle,
  getWikiAuth,
  isWikiAdmin,
  resolveWikiUsername,
  type WikiAuthContext,
  type WikiAuthIdentity,
} from "~/lib/wiki-os/auth";

import { executeMediaWikiWrite } from "~/lib/wiki-os/adapters/mediawiki/write-service";

/** Throws FORBIDDEN unless the caller may edit `title` at its current protection level. */
async function assertCanEditArticle(
  ctx: WikiAuthContext,
  title: string,
  realm = "ixwiki"
): Promise<WikiAuthIdentity> {
  const identity = getWikiAuth(ctx);
  const existing = await ArticleRepository.findBySlug(title, realm);
  if (!canEditProtectedArticle(existing, identity)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This page is protected." });
  }
  return identity;
}

/** Archive/restore mirror MediaWiki delete/undelete, which are sysop rights. */
function assertWikiAdmin(ctx: WikiAuthContext): void {
  if (!isWikiAdmin(ctx)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only wiki administrators can archive or restore pages.",
    });
  }
}

export const wikiosEditingRouter = createTRPCRouter({
  /**
   * Preview wikitext by converting it to HTML via Parsoid.
   */
  previewWikitext: rateLimitedPublicProcedure
    .input(
      z.object({
        wikitext: z.string().max(200_000),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const rawHtml = await wikitextToHtml(input.wikitext, input.title, {
        preserveUnknownTemplates: false,
      });
      const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
      const infoboxPrefix = transformed.infoboxHtml
        ? `<div class="wikios-infobox-container mb-4 float-right clear-right max-w-[340px] ml-4">${transformed.infoboxHtml}</div>`
        : "";
      const noticesPrefix = transformed.noticesHtml
        ? `<div class="wikios-notices-container mb-4">${transformed.noticesHtml}</div>`
        : "";
      return { html: noticesPrefix + infoboxPrefix + transformed.contentHtml };
    }),

  /**
   * Save wikitext directly (from source editor).
   */
  saveWikitext: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wikitext: z.string(),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        turnstileToken: z.string().optional(),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertCanEditArticle(ctx, input.title);

      if (input.turnstileToken) {
        await CloudflareGuardian.verifyTurnstile(input.turnstileToken);
      }

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";

      // 1. Primary Save: Direct to PostgreSQL
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: input.title,
          title: input.title,
          wikitext: input.wikitext,
          summary: input.summary,
          minor: input.minor,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync & cache purge
      MediaWikiExportWorker.enqueue({
        slug: input.title,
        title: input.title,
        wikitext: input.wikitext,
        summary: input.summary,
        minor: input.minor,
        authorWikiUsername: authorName,
      });

      void CloudflareGuardian.purgeArticleEdgeCache(input.title);

      return {
        success: true,
        title: input.title,
        revisionId: saveResult.revisionId,
        extractedLinksCount: saveResult.extractedLinksCount,
      };
    }),

  /**
   * Revert a page to a specific revision.
   * Fetches the old revision's wikitext and saves it as a new edit.
   */
  revertToRevision: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        revid: z.string().min(1).max(64),
        summary: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertCanEditArticle(ctx, input.title);

      const oldRev = await getRevisionWikitextShadow(input.revid);
      if (!oldRev) {
        throw new Error(`Revision ${input.revid} not found`);
      }

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const summary = input.summary || `Reverted to revision ${input.revid} via WikiOS`;

      // 1. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: input.title,
          title: input.title,
          wikitext: oldRev.wikitext,
          summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: input.title,
        title: input.title,
        wikitext: oldRev.wikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
      });

      return {
        success: true,
        title: input.title,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Quick rollback: revert all consecutive edits by the last editor.
   * Finds the most recent revision by a different user and reverts to it.
   */
  rollback: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await assertCanEditArticle(ctx, input.title);

      // Read-through: serve from shadow history with MySQL fallback
      const history = await getArticleHistoryShadow(input.title, 50);
      const revisions = history.revisions;
      if (revisions.length < 2) throw new Error("Not enough revisions to rollback");

      const lastEditor = revisions[0]!.user;
      const targetRev = revisions.find((r) => r.user !== lastEditor);
      if (!targetRev) throw new Error("All revisions are by the same user");

      const oldContent = await getRevisionWikitextShadow(targetRev.revid);
      if (!oldContent) throw new Error("Could not fetch target revision content");

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const summary = `Rolled back edits by ${lastEditor} to revision ${targetRev.revid}`;

      // 1. Primary Save: Direct to PostgreSQL
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: input.title,
          title: input.title,
          wikitext: oldContent.wikitext,
          summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: input.title,
        title: input.title,
        wikitext: oldContent.wikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
      });

      return {
        success: true,
        title: input.title,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Upload a file (image/document) with Dual-Ingest (PostgreSQL wiki_assets + MediaWiki Action API).
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        fileBase64: z.string(),
        description: z.string().max(10000).default(""),
        comment: z.string().max(500).default("Uploaded via WikiOS"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate file size (10MB max)
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit");
      }

      // 1. Dual-Ingest: Register asset in PostgreSQL wiki_assets
      try {
        const cleanName = input.filename.replace(/^File:/, "").replace(/ /g, "_");
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
          filename: input.filename,
          comment: `${input.comment} (via WikiOS)`,
          text: input.description,
          ignorewarnings: "1",
        },
        ctx
      );

      const resAny = result.result as any;
      return {
        success: result.success,
        filename: resAny?.upload?.filename ?? input.filename,
        url: resAny?.upload?.imageinfo?.url ?? null,
        descriptionUrl: resAny?.upload?.imageinfo?.descriptionurl ?? null,
      };
    }),

  /**
   * Restore an Archived Article
   */
  restoreArticle: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        realm: z.string().default("ixwiki"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertWikiAdmin(ctx);
      const { PageManagementService } = await import("~/lib/wiki-os/core/page-management-service");
      return PageManagementService.restoreArticle(
        input.title,
        ctx.auth.userId || "anonymous",
        input.realm
      );
    }),
});
