import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

export const thinkpagesPostsFlagsRouter = createTRPCRouter({
  // Search Unsplash images

  // Fetch Discord Channel Topic (Easter Egg)

  // Search Wiki Commons images

  // Calculate trending topics

  // Search users globally for ThinkTanks/ThinkShare

  // Update ThinkPages Feed Account
  // Username availability check for ThinkPages Feed Accounts

  // Generate random profile picture

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)

  // Get ThinkPages Feed Accounts by Country - For Feed only

  // Get current user's ThinkPages accounts

  // Get Account Counts by Type - For Feed only

  // Post creation

  // Update post content (edit post)

  // Delete post (soft delete)

  // Add reaction to post

  // Remove reaction

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID

  // Get post details with replies

  // Get posts by Clerk User ID - shows all posts from all accounts owned by this user

  // Trigger citizen reaction to a post

  // Calculate and store country mood metrics

  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Create a new ThinkTank group

  // Get ThinkTanks globally (no country restriction)

  // Join a ThinkTank group

  // Leave a ThinkTank group

  // Get ThinkTank messages

  // Send message to ThinkTank

  // Update a ThinkTank group

  // Invite users to a ThinkTank group

  // Get collaborative documents for a ThinkTank

  // Create a collaborative document

  // Update a collaborative document

  // Delete a collaborative document

  // Get a single document

  // Add reaction to a Thinkshare message

  // Remove reaction from a Thinkshare message

  // Edit a Thinkshare message

  // Delete a Thinkshare message

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Create a new conversation

  // Get conversations for a user

  // Get messages for a conversation

  // Send message to conversation

  // Mark messages as read

  // Update user presence/online status

  // Get presence for multiple users

  // Get Discord server emojis

  // Pin/unpin a post

  // Bookmark/unbookmark a post
  // Get user's bookmarked posts

  // Check if a post is bookmarked by user

  // Bookmark or unbookmark a post

  // Get all flagged posts (admin only)
  getFlaggedPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const flags = await db.postFlag.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (flags.length > input.limit) {
        const nextItem = flags.pop();
        nextCursor = nextItem!.id;
      }

      return {
        flags,
        nextCursor,
      };
    }),

  // Check if a post is flagged by user
  isFlagged: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        postId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const flag = await ctx.db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      return { flagged: !!flag };
    }),

  // Flag a post for moderation
  flagPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if already flagged by this user
      const existingFlag = await db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      if (existingFlag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already flagged this post",
        });
      }

      await db.postFlag.create({
        data: {
          postId: input.postId,
          userId: input.userId,
          reason: input.reason,
        },
      });

      return { success: true };
    }),

  // Remove a flag (unflag post)
  unflagPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.postFlag.deleteMany({
        where: {
          postId: input.postId,
          userId: input.userId,
        },
      });

      return { success: true };
    }),

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
});
