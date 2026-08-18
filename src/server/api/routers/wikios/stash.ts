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
  // Stash — save-for-later with color-coded collections
  // ---------------------------------------------------------------------------

  /** Get all stashes for the current user with item counts. */
  getStashes: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireWikiUserId(ctx);
    const stashes = await db.stash.findMany({
      where: { userId },
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
    const userId = requireWikiUserId(ctx);
    let stash = await db.stash.findFirst({
      where: { userId, isDefault: true },
    });
    if (!stash) {
      stash = await db.stash.create({
        data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
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
      const userId = requireWikiUserId(ctx);
      const existing = await db.stash.findMany({
        where: { userId },
        select: { id: true },
      });
      if (existing.length >= 25) throw new Error("Maximum of 25 stashes allowed");
      return db.stash.create({
        data: {
          userId,
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
      const userId = requireWikiUserId(ctx);
      return db.stash.update({
        where: { id: input.id, userId },
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
      const userId = requireWikiUserId(ctx);
      const stash = await db.stash.findUnique({ where: { id: input.id } });
      if (!stash || stash.userId !== userId) throw new Error("Stash not found");
      if (stash.isDefault) throw new Error("Cannot delete default stash");
      await db.stash.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Reorder stashes. */
  reorderStashes: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      await Promise.all(
        input.ids.map((id, idx) =>
          db.stash.updateMany({ where: { id, userId }, data: { order: idx } })
        )
      );
      return { success: true };
    }),

  /** One-click stash a page (saves to default stash if no stashId). */
  stashPage: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), stashId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      let stashId = input.stashId;
      if (!stashId) {
        let defaultStash = await db.stash.findFirst({
          where: { userId, isDefault: true },
        });
        if (!defaultStash) {
          defaultStash = await db.stash.create({
            data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        stashId = defaultStash.id;
      }
      const pageSlug = encodeURIComponent(input.pageTitle.replace(/ /g, "_"));
      await db.stashItem.upsert({
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
      const userId = requireWikiUserId(ctx);
      if (input.stashId) {
        await db.stashItem.deleteMany({
          where: {
            stashId: input.stashId,
            pageTitle: input.pageTitle,
            stash: { userId },
          },
        });
      } else {
        // Remove from all user's stashes
        const stashIds = (await db.stash.findMany({ where: { userId }, select: { id: true } })).map(
          (s) => s.id
        );
        if (stashIds.length > 0) {
          await db.stashItem.deleteMany({
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
      const userId = requireWikiUserId(ctx);
      const items = await db.stashItem.findMany({
        where: { pageTitle: input.pageTitle, stash: { userId } },
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
      const userId = requireWikiUserId(ctx);
      const items = await db.stashItem.findMany({
        where: { stashId: input.stashId, stash: { userId } },
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
      const item = await db.stashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== requireWikiUserId(ctx)) {
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
      const item = await db.stashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== requireWikiUserId(ctx)) throw new Error("Item not found");
      return db.stashItem.update({
        where: { id: input.itemId },
        data: { stashId: input.toStashId },
      });
    }),

  /** Update a stash item's note (rich text). */
  updateItemNote: protectedProcedure
    .input(z.object({ itemId: z.string(), note: z.string().max(50000) }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.stashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== requireWikiUserId(ctx)) throw new Error("Item not found");
      return db.stashItem.update({ where: { id: input.itemId }, data: { note: input.note } });
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

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}
