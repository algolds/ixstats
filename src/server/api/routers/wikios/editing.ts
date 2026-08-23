/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { htmlToWikitext, wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import { resolveWikiUsername } from "~/lib/wiki-os/auth";

import {
  saveToMediaWiki,
  cleanHtmlForParsoid,
  executeMediaWikiWrite,
} from "~/lib/wiki-os/adapters/mediawiki/write-service";

export const wikiosEditingRouter = createTRPCRouter({
  /**
   * Preview wikitext by converting it to HTML via Parsoid.
   */
  previewWikitext: publicProcedure
    .input(
      z.object({
        wikitext: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const html = await wikitextToHtml(input.wikitext, input.title);
      return { html: transformWikiLinks(html) };
    }),

  /**
   * Convert wikitext directly to editor-ready Parsoid HTML.
   */
  convertWikitextToHtml: protectedProcedure
    .input(
      z.object({
        wikitext: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const html = await wikitextToHtml(input.wikitext, input.title);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1]! : html;
      return { html: bodyHtml };
    }),

  /**
   * Convert HTML (from PlateJS editor) back to wikitext via Parsoid.
   */
  htmlToWikitext: protectedProcedure
    .input(
      z.object({
        html: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const result = await htmlToWikitext(input.html, input.title);
      return { wikitext: result.wikitext };
    }),

  /**
   * Save an article edit via PostgreSQL Native Core (<10ms).
   * Persists to PostgreSQL first, updates the link graph, and dispatches background sync.
   */
  saveArticle: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        html: z.string(),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        turnstileToken: z.string().optional(),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Verify Cloudflare Turnstile if token is provided
      if (input.turnstileToken) {
        await CloudflareGuardian.verifyTurnstile(input.turnstileToken);
      }

      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const cleanedHtml = cleanHtmlForParsoid(input.html);
      const { wikitext } = await htmlToWikitext(cleanedHtml, input.title);

      // 2. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: input.title,
          title: input.title,
          contentHtml: cleanedHtml,
          wikitext,
          summary: input.summary,
          minor: input.minor,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 3. Dispatch non-blocking background tasks
      MediaWikiExportWorker.enqueue({
        slug: input.title,
        title: input.title,
        wikitext,
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
        revid: z.number(),
        summary: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const oldRev = await getRevisionWikitextShadow(input.revid);
      if (!oldRev) {
        throw new Error(`Revision ${input.revid} not found`);
      }

      const summary =
        input.summary || `Reverted to revision ${input.revid} via WikiOS`;

      return saveToMediaWiki(
        input.title,
        oldRev.wikitext,
        summary,
        false,
        ctx
      );
    }),

  /**
   * Quick rollback: revert all consecutive edits by the last editor.
   * Finds the most recent revision by a different user and reverts to it.
   */
  rollback: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      // Read-through: serve from shadow history with MySQL fallback
      const history = await getArticleHistoryShadow(input.title, 50, "ixwiki");
      const revisions = history.revisions;
      if (revisions.length < 2) throw new Error("Not enough revisions to rollback");

      const lastEditor = revisions[0]!.user;
      const targetRev = revisions.find((r) => r.user !== lastEditor);
      if (!targetRev) throw new Error("All revisions are by the same user");

      const oldContent = await getRevisionWikitextShadow(targetRev.revid, "ixwiki");
      if (!oldContent) throw new Error("Could not fetch target revision content");

      const summary = `Rolled back edits by ${lastEditor} to revision ${targetRev.revid}`;
      return saveToMediaWiki(input.title, oldContent.wikitext, summary, false, ctx);
    }),

  /**
   * Upload a file (image/document) to MediaWiki via Action API upload endpoint.
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

  // ---------------------------------------------------------------------------
  // Page Properties & Protection (direct MySQL)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Advanced Search (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Category Tree (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Watchlist endpoints (backed by the LoreStash "Watchlist" stash)
  // ---------------------------------------------------------------------------
});

