/**
 * Unified Messages Router — Messaging (Plan 163 Adapter)
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { validateNoXSS } from "~/lib/utils";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

export const messagesMessagingRouter = createTRPCRouter({
  /**
   * Get messages for a conversation (source-aware).
   */
  getConversationMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        userId: z.string().optional().default(""),
        limit: z.number().min(1).max(100).default(50),
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

      try {
        const result = await messagingService.getConversationMessages(ctx.auth.userId, {
          conversationId: input.conversationId,
          limit: input.limit,
          cursor: input.cursor,
        });

        const messages = result.messages.map((m: any) => ({
          id: m.id,
          conversationId: m.conversationId,
          accountId: m.userId,
          account: result.accountMap.get(m.userId) ?? {
            id: m.userId,
            username: m.userId,
            displayName: "Unknown",
            profileImageUrl: null,
            accountType: "country" as const,
          },
          content: m.deletedAt ? "This message was deleted" : m.content,
          messageType: m.messageType || "text",
          replyToId: m.replyToId,
          replyTo: m.replyTo
            ? {
                id: m.replyTo.id,
                accountId: m.replyTo.userId,
                content: m.replyTo.deletedAt ? "This message was deleted" : m.replyTo.content,
                ixTimeTimestamp: m.replyTo.ixTimeTimestamp,
              }
            : null,
          reactions: m.reactions ? (typeof m.reactions === "string" ? JSON.parse(m.reactions) : m.reactions) : {},
          mentions: m.mentions ? (typeof m.mentions === "string" ? JSON.parse(m.mentions) : m.mentions) : [],
          attachments: m.attachments ? (typeof m.attachments === "string" ? JSON.parse(m.attachments) : m.attachments) : [],
          isSystem: Boolean(m.isSystem),
          ixTimeTimestamp: m.ixTimeTimestamp,
          createdAt: m.ixTimeTimestamp,
          editedAt: m.editedAt,
          deletedAt: m.deletedAt,
          source: m.source || "thinkshare",
          classification: m.classification,
          priority: m.priority,
          subject: m.subject,
          readReceipts: (m.readReceipts || []).map((r: any) => ({
            id: r.id,
            accountId: r.userId,
            readAt: r.readAt,
          })),
        }));

        return { messages, nextCursor: result.nextCursor };
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a participant in this conversation",
          });
        }
        throw err;
      }
    }),

  /**
   * Send a message (source-aware).
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        content: z.string().min(1),
        messageType: z.enum(["text", "image", "file", "system"]).default("text"),
        replyToId: z.string().optional(),
        mentions: z.array(z.string()).optional(),
        attachments: z
          .array(
            z.object({
              type: z.string(),
              url: z.string(),
              filename: z.string().optional(),
              size: z.number().optional(),
            })
          )
          .optional(),
        // Diplomatic extensions
        classification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).optional(),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      validateNoXSS(input.content);

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        return await messagingService.sendMessage(ctx.auth.userId, {
          conversationId: input.conversationId,
          content: input.content,
          replyToId: input.replyToId,
          attachments: input.attachments,
          subject: input.subject,
        });
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a participant in this conversation",
          });
        }
        throw err;
      }
    }),

  /**
   * Edit a message.
   */
  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      validateNoXSS(input.content);

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        await messagingService.editMessage(ctx.auth.userId, {
          messageId: input.messageId,
          content: input.content,
        });
        return { success: true };
      } catch (err: any) {
        if (err.name === "MessagingNotFoundError") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        }
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own messages" });
        }
        throw err;
      }
    }),

  /**
   * Delete a message (soft delete).
   */
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        await messagingService.deleteMessage(ctx.auth.userId, {
          messageId: input.messageId,
        });
        return { success: true };
      } catch (err: any) {
        if (err.name === "MessagingNotFoundError") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        }
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own messages" });
        }
        throw err;
      }
    }),

  /**
   * Clear all system notifications for a user.
   */
  clearAllSystemNotifications: protectedProcedure
    .input(z.object({ userId: z.string().optional().default("") }))
    .mutation(async ({ ctx }) => {
      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      return await messagingService.clearAllSystemNotifications(ctx.auth.userId);
    }),

  /**
   * Add reaction to a message.
   */
  addReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string().optional().default(""),
        reaction: z.string(),
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

      try {
        return await messagingService.addReaction(ctx.auth.userId, {
          messageId: input.messageId,
          emoji: input.reaction,
        });
      } catch (err: any) {
        if (err.name === "MessagingNotFoundError") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        }
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this conversation" });
        }
        throw err;
      }
    }),

  /**
   * Remove reaction from a message.
   */
  removeReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string().optional().default(""),
        reaction: z.string(),
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

      try {
        return await messagingService.removeReaction(ctx.auth.userId, {
          messageId: input.messageId,
          emoji: input.reaction,
        });
      } catch (err: any) {
        if (err.name === "MessagingNotFoundError") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        }
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this conversation" });
        }
        throw err;
      }
    }),

  /**
   * Send an admin broadcast / platform alert / system notification.
   */
  sendAdminBroadcast: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        message: z.string().optional(),
        category: z.string().optional().default("system"),
        level: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        type: z.string().optional().default("system"),
        href: z.string().optional(),
        scope: z.enum(["global", "country", "user"]).default("global"),
        countryId: z.string().optional(),
        userId: z.string().optional(),
        actionable: z.boolean().default(false),
        metadata: z.any().optional(),
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

      const actorId = ctx.auth?.userId || "system-admin";
      return await messagingService.sendAdminBroadcast(actorId, input);
    }),

  /**
   * Send a direct message or official dispatch from administrator / system.
   */
  sendAdminMessage: adminProcedure
    .input(
      z.object({
        targetUserId: z.string().min(1),
        content: z.string().min(1),
        subject: z.string().optional(),
        source: z.enum(["thinkshare", "thinktank", "diplomatic", "wiki", "forum", "system"]).default("system"),
        conversationType: z.enum(["personal", "diplomatic", "official"]).default("official"),
        classification: z.enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      validateNoXSS(input.content);

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      const actorId = ctx.auth?.userId || "system-admin";
      return await messagingService.sendAdminMessage(actorId, input);
    }),
});
