import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const thinkpagesPostsFlagsRouter = createTRPCRouter({
  /**
   * Flag a post for moderation. The flag belongs to the signed-in caller (Clerk id); it lands in
   * the admin flag queue (`admin.listFlaggedPosts`, SL-10) until an admin resolves it.
   */
  flagPost: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: z.string(),
        /** Ignored: the flagger is always the caller. Kept so older clients still validate. */
        userId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { id: true },
      });
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      const existingFlag = await db.postFlag.findUnique({
        where: { userId_postId: { postId: input.postId, userId } },
      });

      if (existingFlag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already flagged this post",
        });
      }

      await db.postFlag.create({
        data: { postId: input.postId, userId, reason: input.reason },
      });

      return { success: true };
    }),
});
