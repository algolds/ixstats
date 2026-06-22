/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  getRevisionWikitext as getRevisionWikitextMySQL,
} from "~/lib/wiki-bridge";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";

import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "../wiki";

export const wikiosStashRouter = createTRPCRouter({
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

  /** Get all stashes for the current user with item counts. */
  getStashes: protectedProcedure.query(async ({ ctx }) => {
    const stashes = await db.loreStash.findMany({
      where: { userId: ctx.auth.userId },
      orderBy: { order: "asc" },
      include: { _count: { select: { items: true } } },
    });
    return stashes.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      icon: s.icon,
      isDefault: s.isDefault,
      order: s.order,
      itemCount: (s as unknown as { _count?: { items?: number } })._count?.items ?? 0,
    }));
  }),

  /** Get or auto-create the user's default stash. */
  getDefaultStash: protectedProcedure.query(async ({ ctx }) => {
    let stash = await db.loreStash.findFirst({
      where: { userId: ctx.auth.userId, isDefault: true },
    });
    if (!stash) {
      stash = await db.loreStash.create({
        data: { userId: ctx.auth.userId, name: "My Stash", color: "#3b82f6", isDefault: true },
      });
    }
    return { id: stash.id, name: stash.name, color: stash.color };
  }),

  /** Create a new stash. Max 25 per user. */
  createStash: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().max(20),
        icon: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.loreStash.findMany({
        where: { userId: ctx.auth.userId },
        select: { id: true },
      });
      if (existing.length >= 25) throw new Error("Maximum of 25 stashes allowed");
      return db.loreStash.create({
        data: {
          userId: ctx.auth.userId,
          name: input.name,
          color: input.color,
          icon: input.icon,
          order: existing.length,
        },
      });
    }),

  /** Update a stash's name, color, or icon. */
  updateStash: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().max(20).optional(),
        icon: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.loreStash.update({
        where: { id: input.id, userId: ctx.auth.userId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.color && { color: input.color }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });
    }),

  /** Delete a stash (cannot delete default). */
  deleteStash: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const stash = await db.loreStash.findUnique({ where: { id: input.id } });
      if (!stash || stash.userId !== ctx.auth.userId) throw new Error("Stash not found");
      if (stash.isDefault) throw new Error("Cannot delete default stash");
      await db.loreStash.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Reorder stashes. */
  reorderStashes: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      await Promise.all(
        input.ids.map((id, idx) =>
          db.loreStash.updateMany({ where: { id, userId: ctx.auth.userId }, data: { order: idx } })
        )
      );
      return { success: true };
    }),

  /** One-click stash a page (saves to default stash if no stashId). */
  stashPage: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), stashId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      let stashId = input.stashId;
      if (!stashId) {
        let defaultStash = await db.loreStash.findFirst({
          where: { userId: ctx.auth.userId, isDefault: true },
        });
        if (!defaultStash) {
          defaultStash = await db.loreStash.create({
            data: { userId: ctx.auth.userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        stashId = defaultStash.id;
      }
      const pageSlug = encodeURIComponent(input.pageTitle.replace(/ /g, "_"));
      await db.loreStashItem.upsert({
        where: { stashId_pageTitle: { stashId, pageTitle: input.pageTitle } },
        create: { stashId, pageTitle: input.pageTitle, pageSlug },
        update: {},
      });
      return { success: true, stashId };
    }),

  /** Remove a page from a stash (or all stashes if no stashId). */
  unstashPage: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), stashId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (input.stashId) {
        await db.loreStashItem.deleteMany({
          where: {
            stashId: input.stashId,
            pageTitle: input.pageTitle,
            stash: { userId: ctx.auth.userId },
          },
        });
      } else {
        // Remove from all user's stashes
        const stashIds = (
          await db.loreStash.findMany({ where: { userId: ctx.auth.userId }, select: { id: true } })
        ).map((s) => s.id);
        if (stashIds.length > 0) {
          await db.loreStashItem.deleteMany({
            where: { stashId: { in: stashIds }, pageTitle: input.pageTitle },
          });
        }
      }
      return { success: true };
    }),

  /** Check if a page is stashed (and in which stashes). Powers the button color. */
  isStashed: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const items = await db.loreStashItem.findMany({
        where: { pageTitle: input.pageTitle, stash: { userId: ctx.auth.userId } },
        include: { stash: { select: { id: true, color: true, name: true } } },
      });
      return {
        stashed: items.length > 0,
        stashes: items.map((i) => ({ id: i.stash.id, color: i.stash.color, name: i.stash.name })),
      };
    }),

  /** Get paginated items in a stash. */
  getStashItems: protectedProcedure
    .input(
      z.object({
        stashId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const items = await db.loreStashItem.findMany({
        where: { stashId: input.stashId, stash: { userId: ctx.auth.userId } },
        orderBy: { savedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: { _count: { select: { annotations: true } } },
      });
      const hasMore = items.length > input.limit;
      const results = hasMore ? items.slice(0, -1) : items;
      return {
        items: results.map((i) => ({
          id: i.id,
          pageTitle: i.pageTitle,
          pageSlug: i.pageSlug,
          note: i.note,
          annotationCount:
            (i as unknown as { _count?: { annotations?: number } })._count?.annotations ?? 0,
          savedAt: i.savedAt.toISOString(),
        })),
        nextCursor: hasMore ? results[results.length - 1]?.id : null,
      };
    }),

  /** Get a single stash item by ID. */
  getStashItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) {
        throw new Error("Item not found");
      }
      return {
        id: item.id,
        pageTitle: item.pageTitle,
        pageSlug: item.pageSlug,
        note: item.note,
        savedAt: item.savedAt.toISOString(),
        stashId: item.stashId,
        stashName: item.stash.name,
        stashColor: item.stash.color,
      };
    }),

  /** Move an item to a different stash. */
  moveItem: protectedProcedure
    .input(z.object({ itemId: z.string(), toStashId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) throw new Error("Item not found");
      return db.loreStashItem.update({
        where: { id: input.itemId },
        data: { stashId: input.toStashId },
      });
    }),

  /** Update a stash item's note (rich text). */
  updateItemNote: protectedProcedure
    .input(z.object({ itemId: z.string(), note: z.string().max(50000) }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) throw new Error("Item not found");
      return db.loreStashItem.update({ where: { id: input.itemId }, data: { note: input.note } });
    }),

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

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
