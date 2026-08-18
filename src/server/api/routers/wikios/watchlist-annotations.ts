/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireWikiUserId } from "~/lib/wiki-os/auth";
import { getRevisionWikitext as getRevisionWikitextMySQL } from "~/lib/wiki/bridge";

import { db } from "~/server/db";
import { saveToMediaWiki } from "~/lib/wiki-os/wiki-write-service";

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
      const item = await db.stashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== requireWikiUserId(ctx)) throw new Error("Item not found");
      return db.stashAnnotation.create({ data: input });
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
      const ann = await db.stashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== requireWikiUserId(ctx))
        throw new Error("Annotation not found");
      return db.stashAnnotation.update({
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
      const ann = await db.stashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== requireWikiUserId(ctx))
        throw new Error("Annotation not found");
      await db.stashAnnotation.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Get all annotations for a page (across all user's stashes). */
  getAnnotations: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const annotations = await db.stashAnnotation.findMany({
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
      let watchlistStash = await ctx.db.stash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) {
        watchlistStash = await ctx.db.stash.create({
          data: { userId, name: "Watchlist", color: "#f59e0b", icon: "eye", isDefault: false },
        });
      }
      // Add page (upsert to avoid duplicates)
      await ctx.db.stashItem.upsert({
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
      const watchlistStash = await ctx.db.stash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return { success: true };
      await ctx.db.stashItem.deleteMany({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return { success: true };
    }),

  /**
   * Get the user's full watchlist (most recently saved first, max 100).
   */
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireWikiUserId(ctx);
    const watchlistStash = await ctx.db.stash.findFirst({
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
      const watchlistStash = await ctx.db.stash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return false;
      const item = await ctx.db.stashItem.findFirst({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return !!item;
    }),
});

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}
