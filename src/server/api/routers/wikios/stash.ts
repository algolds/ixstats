/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireWikiUserId, requireWikiUserIds } from "~/lib/wiki-os/auth";
import { stashContentTypeForTitle } from "~/lib/wiki-os/stash-content-type";

import { db } from "~/server/db";

export const wikiosStashRouter = createTRPCRouter({
  /** Get all stashes for the current user with item counts. */
  getStashes: protectedProcedure.query(async ({ ctx }) => {
    const userIds = requireWikiUserIds(ctx);
    const stashes = await db.stash.findMany({
      where: { userId: { in: userIds } },
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
      itemCount: s._count?.items ?? 0,
    }));
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
        where: { userId: { in: requireWikiUserIds(ctx) } },
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
        id: z.string().max(64),
        name: z.string().min(1).max(100).optional(),
        color: z.string().max(20).optional(),
        icon: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.stash.update({
        where: { id: input.id, userId: { in: requireWikiUserIds(ctx) } },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.color && { color: input.color }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });
    }),

  /** Delete a stash (cannot delete default). */
  deleteStash: protectedProcedure
    .input(z.object({ id: z.string().max(64) }))
    .mutation(async ({ input, ctx }) => {
      const userIds = requireWikiUserIds(ctx);
      const stash = await db.stash.findUnique({ where: { id: input.id } });
      if (!stash || !userIds.includes(stash.userId)) throw new Error("Stash not found");
      if (stash.isDefault) throw new Error("Cannot delete default stash");
      await db.stash.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** One-click stash a page (saves to default stash if no stashId). */
  stashPage: protectedProcedure
    .input(
      z.object({
        pageTitle: z.string().min(1).max(500),
        stashId: z.string().max(64).optional(),
        contentType: z.string().max(32).optional(),
        contentId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const userIds = requireWikiUserIds(ctx);
      let stashId: string;
      if (input.stashId) {
        const owned = await db.stash.findFirst({
          where: { id: input.stashId, userId: { in: userIds } },
          select: { id: true },
        });
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Stash not found" });
        stashId = owned.id;
      } else {
        let defaultStash = await db.stash.findFirst({
          where: { userId: { in: userIds }, isDefault: true },
          orderBy: { createdAt: "asc" },
        });
        if (!defaultStash) {
          defaultStash = await db.stash.create({
            data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        stashId = defaultStash.id;
      }
      const pageSlug = encodeURIComponent(input.pageTitle.replace(/ /g, "_"));
      const resolvedType = input.contentType || stashContentTypeForTitle(input.pageTitle);

      await db.stashItem.upsert({
        where: {
          stashId_contentType_pageTitle: {
            stashId,
            contentType: resolvedType,
            pageTitle: input.pageTitle,
          },
        },
        create: {
          stashId,
          pageTitle: input.pageTitle,
          pageSlug,
          contentType: resolvedType,
          contentId: input.contentId,
        },
        update: input.contentId ? { contentId: input.contentId } : {},
      });
      return { success: true, stashId };
    }),

  /**
   * Remove a page from a stash (or all stashes if no stashId). Only the item of one content type is
   * removed — the one named by `contentType`, else the one the title's prefix implies — so unstashing
   * the article "Rome" leaves an Onoma name "Rome" alone.
   */
  unstashPage: protectedProcedure
    .input(
      z.object({
        pageTitle: z.string().min(1).max(500),
        stashId: z.string().max(64).optional(),
        contentType: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userIds = requireWikiUserIds(ctx);
      const contentType = input.contentType || stashContentTypeForTitle(input.pageTitle);
      if (input.stashId) {
        await db.stashItem.deleteMany({
          where: {
            stashId: input.stashId,
            pageTitle: input.pageTitle,
            contentType,
            stash: { userId: { in: userIds } },
          },
        });
      } else {
        // Remove from all user's stashes
        const stashIds = (
          await db.stash.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
        ).map((s) => s.id);
        if (stashIds.length > 0) {
          await db.stashItem.deleteMany({
            where: { stashId: { in: stashIds }, pageTitle: input.pageTitle, contentType },
          });
        }
      }
      return { success: true };
    }),

  /** Check if a page is stashed (and in which stashes). Powers the button color. */
  isStashed: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), contentType: z.string().max(32).optional() }))
    .query(async ({ input, ctx }) => {
      const items = await db.stashItem.findMany({
        where: {
          pageTitle: input.pageTitle,
          contentType: input.contentType || stashContentTypeForTitle(input.pageTitle),
          stash: { userId: { in: requireWikiUserIds(ctx) } },
        },
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
        stashId: z.string().max(64),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const items = await db.stashItem.findMany({
        where: { stashId: input.stashId, stash: { userId: { in: requireWikiUserIds(ctx) } } },
        orderBy: { savedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: {
          _count: { select: { annotations: true } },
          annotations: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
      const hasMore = items.length > input.limit;
      const results = hasMore ? items.slice(0, -1) : items;
      return {
        items: results.map((i) => ({
          id: i.id,
          pageTitle: i.pageTitle,
          pageSlug: i.pageSlug,
          note: i.note,
          contentType:
            i.contentType ||
            (i.pageTitle.startsWith("commons:")
              ? "image"
              : i.pageTitle.startsWith("forum:thread:")
                ? "forum_thread"
                : "wiki"),
          contentId: i.contentId,
          annotations: i.annotations.map((a) => ({
            id: a.id,
            selectedText: a.selectedText,
            comment: a.comment,
            color: a.color,
            createdAt: a.createdAt.toISOString(),
          })),
          annotationCount:
            (i as unknown as { _count?: { annotations?: number } })._count?.annotations ??
            i.annotations.length,
          savedAt: i.savedAt.toISOString(),
        })),
        nextCursor: hasMore ? results[results.length - 1]?.id : null,
      };
    }),
});
