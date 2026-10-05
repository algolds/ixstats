import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import { invalidateFeeds, loadPostForModeration } from "../../post-utils";

export const thinkpagesPostsPostsModifyRouter = createTRPCRouter({
  // Update post content (edit post)
  updatePost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.string(),
        content: z
          .string()
          .min(1)
          .max(10000)
          .refine(
            (content) => {
              const validation = validateNoXSS(content);
              return validation.valid;
            },
            {
              message:
                "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
            }
          ),
        hashtags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const post = await loadPostForModeration(
        db,
        ctx.auth?.userId,
        ctx.user?.role?.level,
        input.postId,
        "update"
      );

      // Update the post
      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: {
          content: input.content,
          hashtags: input.hashtags ? JSON.stringify(input.hashtags) : post.hashtags,
          updatedAt: new Date(),
        },
        include: {
          account: true,
          mediaAttachments: true,
          parentPost: {
            include: { account: true },
          },
          repostOf: {
            include: { account: true },
          },
        },
      });

      // Update Discord message if it exists
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { editDiscordMessage } = await import("~/lib/discord/ixtwitter-sync");
          const mediaUrls = updatedPost.mediaAttachments?.map((m) => m.url) || [];
          editDiscordMessage(
            match[1],
            {
              id: updatedPost.id,
              content: input.content,
              ixTimeTimestamp: updatedPost.ixTimeTimestamp || updatedPost.createdAt,
            },
            updatedPost.account,
            mediaUrls
          )
            .then(async (success: boolean) => {
              if (success) {
                await db.thinkpagesPost.update({
                  where: { id: updatedPost.id },
                  data: {
                    content: `${input.content}\n\n[DiscordMsg:${match[1]}]`,
                  },
                });
              }
            })
            .catch((err: unknown) =>
              console.error("[ThinkPages] Edit Discord msg promise error:", err)
            );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord edit:", error);
        }
      }

      await invalidateFeeds();

      return updatedPost;
    }),

  // Delete post (soft delete)
  deletePost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const post = await loadPostForModeration(
        db,
        ctx.auth?.userId,
        ctx.user?.role?.level,
        input.postId,
        "delete"
      );

      // Handle child posts before deletion:
      // 1. Nullify parentPostId on replies (prevents FK constraint, marks as orphaned)
      await db.thinkpagesPost.updateMany({
        where: { parentPostId: input.postId },
        data: { parentPostId: null },
      });

      // 2. Delete reposts of this post (reposts have no standalone value)
      const repostCount = await db.thinkpagesPost.count({
        where: { repostOfId: input.postId },
      });
      if (repostCount > 0) {
        await db.thinkpagesPost.deleteMany({
          where: { repostOfId: input.postId },
        });
      }

      // Get the message ID before deleting
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);

      // Hard delete the post (PostReaction, PostMention, MediaAttachment cascade automatically)
      const deletedPost = await db.thinkpagesPost.delete({
        where: { id: input.postId },
      });

      // Keep the parent / original post's engagement counters in step (never below zero).
      if (post.parentPostId) {
        await db.thinkpagesPost.updateMany({
          where: { id: post.parentPostId, replyCount: { gt: 0 } },
          data: { replyCount: { decrement: 1 } },
        });
      }
      if (post.repostOfId) {
        await db.thinkpagesPost.updateMany({
          where: { id: post.repostOfId, repostCount: { gt: 0 } },
          data: { repostCount: { decrement: 1 } },
        });
      }

      // If the post had an associated poll, delete it
      if ((post as any).pollId) {
        await db.poll
          .delete({
            where: { id: (post as any).pollId },
          })
          .catch((err) => {
            console.error("[ThinkPages] Failed to delete associated poll:", err);
          });
      }

      // Decrement account post count (include deleted reposts)
      await db.thinkpagesAccount.update({
        where: { id: post.accountId },
        data: {
          postCount: { decrement: 1 + repostCount },
        },
      });

      // Delete Discord message if it exists
      if (match && match[1]) {
        try {
          const { deleteDiscordMessage } = await import("~/lib/discord/ixtwitter-sync");
          deleteDiscordMessage(match[1]).catch((err: unknown) =>
            console.error("[ThinkPages] Delete Discord msg promise error:", err)
          );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord delete:", error);
        }
      }

      await invalidateFeeds();

      return { success: true, postId: deletedPost.id };
    }),

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Pin/unpin a post
  pinPost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.string(),
        accountId: z.string(),
        pinned: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify ownership
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { accountId: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      if (post.accountId !== input.accountId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only pin your own posts",
        });
      }

      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: { pinned: input.pinned },
      });

      return updatedPost;
    }),
});
