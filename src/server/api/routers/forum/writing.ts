// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  xfPostAsUser,
  xfDelete,
  type XFPost,
  type XFThread,
  invalidateThread,
  cacheInvalidate,
  requireForumUser,
} from "~/server/modules/forum";
import { notificationAPI } from "~/lib/notifications/api";
import { normalizePost, normalizeThread } from "./normalize";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const forumWritingRouter = createTRPCRouter({
  // NOTE: Forum alerts route through the global notification system (DynamicIsland).
  // Private messages are centralized in ThinkShare (/messages).
  // XenForo conversations and alerts are not exposed as separate endpoints.

  // =========================================================================
  // WRITE ENDPOINTS (require linked forum account)
  // =========================================================================

  /**
   * Create a new thread.
   */
  createThread: rateLimitedMutationProcedure
    .input(
      z.object({
        forumId: z.number(),
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ thread: XFThread }>(
        "/threads/",
        {
          node_id: String(input.forumId),
          title: input.title,
          message: input.message,
        },
        xfUserId
      );

      if (!result?.thread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create thread",
        });
      }

      // Invalidate thread list cache for this forum
      cacheInvalidate(`forum:threadList:${input.forumId}`);

      // Global notification for new thread
      try {
        const { db } = await import("~/server/db");
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { forumUsername: true },
        });

        await notificationAPI.create({
          title: `New forum thread: ${input.title}`,
          message: `${user?.forumUsername ?? "Someone"} started a new discussion`,
          category: "social",
          priority: "low",
          source: "forum",
          href: `/forum/thread/${result.thread.thread_id}`,
          metadata: {
            threadId: result.thread.thread_id,
            forumId: input.forumId,
            authorName: user?.forumUsername,
          },
        });
      } catch {
        // Non-critical
      }

      return { thread: normalizeThread(result.thread) };
    }),

  /**
   * Reply to a thread.
   */
  createPost: rateLimitedMutationProcedure
    .input(
      z.object({
        threadId: z.number(),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ post: XFPost }>(
        "/posts/",
        {
          thread_id: String(input.threadId),
          message: input.message,
        },
        xfUserId
      );

      if (!result?.post) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create post",
        });
      }

      invalidateThread(input.threadId);

      // Notify thread followers via global notification system
      try {
        const { db } = await import("~/server/db");
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { forumUsername: true },
        });

        await notificationAPI.create({
          title: `New reply in forum thread`,
          message: `${user?.forumUsername ?? "Someone"} replied to a thread`,
          category: "social",
          priority: "low",
          source: "forum",
          href: `/forum/thread/${input.threadId}#post-${result.post.post_id}`,
          metadata: {
            threadId: input.threadId,
            postId: result.post.post_id,
            authorName: user?.forumUsername,
          },
        });
      } catch {
        // Non-critical — don't fail the mutation if notification fails
      }

      return { post: normalizePost(result.post) };
    }),

  /**
   * Edit a post.
   */
  editPost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.number(),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ post: XFPost }>(
        `/posts/${input.postId}/`,
        { message: input.message },
        xfUserId
      );

      if (!result?.post) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to edit post",
        });
      }

      invalidateThread(result.post.thread_id);

      return { post: normalizePost(result.post) };
    }),

  /**
   * Delete a post.
   */
  deletePost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.number(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfDelete<{ success: boolean }>(
        `/posts/${input.postId}/${input.reason ? `?reason=${encodeURIComponent(input.reason)}` : ""}`,
        xfUserId
      );

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete post",
        });
      }

      cacheInvalidate("forum:thread:");
      return { success: true };
    }),

  /**
   * React to a post.
   */
  reactToPost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.number(),
        reactionId: z.number().default(1), // 1 = Like in default XenForo
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ success: boolean }>(
        `/posts/${input.postId}/react`,
        { reaction_id: String(input.reactionId) },
        xfUserId
      );

      cacheInvalidate(`forum:post:${input.postId}`);
      cacheInvalidate("forum:thread:");

      return { success: result !== null };
    }),

  /**
   * Mark a forum/thread as read.
   */
  markForumRead: rateLimitedMutationProcedure
    .input(
      z.object({
        forumId: z.number().optional(),
        threadId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      if (input.threadId) {
        await xfPostAsUser(`/threads/${input.threadId}/mark-read`, {}, xfUserId);
      } else if (input.forumId) {
        await xfPostAsUser(`/forums/${input.forumId}/mark-read`, {}, xfUserId);
      }

      return { success: true };
    }),
});
