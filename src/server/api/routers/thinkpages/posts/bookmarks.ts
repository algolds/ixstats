import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const thinkpagesPostsBookmarksRouter = createTRPCRouter({
  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Bookmark or unbookmark a post
  bookmarkPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        bookmarked: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Bookmarks belong to the authenticated caller (Clerk user id), never a client-supplied id.
      const userId = ctx.auth.userId;

      if (input.bookmarked) {
        // Add bookmark
        await db.postBookmark.upsert({
          where: {
            userId_postId: {
              postId: input.postId,
              userId,
            },
          },
          update: {},
          create: {
            postId: input.postId,
            userId,
          },
        });
      } else {
        // Remove bookmark
        await db.postBookmark.deleteMany({
          where: {
            postId: input.postId,
            userId,
          },
        });
      }

      return { success: true };
    }),
});
