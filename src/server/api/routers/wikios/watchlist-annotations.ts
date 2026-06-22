/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getWikiAuth, getWikiActorLabel, requireWikiUserId } from "~/lib/wiki-os/auth";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { invalidateCache } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  getRevisionWikitext as getRevisionWikitextMySQL,
} from "~/lib/wiki-bridge";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";

import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "../wiki";

export const wikiosWatchlistAnnotationsRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Template Registry (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Lore Stash — save-for-later with color-coded collections
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

  /** Add a text-selection annotation to a stashed page. */
  addAnnotation: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        anchorSelector: z.string().max(500),
        anchorOffset: z.number(),
        focusSelector: z.string().max(500),
        focusOffset: z.number(),
        selectedText: z.string().max(2000),
        comment: z.string().max(5000).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== requireWikiUserId(ctx)) throw new Error("Item not found");
      return db.loreStashAnnotation.create({ data: input });
    }),

  /** Update an annotation's comment or color. */
  updateAnnotation: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        comment: z.string().max(5000).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ann = await db.loreStashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== requireWikiUserId(ctx))
        throw new Error("Annotation not found");
      return db.loreStashAnnotation.update({
        where: { id: input.id },
        data: {
          ...(input.comment !== undefined && { comment: input.comment }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  /** Delete an annotation. */
  deleteAnnotation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ann = await db.loreStashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== requireWikiUserId(ctx))
        throw new Error("Annotation not found");
      await db.loreStashAnnotation.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Get all annotations for a page (across all user's stashes). */
  getAnnotations: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const annotations = await db.loreStashAnnotation.findMany({
        where: { item: { pageTitle: input.pageTitle, stash: { userId } } },
        orderBy: { createdAt: "asc" },
      });
      return annotations.map((a) => ({
        id: a.id,
        anchorSelector: a.anchorSelector,
        anchorOffset: a.anchorOffset,
        focusSelector: a.focusSelector,
        focusOffset: a.focusOffset,
        selectedText: a.selectedText,
        comment: a.comment,
        color: a.color,
      }));
    }),

  // ---------------------------------------------------------------------------
  // User Info (for WikiOS profiles)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Rollback / Undo endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

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

  /**
   * Add a page to the user's watchlist stash.
   */
  watchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      // Find or create the "Watchlist" stash
      let watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) {
        watchlistStash = await ctx.db.loreStash.create({
          data: { userId, name: "Watchlist", color: "#f59e0b", icon: "eye", isDefault: false },
        });
      }
      // Add page (upsert to avoid duplicates)
      await ctx.db.loreStashItem.upsert({
        where: { stashId_pageTitle: { stashId: watchlistStash.id, pageTitle: input.pageTitle } },
        create: {
          stashId: watchlistStash.id,
          pageTitle: input.pageTitle,
          pageSlug: input.pageTitle.replace(/ /g, "_"),
        },
        update: {},
      });
      return { success: true };
    }),

  /**
   * Remove a page from the user's watchlist stash.
   */
  unwatchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      const watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return { success: true };
      await ctx.db.loreStashItem.deleteMany({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return { success: true };
    }),

  /**
   * Get the user's full watchlist (most recently saved first, max 100).
   */
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireWikiUserId(ctx);
    const watchlistStash = await ctx.db.loreStash.findFirst({
      where: { userId, name: "Watchlist" },
      include: { items: { orderBy: { savedAt: "desc" }, take: 100 } },
    });
    return watchlistStash?.items ?? [];
  }),

  /**
   * Check whether a page is on the user's watchlist.
   */
  isPageWatched: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      const watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return false;
      const item = await ctx.db.loreStashItem.findFirst({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return !!item;
    }),
});

// ---------------------------------------------------------------------------
// Shared helper: save wikitext to MediaWiki via Action API
// ---------------------------------------------------------------------------

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
    summary: `${summary} (via WikiOS by ${getWikiActorLabel(ctx)})`,
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
  notifyStashOwners(title, getWikiAuth(ctx).userId, editData.edit?.newrevid ?? null).catch(
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
  const activeCountryId = (await resolveActiveCountryId(ctx)) ?? undefined;

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
