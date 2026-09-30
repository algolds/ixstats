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
import { checkEditPolicy } from "~/lib/wiki-os/namespace-policy";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { detectEditConflict } from "~/lib/wiki-os/core/edit-conflict";
import { getVerifiedWikiUsername } from "~/lib/wiki-os/storage";

import { executeMediaWikiWrite } from "~/lib/wiki-os/adapters/mediawiki/write-service";

/**
 * Throws FORBIDDEN unless the caller may edit `title`: first its namespace (all WikiOS edits reach
 * MediaWiki through one shared bot account, so interface and project namespaces are admin-only;
 * see namespace-policy.ts), then its current protection level.
 */
async function assertCanEditArticle(
  ctx: WikiAuthContext,
  title: string,
  realm = "ixwiki"
): Promise<WikiAuthIdentity> {
  const identity = getWikiAuth(ctx);
  const verifiedWikiUsername = identity.internalUserId
    ? await getVerifiedWikiUsername(identity.internalUserId)
    : null;
  const policy = checkEditPolicy(title, {
    isAdmin: identity.isAdmin,
    linkedWikiUsername: verifiedWikiUsername,
  });
  if (!policy.allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: policy.reason });
  }
  const existing = await ArticleRepository.findBySlug(title, realm);
  if (!canEditProtectedArticle(existing, identity, verifiedWikiUsername !== null)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This page is protected." });
  }
  return identity;
}

/** The canonical title of what the client sent; BAD_REQUEST when MediaWiki would refuse it. */
function requireCanonicalTitle(rawTitle: string): string {
  const canon = canonicalizeTitle(rawTitle);
  if (!canon) throw new TRPCError({ code: "BAD_REQUEST", message: "That page title is not valid." });
  return canon.title;
}

/**
 * The wikitext a revert or rollback may save over `title`, from the revision it restores. Throws
 * when the text was never imported (a placeholder must not blank the page), when the revision
 * belongs to another page, or when it would blank a page that has text (admins may). Text that is
 * only whitespace counts as blank on both sides.
 */
async function requireRestorableWikitext(
  ctx: WikiAuthContext,
  title: string,
  revision: { wikitext: string | null; title: string }
): Promise<string> {
  const { wikitext } = revision;
  if (wikitext === null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This revision's text has not been imported yet.",
    });
  }
  if (canonicalizeTitle(revision.title)?.title !== title) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That revision belongs to a different page.",
    });
  }
  if (wikitext.trim() === "" && !isWikiAdmin(ctx)) {
    const current = await ArticleRepository.findBySlug(title);
    if ((current?.wikitext ?? "").trim() !== "") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Restoring this revision would blank the page. Only administrators can do that.",
      });
    }
  }
  return wikitext;
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
        /** `revisionRef` of the page when the editor loaded it; absent for a page that did not exist. */
        baseRevisionRef: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await assertCanEditArticle(ctx, title);

      const conflict = await detectEditConflict(title, input.baseRevisionRef);
      if (conflict) return { success: false as const, editConflict: true as const, ...conflict };

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
          editSummary: input.summary,
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
        success: true as const,
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
      await assertCanEditArticle(ctx, title);

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
      assertWikiAdmin(ctx);
      const title = requireCanonicalTitle(input.title);
      const { PageManagementService } = await import("~/lib/wiki-os/core/page-management-service");
      return PageManagementService.restoreArticle(
        title,
        ctx.auth.userId || "anonymous",
        input.realm
      );
    }),
});
