// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { requireWikiUserId, requireWikiUserIds } from "~/lib/wiki-os/auth";

export const forumStashRouter = createTRPCRouter({
  // =========================================================================
  // STASH ENDPOINTS (uses global Stash system for forum content)
  // =========================================================================

  /**
   * Stash a forum thread for later.
   */
  stashThread: rateLimitedMutationProcedure
    .input(
      z.object({
        threadId: z.number(),
        title: z.string().min(1).max(500),
        stashId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      // A given stashId must be the caller's own; otherwise use (or create) their default stash.
      let targetStashId: string;
      if (input.stashId) {
        const owned = await db.stash.findFirst({
          where: { id: input.stashId, userId: { in: requireWikiUserIds(ctx) } },
          select: { id: true },
        });
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Stash not found" });
        targetStashId = owned.id;
      } else {
        const defaultStash = await db.stash.findFirst({
          where: { userId: { in: requireWikiUserIds(ctx) }, isDefault: true },
        });
        if (defaultStash) {
          targetStashId = defaultStash.id;
        } else {
          const created = await db.stash.create({
            data: { userId: requireWikiUserId(ctx), name: "My Stash", isDefault: true },
          });
          targetStashId = created.id;
        }
      }

      const pageTitle = `forum:thread:${input.threadId}`;
      const pageSlug = `/forum/thread/${input.threadId}`;

      await db.stashItem.upsert({
        where: {
          stashId_contentType_pageTitle: {
            stashId: targetStashId,
            contentType: "forum_thread",
            pageTitle,
          },
        },
        create: {
          stashId: targetStashId,
          pageTitle,
          pageSlug,
          contentType: "forum_thread",
          contentId: input.threadId,
          note: input.title,
        },
        update: { updatedAt: new Date() },
      });

      return { success: true, stashId: targetStashId };
    }),

  /**
   * Remove a forum thread from stash.
   */
  unstashThread: rateLimitedMutationProcedure
    .input(
      z.object({
        threadId: z.number(),
        stashId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const pageTitle = `forum:thread:${input.threadId}`;

      if (input.stashId) {
        const owned = await db.stash.findFirst({
          where: { id: input.stashId, userId: { in: requireWikiUserIds(ctx) } },
          select: { id: true },
        });
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Stash not found" });
        await db.stashItem.deleteMany({
          where: { stashId: owned.id, pageTitle, contentType: "forum_thread" },
        });
      } else {
        // Remove from all user's stashes
        const userStashes = await db.stash.findMany({
          where: { userId: { in: requireWikiUserIds(ctx) } },
          select: { id: true },
        });
        await db.stashItem.deleteMany({
          where: {
            stashId: { in: userStashes.map((s) => s.id) },
            pageTitle,
            contentType: "forum_thread",
          },
        });
      }

      return { success: true };
    }),

  /**
   * Check if a thread is stashed.
   */
  isThreadStashed: protectedProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const pageTitle = `forum:thread:${input.threadId}`;
      const userStashes = await db.stash.findMany({
        where: { userId: { in: requireWikiUserIds(ctx) } },
        select: { id: true, name: true, color: true },
      });

      const items = await db.stashItem.findMany({
        where: {
          stashId: { in: userStashes.map((s) => s.id) },
          pageTitle,
          contentType: "forum_thread",
        },
        select: { stashId: true },
      });

      const stashedIn = items
        .map((item) => {
          const stash = userStashes.find((s) => s.id === item.stashId);
          return stash ? { id: stash.id, name: stash.name, color: stash.color } : null;
        })
        .filter(Boolean);

      return {
        stashed: stashedIn.length > 0,
        stashes: stashedIn,
      };
    }),

  /**
   * Get all stashed forum threads for the current user.
   */
  getStashedThreads: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const userStashes = await db.stash.findMany({
        where: { userId: { in: requireWikiUserIds(ctx) } },
        select: { id: true },
      });

      const items = await db.stashItem.findMany({
        where: {
          stashId: { in: userStashes.map((s) => s.id) },
          contentType: "forum_thread",
        },
        orderBy: { savedAt: "desc" },
        take: input?.limit ?? 50,
      });

      return items.map((item) => ({
        id: item.id,
        threadId: item.contentId,
        title: item.note ?? item.pageTitle.replace("forum:thread:", "Thread #"),
        slug: item.pageSlug,
        savedAt: item.savedAt,
      }));
    }),
});
