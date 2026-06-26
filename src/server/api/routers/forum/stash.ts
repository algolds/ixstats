// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  type XFPost,
  type XFThread,
  type XFForum,
  getXfApiKey,
  getXfApiUrl,
  transformBBCode,
} from "~/server/modules/forum";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch from XenForo API (server-level, no user impersonation) */
async function xfFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getXfApiKey();
  if (!apiKey) {
    console.error("[Forum Router] XENFORO_API_KEY is missing. Forum features will be disabled.");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getXfApiUrl()}${endpoint}`, {
      headers: {
        "XF-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Forum Router] HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[Forum Router] Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

/** Resolve the user's linked XenForo user ID, or throw */
async function requireForumUser(userId: string): Promise<number> {
  const { db } = await import("~/server/db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { forumUserId: true },
  });
  if (!user?.forumUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please link your forum account first.",
    });
  }
  return user.forumUserId;
}

export const forumStashRouter = createTRPCRouter({
  // =========================================================================
  // Reader endpoints
  // =========================================================================

  // =========================================================================
  // WRITE ENDPOINTS (require linked forum account)
  // =========================================================================

  // Conversations removed — all private messaging is centralized in ThinkShare.

  // =========================================================================
  // MODERATION ENDPOINTS (require admin / system owner)
  // =========================================================================

  // =========================================================================
  // ALERT SYNC (surface XenForo alerts in IxStates UI)
  // =========================================================================

  // =========================================================================
  // ACCOUNT LINKING (existing endpoints, kept intact)
  // =========================================================================

  // =========================================================================
  // STASH ENDPOINTS (uses global Stash system for forum content)
  // =========================================================================

  /**
   * Stash a forum thread for later.
   */
  stashThread: protectedProcedure
    .input(
      z.object({
        threadId: z.number(),
        title: z.string().min(1).max(500),
        stashId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      // Get or create the user's default stash
      let targetStashId = input.stashId;
      if (!targetStashId) {
        const defaultStash = await db.stash.findFirst({
          where: { userId: ctx.auth.userId, isDefault: true },
        });
        if (defaultStash) {
          targetStashId = defaultStash.id;
        } else {
          const created = await db.stash.create({
            data: { userId: ctx.auth.userId, name: "My Stash", isDefault: true },
          });
          targetStashId = created.id;
        }
      }

      const pageTitle = `forum:thread:${input.threadId}`;
      const pageSlug = `/forum/thread/${input.threadId}`;

      await db.stashItem.upsert({
        where: { stashId_pageTitle: { stashId: targetStashId, pageTitle } },
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
  unstashThread: protectedProcedure
    .input(
      z.object({
        threadId: z.number(),
        stashId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const pageTitle = `forum:thread:${input.threadId}`;

      if (input.stashId) {
        await db.stashItem.deleteMany({
          where: { stashId: input.stashId, pageTitle },
        });
      } else {
        // Remove from all user's stashes
        const userStashes = await db.stash.findMany({
          where: { userId: ctx.auth.userId },
          select: { id: true },
        });
        await db.stashItem.deleteMany({
          where: {
            stashId: { in: userStashes.map((s) => s.id) },
            pageTitle,
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
        where: { userId: ctx.auth.userId },
        select: { id: true, name: true, color: true },
      });

      const items = await db.stashItem.findMany({
        where: {
          stashId: { in: userStashes.map((s) => s.id) },
          pageTitle,
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
        where: { userId: ctx.auth.userId },
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
