import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { invalidateFeeds, personaDisplayName } from "../../post-utils";

/**
 * Post update for a new reaction tally: the JSON tally plus `likeCount`, which mirrors the
 * `like` entry so feed and post views show the real number (it was never written before).
 */
function countersData(reactionCounts: Record<string, number>) {
  return {
    reactionCounts: JSON.stringify(reactionCounts),
    likeCount: Math.max(0, reactionCounts.like ?? 0),
  };
}

/**
 * Checks the caller owns `accountId`, then loads the post's tally and the account's existing
 * reaction on it. Throws UNAUTHORIZED / FORBIDDEN / NOT_FOUND like the mutations always did.
 */
async function loadReactionState(
  db: PrismaClient,
  clerkUserId: string | null | undefined,
  postId: string,
  accountId: string,
  unauthorizedMessage: string
) {
  if (!clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: unauthorizedMessage });
  }

  // Verify the account belongs to the current user
  const account = await db.thinkpagesAccount.findUnique({ where: { id: accountId } });
  if (!account || account.clerkUserId !== clerkUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to use this account",
    });
  }

  const post = await db.thinkpagesPost.findUnique({
    where: { id: postId },
    select: { reactionCounts: true, content: true },
  });
  if (!post) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
  }

  const reactionCounts = (() => {
    try {
      return post.reactionCounts ? JSON.parse(post.reactionCounts) : {};
    } catch (error) {
      console.warn("Failed to parse reactionCounts:", error);
      return {};
    }
  })();

  const existingReaction = await db.postReaction.findUnique({
    where: { postId_accountId: { postId, accountId } },
  });

  return { account, post, reactionCounts, existingReaction };
}

const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.union([
    z.enum(["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"]),
    z.string().startsWith("discord:"), // Support Discord emoji reactions like "discord:ixnay"
  ]),
});

export const thinkpagesPostsReactionsMutationsRouter = createTRPCRouter({
  // Add reaction to post
  addReaction: protectedProcedure.input(AddReactionSchema).mutation(async ({ ctx, input }) => {
    const { db } = ctx;
    const clerkUserId = ctx.auth?.userId;

    const { account, post, reactionCounts, existingReaction } = await loadReactionState(
      db,
      clerkUserId,
      input.postId,
      input.accountId,
      "You must be logged in to react to posts"
    );

    if (existingReaction) {
      if (existingReaction.reactionType === input.reactionType) {
        // Same reaction - remove it (toggle behavior)
        await (db as any).$transaction(async (tx: any) => {
          reactionCounts[existingReaction.reactionType] =
            (reactionCounts[existingReaction.reactionType] || 1) - 1;

          await tx.postReaction.delete({
            where: {
              postId_accountId: {
                postId: input.postId,
                accountId: input.accountId,
              },
            },
          });

          await tx.thinkpagesPost.update({
            where: { id: input.postId },
            data: countersData(reactionCounts),
          });
        });

        // Sync removal to Discord if message exists
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        if (match && match[1]) {
          try {
            const { removeDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err: unknown) =>
              console.error("[ThinkPages] Remove Discord reaction promise error:", err)
            );
          } catch (error) {
            console.error("[ThinkPages] Failed to trigger Discord reaction removal:", error);
          }
        }

        await invalidateFeeds();
        return { removed: true };
      }

      // Different reaction - update it
      await (db as any).$transaction(async (tx: any) => {
        reactionCounts[existingReaction.reactionType] =
          (reactionCounts[existingReaction.reactionType] || 1) - 1;
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        await tx.postReaction.update({
          where: {
            postId_accountId: {
              postId: input.postId,
              accountId: input.accountId,
            },
          },
          data: { reactionType: input.reactionType },
        });

        await tx.thinkpagesPost.update({
          where: { id: input.postId },
          data: countersData(reactionCounts),
        });
      });

      // Sync reaction update to Discord
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { addDiscordReaction, removeDiscordReaction } =
            await import("~/lib/discord/ixtwitter-sync");
          removeDiscordReaction(match[1], existingReaction.reactionType)
            .then(() => addDiscordReaction(match[1], input.reactionType))
            .catch((err: unknown) =>
              console.error("[ThinkPages] Sync update Discord reaction error:", err)
            );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord reaction update:", error);
        }
      }

      await invalidateFeeds();
      return { updated: true, reactionType: input.reactionType };
    } else {
      // New reaction - create it
      const reaction = await (db as any).$transaction(async (tx: any) => {
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        const newReaction = await tx.postReaction.create({
          data: {
            postId: input.postId,
            accountId: input.accountId,
            reactionType: input.reactionType,
          },
        });

        await tx.thinkpagesPost.update({
          where: { id: input.postId },
          data: countersData(reactionCounts),
        });

        return newReaction;
      });

      // Sync reaction creation to Discord if message exists
      const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
      if (match && match[1]) {
        try {
          const { addDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
          addDiscordReaction(match[1], input.reactionType).catch((err: unknown) =>
            console.error("[ThinkPages] Add Discord reaction promise error:", err)
          );
        } catch (error) {
          console.error("[ThinkPages] Failed to trigger Discord reaction sync:", error);
        }
      }

      // 🔔 Notify post author of new reaction (likes only)
      if (input.reactionType === "like") {
        const postWithAuthor = await db.thinkpagesPost.findUnique({
          where: { id: input.postId },
          select: {
            accountId: true,
            content: true,
            account: { select: { clerkUserId: true } },
          },
        });

        // Notifications are keyed by Clerk user id, so target the owning user of the author
        // persona (not the persona id), and skip likes on the caller's own personas.
        const authorClerkUserId = postWithAuthor?.account?.clerkUserId;
        if (postWithAuthor && authorClerkUserId && authorClerkUserId !== clerkUserId) {
          await notificationHooks
            .onThinkPageActivity({
              thinkpageId: input.postId,
              title: postWithAuthor.content.substring(0, 50),
              action: "liked",
              authorId: clerkUserId,
              authorName: personaDisplayName(account),
              targetUserId: authorClerkUserId,
            })
            .catch((err) => console.error("[ThinkPages] Failed to send like notification:", err));
        }
      }

      await invalidateFeeds();
      return reaction;
    }
  }),

  // Remove reaction
  removeReaction: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      const { post, reactionCounts, existingReaction } = await loadReactionState(
        db,
        clerkUserId,
        input.postId,
        input.accountId,
        "You must be logged in to remove reactions"
      );

      if (existingReaction) {
        // Use transaction to ensure consistency
        await (db as any).$transaction(async (tx: any) => {
          // Update reaction counts
          reactionCounts[existingReaction.reactionType] =
            (reactionCounts[existingReaction.reactionType] || 1) - 1;

          // Remove the reaction
          await tx.postReaction.delete({
            where: {
              postId_accountId: {
                postId: input.postId,
                accountId: input.accountId,
              },
            },
          });

          // Update post with new counts
          await tx.thinkpagesPost.update({
            where: { id: input.postId },
            data: countersData(reactionCounts),
          });
        });

        // Sync reaction removal to Discord
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        if (match && match[1]) {
          try {
            const { removeDiscordReaction } = await import("~/lib/discord/ixtwitter-sync");
            removeDiscordReaction(match[1], existingReaction.reactionType).catch((err: unknown) =>
              console.error("[ThinkPages] Remove Discord reaction promise error:", err)
            );
          } catch (error) {
            console.error("[ThinkPages] Failed to trigger Discord reaction removal:", error);
          }
        }

        await invalidateFeeds();
        return { success: true };
      }

      return { success: false };
    }),
});
