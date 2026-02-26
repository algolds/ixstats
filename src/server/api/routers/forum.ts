// src/server/api/routers/forum.ts
// tRPC router for XenForo forum integration (profile sync, account linking)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  setupForumCustomFields,
  linkForumAccount,
  syncUserToForum,
} from "~/lib/xenforo-user-sync";

export const forumRouter = createTRPCRouter({
  /**
   * Link the current user's IxStats account to their XenForo forum account.
   * Looks up the forum user by username and triggers an initial profile sync.
   */
  linkAccount: protectedProcedure
    .input(z.object({ forumUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkForumAccount(ctx.userId, input.forumUsername);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link forum account",
        });
      }

      return {
        success: true,
        forumUserId: result.forumUserId,
      };
    }),

  /**
   * Manually sync the current user's IxStats data to their XenForo forum profile.
   * Requires a linked forum account. Debounced to max once per 5 minutes.
   */
  syncProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const synced = await syncUserToForum(ctx.userId);
    return { synced };
  }),

  /**
   * Get the current user's forum link status.
   */
  getLinkStatus: protectedProcedure.query(async ({ ctx }) => {
    const { db } = await import("~/server/db");
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
      },
    });

    return {
      linked: !!user?.forumUserId,
      forumUsername: user?.forumUsername ?? null,
      lastSynced: user?.lastForumSync ?? null,
    };
  }),

  /**
   * Unlink the current user's forum account.
   */
  unlinkAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const { db } = await import("~/server/db");
    await db.user.update({
      where: { id: ctx.userId },
      data: {
        forumUserId: null,
        forumUsername: null,
        lastForumSync: null,
      },
    });
    return { success: true };
  }),

  /**
   * Admin: one-time setup to create IxStats custom user fields in XenForo.
   * Idempotent — fields that already exist will be skipped.
   */
  setupCustomFields: adminProcedure.mutation(async () => {
    const result = await setupForumCustomFields();
    return result;
  }),
});
