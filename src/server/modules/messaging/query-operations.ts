/**
 * Messaging Query Operations (Plan 163)
 *
 * Encapsulates read paths, message folder indexing, unread counters,
 * pagination cursor resolution, and user search.
 */

import {
  type GetConversationsByFolderInput,
  type GetConversationsLegacyInput,
  type GetConversationMessagesInput,
  type SearchUsersInput,
  type MessagingDependencies,
} from "./contracts";
import { MessagingForbiddenError } from "./errors";
import { formatMessagesConversation, formatThinkpagesConversation } from "./formatters";
import { recordMessagingTelemetry } from "./telemetry";
import { batchResolveMessagingAccounts } from "./account-resolver";

const FOLDER_SOURCES = new Set(["diplomatic", "wiki", "forum"]);
const COUNTED_SOURCES = ["thinktank", "diplomatic", "wiki", "forum"] as const;

const CONVERSATION_DETAIL_INCLUDE = {
  participants: { where: { isActive: true } },
  thinktankGroup: { include: { members: { where: { isActive: true } } } },
  messages: { take: 1, orderBy: { ixTimeTimestamp: "desc" } },
} as const;

export class MessagingQueryOperations {
  private db: any;
  private forumBridge?: any;
  private wikiBridge?: any;
  private telemetry?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.forumBridge = dependencies.forumBridge;
    this.wikiBridge = dependencies.wikiBridge;
    this.telemetry = dependencies.telemetry;
  }

  /** Accounts for the actor, every listed participant and every last-message sender. */
  private resolveListAccounts(conversations: any[], actorId: string) {
    const userIds: string[] = [actorId];
    for (const conv of conversations) {
      for (const p of conv.participants) userIds.push(p.userId);
      if (conv.messages?.[0]) userIds.push(conv.messages[0].userId);
    }
    return batchResolveMessagingAccounts(userIds, this.db);
  }

  /** Unread message count per conversation (messages from others after the actor's last read). */
  private async unreadCounts(conversationIds: string[], actorId: string) {
    const unreadMap = new Map<string, number>();
    if (conversationIds.length === 0) return unreadMap;

    const myParticipants =
      (await this.db.conversationParticipant.findMany({
        where: { conversationId: { in: conversationIds }, userId: actorId },
      })) ?? [];
    for (const mp of myParticipants) unreadMap.set(mp.conversationId, 0);
    if (myParticipants.length === 0) return unreadMap;

    const unreadMessages =
      (await this.db.thinkshareMessage.findMany({
        where: {
          OR: myParticipants.map((mp: any) => ({
            conversationId: mp.conversationId,
            ixTimeTimestamp: { gt: mp.lastReadAt || new Date(0) },
          })),
          userId: { not: actorId },
          deletedAt: null,
        },
        select: { conversationId: true },
      })) ?? [];
    for (const msg of unreadMessages) {
      unreadMap.set(msg.conversationId, (unreadMap.get(msg.conversationId) ?? 0) + 1);
    }
    return unreadMap;
  }

  /** Runs a list query and records its success/failure telemetry. */
  private async withTelemetry<T>(
    surface: "messages" | "thinkpages",
    procedure: string,
    actorId: string,
    run: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const record = (authenticated: boolean, success: boolean) =>
      recordMessagingTelemetry(
        { surface, procedure, authenticated, success, durationMs: Date.now() - startTime },
        this.telemetry
      );

    try {
      const result = await run();
      record(true, true);
      return result;
    } catch (err) {
      record(Boolean(actorId), false);
      throw err;
    }
  }

  /** Removes the look-ahead row from a `limit + 1` page and returns its lastActivity as the next cursor. */
  private popNextCursor(conversations: any[], limit: number): string | undefined {
    if (conversations.length <= limit) return undefined;
    return conversations.pop()!.lastActivity?.toISOString();
  }

  public getConversationsByFolder(actorId: string, input: GetConversationsByFolderInput) {
    return this.withTelemetry("messages", "getConversationsByFolder", actorId, async () => {
      if (this.forumBridge?.syncInbound) {
        await this.forumBridge.syncInbound(actorId, this.db).catch(() => {});
      }
      if (this.wikiBridge?.syncInbound) {
        await this.wikiBridge.syncInbound(actorId, this.db).catch(() => {});
      }

      const limit = input.limit ?? 20;
      const { folder, cursor } = input;
      const isMember = { userId: actorId, isActive: true };

      const where: any =
        folder === "thinktank" || folder === "groups"
          ? {
              source: "thinktank",
              OR: [
                { participants: { some: isMember } },
                { thinktankGroup: { members: { some: isMember } } },
              ],
            }
          : {
              participants: { some: isMember },
              source: FOLDER_SOURCES.has(folder) ? folder : { not: "thinktank" },
            };

      if (cursor) {
        where.lastActivity = { lt: new Date(cursor) };
      }

      const conversations = await this.db.thinkshareConversation.findMany({
        where,
        take: limit + 1,
        orderBy: { lastActivity: "desc" },
        include: {
          participants: { where: { isActive: true } },
          thinktankGroup: true,
          messages: {
            take: 1,
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      const nextCursor = this.popNextCursor(conversations, limit) ?? null;

      const accountMap = await this.resolveListAccounts(conversations, actorId);
      const unreadMap = await this.unreadCounts(
        conversations.map((c: any) => c.id),
        actorId
      );

      return {
        conversations: conversations.map((conv: any) =>
          formatMessagesConversation(conv, actorId, accountMap, unreadMap.get(conv.id) ?? 0)
        ),
        nextCursor,
      };
    });
  }

  public async getFolderCounts(actorId: string) {
    // ConversationParticipant has no archive/trash state (archive and mute are client-side
    // only), so those folders carry no counts.
    const counts = {
      inbox: 0,
      thinktank: 0,
      diplomatic: 0,
      wiki: 0,
      forum: 0,
    };

    if (!actorId) return counts;

    const activeParticipants = await this.db.conversationParticipant.findMany({
      where: { userId: actorId, isActive: true },
      include: {
        conversation: { select: { id: true, source: true } },
      },
    });

    if (activeParticipants.length === 0) return counts;

    // Count unread per conversation in SQL: loading every received message row hit the
    // 1000-row findMany guard and undercounted badges for busy users.
    const rows: { conversationId: string; unread: number }[] = await this.db.$queryRaw`
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS unread
      FROM "ThinkshareMessage" m
      JOIN "ConversationParticipant" p
        ON p."conversationId" = m."conversationId"
       AND p."userId" = ${actorId}
       AND p."isActive" = true
      WHERE m."userId" <> ${actorId}
        AND m."deletedAt" IS NULL
        AND m."ixTimeTimestamp" > p."lastReadAt"
      GROUP BY m."conversationId"
    `;
    const convUnreadCounts = new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));

    for (const p of activeParticipants) {
      const unread = convUnreadCounts.get(p.conversationId) || 0;
      if (unread === 0) continue;
      counts.inbox += unread;
      const src = p.conversation?.source;
      if (COUNTED_SOURCES.includes(src)) counts[src as (typeof COUNTED_SOURCES)[number]] += unread;
    }

    return counts;
  }

  public async getConversation(actorId: string, conversationId: string) {
    let conv = await this.db.thinkshareConversation.findFirst({
      where: {
        OR: [
          { id: conversationId },
          { sourceId: conversationId },
          { thinktankGroup: { id: conversationId } },
          { thinktankGroup: { conversationId: conversationId } },
        ],
      },
      include: CONVERSATION_DETAIL_INCLUDE,
    });

    // Auto-create/heal ThinkTank conversation if missing
    if (!conv) {
      const group = await this.db.thinktankGroup.findFirst({
        where: {
          OR: [{ id: conversationId }, { conversationId: conversationId }],
        },
        include: {
          members: { where: { isActive: true } },
        },
      });

      if (group) {
        const newConv = await this.db.thinkshareConversation.create({
          data: {
            type: "group",
            name: group.name,
            avatar: group.avatar,
            source: "thinktank",
            sourceId: group.id,
            participants: {
              create: group.members.map((m: any) => ({
                userId: m.userId,
                role: m.role === "owner" || m.role === "admin" ? "admin" : "participant",
              })),
            },
          },
        });

        await this.db.thinktankGroup.update({
          where: { id: group.id },
          data: { conversationId: newConv.id },
        });

        conv = await this.db.thinkshareConversation.findUnique({
          where: { id: newConv.id },
          include: CONVERSATION_DETAIL_INCLUDE,
        });
      }
    }

    if (!conv) return null;

    // Ensure actor is in participants if group is public or user is already a member
    if (
      actorId &&
      !conv.participants.some((p: any) => p.userId === actorId) &&
      (conv.source === "thinktank" || conv.type === "group")
    ) {
      await this.db.conversationParticipant
        .create({
          data: {
            conversationId: conv.id,
            userId: actorId,
            role: "participant",
          },
        })
        .catch(() => {});
    }

    const userIdsToResolve: string[] = [actorId];
    for (const p of conv.participants || []) userIdsToResolve.push(p.userId);
    if (conv.thinktankGroup?.members) {
      for (const m of conv.thinktankGroup.members) userIdsToResolve.push(m.userId);
    }
    if (conv.messages?.[0]) userIdsToResolve.push(conv.messages[0].userId);

    const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

    const unreadCount = await this.db.thinkshareMessage.count({
      where: {
        conversationId: conv.id,
        userId: { not: actorId },
        deletedAt: null,
      },
    });

    return formatMessagesConversation(conv, actorId, accountMap, unreadCount);
  }

  public getConversationsLegacy(actorId: string, input: GetConversationsLegacyInput) {
    return this.withTelemetry("thinkpages", "getConversations", actorId, async () => {
      const limit = input.limit ?? 20;
      const where: any = {
        participants: {
          some: { userId: actorId, isActive: true },
        },
        source: { not: "thinktank" },
      };

      if (input.cursor) {
        where.lastActivity = { lt: new Date(input.cursor) };
      }

      const conversations = await this.db.thinkshareConversation.findMany({
        where,
        take: limit + 1,
        orderBy: { lastActivity: "desc" },
        include: {
          participants: { where: { isActive: true } },
          messages: {
            take: 1,
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      const nextCursor = this.popNextCursor(conversations, limit);

      const accountMap = await this.resolveListAccounts(conversations, actorId);
      const unreadMap = await this.unreadCounts(
        conversations.map((c: any) => c.id),
        actorId
      );

      return {
        conversations: conversations.map((conv: any) =>
          formatThinkpagesConversation(conv, actorId, accountMap, unreadMap.get(conv.id) ?? 0)
        ),
        nextCursor,
      };
    });
  }

  public async getConversationMessages(actorId: string, input: GetConversationMessagesInput) {
    const { conversationId, limit = 50, cursor, direction = "before" } = input;

    const conv = await this.db.thinkshareConversation.findFirst({
      where: {
        OR: [
          { id: conversationId },
          { sourceId: conversationId },
          { thinktankGroup: { id: conversationId } },
        ],
      },
    });

    const targetConvId = conv?.id || conversationId;

    let participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: targetConvId, userId: actorId, isActive: true },
    });

    // For ThinkTank groups or public discussions, auto-enroll or allow read
    if (!participant && conv && (conv.source === "thinktank" || conv.type === "group")) {
      participant = await this.db.conversationParticipant
        .create({
          data: {
            conversationId: targetConvId,
            userId: actorId,
            role: "participant",
          },
        })
        .catch(() => null);
    }

    if (!participant) {
      throw new MessagingForbiddenError();
    }

    const where: any = { conversationId: targetConvId };

    if (cursor) {
      where.ixTimeTimestamp =
        direction === "after" ? { gt: new Date(cursor) } : { lt: new Date(cursor) };
    }

    const messages = await this.db.thinkshareMessage.findMany({
      where,
      take: limit + 1,
      orderBy: { ixTimeTimestamp: direction === "after" ? "asc" : "desc" },
      include: {
        replyTo: true,
      },
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const nextItem = messages.pop()!;
      nextCursor = nextItem.ixTimeTimestamp.toISOString();
    }

    const orderedMessages = direction === "after" ? messages : messages.reverse();

    const userIdsToResolve: string[] = [actorId];
    for (const m of orderedMessages) {
      userIdsToResolve.push(m.userId);
      if (m.replyTo) userIdsToResolve.push(m.replyTo.userId);
    }

    const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

    return {
      messages: orderedMessages,
      accountMap,
      nextCursor,
    };
  }

  public async searchUsers(_actorId: string, input: SearchUsersInput) {
    const limit = input.limit ?? 20;
    const users = await this.db.user.findMany({
      where: {
        OR: [
          { country: { name: { contains: input.query, mode: "insensitive" } } },
          { country: { slug: { contains: input.query, mode: "insensitive" } } },
        ],
      },
      include: { country: true },
      take: limit,
    });

    return users.map((u: any) => ({
      id: u.clerkUserId,
      username: u.country?.slug ?? u.clerkUserId,
      displayName: u.country?.name ?? "Unknown",
      profileImageUrl: u.country?.flag ?? null,
      accountType: "country" as const,
    }));
  }
}
