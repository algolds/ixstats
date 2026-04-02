/**
 * Unified Messages Router (Phase 2 + Phase 3)
 *
 * Provides folder-aware messaging endpoints that work across all message sources
 * (thinkshare, thinktank, diplomatic, wiki, forum).
 *
 * Phase 3: Bridge adapters for wiki talk pages and forum conversations.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { validateNoXSS } from "~/lib/sanitize-html";
import { notificationAPI } from "~/lib/notification-api";
import { getThinkPagesServer } from "~/server/websocket-server";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { forumBridge } from "~/modules/forum";

// ─── Shared Schemas ──────────────────────────────────────────────

const MessageFolderSchema = z.enum([
  "inbox",
  "personal",
  "diplomatic",
  "discussions",
  "groups",
  "system",
]);

const MessageSourceSchema = z.enum([
  "thinkshare",
  "thinktank",
  "diplomatic",
  "wiki",
  "forum",
  "system",
]);

// ─── Router ──────────────────────────────────────────────────────

export const messagesRouter = createTRPCRouter({
  /**
   * Get conversations filtered by folder — server-side folder classification.
   */
  getConversationsByFolder: publicProcedure
    .input(
      z.object({
        userId: z.string().optional().default(""),
        folder: MessageFolderSchema,
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!input.userId) return { conversations: [], nextCursor: undefined };

      const { folder, limit, cursor } = input;

      // Build where clause based on folder
      const baseWhere: any = {
        participants: {
          some: { userId: input.userId, isActive: true },
        },
        isActive: true,
      };

      switch (folder) {
        case "inbox":
          // All conversations — we'll filter by unread client-side or via subquery
          // For now, fetch recent and let client determine unread
          break;
        case "personal":
          baseWhere.source = "thinkshare";
          baseWhere.type = "direct";
          baseWhere.OR = [
            { conversationType: null },
            { conversationType: "personal" },
          ];
          break;
        case "diplomatic":
          baseWhere.OR = [
            { source: "diplomatic" },
            { conversationType: "diplomatic" },
          ];
          break;
        case "discussions":
          // Sync-on-demand: pull latest from wiki + forum before querying
          if (input.userId) {
            try {
              await Promise.all([
                wikiTalkBridge.syncInbound(input.userId, ctx.db),
                forumBridge.syncInbound(input.userId, ctx.db),
              ]);
            } catch {
              // Non-fatal: sync failures shouldn't block the query
            }
          }
          baseWhere.source = { in: ["wiki", "forum"] };
          break;
        case "groups":
          baseWhere.OR = [
            { source: "thinktank" },
            { type: "group", source: "thinkshare" },
          ];
          break;
        case "system":
          baseWhere.OR = [
            { source: "system" },
            {
              messages: { some: { isSystem: true } },
            },
          ];
          break;
      }

      const conversations = await ctx.db.thinkshareConversation.findMany({
        where: baseWhere,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { lastActivity: "desc" },
        include: {
          participants: {
            where: { isActive: true },
            include: {
              conversation: false,
            },
          },
          messages: {
            take: 1,
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      // Compute unread counts and enrich with user profile data
      const enriched = await Promise.all(
        conversations.slice(0, limit).map(async (conv) => {
          const participant = conv.participants.find(
            (p) => p.userId === input.userId
          );
          const lastReadAt = participant?.lastReadAt ?? new Date(0);

          const unreadCount = await ctx.db.thinkshareMessage.count({
            where: {
              conversationId: conv.id,
              userId: { not: input.userId },
              ixTimeTimestamp: { gt: lastReadAt },
              deletedAt: null,
            },
          });

          // Get other participants' display info
          const otherParticipants = conv.participants.filter(
            (p) => p.userId !== input.userId
          );

          const participantProfiles = await Promise.all(
            otherParticipants.map(async (p) => {
              // Try user lookup first
              const user = await ctx.db.user.findFirst({
                where: { clerkUserId: p.userId },
                include: { country: true },
              });

              // Fallback: try as countryId (for diplomatic channels)
              if (!user) {
                const country = await ctx.db.country.findUnique({
                  where: { id: p.userId },
                });
                if (country) {
                  return {
                    id: p.id,
                    accountId: p.userId,
                    isActive: p.isActive,
                    account: {
                      id: p.userId,
                      username: country.slug,
                      displayName: country.name,
                      profileImageUrl: country.flag ?? null,
                      accountType: "country" as const,
                    },
                  };
                }
              }

              return {
                id: p.id,
                accountId: p.userId,
                isActive: p.isActive,
                account: {
                  id: p.userId,
                  username: user?.country?.slug ?? p.userId,
                  displayName: user?.country?.name ?? "Unknown",
                  profileImageUrl: user?.country?.flag ?? null,
                  accountType: "country" as const,
                },
              };
            })
          );

          const lastMessage = conv.messages[0];
          let lastMessageAccount = null;
          if (lastMessage) {
            const sender = await ctx.db.user.findFirst({
              where: { clerkUserId: lastMessage.userId },
              include: { country: true },
            });
            lastMessageAccount = {
              id: lastMessage.userId,
              username: sender?.country?.slug ?? lastMessage.userId,
              displayName: sender?.country?.name ?? "Unknown",
              profileImageUrl: sender?.country?.flag ?? null,
              accountType: "country" as const,
            };
          }

          return {
            id: conv.id,
            type: conv.type,
            name: conv.name,
            avatar: conv.avatar,
            isActive: conv.isActive,
            lastActivity: conv.lastActivity,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            source: conv.source,
            sourceId: conv.sourceId,
            conversationType: conv.conversationType,
            diplomaticClassification: conv.diplomaticClassification,
            unreadCount,
            otherParticipants: participantProfiles,
            lastMessage: lastMessage
              ? {
                  id: lastMessage.id,
                  accountId: lastMessage.userId,
                  account: lastMessageAccount,
                  content: lastMessage.content,
                  ixTimeTimestamp: lastMessage.ixTimeTimestamp,
                  createdAt: lastMessage.ixTimeTimestamp,
                }
              : undefined,
          };
        })
      );

      // For inbox folder, filter to only unread
      const result =
        folder === "inbox"
          ? enriched.filter((c) => c.unreadCount > 0)
          : enriched;

      const hasMore = conversations.length > limit;
      const nextCursor = hasMore ? conversations[limit - 1]?.id : undefined;

      return { conversations: result, nextCursor };
    }),

  /**
   * Get unread counts per folder for the sidebar badges.
   */
  getFolderCounts: publicProcedure
    .input(z.object({ userId: z.string().optional().default("") }))
    .query(async ({ ctx, input }) => {
      if (!input.userId) {
        return {
          inbox: 0,
          personal: 0,
          diplomatic: 0,
          discussions: 0,
          groups: 0,
          system: 0,
        };
      }

      // Get all conversations this user participates in
      const participations = await ctx.db.conversationParticipant.findMany({
        where: { userId: input.userId, isActive: true },
        select: { conversationId: true, lastReadAt: true },
      });

      if (participations.length === 0) {
        return {
          inbox: 0,
          personal: 0,
          diplomatic: 0,
          discussions: 0,
          groups: 0,
          system: 0,
        };
      }

      const convIds = participations.map((p) => p.conversationId);
      const readMap = new Map(
        participations.map((p) => [p.conversationId, p.lastReadAt])
      );

      // Fetch all conversations with source info
      const conversations = await ctx.db.thinkshareConversation.findMany({
        where: { id: { in: convIds }, isActive: true },
        select: {
          id: true,
          type: true,
          source: true,
          conversationType: true,
        },
      });

      // Count unread per conversation
      const counts: Record<string, number> = {
        inbox: 0,
        personal: 0,
        diplomatic: 0,
        discussions: 0,
        groups: 0,
        system: 0,
      };

      for (const conv of conversations) {
        const lastRead = readMap.get(conv.id) ?? new Date(0);
        const unread = await ctx.db.thinkshareMessage.count({
          where: {
            conversationId: conv.id,
            userId: { not: input.userId },
            ixTimeTimestamp: { gt: lastRead },
            deletedAt: null,
          },
        });

        if (unread === 0) continue;

        // Classify folder
        let folder: string;
        if (
          conv.source === "diplomatic" ||
          conv.conversationType === "diplomatic"
        ) {
          folder = "diplomatic";
        } else if (conv.source === "thinktank" || conv.type === "group") {
          folder = "groups";
        } else if (
          conv.source === "wiki" ||
          conv.source === "forum"
        ) {
          folder = "discussions";
        } else if (conv.source === "system") {
          folder = "system";
        } else {
          folder = "personal";
        }

        counts[folder]! += unread;
        counts.inbox! += unread;
      }

      return counts;
    }),

  /**
   * Get messages for a conversation (source-aware).
   */
  getConversationMessages: publicProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        userId: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify participant
      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: input.conversationId,
          userId: input.userId,
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
        ...(input.cursor
          ? { skip: 1, cursor: { id: input.cursor } }
          : {}),
        orderBy: { ixTimeTimestamp: "desc" },
        include: {
          replyTo: true,
          readReceipts: true,
        },
      });

      // Enrich with user accounts
      const enriched = await Promise.all(
        messages.slice(0, input.limit).map(async (msg) => {
          const user = await ctx.db.user.findFirst({
            where: { clerkUserId: msg.userId },
            include: { country: true },
          });

          // Fallback: countryId for diplomatic
          let account;
          if (user) {
            account = {
              id: msg.userId,
              username: user.country?.slug ?? msg.userId,
              displayName: user.country?.name ?? "Unknown",
              profileImageUrl: user.country?.flag ?? null,
              accountType: "country" as const,
            };
          } else {
            const country = await ctx.db.country.findUnique({
              where: { id: msg.userId },
            });
            account = {
              id: msg.userId,
              username: country?.slug ?? msg.userId,
              displayName: country?.name ?? "Unknown",
              profileImageUrl: country?.flag ?? null,
              accountType: "country" as const,
            };
          }

          // Parse JSON fields
          let reactions: Record<string, number> = {};
          try {
            reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
          } catch { /* empty */ }

          let mentions: string[] = [];
          try {
            mentions = msg.mentions ? JSON.parse(msg.mentions) : [];
          } catch { /* empty */ }

          let attachments: any[] = [];
          try {
            attachments = msg.attachments ? JSON.parse(msg.attachments) : [];
          } catch { /* empty */ }

          return {
            id: msg.id,
            conversationId: msg.conversationId,
            accountId: msg.userId,
            account,
            content: msg.content,
            messageType: msg.messageType,
            ixTimeTimestamp: msg.ixTimeTimestamp,
            createdAt: msg.ixTimeTimestamp,
            reactions,
            mentions,
            attachments,
            replyTo: msg.replyTo
              ? { ...msg.replyTo, account: { displayName: "..." } }
              : undefined,
            readReceipts: msg.readReceipts.map((r) => ({
              id: r.id,
              accountId: r.userId,
              readAt: r.readAt,
            })),
            isSystem: msg.isSystem,
            editedAt: msg.editedAt,
            deletedAt: msg.deletedAt,
            source: msg.source,
          };
        })
      );

      const hasMore = messages.length > input.limit;
      const nextCursor = hasMore
        ? messages[input.limit - 1]?.id
        : undefined;

      return { messages: enriched, nextCursor };
    }),

  /**
   * Send a message (source-aware).
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
        content: z.string().min(1),
        messageType: z
          .enum(["text", "image", "file", "system"])
          .default("text"),
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
          .enum([
            "PUBLIC",
            "RESTRICTED",
            "CONFIDENTIAL",
            "SECRET",
            "TOP_SECRET",
          ])
          .optional(),
        priority: z
          .enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"])
          .optional(),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate content
      validateNoXSS(input.content);

      // Verify participant
      const participant = await ctx.db.conversationParticipant.findFirst({
        where: {
          conversationId: input.conversationId,
          userId: input.userId,
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
          userId: input.userId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          reactions: "{}",
          mentions: input.mentions ? JSON.stringify(input.mentions) : "[]",
          attachments: input.attachments
            ? JSON.stringify(input.attachments)
            : "[]",
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
            input.userId,
            ctx.db
          );
        } catch (err) {
          console.error("Wiki bridge outbound failed:", err);
        }
      } else if (conversation?.source === "forum" && conversation.sourceId) {
        try {
          await forumBridge.sendOutbound(
            conversation.sourceId,
            input.content,
            input.userId,
            ctx.db
          );
        } catch (err) {
          console.error("Forum bridge outbound failed:", err);
        }
      }

      // Broadcast via WebSocket
      try {
        const wsServer = getThinkPagesServer();
        if (wsServer) {
          wsServer.broadcast("message:new", {
            conversationId: input.conversationId,
            messageId: message.id,
            accountId: input.userId,
            content: input.content,
            timestamp: message.ixTimeTimestamp,
          });
        }
      } catch {
        // WebSocket not available
      }

      // Notify other participants
      const otherParticipants =
        await ctx.db.conversationParticipant.findMany({
          where: {
            conversationId: input.conversationId,
            userId: { not: input.userId },
            isActive: true,
          },
        });

      for (const p of otherParticipants) {
        try {
          await notificationAPI.createNotification({
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
   * Create a conversation (source-aware).
   */
  createConversation: protectedProcedure
    .input(
      z.object({
        participantIds: z.array(z.string().min(1)),
        source: MessageSourceSchema.optional().default("thinkshare"),
        name: z.string().optional(),
        conversationType: z
          .enum(["personal", "diplomatic", "official"])
          .optional(),
        diplomaticClassification: z
          .enum([
            "PUBLIC",
            "RESTRICTED",
            "CONFIDENTIAL",
            "SECRET",
            "TOP_SECRET",
          ])
          .optional(),
        priority: z
          .enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"])
          .optional(),
        encrypted: z.boolean().optional(),
        channelType: z
          .enum(["BILATERAL", "MULTILATERAL", "EMERGENCY"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { participantIds, source, ...metadata } = input;

      // Check for existing direct conversation between same participants
      if (participantIds.length <= 2 && source === "thinkshare") {
        const existingConvs =
          await ctx.db.thinkshareConversation.findMany({
            where: {
              type: "direct",
              source: "thinkshare",
              isActive: true,
              participants: {
                every: {
                  userId: { in: participantIds },
                  isActive: true,
                },
              },
            },
            include: {
              participants: { where: { isActive: true } },
            },
          });

        const existing = existingConvs.find(
          (c) => c.participants.length === participantIds.length
        );
        if (existing) return existing;
      }

      const conversation = await ctx.db.thinkshareConversation.create({
        data: {
          type: participantIds.length > 2 ? "group" : "direct",
          source,
          ...metadata,
          participants: {
            create: participantIds.map((userId) => ({
              userId,
              role: "participant",
            })),
          },
        },
        include: { participants: true },
      });

      // Notify participants
      for (const pid of participantIds) {
        if (pid !== ctx.auth?.userId) {
          try {
            await notificationAPI.createNotification({
              userId: pid,
              title: "New Conversation",
              message: "You've been added to a new conversation",
              type: "info",
              category: "social",
              priority: "low",
            });
          } catch {
            // Non-fatal
          }
        }
      }

      return conversation;
    }),

  /**
   * Mark messages as read.
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
      // Update participant lastReadAt
      await ctx.db.conversationParticipant.updateMany({
        where: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
        data: { lastReadAt: new Date() },
      });

      // Create specific read receipts if messageIds provided
      if (input.messageIds && input.messageIds.length > 0) {
        // Filter out already-read messages
        const existing = await ctx.db.messageReadReceipt.findMany({
          where: {
            thinkshareMessageId: { in: input.messageIds },
            userId: input.userId,
          },
          select: { thinkshareMessageId: true },
        });
        const existingIds = new Set(
          existing.map((e) => e.thinkshareMessageId)
        );
        const newIds = input.messageIds.filter(
          (id) => !existingIds.has(id)
        );

        if (newIds.length > 0) {
          await ctx.db.messageReadReceipt.createMany({
            data: newIds.map((msgId) => ({
              thinkshareMessageId: msgId,
              userId: input.userId,
              messageType: "thinkshare",
            })),
          });
        }
      }

      return { success: true };
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
   * Add reaction to a message.
   */
  addReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string(),
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      let reactions: Record<string, number> = {};
      try {
        reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
      } catch { /* empty */ }

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
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.thinkshareMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      let reactions: Record<string, number> = {};
      try {
        reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
      } catch { /* empty */ }

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

  /**
   * Search users for new conversation creation.
   */
  searchUsers: publicProcedure
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
        include: { country: true },
        take: 10,
      });

      return users;
    }),

  /**
   * Manually sync discussions from wiki talk pages and forum conversations.
   */
  syncDiscussions: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [wikiResult, forumResult] = await Promise.allSettled([
        wikiTalkBridge.syncInbound(input.userId, ctx.db),
        forumBridge.syncInbound(input.userId, ctx.db),
      ]);

      return {
        wiki:
          wikiResult.status === "fulfilled"
            ? wikiResult.value
            : { conversationsCreated: 0, conversationsUpdated: 0, messagesCreated: 0 },
        forum:
          forumResult.status === "fulfilled"
            ? forumResult.value
            : { conversationsCreated: 0, conversationsUpdated: 0, messagesCreated: 0 },
      };
    }),
});
