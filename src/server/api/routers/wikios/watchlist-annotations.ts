/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireWikiUserId } from "~/lib/wiki-os/auth";

import { db } from "~/server/db";
import { saveToMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/write-service";

export const wikiosWatchlistAnnotationsRouter = createTRPCRouter({
  /** Add a text-selection annotation to a stashed page (or directly by pageTitle). */
  addAnnotation: protectedProcedure
    .input(
      z.object({
        itemId: z.string().optional(),
        pageTitle: z.string().min(1).max(500).optional(),
        anchorSelector: z.string().max(500).default("p"),
        anchorOffset: z.number().default(0),
        focusSelector: z.string().max(500).default("p"),
        focusOffset: z.number().default(0),
        selectedText: z.string().max(2000),
        comment: z.string().max(5000).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      let targetItemId = input.itemId;

      if (!targetItemId) {
        if (!input.pageTitle) throw new Error("Either itemId or pageTitle is required");
        let defaultStash = await db.stash.findFirst({
          where: { userId, isDefault: true },
        });
        if (!defaultStash) {
          defaultStash = await db.stash.create({
            data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        const pageSlug = encodeURIComponent(input.pageTitle.replace(/ /g, "_"));
        const item = await db.stashItem.upsert({
          where: { stashId_pageTitle: { stashId: defaultStash.id, pageTitle: input.pageTitle } },
          create: { stashId: defaultStash.id, pageTitle: input.pageTitle, pageSlug },
          update: {},
        });
        targetItemId = item.id;
      } else {
        const item = await db.stashItem.findUnique({
          where: { id: targetItemId },
          include: { stash: true },
        });
        if (!item || item.stash.userId !== userId) throw new Error("Item not found");
      }

      return db.stashAnnotation.create({
        data: {
          itemId: targetItemId,
          anchorSelector: input.anchorSelector,
          anchorOffset: input.anchorOffset,
          focusSelector: input.focusSelector,
          focusOffset: input.focusOffset,
          selectedText: input.selectedText,
          comment: input.comment || null,
          color: input.color || "#fbbf24",
        },
      });
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
   * Add a page to the user's watchlist (both native WikiWatchlist and Stash).
   */
  watchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      
      // 1. Find article in PostgreSQL
      const article = await ctx.db.wikiArticle.findFirst({
        where: {
          source: "ixwiki",
          OR: [
            { title: input.pageTitle },
            { title: input.pageTitle.replace(/_/g, " ") },
          ],
        },
        select: { id: true },
      });

      if (article) {
        await ctx.db.wikiWatchlist.upsert({
          where: { userId_articleId: { userId, articleId: article.id } },
          create: { userId, articleId: article.id },
          update: {},
        });
      }

      // 2. Also sync to LoreStash "Watchlist"
      let watchlistStash = await ctx.db.stash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) {
        watchlistStash = await ctx.db.stash.create({
          data: { userId, name: "Watchlist", color: "#f59e0b", icon: "eye", isDefault: false },
        });
      }
      await ctx.db.stashItem.upsert({
        where: { stashId_pageTitle: { stashId: watchlistStash.id, pageTitle: input.pageTitle } },
        create: {
          stashId: watchlistStash.id,
          pageTitle: input.pageTitle,
          pageSlug: input.pageTitle.replace(/ /g, "_"),
          articleId: article?.id || null,
        },
        update: {
          articleId: article?.id || undefined,
        },
      });

      return { success: true };
    }),

  /**
   * Remove a page from the user's watchlist.
   */
  unwatchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      
      // 1. Remove from WikiWatchlist
      const article = await ctx.db.wikiArticle.findFirst({
        where: {
          source: "ixwiki",
          OR: [
            { title: input.pageTitle },
            { title: input.pageTitle.replace(/_/g, " ") },
          ],
        },
        select: { id: true },
      });

      if (article) {
        await ctx.db.wikiWatchlist.deleteMany({
          where: { userId, articleId: article.id },
        });
      }

      // 2. Remove from Stash
      const watchlistStash = await ctx.db.stash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (watchlistStash) {
        await ctx.db.stashItem.deleteMany({
          where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
        });
      }

      return { success: true };
    }),

  /**
   * Get the user's full watchlist items.
   */
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireWikiUserId(ctx);
    const watched = await ctx.db.wikiWatchlist.findMany({
      where: { userId },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (watched.length > 0) {
      return watched.map((w) => ({
        id: w.id,
        pageTitle: w.article.title,
        pageSlug: w.article.slug,
        articleId: w.articleId,
        savedAt: w.createdAt,
        lastViewedTime: w.lastViewedTime,
        notificationTime: w.notificationTime,
      }));
    }

    // Fallback to Stash items
    const watchlistStash = await ctx.db.stash.findFirst({
      where: { userId, name: "Watchlist" },
      include: { items: { orderBy: { savedAt: "desc" }, take: 100 } },
    });
    return watchlistStash?.items ?? [];
  }),

  /**
   * Get real-time activity feed for watched articles with revision diff previews.
   */
  getWatchlistFeed: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(30).default(7),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      const sinceDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Get user's watched article IDs
      const watched = await ctx.db.wikiWatchlist.findMany({
        where: { userId },
        select: { articleId: true, lastViewedTime: true },
      });

      const watchedMap = new Map(watched.map((w) => [w.articleId, w.lastViewedTime]));
      const articleIds = Array.from(watchedMap.keys());

      if (articleIds.length === 0) {
        return [];
      }

      // Query recent revisions on watched articles
      const revisions = await ctx.db.wikiRevision.findMany({
        where: {
          articleId: { in: articleIds },
          createdAt: { gte: sinceDate },
        },
        include: {
          article: {
            select: { id: true, title: true, slug: true, namespacePrefix: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return revisions.map((rev) => {
        const lastViewed = watchedMap.get(rev.articleId);
        const isUnread = !lastViewed || new Date(rev.createdAt) > new Date(lastViewed);

        return {
          id: rev.id,
          articleId: rev.articleId,
          articleTitle: rev.article.title,
          articleSlug: rev.article.slug,
          namespacePrefix: rev.article.namespacePrefix,
          mwRevId: rev.mwRevId,
          author: rev.author || "Community Contributor",
          summary: rev.summary,
          minor: rev.minor,
          byteSize: rev.byteSize,
          byteDelta: rev.byteDelta,
          createdAt: rev.createdAt,
          isUnread,
          wikitext: rev.wikitext,
        };
      });
    }),

  /**
   * Mark all watched articles as visited (clearing unread indicator dots).
   */
  markAllWatchedVisited: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = requireWikiUserId(ctx);
    await ctx.db.wikiWatchlist.updateMany({
      where: { userId },
      data: { lastViewedTime: new Date() },
    });
    return { success: true };
  }),

  /**
   * Check whether a page is on the user's watchlist.
   */
  isPageWatched: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      
      const article = await ctx.db.wikiArticle.findFirst({
        where: {
          source: "ixwiki",
          OR: [
            { title: input.pageTitle },
            { title: input.pageTitle.replace(/_/g, " ") },
          ],
        },
        select: { id: true },
      });

      if (article) {
        const entry = await ctx.db.wikiWatchlist.findUnique({
          where: { userId_articleId: { userId, articleId: article.id } },
        });
        if (entry) return true;
      }

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

