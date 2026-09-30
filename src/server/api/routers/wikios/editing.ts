/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, lightMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
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
  getWikiActorLabel,
  requireWikiUserId,
  resolveWikiUsername,
  type WikiAuthContext,
} from "~/lib/wiki-os/auth";
import { authorizeAction, requireCanonicalTitle, requireRight } from "~/lib/wiki-os/permissions";

import { executeMediaWikiWrite } from "~/lib/wiki-os/adapters/mediawiki/write-service";

/**
 * Throws FORBIDDEN unless the caller may edit `title` (or create it, when it does not exist): not
 * blocked, allowed in its namespace, past its protection, and holding the right (see
 * `authorizeAction`). A deleted (archived) page counts as missing, as in MediaWiki.
 */
async function assertCanEditArticle(
  ctx: WikiAuthContext,
  title: string,
  realm = "ixwiki"
): Promise<void> {
  const existing = await ArticleRepository.findBySlug(title, realm);
  const exists = existing !== null && existing.status !== "ARCHIVED";
  await authorizeAction(ctx, exists ? "edit" : "create", title, realm);
}

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
      return { html: noticesPrefix + infoboxPrefix + transformed.contentHtml };
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
        turnstileToken: z.string().optional(),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await assertCanEditArticle(ctx, title);

      if (input.turnstileToken) {
        await CloudflareGuardian.verifyTurnstile(input.turnstileToken);
      }

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";

      // 1. Primary Save: Direct to PostgreSQL
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: title,
          title,
          wikitext: input.wikitext,
          summary: input.summary,
          minor: input.minor,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync & cache purge
      MediaWikiExportWorker.enqueue({
        slug: title,
        title,
        wikitext: input.wikitext,
        summary: input.summary,
        minor: input.minor,
        authorWikiUsername: authorName,
        revisionId: saveResult.revisionId,
      });

      void CloudflareGuardian.purgeArticleEdgeCache(title);

      return {
        success: true,
        title,
        revisionId: saveResult.revisionId,
        extractedLinksCount: saveResult.extractedLinksCount,
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
        throw new Error(`Revision ${input.revid} not found`);
      }

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const summary = input.summary || `Reverted to revision ${input.revid} via WikiOS`;

      // 1. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: title,
          title,
          wikitext: oldRev.wikitext,
          summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: title,
        title,
        wikitext: oldRev.wikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
        revisionId: saveResult.revisionId,
      });

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

      // Read-through: serve from shadow history with MySQL fallback
      const history = await getArticleHistoryShadow(title, 50);
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
          slug: title,
          title,
          wikitext: oldContent.wikitext,
          summary,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 2. Background MediaWiki sync
      MediaWikiExportWorker.enqueue({
        slug: title,
        title,
        wikitext: oldContent.wikitext,
        summary,
        minor: false,
        authorWikiUsername: authorName,
        revisionId: saveResult.revisionId,
      });

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
      await authorizeAction(
        ctx,
        "upload",
        `File:${input.filename.replace(/^(?:File|Image):/i, "")}`
      );

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
      const title = requireCanonicalTitle(input.title);
      await authorizeAction(ctx, "undelete", title);
      const { PageManagementService } = await import("~/lib/wiki-os/core/page-management-service");
      return PageManagementService.restoreArticle(
        title,
        { userId: requireWikiUserId(ctx), name: getWikiActorLabel(ctx) },
        input.realm
      );
    }),
});
