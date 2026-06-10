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
import { validateNoXSS } from "~/lib/sanitize-html";
import { notificationAPI } from "~/lib/notification-api";
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

const MessageFolderSchema = z.enum([
  "inbox",
  "personal",
  "diplomatic",
  "discussions",
  "groups",
  "system",
  "conversations",
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

      // Fire-and-forget bridge sync for folders that need it (non-blocking)
      if ((folder === "inbox" || folder === "discussions") && input.userId) {
        Promise.allSettled([
          wikiTalkBridge.syncInbound(input.userId, ctx.db as any),
          forumBridge.syncInbound(input.userId, ctx.db as any),
        ]).catch((err: unknown) => {
          console.error("[Messages] Background op failed:", (err as Error).message);
        });
      }

      switch (folder) {
        case "conversations":
          baseWhere.source = { not: "system" };
          break;
        case "inbox":
          break;
        case "personal":
          baseWhere.source = "thinkshare";
          baseWhere.type = "direct";
          baseWhere.OR = [{ conversationType: null }, { conversationType: "personal" }];
          break;
        case "diplomatic":
          baseWhere.OR = [{ source: "diplomatic" }, { conversationType: "diplomatic" }];
          break;
        case "discussions":
          baseWhere.source = { in: ["wiki", "forum"] };
          break;
        case "groups":
          baseWhere.OR = [{ source: "thinktank" }, { type: "group", source: "thinkshare" }];
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

      // ── Batch enrichment (replaces N+1 loops) ──
      const page = conversations.slice(0, limit);

      // 1. Collect all userIds we need to resolve (participants + last message senders)
      const allUserIds = new Set<string>();
      for (const conv of page) {
        for (const p of conv.participants) allUserIds.add(p.userId);
        if (conv.messages[0]) allUserIds.add(conv.messages[0].userId);
      }
      allUserIds.delete(input.userId);

      // 2. Single batch query for all user profiles
      const userMap = await batchResolveUsers([...allUserIds], ctx.db);

      // 3. Batch unread counts — single query with groupBy
      const participantReadMap = new Map(
        page.map((c) => {
          const p = c.participants.find((pp) => pp.userId === input.userId);
          return [c.id, p?.lastReadAt ?? new Date(0)];
        })
      );

      // Batch unread counts: parallel Promise.all instead of sequential loop
      const unreadMap = new Map<string, number>();
      await Promise.all(
        page.map(async (conv) => {
          const lastRead = participantReadMap.get(conv.id) ?? new Date(0);
          const count = await ctx.db.thinkshareMessage.count({
            where: {
              conversationId: conv.id,
              userId: { not: input.userId },
              ixTimeTimestamp: { gt: lastRead },
              deletedAt: null,
            },
          });
          unreadMap.set(conv.id, count);
        })
      );

      // 4. Build enriched results (no more async per-item)
      const defaultAccount: UserAccount = {
        id: "unknown",
        username: "unknown",
        displayName: "Unknown",
        profileImageUrl: null,
        accountType: "country",
      };

      const enriched = page.map((conv) => {
        const otherParticipants = conv.participants
          .filter((p) => p.userId !== input.userId)
          .map((p) => ({
            id: p.id,
            accountId: p.userId,
            isActive: p.isActive,
            account: userMap.get(p.userId) ?? { ...defaultAccount, id: p.userId },
          }));

        const lastMessage = conv.messages[0];
        const lastMessageAccount = lastMessage
          ? (userMap.get(lastMessage.userId) ?? { ...defaultAccount, id: lastMessage.userId })
          : null;

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
          unreadCount: unreadMap.get(conv.id) ?? 0,
          otherParticipants,
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
      });

      // For inbox folder, filter to only unread
      const result = folder === "inbox" ? enriched.filter((c) => c.unreadCount > 0) : enriched;

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
      const readMap = new Map(participations.map((p) => [p.conversationId, p.lastReadAt]));

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

      // Batch unread counts in parallel (Promise.all instead of sequential loop)
      const unreadResults = await Promise.all(
        conversations.map(async (conv) => {
          const lastRead = readMap.get(conv.id) ?? new Date(0);
          const count = await ctx.db.thinkshareMessage.count({
            where: {
              conversationId: conv.id,
              userId: { not: input.userId },
              ixTimeTimestamp: { gt: lastRead },
              deletedAt: null,
            },
          });
          return { conv, count };
        })
      );

      const counts: Record<string, number> = {
        inbox: 0,
        personal: 0,
        diplomatic: 0,
        discussions: 0,
        groups: 0,
        system: 0,
        conversations: 0,
      };

      for (const { conv, count } of unreadResults) {
        if (count === 0) continue;

        let folder: string;
        if (conv.source === "diplomatic" || conv.conversationType === "diplomatic") {
          folder = "diplomatic";
        } else if (conv.source === "thinktank" || conv.type === "group") {
          folder = "groups";
        } else if (conv.source === "wiki" || conv.source === "forum") {
          folder = "discussions";
        } else if (conv.source === "system") {
          folder = "system";
        } else {
          folder = "personal";
        }

        counts[folder]! += count;
        counts.inbox! += count;
        if (folder !== "system") {
          counts.conversations! += count;
        }
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
          ixTimeTimestamp: msg.ixTimeTimestamp,
          createdAt: msg.ixTimeTimestamp,
          reactions,
          mentions,
          attachments,
          replyTo: msg.replyTo ? { ...msg.replyTo, account: { displayName: "..." } } : undefined,
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
        userId: z.string(),
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
            input.userId,
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
            input.userId,
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
      const otherParticipants = await ctx.db.conversationParticipant.findMany({
        where: {
          conversationId: input.conversationId,
          userId: { not: input.userId },
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
      const { participantIds, source, ...metadata } = input;

      // Check for existing direct conversation between same participants
      if (participantIds.length <= 2 && source === "thinkshare") {
        const existingConvs = await ctx.db.thinkshareConversation.findMany({
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

        const existing = existingConvs.find((c) => c.participants.length === participantIds.length);
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
            await notificationAPI.create({
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
   * Leave a conversation (marks participant as inactive).
   */
  leaveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId !== ctx.auth.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only leave conversations on behalf of yourself",
        });
      }

      // Check if participant exists
      const participant = await ctx.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
      });

      if (!participant || !participant.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You are not an active participant in this conversation",
        });
      }

      // Update participant to inactive
      await ctx.db.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });

      // Get user names for the system message
      const userMap = await batchResolveUsers([ctx.auth.userId], ctx.db);
      const callerName = userMap.get(ctx.auth.userId)?.displayName ?? "Someone";

      // Add system message
      await ctx.db.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: "system",
          content: `${callerName} left the conversation`,
          isSystem: true,
          messageType: "system",
        },
      });

      // Update last activity
      await ctx.db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() },
      });

      return { success: true };
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
      // 1. Verify caller is a participant in the conversation
      const callerParticipant = await ctx.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.auth.userId,
          },
        },
      });

      if (!callerParticipant || !callerParticipant.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be an active participant to add others",
        });
      }

      // 2. Get target conversation details
      const conversation = await ctx.db.thinkshareConversation.findUnique({
        where: { id: input.conversationId },
      });

      if (!conversation || !conversation.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // 3. Upsert participant
      const existingParticipant = await ctx.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId,
          },
        },
      });

      if (existingParticipant?.isActive) {
        return { success: true, alreadyParticipant: true };
      }

      if (existingParticipant) {
        await ctx.db.conversationParticipant.update({
          where: { id: existingParticipant.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
            leftAt: null,
          },
        });
      } else {
        await ctx.db.conversationParticipant.create({
          data: {
            conversationId: input.conversationId,
            userId: input.userId,
            isActive: true,
            role: "participant",
          },
        });
      }

      // If it was a direct conversation and is now becoming a multi-user group chat, we should upgrade the conversation type to "group"
      if (conversation.type === "direct") {
        await ctx.db.thinkshareConversation.update({
          where: { id: input.conversationId },
          data: { type: "group" },
        });
      }

      // 4. Create system message
      const userMap = await batchResolveUsers([ctx.auth.userId, input.userId], ctx.db);
      const callerName = userMap.get(ctx.auth.userId)?.displayName ?? "Someone";
      const targetName = userMap.get(input.userId)?.displayName ?? "Someone";

      await ctx.db.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: "system",
          content: `${callerName} added ${targetName} to the conversation`,
          isSystem: true,
          messageType: "system",
        },
      });

      // Update last activity
      await ctx.db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() },
      });

      return { success: true };
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
        const existingIds = new Set(existing.map((e) => e.thinkshareMessageId));
        const newIds = input.messageIds.filter((id) => !existingIds.has(id));

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
   * Clear all system notifications for a user.
   */
  clearAllSystemNotifications: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conversations = await ctx.db.thinkshareConversation.findMany({
        where: {
          participants: {
            some: { userId: input.userId, isActive: true },
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
        wikiTalkBridge.syncInbound(input.userId, ctx.db as any),
        forumBridge.syncInbound(input.userId, ctx.db as any),
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
