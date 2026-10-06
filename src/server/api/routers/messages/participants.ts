/**
 * Unified Messages Router — Participants (Plan 163 Adapter)
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { messagingFor, mapMessagingErrors } from "./_service";

export const messagesParticipantsRouter = createTRPCRouter({
  /**
   * Leave a conversation (marks participant as inactive).
   */
  leaveConversation: rateLimitedMutationProcedure
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

      const messagingService = messagingFor(ctx);

      return await messagingService.leaveConversation(principalId, {
        conversationId: input.conversationId,
      });
    }),

  /**
   * Add a participant to a conversation.
   */
  addParticipant: rateLimitedMutationProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.addParticipant(ctx.auth.userId, {
            conversationId: input.conversationId,
            targetUserId: input.userId,
          }),
        {
          forbidden: "You must be an active participant to add others",
          notFound: "Conversation not found",
        }
      );
    }),

  /**
   * Mark messages as read.
   */
  markMessagesAsRead: rateLimitedMutationProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        messageIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.markMessagesAsRead(ctx.auth.userId, {
            conversationId: input.conversationId,
            messageIds: input.messageIds,
          }),
        { forbidden: "You are not an active participant in this conversation" }
      );
    }),

  /**
   * Accept or decline a message request (SL-4).
   */
  respondToRequest: rateLimitedMutationProcedure
    .input(z.object({ conversationId: z.string().min(1), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);
      return await mapMessagingErrors(
        () => messagingService.respondToRequest(ctx.auth.userId, input),
        { forbidden: "You cannot answer this request", notFound: "Message request not found" }
      );
    }),

  /**
   * Read receipts (SL-4): when the other person in a direct conversation last read it, or null
   * unless both of you allow read receipts.
   */
  getSeenState: protectedProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);
      return await mapMessagingErrors(
        () => messagingService.getSeenState(ctx.auth.userId, input.conversationId),
        {
          forbidden: "You are not an active participant in this conversation",
          notFound: "Conversation not found",
        }
      );
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
