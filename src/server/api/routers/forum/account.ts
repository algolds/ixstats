// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// ---------------------------------------------------------------------------
// Normalized output types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const forumAccountRouter = createTRPCRouter({
  // NOTE: Forum alerts route through the global notification system (DynamicIsland).
  // Private messages are centralized in ThinkShare (/messages).
  // XenForo conversations and alerts are not exposed as separate endpoints.

  // =========================================================================
  // ACCOUNT LINKING (existing endpoints, kept intact)
  // =========================================================================

  /**
   * Get the current user's forum link status.
   */
  getLinkStatus: protectedProcedure.query(async ({ ctx }) => {
    const { db } = await import("~/server/db");
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
      },
    });

    // Backfill: if forumUsername exists but forumUserId is missing, look it up
    if (user?.forumUsername && !user.forumUserId) {
      try {
        const { lookupForumUser } = await import("~/server/modules/forum");
        const xfUser = await lookupForumUser(user.forumUsername);
        if (xfUser) {
          await db.user.update({
            where: { id: ctx.user.id },
            data: { forumUserId: xfUser.userId },
          });
          return {
            linked: true,
            forumUserId: xfUser.userId,
            forumUsername: user.forumUsername,
            lastSynced: user.lastForumSync ?? null,
          };
        }
      } catch {
        /* non-critical */
      }
    }

    return {
      linked: !!user?.forumUserId || !!user?.forumUsername,
      forumUserId: user?.forumUserId ?? null,
      forumUsername: user?.forumUsername ?? null,
      lastSynced: user?.lastForumSync ?? null,
    };
  }),
});
