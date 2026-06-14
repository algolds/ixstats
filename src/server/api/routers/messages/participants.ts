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

export const messagesParticipantsRouter = createTRPCRouter({
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
});
