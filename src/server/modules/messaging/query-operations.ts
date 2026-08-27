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

  public async getConversationsByFolder(actorId: string, input: GetConversationsByFolderInput) {
    const startTime = Date.now();
    try {
      if (this.forumBridge?.syncInbound) {
        await this.forumBridge.syncInbound(actorId, this.db).catch(() => {});
      }
      if (this.wikiBridge?.syncInbound) {
        await this.wikiBridge.syncInbound(actorId, this.db).catch(() => {});
      }

      const limit = input.limit ?? 20;
      const { folder, cursor } = input;

      const where: any = {};

      if (folder === "thinktank" || folder === "groups") {
        where.source = "thinktank";
        where.OR = [
          {
            participants: {
              some: {
                userId: actorId,
                isActive: true,
              },
            },
          },
          {
            thinktankGroup: {
              members: {
                some: {
                  userId: actorId,
                  isActive: true,
                },
              },
            },
          },
        ];
      } else {
        where.participants = {
          some: {
            userId: actorId,
            isActive: true,
          },
        };
        where.source = { not: "thinktank" };
        if (folder === "diplomatic") {
          where.source = "diplomatic";
        } else if (folder === "wiki") {
          where.source = "wiki";
        } else if (folder === "forum") {
          where.source = "forum";
        }
      }

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

      let nextCursor: string | null = null;
      if (conversations.length > limit) {
        const nextItem = conversations.pop()!;
        nextCursor = nextItem.lastActivity ? nextItem.lastActivity.toISOString() : null;
      }

      const userIdsToResolve: string[] = [actorId];
      const conversationIds = conversations.map((c: any) => c.id);

      for (const conv of conversations) {
        for (const p of conv.participants) userIdsToResolve.push(p.userId);
        if (conv.messages?.[0]) userIdsToResolve.push(conv.messages[0].userId);
      }

      const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

      const unreadMap = new Map<string, number>();
      if (conversationIds.length > 0) {
        const myParticipants =
          (await this.db.conversationParticipant.findMany({
            where: {
              conversationId: { in: conversationIds },
              userId: actorId,
            },
          })) ?? [];

        for (const mp of myParticipants) {
          unreadMap.set(mp.conversationId, 0);
        }

        if (myParticipants.length > 0) {
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
        }
      }

      const formatted = conversations.map((conv: any) =>
        formatMessagesConversation(conv, actorId, accountMap, unreadMap.get(conv.id) ?? 0)
      );

      recordMessagingTelemetry(
        {
          surface: "messages",
          procedure: "getConversationsByFolder",
          authenticated: true,
          success: true,
          durationMs: Date.now() - startTime,
        },
        this.telemetry
      );

      return {
        conversations: formatted,
        nextCursor,
      };
    } catch (err) {
      recordMessagingTelemetry(
        {
          surface: "messages",
          procedure: "getConversationsByFolder",
          authenticated: Boolean(actorId),
          success: false,
          durationMs: Date.now() - startTime,
        },
        this.telemetry
      );
      throw err;
    }
  }

  public async getFolderCounts(actorId: string) {
    const counts = {
      inbox: 0,
      sent: 0,
      archive: 0,
      trash: 0,
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

    const conversationIds = activeParticipants.map((p: any) => p.conversationId);
    const unreadMessages = await this.db.thinkshareMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        userId: { not: actorId },
        deletedAt: null,
      },
      select: {
        conversationId: true,
        ixTimeTimestamp: true,
      },
    });

    const participantMap = new Map<string, any>(
      activeParticipants.map((p: any) => [p.conversationId, p])
    );
    const convUnreadCounts = new Map<string, number>();

    for (const msg of unreadMessages) {
      const p = participantMap.get(msg.conversationId);
      if (p && (!p.lastReadAt || msg.ixTimeTimestamp > p.lastReadAt)) {
        convUnreadCounts.set(
          msg.conversationId,
          (convUnreadCounts.get(msg.conversationId) || 0) + 1
        );
      }
    }

    for (const p of activeParticipants) {
      const unread = convUnreadCounts.get(p.conversationId) || 0;
      if (p.isArchived) {
        if (unread > 0) counts.archive += unread;
      } else if (p.isMuted) {
        if (unread > 0) counts.trash += unread;
      } else {
        if (unread > 0) {
          counts.inbox += unread;
          const src = p.conversation?.source;
          if (src === "thinktank") counts.thinktank += unread;
          else if (src === "diplomatic") counts.diplomatic += unread;
          else if (src === "wiki") counts.wiki += unread;
          else if (src === "forum") counts.forum += unread;
        }
      }
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
      include: {
        participants: { where: { isActive: true } },
        thinktankGroup: {
          include: {
            members: { where: { isActive: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { ixTimeTimestamp: "desc" },
        },
      },
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
          include: {
            participants: { where: { isActive: true } },
            thinktankGroup: {
              include: {
                members: { where: { isActive: true } },
              },
            },
            messages: {
              take: 1,
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
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

  public async getConversationsLegacy(actorId: string, input: GetConversationsLegacyInput) {
    const startTime = Date.now();
    try {
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

      let nextCursor: string | undefined = undefined;
      if (conversations.length > limit) {
        const nextItem = conversations.pop()!;
        nextCursor = nextItem.lastActivity ? nextItem.lastActivity.toISOString() : undefined;
      }

      const userIdsToResolve: string[] = [actorId];
      const conversationIds = conversations.map((c: any) => c.id);

      for (const conv of conversations) {
        for (const p of conv.participants) userIdsToResolve.push(p.userId);
        if (conv.messages?.[0]) userIdsToResolve.push(conv.messages[0].userId);
      }

      const accountMap = await batchResolveMessagingAccounts(userIdsToResolve, this.db);

      const unreadMap = new Map<string, number>();
      if (conversationIds.length > 0) {
        const myParticipants = await this.db.conversationParticipant.findMany({
          where: {
            conversationId: { in: conversationIds },
            userId: actorId,
          },
        });

        for (const mp of myParticipants) {
          const count = await this.db.thinkshareMessage.count({
            where: {
              conversationId: mp.conversationId,
              ixTimeTimestamp: { gt: mp.lastReadAt || new Date(0) },
              userId: { not: actorId },
              deletedAt: null,
            },
          });
          unreadMap.set(mp.conversationId, count);
        }
      }

      const formatted = conversations.map((conv: any) =>
        formatThinkpagesConversation(conv, actorId, accountMap, unreadMap.get(conv.id) ?? 0)
      );

      recordMessagingTelemetry(
        {
          surface: "thinkpages",
          procedure: "getConversations",
          authenticated: true,
          success: true,
          durationMs: Date.now() - startTime,
        },
        this.telemetry
      );

      return {
        conversations: formatted,
        nextCursor,
      };
    } catch (err) {
      recordMessagingTelemetry(
        {
          surface: "thinkpages",
          procedure: "getConversations",
          authenticated: Boolean(actorId),
          success: false,
          durationMs: Date.now() - startTime,
        },
        this.telemetry
      );
      throw err;
    }
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

  public async getPresenceForUsers(userIds: string[]) {
    if (userIds.length === 0) return {};

    const presenceList = await this.db.userPresence.findMany({
      where: { userId: { in: userIds } },
    });

    const result: Record<string, any> = {};
    for (const p of presenceList) {
      result[p.userId] = {
        status: p.status,
        lastSeenAt: p.lastSeenAt,
        currentCountryId: p.currentCountryId,
        customStatus: p.customStatus,
      };
    }

    return result;
  }
}
