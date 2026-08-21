/**
 * Messaging Domain Service (Plan 163)
 *
 * Single domain service handling all business logic, transactions,
 * identity binding, collaborator fan-outs, and batch query loading.
 */

import type {
  MessagingDependencies,
  UserAccount,
  GetConversationsByFolderInput,
  GetConversationsLegacyInput,
  GetConversationMessagesInput,
  CreateConversationInput,
  CreateConversationByCountriesInput,
  SendMessageInput,
  EditMessageInput,
  DeleteMessageInput,
  MarkMessagesAsReadInput,
  AddReactionInput,
  RemoveReactionInput,
  AddParticipantInput,
  LeaveConversationInput,
  SearchUsersInput,
  UpdatePresenceInput,
} from "./contracts";
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";
import {
  formatMessagesConversation,
  formatThinkpagesConversation,
} from "./formatters";
import { recordMessagingTelemetry } from "./telemetry";
import { batchResolveMessagingAccounts } from "./account-resolver";

export class MessagingService {
  private db: any;
  private notifications?: any;
  private websocket?: any;
  private forumBridge?: any;
  private wikiBridge?: any;
  private telemetry?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.notifications = dependencies.notifications;
    this.websocket = dependencies.websocket;
    this.forumBridge = dependencies.forumBridge;
    this.wikiBridge = dependencies.wikiBridge;
    this.telemetry = dependencies.telemetry;
  }

  public async batchResolveUsers(userIds: string[]): Promise<Map<string, UserAccount>> {
    return await batchResolveMessagingAccounts(userIds, this.db);
  }

  // ─── Query Operations ──────────────────────────────────────────────────────

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

      const participantFilter: any = {
        userId: actorId,
        isActive: true,
      };

      if (folder === "archive") {
        participantFilter.isArchived = true;
      } else if (folder === "trash") {
        participantFilter.isMuted = true;
      } else {
        participantFilter.isArchived = false;
        participantFilter.isMuted = false;
      }

      const where: any = {
        participants: {
          some: participantFilter,
        },
      };

      if (folder === "thinktank") {
        where.source = "thinktank";
      } else if (folder === "diplomatic") {
        where.source = "diplomatic";
      } else if (folder === "wiki") {
        where.source = "wiki";
      } else if (folder === "forum") {
        where.source = "forum";
      }

      if (cursor) {
        where.lastMessageAt = { lt: new Date(cursor) };
      }

      const conversations = await this.db.thinkshareConversation.findMany({
        where,
        take: limit + 1,
        orderBy: { lastMessageAt: "desc" },
        include: {
          participants: { where: { isActive: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      let nextCursor: string | null = null;
      if (conversations.length > limit) {
        const nextItem = conversations.pop()!;
        nextCursor = nextItem.lastMessageAt ? nextItem.lastMessageAt.toISOString() : null;
      }

      const userIdsToResolve: string[] = [actorId];
      const conversationIds = conversations.map((c: any) => c.id);

      for (const conv of conversations) {
        for (const p of conv.participants) userIdsToResolve.push(p.userId);
        if (conv.messages?.[0]) userIdsToResolve.push(conv.messages[0].userId);
      }

      const accountMap = await this.batchResolveUsers(userIdsToResolve);

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
              createdAt: { gt: mp.lastReadAt || new Date(0) },
              userId: { not: actorId },
              isDeleted: false,
            },
          });
          unreadMap.set(mp.conversationId, count);
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

    const activeParticipants = await this.db.conversationParticipant.findMany({
      where: { userId: actorId, isActive: true },
      include: {
        conversation: { select: { id: true, source: true } },
      },
    });

    for (const p of activeParticipants) {
      if (p.isArchived) {
        counts.archive++;
      } else if (p.isMuted) {
        counts.trash++;
      } else {
        counts.inbox++;
        const src = p.conversation?.source;
        if (src === "thinktank") counts.thinktank++;
        else if (src === "diplomatic") counts.diplomatic++;
        else if (src === "wiki") counts.wiki++;
        else if (src === "forum") counts.forum++;
      }
    }

    return counts;
  }

  public async getConversationsLegacy(actorId: string, input: GetConversationsLegacyInput) {
    const startTime = Date.now();
    try {
      const limit = input.limit ?? 20;
      const where: any = {
        participants: {
          some: { userId: actorId, isActive: true },
        },
      };

      if (input.cursor) {
        where.lastMessageAt = { lt: new Date(input.cursor) };
      }

      const conversations = await this.db.thinkshareConversation.findMany({
        where,
        take: limit + 1,
        orderBy: { lastMessageAt: "desc" },
        include: {
          participants: { where: { isActive: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (conversations.length > limit) {
        const nextItem = conversations.pop()!;
        nextCursor = nextItem.lastMessageAt ? nextItem.lastMessageAt.toISOString() : undefined;
      }

      const userIdsToResolve: string[] = [actorId];
      const conversationIds = conversations.map((c: any) => c.id);

      for (const conv of conversations) {
        for (const p of conv.participants) userIdsToResolve.push(p.userId);
        if (conv.messages?.[0]) userIdsToResolve.push(conv.messages[0].userId);
      }

      const accountMap = await this.batchResolveUsers(userIdsToResolve);

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
              createdAt: { gt: mp.lastReadAt || new Date(0) },
              userId: { not: actorId },
              isDeleted: false,
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

    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId, userId: actorId, isActive: true },
    });

    if (!participant) {
      throw new MessagingForbiddenError();
    }

    const where: any = { conversationId };

    if (cursor) {
      where.createdAt = direction === "after" ? { gt: new Date(cursor) } : { lt: new Date(cursor) };
    }

    const messages = await this.db.thinkshareMessage.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: direction === "after" ? "asc" : "desc" },
      include: {
        reactions: true,
        replyTo: true,
      },
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const nextItem = messages.pop()!;
      nextCursor = nextItem.createdAt.toISOString();
    }

    const orderedMessages = direction === "after" ? messages : messages.reverse();

    const userIdsToResolve: string[] = [actorId];
    for (const m of orderedMessages) {
      userIdsToResolve.push(m.userId);
      if (m.replyTo) userIdsToResolve.push(m.replyTo.userId);
    }

    const accountMap = await this.batchResolveUsers(userIdsToResolve);

    return {
      messages: orderedMessages,
      accountMap,
      nextCursor,
    };
  }

  // ─── Write Operations ──────────────────────────────────────────────────────

  public async createConversation(actorId: string, input: CreateConversationInput) {
    const allParticipants = [...new Set([actorId, ...input.participantIds])];
    if (allParticipants.length < 2) {
      throw new MessagingValidationError("A conversation requires at least 2 participants");
    }

    const isGroup = allParticipants.length > 2;

    return await this.db.$transaction(async (tx: any) => {
      const conversation = await tx.thinkshareConversation.create({
        data: {
          subject: input.subject,
          isGroup,
          channelId: input.channelId,
          source: input.source || "thinkshare",
          participants: {
            create: allParticipants.map((uid) => ({
              userId: uid,
              role: uid === actorId ? "admin" : "member",
            })),
          },
        },
        include: {
          participants: true,
        },
      });

      if (input.initialMessage) {
        await tx.thinkshareMessage.create({
          data: {
            conversationId: conversation.id,
            userId: actorId,
            content: input.initialMessage,
            source: input.source || "thinkshare",
          },
        });
      }

      return conversation;
    });
  }

  public async createConversationByCountries(
    actorId: string,
    input: CreateConversationByCountriesInput
  ) {
    const users = await this.db.user.findMany({
      where: { countryId: { in: input.countryIds } },
      select: { clerkUserId: true },
    });

    const targetUserIds = users.map((u: any) => u.clerkUserId).filter(Boolean);
    return await this.createConversation(actorId, {
      participantIds: targetUserIds,
      subject: input.subject,
      initialMessage: input.initialMessage,
      source: input.source || "diplomatic",
    });
  }

  public async sendMessage(actorId: string, input: SendMessageInput) {
    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: input.conversationId, userId: actorId, isActive: true },
      include: { conversation: true },
    });

    if (!participant) {
      throw new MessagingForbiddenError();
    }

    const conv = participant.conversation;

    const message = await this.db.$transaction(async (tx: any) => {
      const createdMsg = await tx.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: actorId,
          content: input.content,
          replyToId: input.replyToId,
          attachments: input.attachments ?? [],
          source: input.source || conv?.source || "thinkshare",
          subject: input.subject,
        },
        include: {
          replyTo: true,
        },
      });

      await tx.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return createdMsg;
    });

    const otherParticipants = await this.db.conversationParticipant.findMany({
      where: { conversationId: input.conversationId, userId: { not: actorId }, isActive: true },
    });

    if (this.notifications?.create) {
      for (const p of otherParticipants) {
        this.notifications.create({
          userId: p.userId,
          type: "info",
          category: "social",
          priority: "low",
          title: "New Message",
          message: input.content.slice(0, 100),
          href: `/messages?id=${input.conversationId}`,
        }).catch(() => {});
      }
    }

    if (this.websocket?.broadcastToUsers) {
      const allRecipientIds = otherParticipants.map((p: any) => p.userId);
      this.websocket.broadcastToUsers(allRecipientIds, "message:new", {
        conversationId: input.conversationId,
        message,
      });
    } else if (this.websocket?.broadcastMessage) {
      this.websocket.broadcastMessage({
        type: "message:new",
        conversationId: input.conversationId,
        messageId: message.id,
        accountId: actorId,
        content: input.content,
        timestamp: Date.now(),
      });
    }

    if (conv?.source === "forum" && this.forumBridge?.postOutbound) {
      this.forumBridge.postOutbound({
        conversationId: input.conversationId,
        senderId: actorId,
        content: input.content,
      }).catch(() => {});
    }

    return message;
  }

  public async editMessage(actorId: string, input: EditMessageInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError("Cannot edit another user's message");
    if (msg.isDeleted) throw new MessagingValidationError("Cannot edit a deleted message");

    return await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        content: input.content,
        isEdited: true,
        updatedAt: new Date(),
      },
    });
  }

  public async deleteMessage(actorId: string, input: DeleteMessageInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError("Cannot delete another user's message");

    return await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        isDeleted: true,
        content: "This message was deleted",
        updatedAt: new Date(),
      },
    });
  }

  public async markMessagesAsRead(actorId: string, input: MarkMessagesAsReadInput) {
    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: input.conversationId, userId: actorId, isActive: true },
    });

    if (!participant) throw new MessagingForbiddenError();

    await this.db.conversationParticipant.updateMany({
      where: { conversationId: input.conversationId, userId: actorId },
      data: { lastReadAt: new Date() },
    });

    return { success: true };
  }

  public async addReaction(actorId: string, input: AddReactionInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
      include: { conversation: { include: { participants: true } } },
    });

    if (!msg) throw new MessagingNotFoundError();
    const isParticipant = msg.conversation?.participants.some(
      (p: any) => p.userId === actorId && p.isActive
    );
    if (!isParticipant) throw new MessagingForbiddenError();

    await this.db.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId: input.messageId,
          userId: actorId,
          emoji: input.emoji,
        },
      },
      create: {
        messageId: input.messageId,
        userId: actorId,
        emoji: input.emoji,
      },
      update: {},
    });

    return { success: true };
  }

  public async removeReaction(actorId: string, input: RemoveReactionInput) {
    await this.db.messageReaction.deleteMany({
      where: {
        messageId: input.messageId,
        userId: actorId,
        emoji: input.emoji,
      },
    });

    return { success: true };
  }

  public async addParticipant(actorId: string, input: AddParticipantInput) {
    const conv = await this.db.thinkshareConversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conv) throw new MessagingNotFoundError();
    const myP = conv.participants.find((p: any) => p.userId === actorId && p.isActive);
    if (!myP) throw new MessagingForbiddenError();

    await this.db.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.targetUserId,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: input.targetUserId,
        role: input.role || "member",
        isActive: true,
      },
      update: {
        isActive: true,
        role: input.role || "member",
      },
    });

    return { success: true };
  }

  public async leaveConversation(actorId: string, input: LeaveConversationInput) {
    await this.db.conversationParticipant.updateMany({
      where: { conversationId: input.conversationId, userId: actorId },
      data: { isActive: false },
    });

    return { success: true };
  }

  public async clearAllSystemNotifications(actorId: string) {
    await this.db.notification.deleteMany({
      where: { userId: actorId },
    });
    return { success: true };
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

  public async updatePresence(actorId: string, input: UpdatePresenceInput) {
    await this.db.userPresence.upsert({
      where: { userId: actorId },
      create: {
        userId: actorId,
        status: input.status,
        currentCountryId: input.currentCountryId,
        customStatus: input.customStatus,
        lastSeenAt: new Date(),
      },
      update: {
        status: input.status,
        currentCountryId: input.currentCountryId,
        customStatus: input.customStatus,
        lastSeenAt: new Date(),
      },
    });

    return { success: true };
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

  public async syncDiscussions(actorId: string) {
    const results = {
      forum: { synced: false },
      wiki: { synced: false },
    };

    if (this.forumBridge?.syncInbound) {
      await this.forumBridge.syncInbound(actorId, this.db);
      results.forum.synced = true;
    }

    if (this.wikiBridge?.syncInbound) {
      await this.wikiBridge.syncInbound(actorId, this.db);
      results.wiki.synced = true;
    }

    return results;
  }
}

export function createMessagingService(dependencies: MessagingDependencies): MessagingService {
  return new MessagingService(dependencies);
}
