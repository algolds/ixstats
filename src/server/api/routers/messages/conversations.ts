/**
 * Unified Messages Router — Conversations (Plan 163 Adapter)
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { mapMessagingErrors, messagingFor } from "./_service";

const MessageFolderSchema = z.enum([
  "inbox",
  "personal",
  "diplomatic",
  "discussions",
  "groups",
  "system",
  "conversations",
  "archive",
  "trash",
  "thinktank",
  "wiki",
  "forum",
]);

const MessageSourceSchema = z.enum([
  "thinkshare",
  "thinktank",
  "diplomatic",
  "wiki",
  "forum",
  "system",
]);

export const messagesConversationsRouter = createTRPCRouter({
  /**
   * Get conversations filtered by folder — server-side folder classification.
   */
  getConversationsByFolder: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional().default(""),
        folder: MessageFolderSchema,
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await messagingService.getConversationsByFolder(ctx.auth.userId, {
        folder: input.folder as any,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  /**
   * Get single conversation by ID.
   */
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await messagingService.getConversation(ctx.auth.userId, input.conversationId);
    }),

  /**
   * Get unread counts per folder for the sidebar badges.
   */
  getFolderCounts: protectedProcedure
    .input(z.object({ userId: z.string().optional().default("") }).optional())
    .query(async ({ ctx }) => {
      const messagingService = messagingFor(ctx);

      return await messagingService.getFolderCounts(ctx.auth.userId);
    }),

  /**
   * Mark all conversations/messages as read for the current user.
   */
  markAllAsRead: rateLimitedMutationProcedure.mutation(async ({ ctx }) => {
    const messagingService = messagingFor(ctx);

    return await messagingService.markAllAsRead(ctx.auth.userId);
  }),

  /**
   * Create a conversation (source-aware).
   */
  createConversation: rateLimitedMutationProcedure
    .input(
      z.object({
        participantIds: z.array(z.string().min(1)),
        source: MessageSourceSchema.optional().default("thinkshare"),
        name: z.string().optional(),
        conversationType: z.enum(["personal", "diplomatic", "official"]).optional(),
        diplomaticClassification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).optional(),
        encrypted: z.boolean().optional(),
        channelType: z.enum(["BILATERAL", "MULTILATERAL", "EMERGENCY"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.createConversation(ctx.auth.userId, {
            participantIds: input.participantIds,
            subject: input.name,
            source: input.source as any,
            conversationType: input.conversationType,
            diplomaticClassification: input.diplomaticClassification,
            priority: input.priority,
            channelType: input.channelType,
          }),
        { forbidden: "You cannot start this conversation" }
      );
    }),
});
