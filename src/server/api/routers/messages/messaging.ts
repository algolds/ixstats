/**
 * Unified Messages Router — Messaging (Plan 163 Adapter)
 */

import { z } from "zod";
import {
  createTRPCRouter,
  readOnlyProcedure,
  adminProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { validateNoXSS } from "~/lib/utils";
import { MAX_MESSAGE_LENGTH, reactionsForViewer } from "~/server/modules/messaging";
import type { UserAccount } from "~/server/modules/messaging/contracts";
import { messagingFor, mapMessagingErrors } from "./_service";
import { AttachmentsSchema, SafeUrl } from "./_schemas";

/** A message body: bounded like a ThinkPages post, and refused (BAD_REQUEST) when it carries unsafe HTML. */
const MessageContent = z
  .string()
  .min(1)
  .max(MAX_MESSAGE_LENGTH)
  .refine((content) => validateNoXSS(content).valid, {
    message:
      "Message contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
  });

/** The accounts the resolver found, with a stand-in for one it did not. */
function accountOf(accountMap: Map<string, UserAccount>, userId: string): UserAccount {
  return (
    accountMap.get(userId) ?? {
      id: userId,
      username: userId,
      displayName: "Unknown",
      profileImageUrl: null,
      countryFlag: null,
      countryName: null,
      country: null,
      accountType: "country",
    }
  );
}

/** A stored JSON list (mentions, attachments): empty when absent or unreadable. */
function parseList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface MessageRow {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  messageType: string;
  replyToId: string | null;
  reactions: string | null;
  mentions: string | null;
  attachments: string | null;
  isSystem: boolean;
  ixTimeTimestamp: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  source: string;
  classification: string | null;
  priority: string | null;
  subject: string | null;
  replyTo: {
    id: string;
    userId: string;
    content: string;
    deletedAt: Date | null;
    ixTimeTimestamp: Date;
  } | null;
}

const DELETED_TEXT = "This message was deleted";

/**
 * A message as the client reads it. `reactions` is a count per emoji and `myReactions` the emojis the viewer
 * reacted with; `replyTo` carries the quoted message's sender in `account`.
 */
function toMessageDto(m: MessageRow, accountMap: Map<string, UserAccount>, viewerId: string) {
  const deleted = m.deletedAt !== null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    accountId: m.userId,
    account: accountOf(accountMap, m.userId),
    content: deleted ? DELETED_TEXT : m.content,
    messageType: m.messageType || "text",
    replyToId: m.replyToId,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          accountId: m.replyTo.userId,
          account: accountOf(accountMap, m.replyTo.userId),
          content: m.replyTo.deletedAt ? DELETED_TEXT : m.replyTo.content,
          ixTimeTimestamp: m.replyTo.ixTimeTimestamp,
        }
      : null,
    ...reactionsForViewer(m.reactions, viewerId),
    mentions: deleted ? [] : parseList(m.mentions),
    attachments: deleted ? [] : parseList(m.attachments),
    isSystem: m.isSystem,
    ixTimeTimestamp: m.ixTimeTimestamp,
    createdAt: m.ixTimeTimestamp,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    source: m.source || "thinkshare",
    classification: m.classification,
    priority: m.priority,
    subject: m.subject,
    // Per-message receipt rows are no longer kept (see markMessagesAsRead); "seen" comes from getSeenState.
    readReceipts: [] as { id: string; accountId: string; readAt: Date }[],
  };
}

