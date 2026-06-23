/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { htmlToWikitext, wikitextToHtml } from "~/lib/wiki-os/parsoid-client";
import { getWikiAuth } from "~/lib/wiki-os/auth";
import {
  getPageHistory,
  getRevisionWikitext as getRevisionWikitextMySQL,
} from "~/lib/wiki-bridge";
import { transformWikiLinks } from "~/lib/wiki-os/url-compat";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";
import {
  saveToMediaWiki,
  cleanHtmlForParsoid,
  updateFileUploadActor,
} from "~/lib/wiki-os/wiki-write-service";

export const wikiosEditingRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

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
   * Save an article edit via MediaWiki Action API.
   * Converts HTML to wikitext first, then saves.
   */
  saveArticle: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        html: z.string(),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cleanedHtml = cleanHtmlForParsoid(input.html);
      const { wikitext } = await htmlToWikitext(cleanedHtml, input.title);
      return saveToMediaWiki(
        input.title,
        wikitext,
        input.summary,
        input.minor,
        ctx,
        input.basetimestamp
      );
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
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return saveToMediaWiki(
        input.title,
        input.wikitext,
        input.summary,
        input.minor,
        ctx,
        input.basetimestamp
      );
    }),

  // ---------------------------------------------------------------------------
  // Template Registry (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Lore Stash — save-for-later with color-coded collections
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // User Info (for WikiOS profiles)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Rollback / Undo endpoints
  // ---------------------------------------------------------------------------

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
      const oldRev = await getRevisionWikitext(input.revid);
      if (!oldRev) throw new Error("Target revision not found");

      const summary = input.summary ?? `Reverted to revision ${input.revid}`;
      return saveToMediaWiki(input.title, oldRev.wikitext, summary, false, ctx);
    }),

  /**
   * Quick rollback: revert all consecutive edits by the last editor.
   * Finds the most recent revision by a different user and reverts to it.
   */
  rollback: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      // Direct MySQL — uses wiki-bridge getPageHistory instead of API
      const history = await getPageHistory(input.title, 50);
      const revisions = history.revisions;
      if (revisions.length < 2) throw new Error("Not enough revisions to rollback");

      const lastEditor = revisions[0]!.user;
      const targetRev = revisions.find((r) => r.user !== lastEditor);
      if (!targetRev) throw new Error("All revisions are by the same user");

      const oldContent = await getRevisionWikitext(targetRev.revid);
      if (!oldContent) throw new Error("Could not fetch target revision content");

      const summary = `Rolled back edits by ${lastEditor} to revision ${targetRev.revid}`;
      return saveToMediaWiki(input.title, oldContent.wikitext, summary, false, ctx);
    }),

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

  /**
   * Upload a file to MediaWiki.
   * Accepts base64-encoded file data with metadata.
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(500),
        fileBase64: z.string(),
        description: z.string().max(10000).default(""),
        comment: z.string().max(500).default("Uploaded via WikiOS"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

      // Validate file size (10MB max)
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit");
      }

      let { cookies, csrfToken } = await getUserSessionAndToken(ctx);
      const { wikiUsername } = getWikiAuth(ctx);

      let attempt = 0;
      let uploadData: any;

      while (attempt < 2) {
        // Build multipart form data
        const formData = new FormData();
        formData.append("action", "upload");
        formData.append("filename", input.filename);
        formData.append("comment", `${input.comment} (via WikiOS)`);
        formData.append("token", csrfToken);
        formData.append("format", "json");
        formData.append("ignorewarnings", "1");
        formData.append("file", new Blob([fileBuffer]), input.filename);

        const uploadRes = await fetch(apiBase, {
          method: "POST",
          headers: {
            Cookie: cookies.join("; "),
          },
          body: formData,
        });

        uploadData = (await uploadRes.json()) as {
          upload?: {
            result: string;
            filename?: string;
            imageinfo?: { url?: string; descriptionurl?: string };
          };
          error?: { code: string; info: string };
        };

        if (uploadData.error) {
          if (uploadData.error.code === "badtoken" && attempt === 0) {
            console.warn(
              "[Editing Router] Bad token for upload. Invalidating cache and retrying..."
            );
            invalidateCsrfToken();
            const fresh = await getUserSessionAndToken(ctx);
            cookies = fresh.cookies;
            csrfToken = fresh.csrfToken;
            attempt++;
            continue;
          }
          throw new Error(`Upload failed: ${uploadData.error.info}`);
        }

        break;
      }

      if (uploadData?.error) {
        throw new Error(`Upload failed: ${uploadData.error.info}`);
      }

      if (uploadData.upload?.result === "Success" && wikiUsername) {
        await updateFileUploadActor(uploadData.upload.filename ?? input.filename, wikiUsername);
      }

      return {
        success: uploadData.upload?.result === "Success",
        filename: uploadData.upload?.filename ?? input.filename,
        url: uploadData.upload?.imageinfo?.url ?? null,
        descriptionUrl: uploadData.upload?.imageinfo?.descriptionurl ?? null,
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

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}
