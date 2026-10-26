/**
 * Messaging Conversation Operations (Plan 163)
 *
 * Encapsulates conversation lifecycle, participant memberships,
 * presence states, discussion bridge sync, and admin dispatch.
 */

import {
  MAX_GROUP_PARTICIPANTS,
  type CreateConversationInput,
  type AddParticipantInput,
  type LeaveConversationInput,
  type RespondToRequestInput,
  type SendAdminBroadcastInput,
  type SendAdminMessageInput,
  type MessagingDependencies,
} from "./contracts";
import {
  MessagingBlockedError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import {
  recipientsRefusing,
  splitDirectMessageRefusals,
} from "~/server/shared/privacy-permissions";
import { recipientAccepts } from "~/lib/notifications/recipient-preferences";
import { deliverNotification } from "~/lib/notifications/delivery/deliver";

const DM_REFUSED_MESSAGE = "This user is not accepting direct messages from you";
const GROUP_FULL_MESSAGE = `A group conversation holds at most ${MAX_GROUP_PARTICIPANTS} people`;

export class MessagingConversationOperations {
  private db: any;
  private websocket?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.websocket = dependencies.websocket;
  }

  public async createConversation(actorId: string, input: CreateConversationInput) {
    const allParticipants = [...new Set([actorId, ...input.participantIds])];
    if (allParticipants.length < 2) {
      throw new MessagingValidationError("A conversation requires at least 2 participants");
    }
    if (allParticipants.length > MAX_GROUP_PARTICIPANTS) {
      throw new MessagingValidationError(GROUP_FULL_MESSAGE);
    }

    const isGroup = allParticipants.length > 2;

    // Nobody who has blocked the creator can be pulled into a conversation with them.
    if ((await recipientsBlockingSender(this.db, actorId, allParticipants)).length > 0) {
      throw new MessagingBlockedError();
    }
    // Nor anyone whose direct-message setting excludes the creator (SL-4), unless they filter
    // message requests: then the conversation waits in their Requests folder.
    const refusing = await recipientsRefusing(this.db, actorId, allParticipants, "directMessages");
    const pending = new Set<string>();
    if (refusing.length > 0) {
      const { requests, refused } = await splitDirectMessageRefusals(this.db, refusing);
      if (refused.length > 0) throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
      for (const id of requests) pending.add(id);
    }

    return await this.db.$transaction(async (tx: any) => {
      const conversation = await tx.thinkshareConversation.create({
        data: {
          name: input.subject,
          type: isGroup ? "group" : "direct",
          channelType: input.channelType ?? input.channelId,
          conversationType: input.conversationType,
          diplomaticClassification: input.diplomaticClassification,
          priority: input.priority,
          source: input.source || "thinkshare",
          participants: {
            create: allParticipants.map((uid) => ({
              userId: uid,
              role: "participant",
              ...(pending.has(uid) && { requestStatus: "pending" }),
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

  /**
   * Adds someone to a group conversation, with the checks createConversation makes: not someone
   * who blocked the actor, nor someone whose direct-message setting excludes them (SL-4) unless
   * they filter message requests, in which case the group waits in their Requests folder. A
   * former member who left or was removed comes back only as a request they accept; one who
   * declined it is not asked again. The group stays within MAX_GROUP_PARTICIPANTS.
   */
  public async addParticipant(actorId: string, input: AddParticipantInput) {
    const conv = await this.db.thinkshareConversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conv) throw new MessagingNotFoundError();
    const myP = conv.participants.find((p: any) => p.userId === actorId && p.isActive);
    if (!myP) throw new MessagingForbiddenError();
    // A direct message stays between its two people, and a ThinkTank's chat follows its membership (invites, joins)
    if (conv.type === "direct" || conv.source === "thinktank") throw new MessagingForbiddenError();

    const target = input.targetUserId;
    const existing = conv.participants.find((p: any) => p.userId === target);
    if (existing?.isActive) return { success: true, pending: existing.requestStatus === "pending" };
    if (existing?.requestStatus === "declined") throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
    if (conv.participants.filter((p: any) => p.isActive).length >= MAX_GROUP_PARTICIPANTS) {
      throw new MessagingValidationError(GROUP_FULL_MESSAGE);
    }
    if ((await recipientsBlockingSender(this.db, actorId, [target])).length > 0) {
      throw new MessagingBlockedError();
    }
    let pending = !!existing;
    const refusing = await recipientsRefusing(this.db, actorId, [target], "directMessages");
    if (refusing.length > 0) {
      const { requests, refused } = await splitDirectMessageRefusals(this.db, refusing);
      if (refused.length > 0) throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
      if (requests.length > 0) pending = true;
    }
    const requestStatus = pending ? "pending" : "none";

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
        requestStatus,
      },
      update: {
        isActive: true,
        role: input.role || "member",
        requestStatus,
        leftAt: null,
      },
    });

    return { success: true, pending };
  }

  public async leaveConversation(actorId: string, input: LeaveConversationInput) {
    await this.db.conversationParticipant.updateMany({
      where: { conversationId: input.conversationId, userId: actorId },
      data: { isActive: false },
    });

    return { success: true };
  }

  /**
   * Accepts or declines a message request (SL-4). Accepting moves the conversation to the inbox
   * and lets the sender keep messaging even though they are outside the recipient's audience;
   * declining removes it and refuses further messages in it.
   */
  public async respondToRequest(actorId: string, input: RespondToRequestInput) {
    const participant = await this.db.conversationParticipant.findFirst({
      where: {
        conversationId: input.conversationId,
        userId: actorId,
        isActive: true,
        requestStatus: "pending",
      },
      select: { id: true },
    });
    if (!participant) throw new MessagingNotFoundError();

    await this.db.conversationParticipant.update({
      where: { id: participant.id },
      data: input.accept
        ? { requestStatus: "accepted" }
        : { requestStatus: "declined", isActive: false, leftAt: new Date() },
    });
    return { success: true, accepted: input.accept };
  }

  public async clearAllSystemNotifications(actorId: string) {
    await this.db.notification.deleteMany({
      where: { userId: actorId },
    });
    return { success: true };
  }

  /**
   * Returns null without writing anything when a single-user notice is filtered out by the
   * recipient's notification preferences. Country-wide and global notices are not filtered.
   */
  public async sendAdminBroadcast(input: SendAdminBroadcastInput) {
    const userId = input.scope === "user" && input.userId ? input.userId : null;
    const category = input.category || "system";
    const priority = input.level || "medium";
    if (userId && !(await recipientAccepts(userId, category, priority))) return null;

    const notification = await this.db.notification.create({
      data: {
        title: input.title,
        description: input.description,
        message: input.message || input.description,
        type: input.type || "system",
        category,
        priority,
        href: input.href,
        userId,
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
    // A notice to one user also goes out by email and push (SL-5); broadcasts stay in-app.
    if (userId) void deliverNotification({ ...notification, userId }, { db: this.db });

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
