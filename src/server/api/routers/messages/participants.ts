/**
 * Unified Messages Router — Participants (Plan 163 Adapter)
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

export const messagesParticipantsRouter = createTRPCRouter({
  /**
   * Leave a conversation (marks participant as inactive).
   */
  leaveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const principalId = ctx.auth.userId;
      if (input.userId && input.userId !== principalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only leave conversations on behalf of yourself",
        });
      }

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesBroadcaster(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.leaveConversation(principalId, {
        conversationId: input.conversationId,
      });
    }),

  /**
   * Add a participant to a conversation.
   */
  addParticipant: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesBroadcaster(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        return await messagingService.addParticipant(ctx.auth.userId, {
          conversationId: input.conversationId,
          targetUserId: input.userId,
        });
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must be an active participant to add others",
          });
        }
        if (err.name === "MessagingNotFoundError") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found",
          });
        }
        throw err;
      }
    }),

  /**
   * Mark messages as read.
   */
  markMessagesAsRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        messageIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesBroadcaster(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        return await messagingService.markMessagesAsRead(ctx.auth.userId, {
          conversationId: input.conversationId,
          messageIds: input.messageIds,
        });
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not an active participant in this conversation",
          });
        }
        throw err;
      }
    }),

  /**
   * Search users for new conversation creation.
   */
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (input.query.length < 3) return [];

      const users = await ctx.db.user.findMany({
        where: {
          isActive: true,
          country: {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { slug: { contains: input.query, mode: "insensitive" } },
            ],
          },
        },
        // Only the fields the compose/add-participant UI renders (clerkUserId is the
        // participant identifier). Never return the full User/Country rows.
        select: {
          id: true,
          clerkUserId: true,
          country: { select: { name: true, slug: true, flag: true } },
        },
        take: 10,
      });

      return users;
    }),
});
