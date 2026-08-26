/**
 * Messaging Domain Service (Plan 163)
 *
 * Single domain service handling all business logic, transactions,
 * identity binding, collaborator fan-outs, and batch query loading.
 */

import {
  DEFAULT_USER_MESSAGE_CAP,
  type MessagingDependencies,
  type UserAccount,
  type GetConversationsByFolderInput,
  type GetConversationsLegacyInput,
  type GetConversationMessagesInput,
  type CreateConversationInput,
  type CreateConversationByCountriesInput,
  type SendMessageInput,
  type EditMessageInput,
  type DeleteMessageInput,
  type MarkMessagesAsReadInput,
  type AddReactionInput,
  type RemoveReactionInput,
  type AddParticipantInput,
  type LeaveConversationInput,
  type SearchUsersInput,
  type UpdatePresenceInput,
  type SendAdminBroadcastInput,
  type SendAdminMessageInput,
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

      const accountMap = await this.batchResolveUsers(userIdsToResolve);

      const unreadMap = new Map<string, number>();
      if (conversationIds.length > 0) {
        const myParticipants = (await this.db.conversationParticipant.findMany({
          where: {
            conversationId: { in: conversationIds },
            userId: actorId,
          },
        })) ?? [];

        for (const mp of myParticipants) {
          unreadMap.set(mp.conversationId, 0);
        }

        if (myParticipants.length > 0) {
          const unreadMessages = (await this.db.thinkshareMessage.findMany({
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
        convUnreadCounts.set(msg.conversationId, (convUnreadCounts.get(msg.conversationId) || 0) + 1);
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
          OR: [
            { id: conversationId },
            { conversationId: conversationId },
          ],
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

    const accountMap = await this.batchResolveUsers(userIdsToResolve);

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
      where.ixTimeTimestamp = direction === "after" ? { gt: new Date(cursor) } : { lt: new Date(cursor) };
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
          name: input.subject,
          type: isGroup ? "group" : "direct",
          channelType: input.channelId,
          source: input.source || "thinkshare",
          participants: {
            create: allParticipants.map((uid) => ({
              userId: uid,
              role: "participant",
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
    const conv =
      (await this.db.thinkshareConversation.findFirst?.({
        where: {
          OR: [
            { id: input.conversationId },
            { sourceId: input.conversationId },
            { thinktankGroup: { id: input.conversationId } },
          ],
        },
      })) ??
      (await this.db.thinkshareConversation.findUnique?.({
        where: { id: input.conversationId },
      }));

    const targetConvId = conv?.id || input.conversationId;

    let participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: targetConvId, userId: actorId, isActive: true },
      include: { conversation: true },
    });

    if (!participant && conv && (conv.source === "thinktank" || conv.type === "group")) {
      participant = await this.db.conversationParticipant
        .create({
          data: {
            conversationId: targetConvId,
            userId: actorId,
            role: "participant",
          },
          include: { conversation: true },
        })
        .catch(() => null);
    }

    if (!participant) {
      throw new MessagingForbiddenError();
    }

    const message = await this.db.$transaction(async (tx: any) => {
      const createdMsg = await tx.thinkshareMessage.create({
        data: {
          conversationId: targetConvId,
          userId: actorId,
          content: input.content,
          replyToId: input.replyToId,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          source: input.source || conv?.source || "thinkshare",
          subject: input.subject,
        },
        include: {
          replyTo: true,
        },
      });

      await tx.thinkshareConversation.update({
        where: { id: targetConvId },
        data: {
          lastActivity: new Date(),
          updatedAt: new Date(),
        },
      });

      return createdMsg;
    });

    const otherParticipants = await this.db.conversationParticipant.findMany({
      where: { conversationId: input.conversationId, userId: { not: actorId }, isActive: true },
    });

    const notifFn = this.notifications?.create ?? this.notifications?.createNotification;
    if (notifFn) {
      for (const p of otherParticipants) {
        notifFn.call(this.notifications, {
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

    const effectiveConv = {
      ...(participant?.conversation || {}),
      ...(conv || {}),
      source: conv?.source || (participant as any)?.conversation?.source,
      sourceId: conv?.sourceId || (participant as any)?.conversation?.sourceId,
    };

    if (effectiveConv?.source === "forum" && this.forumBridge?.postOutbound) {
      this.forumBridge.postOutbound({
        conversationId: input.conversationId,
        senderId: actorId,
        content: input.content,
      }).catch(() => {});
    }

    if (effectiveConv?.source === "wiki" && this.wikiBridge?.sendOutbound) {
      this.wikiBridge.sendOutbound(
        effectiveConv.sourceId || input.conversationId,
        input.content,
        actorId,
        this.db
      ).catch(() => {});
    }

    // Auto-prune default user messages beyond 1000 cap
    void this.pruneOldMessagesForUser(actorId, DEFAULT_USER_MESSAGE_CAP).catch(() => {});
    void this.pruneConversationMessages(targetConvId, DEFAULT_USER_MESSAGE_CAP).catch(() => {});

    return message;
  }

  public async editMessage(actorId: string, input: EditMessageInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError();
    if (msg.deletedAt) throw new MessagingForbiddenError("Cannot edit a deleted message");

    const updated = await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        content: input.content,
        editedAt: new Date(),
      },
    });

    return updated;
  }

  public async deleteMessage(actorId: string, input: DeleteMessageInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError();
    if (msg.deletedAt) return { success: true };

    await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        content: "This message was deleted",
        deletedAt: new Date(),
      },
    });

    return { success: true };
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

    if (input.messageIds && input.messageIds.length > 0 && this.db.messageReadReceipt?.createMany) {
      await this.db.messageReadReceipt
        .createMany({
          data: input.messageIds.map((msgId) => ({
            thinkshareMessageId: msgId,
            userId: actorId,
            messageType: "thinkshare",
          })),
        })
        .catch(() => {});
    }

    return { success: true };
  }

  public async markAllAsRead(actorId: string) {
    if (!actorId) return { success: true };
    await this.db.conversationParticipant.updateMany({
      where: { userId: actorId, isActive: true },
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
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
      include: { conversation: { include: { participants: true } } },
    });

    if (!msg) throw new MessagingNotFoundError();
    const isParticipant = msg.conversation?.participants.some(
      (p: any) => p.userId === actorId && p.isActive
    );
    if (!isParticipant) throw new MessagingForbiddenError();

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

  public async sendAdminBroadcast(actorId: string, input: SendAdminBroadcastInput) {
    const notification = await this.db.notification.create({
      data: {
        title: input.title,
        description: input.description,
        message: input.message || input.description,
        type: input.type || "system",
        category: input.category || "system",
        priority: input.level || "medium",
        href: input.href,
        userId: input.scope === "user" && input.userId ? input.userId : null,
        countryId: input.scope === "country" && input.countryId ? input.countryId : null,
        actionable: input.actionable ?? false,
        metadata: input.metadata ? (typeof input.metadata === "string" ? input.metadata : JSON.stringify(input.metadata)) : null,
      },
    });

    if (this.websocket?.broadcastMessage) {
      this.websocket.broadcastMessage({
        type: "notification:new",
        notification,
      });
    }

    return notification;
  }

  public async sendAdminMessage(actorId: string, input: SendAdminMessageInput) {
    if (!input.targetUserId) {
      throw new MessagingValidationError("targetUserId is required");
    }

    let conversation = await this.db.thinkshareConversation.findFirst({
      where: {
        type: "direct",
        source: input.source || "system",
        participants: {
          every: {
            userId: { in: [actorId, input.targetUserId] },
          },
        },
      },
      include: { participants: true },
    });

    if (!conversation) {
      conversation = await this.db.thinkshareConversation.create({
        data: {
          type: "direct",
          conversationType: input.conversationType || "official",
          diplomaticClassification: input.classification || null,
          source: input.source || "system",
          subject: input.subject || null,
          participants: {
            create: [
              { userId: actorId, role: "admin" },
              { userId: input.targetUserId, role: "member" },
            ],
          },
        },
        include: { participants: true },
      });
    }

    const message = await this.db.thinkshareMessage.create({
      data: {
        conversationId: conversation.id,
        userId: actorId,
        content: input.content,
        source: input.source || "system",
        classification: input.classification || null,
        subject: input.subject || null,
        isSystem: input.source === "system",
      },
    });

    await this.db.thinkshareConversation.update({
      where: { id: conversation.id },
      data: { lastActivity: new Date() },
    });

    if (this.websocket?.broadcastToUsers) {
      this.websocket.broadcastToUsers([input.targetUserId], "message:new", {
        type: "message:new",
        conversationId: conversation.id,
        messageId: message.id,
        accountId: actorId,
        content: input.content,
        timestamp: message.ixTimeTimestamp.toISOString(),
      });
    }

    return { success: true, conversationId: conversation.id, messageId: message.id };
  }

  /**
   * Auto-prune messages for default (non-exempt) users when exceeding artificial cap (1000).
   * Keeps the newest `cap` messages and removes the oldest excess messages.
   */
  public async pruneOldMessagesForUser(
    userId: string,
    cap: number = DEFAULT_USER_MESSAGE_CAP
  ): Promise<number> {
    try {
      const user = await this.db.user?.findFirst?.({
        where: { OR: [{ id: userId }, { clerkUserId: userId }] },
        include: { role: true },
      });

      const isExempt =
        user?.role?.name === "admin" ||
        user?.role?.name === "system-owner" ||
        user?.role?.name === "owner" ||
        user?.role?.name === "staff" ||
        user?.membershipTier === "premium" ||
        user?.membershipTier === "pro" ||
        user?.membershipTier === "vip";

      if (isExempt) return 0;

      const totalCount = await this.db.thinkshareMessage.count({
        where: { userId },
      });

      if (totalCount > cap) {
        const excess = totalCount - cap;
        const oldestMessages = await this.db.thinkshareMessage.findMany({
          where: { userId },
          orderBy: { ixTimeTimestamp: "asc" },
          take: excess,
          select: { id: true },
        });

        if (oldestMessages.length > 0) {
          const idsToDelete = oldestMessages.map((m: any) => m.id);
          const deleteResult = await this.db.thinkshareMessage.deleteMany({
            where: { id: { in: idsToDelete } },
          });
          return deleteResult.count;
        }
      }

      return 0;
    } catch (err) {
      console.error(`[MessagingService] Auto-prune error for user ${userId}:`, err);
      return 0;
    }
  }

  /**
   * Auto-prune older messages in a conversation when it exceeds the message cap.
   */
  public async pruneConversationMessages(
    conversationId: string,
    cap: number = DEFAULT_USER_MESSAGE_CAP
  ): Promise<number> {
    try {
      const totalCount = await this.db.thinkshareMessage.count({
        where: { conversationId },
      });

      if (totalCount > cap) {
        const excess = totalCount - cap;
        const oldestMessages = await this.db.thinkshareMessage.findMany({
          where: { conversationId },
          orderBy: { ixTimeTimestamp: "asc" },
          take: excess,
          select: { id: true },
        });

        if (oldestMessages.length > 0) {
          const idsToDelete = oldestMessages.map((m: any) => m.id);
          const deleteResult = await this.db.thinkshareMessage.deleteMany({
            where: { id: { in: idsToDelete } },
          });
          return deleteResult.count;
        }
      }

      return 0;
    } catch (err) {
      console.error(`[MessagingService] Auto-prune error for conversation ${conversationId}:`, err);
      return 0;
    }
  }
}

export function createMessagingService(dependencies: MessagingDependencies): MessagingService {
  return new MessagingService(dependencies);
}
