/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { htmlToWikitext, wikitextToHtml, invalidateCache } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  getPageHistory,
  resolveRedirect as resolveRedirectMySQL,
  getRevisionWikitext as getRevisionWikitextMySQL,
  getCurrentRevMeta,
} from "~/lib/wiki-bridge";
import { transformWikiLinks } from "~/lib/wiki-os/url-compat";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";

import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "../wiki";

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

      const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      // Build multipart form data
      const formData = new FormData();
      formData.append("action", "upload");
      formData.append("filename", input.filename);
      formData.append(
        "comment",
        `${input.comment} (via WikiOS by ${ctx.user?.wikiUsername ?? ctx.auth?.userId ?? "anonymous"})`
      );
      formData.append("text", input.description);
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

      const uploadData = (await uploadRes.json()) as {
        upload?: {
          result: string;
          filename?: string;
          imageinfo?: { url?: string; descriptionurl?: string };
        };
        error?: { code: string; info: string };
      };

      if (uploadData.error) throw new Error(`Upload failed: ${uploadData.error.info}`);

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

// ---------------------------------------------------------------------------
// Shared helper: save wikitext to MediaWiki via Action API
// ---------------------------------------------------------------------------

/**
 * Resolve a page title through redirects via direct MySQL.
 */
async function resolveRedirect(title: string): Promise<string> {
  return resolveRedirectMySQL(title);
}

async function saveToMediaWiki(
  title: string,
  wikitext: string,
  summary: string,
  minor: boolean,
  ctx: any,
  basetimestamp?: string,
  isTemplateSync = false
): Promise<{ success: boolean; revisionId: number | null; editConflict?: boolean }> {
  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

  // Get session cookies and CSRF token from the user context
  const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

  // Edit
  const editParams = new URLSearchParams({
    action: "edit",
    title,
    text: wikitext,
    summary: `${summary} (via WikiOS by ${ctx.user?.wikiUsername ?? ctx.auth?.userId ?? "anonymous"})`,
    token: csrfToken,
    format: "json",
  });
  if (minor) editParams.set("minor", "1");
  if (basetimestamp) {
    editParams.set("basetimestamp", basetimestamp);
    editParams.set("starttimestamp", new Date().toISOString());
  }

  const editRes = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: editParams.toString(),
  });

  const editData = (await editRes.json()) as {
    edit?: { result: string; newrevid?: number };
    error?: { code: string; info: string };
  };

  if (editData.error) {
    if (editData.error.code === "editconflict") {
      return { success: false, revisionId: null, editConflict: true };
    }
    if (editData.error.code === "badtoken") {
      invalidateCsrfToken();
    }
    throw new Error(`MediaWiki edit failed: ${editData.error.info}`);
  }

  invalidateCache(title);

  // Notify stash owners about the edit (non-blocking)
  notifyStashOwners(title, ctx.auth?.userId, editData.edit?.newrevid ?? null).catch(
    (err: unknown) => {
      console.error("[WikiOS] Background op failed:", (err as Error).message);
    }
  );

  // Trigger template sync if this is a user edit, not a template sync itself
  if (!isTemplateSync && editData.edit?.result === "Success") {
    syncCustomTemplates(wikitext, ctx).catch((err) => {
      console.error("[WikiOS] Background template sync failed:", err);
    });
  }

  return {
    success: editData.edit?.result === "Success",
    revisionId: editData.edit?.newrevid ?? null,
  };
}

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}

/**
 * Get the current revision metadata (revid + timestamp) via direct MySQL.
 */
async function getCurrentRevisionMeta(title: string) {
  return getCurrentRevMeta(title);
}

/**
 * Notify users who have stashed a page that it was edited.
 * Non-blocking — fires and forgets.
 */
async function notifyStashOwners(
  pageTitle: string,
  editorUserId: string | null | undefined,
  revisionId: number | null
): Promise<void> {
  const stashItems = await db.loreStashItem.findMany({
    where: { pageTitle },
    include: { stash: { select: { userId: true } } },
  });

  // Deduplicate user IDs and exclude the editor
  const userIds = [...new Set(stashItems.map((i) => i.stash.userId))].filter(
    (uid) => uid !== editorUserId
  );

  if (userIds.length === 0) return;

  const pageSlug = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  const href = revisionId
    ? `/wiki/diff?from=${revisionId - 1}&to=${revisionId}`
    : `/wiki/${pageSlug}`;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: `"${pageTitle}" was edited`,
      description: `A page in your stash was updated.`,
      type: "wiki_edit",
      category: "wiki",
      href,
      metadata: JSON.stringify({ pageTitle, revisionId }),
    })),
  });
}

/**
 * Background worker to parse templates in saved wikitext,
 * resolve their current DB values, and update corresponding
 * Template: pages on headless MediaWiki so they render correctly on traditional pages.
 */
async function syncCustomTemplates(wikitext: string, ctx: any): Promise<void> {
  // 1. Extract all MyCountry:, CountryData:, and BusinessData: templates
  const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi;
  const placeholders = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(wikitext)) !== null) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }

  if (placeholders.size === 0) return;

  const keys = Array.from(placeholders);
  console.log(`[WikiOS] Syncing ${keys.length} custom templates:`, keys);

  // 2. Resolve the dynamic database values
  let activeCountryId: string | undefined;
  if (ctx.auth?.userId) {
    const user = await ctx.db.user.findFirst({
      where: { clerkUserId: ctx.auth.userId },
      select: { countryId: true },
    });
    if (user?.countryId) {
      activeCountryId = user.countryId;
    }
  }

  const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, activeCountryId);

  // 3. For each template, save its resolved HTML template tag to MediaWiki
  for (const key of keys) {
    const data = resolved[key];
    const valStr = data ? data.value : "N/A";

    // Normalize template key for page title (MediaWiki converts spaces to underscores)
    const normalizedKey = key.replace(/ /g, "_");
    const templateTitle = `Template:${normalizedKey}`;

    // Template wikitext: static span element that traditional MediaWiki renders.
    const templateWikitext = `<span class="wikios-stat-placeholder" data-key="${normalizedKey}">${valStr}</span>`;

    try {
      // Fetch the current template content if it exists, to avoid redundant writes
      let currentContent = "";
      try {
        const article = await getArticleWikitext(templateTitle, "ixwiki");
        if (article) {
          currentContent = article.wikitext;
        }
      } catch (_err) {
        // template does not exist
      }

      if (currentContent.trim() !== templateWikitext.trim()) {
        console.log(`[WikiOS] Updating template ${templateTitle} -> "${valStr}"`);
        await saveToMediaWiki(
          templateTitle,
          templateWikitext,
          "Update dynamic stat template value",
          true, // minor
          ctx,
          undefined, // no basetimestamp
          true // isTemplateSync = true (prevents recursion!)
        );
      }
    } catch (err: any) {
      console.error(`[WikiOS] Failed to sync template ${templateTitle}:`, err.message);
    }
  }
}

/**
 * Clean up visual editor HTML before passing to Parsoid for wikitext transformation.
 * Strips formatting emoji and temporary visual decoration from custom chips.
 */
function cleanHtmlForParsoid(html: string): string {
  let cleaned = html;

  // Clean Coords anchors: remove emoji and wrapper spans, restore standard link format
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*Coords[^"]*)"[^>]*>(?:<span[^>]*>📍<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/📍/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );

  // Clean MapEmbed anchors: remove emoji and wrapper spans
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*MapEmbed[^"]*)"[^>]*>(?:<span[^>]*>🗺️<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/🗺️/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );

  return cleaned;
}
