import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const thinkpagesPostsFlagsRouter = createTRPCRouter({
  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Flag a post for moderation
  flagPost: rateLimitedMutationProcedure
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
});
