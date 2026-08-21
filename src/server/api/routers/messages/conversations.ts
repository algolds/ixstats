/**
 * Unified Messages Router — Conversations (Plan 163 Adapter)
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

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
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

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
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.getConversation(ctx.auth.userId, input.conversationId);
    }),

  /**
   * Get unread counts per folder for the sidebar badges.
   */
  getFolderCounts: protectedProcedure
    .input(z.object({ userId: z.string().optional().default("") }).optional())
    .query(async ({ ctx }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.getFolderCounts(ctx.auth.userId);
    }),

  /**
   * Mark all conversations/messages as read for the current user.
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const messagingService = createMessagingService({
      db: ctx.db,
      notifications: notificationAPI,
      websocket: getThinkPagesServer(),
      forumBridge,
      wikiBridge: wikiTalkBridge,
    });

    return await messagingService.markAllAsRead(ctx.auth.userId);
  }),

  /**
   * Create a conversation (source-aware).
   */
  createConversation: protectedProcedure
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
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.createConversation(ctx.auth.userId, {
        participantIds: input.participantIds,
        subject: input.name,
        source: input.source as any,
      });
    }),

  /**
   * Manually sync discussions from wiki talk pages and forum conversations.
   */
  syncDiscussions: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.syncDiscussions(ctx.auth.userId);
    }),
});
