/**
 * ThinkPages Messaging Router — Messages (Plan 163 Legacy Adapter)
 *
 * Provides backward-compatible ThinkShare message procedures.
 * All operations delegate to the canonical MessagingService.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { validateNoXSS } from "~/lib/utils";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

export const thinkpagesMessagingMessagesRouter = createTRPCRouter({
  /**
   * Get messages for a conversation (legacy ThinkPages procedure).
   */
  getConversationMessages: publicProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.string().optional(),
        direction: z.enum(["before", "after"]).optional().default("before"),
      })
    )
    .query(async ({ ctx, input }) => {
      const actorId = input.userId || ctx.auth?.userId || "";
      if (!actorId) {
        return {
          messages: [],
          nextCursor: undefined,
        };
      }

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        const result = await messagingService.getConversationMessages(actorId, {
          conversationId: input.conversationId,
          limit: input.limit,
          cursor: input.cursor,
          direction: input.direction,
        });

        const messages = result.messages.map((msg: any) => {
          const senderAccount = result.accountMap.get(msg.userId);
          const isDeleted = Boolean(msg.deletedAt || msg.isDeleted);
          const isEdited = Boolean(msg.editedAt || msg.isEdited);
          const timestamp = msg.ixTimeTimestamp || msg.createdAt;

          let replyToFormatted = undefined;
          if (msg.replyTo) {
            const replySender = result.accountMap.get(msg.replyTo.userId);
            const replyDeleted = Boolean(msg.replyTo.deletedAt || msg.replyTo.isDeleted);
            replyToFormatted = {
              id: msg.replyTo.id,
              content: replyDeleted ? "This message was deleted" : msg.replyTo.content,
              senderName: replySender?.displayName ?? msg.replyTo.senderName ?? "Unknown",
            };
          }

          return {
            id: msg.id,
            conversationId: msg.conversationId,
            userId: msg.userId,
            content: isDeleted ? "This message was deleted" : msg.content,
            attachments: msg.attachments ?? [],
            replyToId: msg.replyToId ?? undefined,
            isDeleted,
            isEdited,
            createdAt: timestamp,
            updatedAt: msg.editedAt || timestamp,
            senderName: senderAccount?.displayName ?? msg.senderName ?? "Unknown",
            senderAvatar: senderAccount?.profileImageUrl ?? msg.senderAvatar ?? null,
            replyTo: replyToFormatted,
          };
        });

        return {
          messages,
          nextCursor: result.nextCursor ?? undefined,
        };
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a participant in this conversation",
          });
        }
        return {
          messages: [],
          nextCursor: undefined,
        };
      }
    }),

  /**
   * Send a message to a conversation (legacy ThinkPages procedure).
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        content: z.string().min(1),
        replyToId: z.string().optional(),
        attachments: z.array(z.any()).optional(),
        classification: z.string().optional(),
        priority: z.string().optional(),
        subject: z.string().optional(),
        signature: z.string().optional(),
        encryptedContent: z.string().optional(),
        status: z.string().optional(),
        mentions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      validateNoXSS(input.content);
      const principalId = ctx.auth.userId;

      // Ensure user matches principal if provided
      if (input.userId && input.userId !== principalId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User mismatch" });
      }

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        return await messagingService.sendMessage(principalId, {
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
   * Mark messages as read (legacy ThinkPages procedure).
   */
  markMessagesAsRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
        messageIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const principalId = ctx.auth.userId;
      if (input.userId && input.userId !== principalId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User mismatch" });
      }

      const messagingService = createMessagingService({
        db: ctx.db,
        notifications: notificationAPI,
        websocket: getThinkPagesServer(),
        forumBridge,
        wikiBridge: wikiTalkBridge,
      });

      try {
        return await messagingService.markMessagesAsRead(principalId, {
          conversationId: input.conversationId,
          messageIds: input.messageIds,
        });
      } catch (err: any) {
        if (err.name === "MessagingForbiddenError") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Not a participant in this conversation",
          });
        }
        throw err;
      }
    }),
});
