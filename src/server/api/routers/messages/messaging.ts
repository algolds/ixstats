/**
 * Unified Messages Router (Phase 2 + Phase 3)
 *
 * Provides folder-aware messaging endpoints that work across all message sources
 * (thinkshare, thinktank, diplomatic, wiki, forum).
 *
 * Phase 3: Bridge adapters for wiki talk pages and forum conversations.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { validateNoXSS } from "~/lib/utils";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { forumBridge } from "~/server/bridges/forum-bridge";

// ─── User Profile Cache (batch lookup) ───────────────────────────

type UserAccount = {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  accountType: "country";
};

/** Batch-resolve userIds to display accounts. Single query instead of N+1. */
async function batchResolveUsers(userIds: string[], db: any): Promise<Map<string, UserAccount>> {
  const map = new Map<string, UserAccount>();
  if (userIds.length === 0) return map;

  const unique = [...new Set(userIds)];

  // Separate bridge-prefixed IDs from real clerkUserIds
  const realIds: string[] = [];
  const forumKeys: { key: string; raw: string }[] = []; // raw = part after "forum:"
  const wikiNames: string[] = [];

  for (const id of unique) {
    if (id.startsWith("forum:")) {
      forumKeys.push({ key: id, raw: id.slice(6) });
    } else if (id.startsWith("wiki:")) {
      wikiNames.push(id.slice(5));
    } else {
      realIds.push(id);
    }
  }

  // 1. Resolve real clerkUserIds
  if (realIds.length > 0) {
    const users = await db.user.findMany({
      where: { clerkUserId: { in: realIds } },
      include: { country: true },
    });
    for (const u of users) {
      map.set(u.clerkUserId, {
        id: u.clerkUserId,
        username: u.country?.slug ?? u.clerkUserId,
        displayName: u.country?.name ?? "Unknown",
        profileImageUrl: u.country?.flag ?? null,
        accountType: "country",
      });
    }

    // Fallback: unresolved real IDs might be countryIds (diplomatic channels)
    const unresolvedReal = realIds.filter((id) => !map.has(id));
    if (unresolvedReal.length > 0) {
      const countries = await db.country.findMany({
        where: { id: { in: unresolvedReal } },
      });
      for (const c of countries) {
        map.set(c.id, {
          id: c.id,
          username: c.slug,
          displayName: c.name,
          profileImageUrl: c.flag ?? null,
          accountType: "country",
        });
      }
    }
  }

  // 2. Resolve forum:* IDs — try by forumUserId (numeric) or forumUsername
  if (forumKeys.length > 0) {
    const numericIds = forumKeys.map((f) => parseInt(f.raw, 10)).filter((n) => !isNaN(n));
    const nameKeys = forumKeys.filter((f) => isNaN(parseInt(f.raw, 10)));

    // Try numeric forumUserId lookup
    if (numericIds.length > 0) {
      const forumUsers = await db.user.findMany({
        where: { forumUserId: { in: numericIds } },
        include: { country: true },
      });
      for (const u of forumUsers) {
        map.set(`forum:${u.forumUserId}`, {
          id: `forum:${u.forumUserId}`,
          username: u.forumUsername ?? u.country?.slug ?? `forum-${u.forumUserId}`,
          displayName: u.forumUsername ?? u.country?.name ?? `Forum User`,
          profileImageUrl: u.country?.flag ?? null,
          accountType: "country",
        });
      }
    }

    // Try forumUsername lookup for name-based IDs
    if (nameKeys.length > 0) {
      const forumUsersByName = await db.user.findMany({
        where: { forumUsername: { in: nameKeys.map((f) => f.raw) } },
        include: { country: true },
      });
      for (const u of forumUsersByName) {
        map.set(`forum:${u.forumUsername}`, {
          id: `forum:${u.forumUsername}`,
          username: u.forumUsername ?? u.country?.slug ?? "forum-user",
          displayName: u.country?.name ?? u.forumUsername ?? "Forum User",
          profileImageUrl: u.country?.flag ?? null,
          accountType: "country",
        });
      }
    }

    // Fallback: use the raw value (username or ID) as the display name
    for (const f of forumKeys) {
      if (!map.has(f.key)) {
        map.set(f.key, {
          id: f.key,
          username: f.raw,
          displayName: f.raw,
          profileImageUrl: null,
          accountType: "country",
        });
      }
    }
  }

  // 3. Resolve wiki:Username IDs
  if (wikiNames.length > 0) {
    const wikiUsers = await db.user.findMany({
      where: { wikiUsername: { in: wikiNames } },
      include: { country: true },
    });
    for (const u of wikiUsers) {
      map.set(`wiki:${u.wikiUsername}`, {
        id: `wiki:${u.wikiUsername}`,
        username: u.wikiUsername ?? u.country?.slug ?? "wiki-user",
        displayName: u.wikiUsername ?? u.country?.name ?? "Wiki User",
        profileImageUrl: u.country?.flag ?? null,
        accountType: "country",
      });
    }
    // For unresolved wiki names, use the username directly
    for (const name of wikiNames) {
      const key = `wiki:${name}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          username: name,
          displayName: name,
          profileImageUrl: null,
          accountType: "country",
        });
      }
    }
  }

  return map;
}

// ─── Shared Schemas ──────────────────────────────────────────────

const _MessageFolderSchema = z.enum([
  "inbox",
  "personal",
  "diplomatic",
  "discussions",
  "groups",
  "system",
  "conversations",
]);

const _MessageSourceSchema = z.enum([
  "thinkshare",
  "thinktank",
  "diplomatic",
  "wiki",
  "forum",
  "system",
]);

// ─── Router ──────────────────────────────────────────────────────

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
      const principalId = ctx.auth.userId;

      // Verify participant
      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: input.conversationId,
          userId: principalId,
          isActive: true,
        },
      });

      if (!participant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this conversation",
        });
      }

      const messages = await ctx.db.thinkshareMessage.findMany({
        where: { conversationId: input.conversationId },
        take: input.limit + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
        orderBy: { ixTimeTimestamp: "desc" },
        include: {
          replyTo: true,
          readReceipts: true,
        },
      });

      // Batch resolve all message senders in one query
      const page = messages.slice(0, input.limit);
      const senderIds = [...new Set(page.map((m) => m.userId))];
      const userMap = await batchResolveUsers(senderIds, ctx.db);

      const defaultAccount: UserAccount = {
        id: "unknown",
        username: "unknown",
        displayName: "Unknown",
        profileImageUrl: null,
        accountType: "country",
      };

      // Synchronous enrichment — no more async per message
      const enriched = page.map((msg) => {
        const account = userMap.get(msg.userId) ?? {
          ...defaultAccount,
          id: msg.userId,
        };

        let reactions: Record<string, number> = {};
        try {
          reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
        } catch {
          /* empty */
        }

        let mentions: string[] = [];
        try {
          mentions = msg.mentions ? JSON.parse(msg.mentions) : [];
        } catch {
          /* empty */
        }

        let attachments: any[] = [];
        try {
          attachments = msg.attachments ? JSON.parse(msg.attachments) : [];
        } catch {
          /* empty */
        }

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          accountId: msg.userId,
          account,
          content: msg.content,
          messageType: msg.messageType,
          replyToId: msg.replyToId,
          replyTo: msg.replyTo
            ? {
                id: msg.replyTo.id,
                accountId: msg.replyTo.userId,
                content: msg.replyTo.content,
                ixTimeTimestamp: msg.replyTo.ixTimeTimestamp,
              }
            : null,
          reactions,
          mentions,
          attachments,
          isSystem: msg.isSystem,
          ixTimeTimestamp: msg.ixTimeTimestamp,
          createdAt: msg.ixTimeTimestamp,
          editedAt: msg.editedAt,
          deletedAt: msg.deletedAt,
          source: msg.source,
          classification: msg.classification,
          priority: msg.priority,
          subject: msg.subject,
          readReceipts: msg.readReceipts.map((r) => ({
            id: r.id,
            accountId: r.userId,
            readAt: r.readAt,
          })),
        };
      });

      const hasMore = messages.length > input.limit;
      const nextCursor = hasMore ? messages[input.limit - 1]?.id : undefined;

      return { messages: enriched, nextCursor };
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
      const principalId = ctx.auth.userId;

      // Validate content
      validateNoXSS(input.content);

      // Verify participant
      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: input.conversationId,
          userId: principalId,
          isActive: true,
        },
      });

      if (!participant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this conversation",
        });
      }

      // Get the conversation to inherit source
      const conversation = await ctx.db.thinkshareConversation.findUnique({
        where: { id: input.conversationId },
      });

      const message = await ctx.db.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: principalId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          reactions: "{}",
          mentions: input.mentions ? JSON.stringify(input.mentions) : "[]",
          attachments: input.attachments ? JSON.stringify(input.attachments) : "[]",
          source: conversation?.source ?? "thinkshare",
          classification: input.classification,
          priority: input.priority,
          subject: input.subject,
        },
      });

      // Update conversation lastActivity
      await ctx.db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() },
      });

      // Route outbound through bridge if external source
      if (conversation?.source === "wiki" && conversation.sourceId) {
        try {
          await wikiTalkBridge.sendOutbound(
            conversation.sourceId,
            input.content,
            principalId,
            ctx.db as any
          );
        } catch (err) {
          console.error("Wiki bridge outbound failed:", err);
        }
      } else if (conversation?.source === "forum" && conversation.sourceId) {
        try {
          await forumBridge.sendOutbound(
            conversation.sourceId,
            input.content,
            principalId,
            ctx.db as any
          );
        } catch (err) {
          console.error("Forum bridge outbound failed:", err);
        }
      }

      // Broadcast via WebSocket
      try {
        const wsServer = getThinkPagesServer();
        if (wsServer) {
          wsServer.broadcastMessage({
            type: "message:new",
            conversationId: input.conversationId,
            messageId: message.id,
            accountId: principalId,
            content: input.content,
            timestamp: Date.now(),
          });
        }
      } catch {
        // WebSocket not available
      }

      // Notify other participants
      const otherParticipants = await ctx.db.conversationParticipant.findMany({
        where: {
          conversationId: input.conversationId,
          userId: { not: principalId },
          isActive: true,
        },
      });

      for (const p of otherParticipants) {
        try {
          await notificationAPI.create({
            userId: p.userId,
            title: "New Message",
            message: `New message in ${conversation?.name ?? "conversation"}`,
            type: "info",
            category: "social",
            priority: "low",
          });
        } catch {
          // Notification delivery failure is non-fatal
        }
      }

      return message;
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
      const principalId = ctx.auth.userId;
      validateNoXSS(input.content);

      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      if (msg.userId !== principalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own messages",
        });
      }

      await ctx.db.thinkshareMessage.update({
        where: { id: input.messageId },
        data: {
          content: input.content,
          editedAt: new Date(),
        },
      });
      return { success: true };
    }),

  /**
   * Delete a message (soft delete).
   */
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const principalId = ctx.auth.userId;

      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      if (msg.userId !== principalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages",
        });
      }

      await ctx.db.thinkshareMessage.update({
        where: { id: input.messageId },
        data: {
          deletedAt: new Date(),
          content: "[deleted]",
        },
      });
      return { success: true };
    }),

  /**
   * Clear all system notifications for a user.
   */
  clearAllSystemNotifications: protectedProcedure
    .input(z.object({ userId: z.string().optional().default("") }))
    .mutation(async ({ ctx }) => {
      const principalId = ctx.auth.userId;

      const conversations = await ctx.db.thinkshareConversation.findMany({
        where: {
          participants: {
            some: { userId: principalId, isActive: true },
          },
          isActive: true,
          OR: [
            { source: "system" },
            {
              messages: { some: { isSystem: true } },
            },
          ],
        },
        select: { id: true },
      });

      const convIds = conversations.map((c) => c.id);

      if (convIds.length > 0) {
        await ctx.db.thinkshareMessage.updateMany({
          where: {
            conversationId: { in: convIds },
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            content: "[deleted]",
          },
        });
      }

      return { success: true };
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
      const principalId = ctx.auth.userId;

      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: msg.conversationId,
          userId: principalId,
          isActive: true,
        },
      });
      if (!participant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this conversation",
        });
      }

      let reactions: Record<string, number> = {};
      try {
        reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
      } catch {
        /* empty */
      }

      reactions[input.reaction] = (reactions[input.reaction] ?? 0) + 1;

      await ctx.db.thinkshareMessage.update({
        where: { id: input.messageId },
        data: { reactions: JSON.stringify(reactions) },
      });
      return { success: true };
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
      const principalId = ctx.auth.userId;

      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: msg.conversationId,
          userId: principalId,
          isActive: true,
        },
      });
      if (!participant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this conversation",
        });
      }

      let reactions: Record<string, number> = {};
      try {
        reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
      } catch {
        /* empty */
      }

      if (reactions[input.reaction]) {
        reactions[input.reaction]--;
        if (reactions[input.reaction] <= 0) {
          delete reactions[input.reaction];
        }
      }

      await ctx.db.thinkshareMessage.update({
        where: { id: input.messageId },
        data: { reactions: JSON.stringify(reactions) },
      });
      return { success: true };
    }),
});
