import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
// Import the wiki search service
import { validateNoXSS } from "~/lib/utils";
import {
  invalidateFeeds,
  loadPostForModeration,
  postAuthorsInclude,
  stripDiscordMarker,
} from "../../post-utils";
import { ownHashtags, storedPseudoTags } from "~/server/shared/realm-board";
import { deleteThinkpagesPost } from "~/server/shared/thinkpages-post-delete";

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
          )
          .transform(stripDiscordMarker),
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

      // The post's own Discord marker (set by the IxTwitter sync) is kept; the edit can't add one.
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: {
          content: match ? `${input.content}\n\n${match[0]}` : input.content,
          // Editing tags keeps the post's board placement and can't add a new one.
          hashtags: input.hashtags
            ? JSON.stringify([...storedPseudoTags(post.hashtags), ...ownHashtags(input.hashtags)])
            : post.hashtags,
          updatedAt: new Date(),
        },
        include: { ...postAuthorsInclude, mediaAttachments: true },
      });

      // Update Discord message if it exists
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
          ).catch((err: unknown) =>
            console.error("[ThinkPages] Edit Discord msg promise error:", err)
          );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord edit:", error);
        }
      }

      await invalidateFeeds();

      return updatedPost;
    }),

  // Delete a post (hard delete; see deleteThinkpagesPost)
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

      const deletedPost = await deleteThinkpagesPost(db, post);

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
      // The feed lists pinned posts first, so only the post's owner (or a moderator) may pin it;
      // matching the client's accountId alone let anyone pin any post.
      await loadPostForModeration(db, ctx.auth?.userId, ctx.user?.role?.level, input.postId, "pin");

      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: { pinned: input.pinned },
      });

      return updatedPost;
    }),
});
