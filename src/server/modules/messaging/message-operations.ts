/**
 * Messaging Message Operations (Plan 163)
 *
 * Encapsulates message creation, editing, soft deletion,
 * read-state tracking, reactions, and automated quota pruning.
 */

import {
  DEFAULT_USER_MESSAGE_CAP,
  type SendMessageInput,
  type EditMessageInput,
  type DeleteMessageInput,
  type MarkMessagesAsReadInput,
  type AddReactionInput,
  type RemoveReactionInput,
  type MessagingDependencies,
} from "./contracts";
import { MessagingForbiddenError, MessagingNotFoundError } from "./errors";

export class MessagingMessageOperations {
  private db: any;
  private notifications?: any;
  private websocket?: any;
  private forumBridge?: any;
  private wikiBridge?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.notifications = dependencies.notifications;
    this.websocket = dependencies.websocket;
    this.forumBridge = dependencies.forumBridge;
    this.wikiBridge = dependencies.wikiBridge;
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
        notifFn
          .call(this.notifications, {
            userId: p.userId,
            type: "info",
            category: "social",
            priority: "low",
            title: "New Message",
            message: input.content.slice(0, 100),
            href: `/messages?id=${input.conversationId}`,
          })
          .catch(() => {});
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
      this.forumBridge
        .postOutbound({
          conversationId: input.conversationId,
          senderId: actorId,
          content: input.content,
        })
        .catch(() => {});
    }

    if (effectiveConv?.source === "wiki" && this.wikiBridge?.sendOutbound) {
      this.wikiBridge
        .sendOutbound(
          effectiveConv.sourceId || input.conversationId,
          input.content,
          actorId,
          this.db
        )
        .catch(() => {});
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
      console.error(`[MessagingMessageOperations] Auto-prune error for user ${userId}:`, err);
      return 0;
    }
  }

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
      console.error(
        `[MessagingMessageOperations] Auto-prune error for conversation ${conversationId}:`,
        err
      );
      return 0;
    }
  }
}
