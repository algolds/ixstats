/**
 * Messaging Conversation Operations (Plan 163)
 *
 * Encapsulates conversation lifecycle, participant memberships,
 * presence states, discussion bridge sync, and admin dispatch.
 */

import {
  type CreateConversationInput,
  type CreateConversationByCountriesInput,
  type AddParticipantInput,
  type LeaveConversationInput,
  type UpdatePresenceInput,
  type SendAdminBroadcastInput,
  type SendAdminMessageInput,
  type MessagingDependencies,
} from "./contracts";
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";

export class MessagingConversationOperations {
  private db: any;
  private websocket?: any;
  private forumBridge?: any;
  private wikiBridge?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.websocket = dependencies.websocket;
    this.forumBridge = dependencies.forumBridge;
    this.wikiBridge = dependencies.wikiBridge;
  }

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

  public async sendAdminBroadcast(input: SendAdminBroadcastInput) {
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
        metadata: input.metadata
          ? typeof input.metadata === "string"
            ? input.metadata
            : JSON.stringify(input.metadata)
          : null,
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
}
