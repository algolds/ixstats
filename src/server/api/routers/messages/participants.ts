/**
 * Unified Messages Router — Participants (Plan 163 Adapter)
 */

import { z } from "zod";
import {
  createTRPCRouter,
  readOnlyProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { MAX_MARK_READ_IDS } from "~/server/modules/messaging";
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
          forbidden:
            "Only an active participant can add others, and not to a direct message or a ThinkTank chat",
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
        messageIds: z.array(z.string().min(1)).max(MAX_MARK_READ_IDS).optional(),
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
  getSeenState: readOnlyProcedure
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
   * Search users for new conversation creation: by nation, passport handle or forum name, so a player with
   * no nation is found too.
   */
  searchUsers: readOnlyProcedure
    .input(z.object({ query: z.string().max(100) }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (query.length < 3) return [];
      return await messagingFor(ctx).searchUsers(ctx.auth.userId, { query, limit: 10 });
    }),

  /**
   * The conversations the caller muted and archived (kept on their participant rows, not in the browser).
   */
  getConversationPreferences: readOnlyProcedure.query(async ({ ctx }) => {
    return await messagingFor(ctx).getConversationPreferences(ctx.auth.userId);
  }),

  /**
   * Mute and/or archive one of the caller's conversations; the fields left out stay as they were.
   */
  setConversationPreferences: rateLimitedMutationProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        muted: z.boolean().optional(),
        archived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await mapMessagingErrors(
        () => messagingFor(ctx).setConversationPreferences(ctx.auth.userId, input),
        { forbidden: "You are not an active participant in this conversation" }
      );
    }),
});
