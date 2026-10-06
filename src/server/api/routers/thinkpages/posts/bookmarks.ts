import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { canViewPost, postInclude, transformPost } from "../post-utils";

export const thinkpagesPostsBookmarksRouter = createTRPCRouter({
  // Bookmark or unbookmark a post
  bookmarkPost: rateLimitedMutationProcedure
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
        await db.postBookmark.upsert({
          where: { userId_postId: { postId: input.postId, userId } },
          update: {},
          create: { postId: input.postId, userId },
        });
      } else {
        await db.postBookmark.deleteMany({ where: { postId: input.postId, userId } });
      }

      return { success: true };
    }),

  /**
   * The caller's saved posts (SL-10), most recently saved first. Posts deleted since, and posts
   * the caller can no longer read (made private by their author), are left out. Paginated by
   * bookmark id.
   */
  getBookmarkedPosts: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .default({ limit: 20 })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const bookmarks = await db.postBookmark.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: { id: true, postId: true, createdAt: true },
      });
      const page = bookmarks.slice(0, input.limit);
      const nextCursor = bookmarks.length > input.limit ? page[page.length - 1]!.id : null;

      const posts = page.length
        ? await db.thinkpagesPost.findMany({
            where: { id: { in: page.map((b) => b.postId) } },
            include: postInclude,
          })
        : [];
      const byId = new Map(posts.map((post) => [post.id, post]));

      return {
        posts: page.flatMap((bookmark) => {
          const post = byId.get(bookmark.postId);
          if (!post || !canViewPost(post as any, userId)) return [];
          return [{ ...transformPost(post), bookmarkedAt: bookmark.createdAt }];
        }),
        nextCursor,
      };
    }),
});
