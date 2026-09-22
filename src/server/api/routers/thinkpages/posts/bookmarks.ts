import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

export const thinkpagesPostsBookmarksRouter = createTRPCRouter({
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
  getBookmarks: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const bookmarks = await db.postBookmark.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (bookmarks.length > input.limit) {
        const nextItem = bookmarks.pop();
        nextCursor = nextItem!.id;
      }

      return {
        bookmarks,
        nextCursor,
      };
    }),

  // Check if a post is bookmarked by user
  isBookmarked: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        postId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bookmark = await ctx.db.postBookmark.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId,
          },
        },
      });

      return { bookmarked: !!bookmark };
    }),

  // Bookmark or unbookmark a post
  bookmarkPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
        bookmarked: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      if (input.bookmarked) {
        // Add bookmark
        await db.postBookmark.upsert({
          where: {
            userId_postId: {
              postId: input.postId,
              userId: input.userId,
            },
          },
          update: {},
          create: {
            postId: input.postId,
            userId: input.userId,
          },
        });
      } else {
        // Remove bookmark
        await db.postBookmark.deleteMany({
          where: {
            postId: input.postId,
            userId: input.userId,
          },
        });
      }

      return { success: true };
    }),

  // Get all flagged posts (admin only)

  // Check if a post is flagged by user

  // Flag a post for moderation

  // Remove a flag (unflag post)

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
});