export const messagesMessagingRouter = createTRPCRouter({
  /**
   * Get messages for a conversation (source-aware).
   */
  getConversationMessages: readOnlyProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        userId: z.string().optional().default(""),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        async () => {
          const result = await messagingService.getConversationMessages(ctx.auth.userId, {
            conversationId: input.conversationId,
            limit: input.limit,
            cursor: input.cursor,
          });

          const messages = result.messages.map((m) =>
            toMessageDto(m, result.accountMap, ctx.auth.userId)
          );

          return { messages, nextCursor: result.nextCursor };
        },
        { forbidden: "You are not a participant in this conversation" }
      );
    }),

  /**
   * Send a message (source-aware).
   */
  sendMessage: rateLimitedMutationProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string().optional().default(""),
        content: MessageContent,
        messageType: z.enum(["text", "image", "file"]).default("text"),
        replyToId: z.string().optional(),
        mentions: z.array(z.string().min(1).max(128)).max(50).optional(),
        attachments: AttachmentsSchema.optional(),
        // Diplomatic extensions
        classification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]).optional(),
        subject: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.sendMessage(ctx.auth.userId, {
            conversationId: input.conversationId,
            content: input.content,
            replyToId: input.replyToId,
            attachments: input.attachments,
            messageType: input.messageType,
            mentions: input.mentions,
            classification: input.classification,
            priority: input.priority,
            subject: input.subject,
          }),
        { forbidden: "You are not a participant in this conversation" }
      );
    }),

  /**
   * Edit a message.
   */
  editMessage: rateLimitedMutationProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: MessageContent,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        async () => {
          await messagingService.editMessage(ctx.auth.userId, {
            messageId: input.messageId,
            content: input.content,
          });
          return { success: true };
        },
        { forbidden: "You can only edit your own messages", notFound: "Message not found" }
      );
    }),

  /**
   * Delete a message (soft delete).
   */
  deleteMessage: rateLimitedMutationProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        async () => {
          await messagingService.deleteMessage(ctx.auth.userId, {
            messageId: input.messageId,
          });
          return { success: true };
        },
        { forbidden: "You can only delete your own messages", notFound: "Message not found" }
      );
    }),

  /**
   * Clear all system notifications for a user.
   */
  clearAllSystemNotifications: rateLimitedMutationProcedure
    .input(z.object({ userId: z.string().optional().default("") }))
    .mutation(async ({ ctx }) => {
      const messagingService = messagingFor(ctx);

      return await messagingService.clearAllSystemNotifications(ctx.auth.userId);
    }),

  /**
   * Add reaction to a message.
   */
  addReaction: rateLimitedMutationProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string().optional().default(""),
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.addReaction(ctx.auth.userId, {
            messageId: input.messageId,
            emoji: input.reaction,
          }),
        {
          forbidden: "You are not a participant in this conversation",
          notFound: "Message not found",
        }
      );
    }),

  /**
   * Remove reaction from a message.
   */
  removeReaction: rateLimitedMutationProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string().optional().default(""),
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      return await mapMessagingErrors(
        () =>
          messagingService.removeReaction(ctx.auth.userId, {
            messageId: input.messageId,
            emoji: input.reaction,
          }),
        {
          forbidden: "You are not a participant in this conversation",
          notFound: "Message not found",
        }
      );
    }),

  /**
   * Send an admin broadcast / platform alert / system notification.
   */
  sendAdminBroadcast: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        message: z.string().max(2000).optional(),
        category: z.string().optional().default("system"),
        level: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        type: z.string().optional().default("system"),
        // Rendered as a link in the notice card: a path on this site or an https: URL, never javascript: or //host.
        href: SafeUrl.optional(),
        scope: z.enum(["global", "country", "user"]).default("global"),
        countryId: z.string().optional(),
        userId: z.string().optional(),
        actionable: z.boolean().default(false),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

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
        // The same bounded, XSS-checked body as any message: a body carrying unsafe HTML is refused.
        content: MessageContent,
        subject: z.string().max(200).optional(),
        source: z
          .enum(["thinkshare", "thinktank", "diplomatic", "wiki", "forum", "system"])
          .default("system"),
        conversationType: z.enum(["personal", "diplomatic", "official"]).default("official"),
        classification: z
          .enum(["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messagingService = messagingFor(ctx);

      const actorId = ctx.auth?.userId || "system-admin";
      return await messagingService.sendAdminMessage(actorId, input);
    }),
});
