/**
 * Messaging Conversation Operations (Plan 163)
 *
 * Encapsulates conversation lifecycle, participant memberships,
 * presence states, discussion bridge sync, and admin dispatch.
 */

import type { PrismaClient } from "@prisma/client";
import {
  MAX_GROUP_PARTICIPANTS,
  type CreateConversationInput,
  type AddParticipantInput,
  type LeaveConversationInput,
  type RespondToRequestInput,
  type SendAdminBroadcastInput,
  type SendAdminMessageInput,
  type MessagingDependencies,
  type WebSocketCollaborator,
} from "./contracts";
import {
  MessagingBlockedError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";
import {
  assertNotPending,
  assertUserCreatableSource,
  assertWritableConversation,
  canManageParticipants,
} from "./access";
import { directThreadWhere } from "./direct-thread";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import {
  recipientsRefusing,
  splitDirectMessageRefusals,
} from "~/server/shared/privacy-permissions";
import { recipientAccepts } from "~/lib/notifications/recipient-preferences";
import { deliverNotification } from "~/lib/notifications/delivery/deliver";

const DM_REFUSED_MESSAGE = "This user is not accepting direct messages from you";
/** The name a "Message myself" conversation shows, as it has no other participant to name it. */
const NOTE_TO_SELF_NAME = "Notes to self";
const GROUP_FULL_MESSAGE = `A group conversation holds at most ${MAX_GROUP_PARTICIPANTS} people`;

export class MessagingConversationOperations {
  private db: PrismaClient;
  private websocket?: WebSocketCollaborator | null;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.websocket = dependencies.websocket;
  }

  /** Whether the player holds a nation: set on them, or one they own. */
  private async ownsNation(actorId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({
      where: { clerkUserId: actorId },
      select: { countryId: true, ownedCountries: { select: { id: true }, take: 1 } },
    });
    return Boolean(user?.countryId) || (user?.ownedCountries.length ?? 0) > 0;
  }

  /**
   * What only some people may start: an "official" conversation (administrators), a classification above
   * PUBLIC (a nation's owner or an administrator, so nobody forges a TOP_SECRET thread), and a conversation
   * in a channel the server alone writes to (never a user).
   */
  private async assertMayStart(actorId: string, input: CreateConversationInput) {
    assertUserCreatableSource(input.source);
    if (input.actorIsAdmin) return;
    if (input.conversationType === "official") {
      throw new MessagingForbiddenError("Only administrators can start an official conversation");
    }
    const classified =
      input.diplomaticClassification && input.diplomaticClassification !== "PUBLIC";
    if (classified && !(await this.ownsNation(actorId))) {
      throw new MessagingForbiddenError("Only a nation's owner can classify a conversation");
    }
  }

  public async createConversation(actorId: string, input: CreateConversationInput) {
    await this.assertMayStart(actorId, input);

    const allParticipants = [...new Set([actorId, ...input.participantIds])];
    if (allParticipants.length === 1) return await this.noteToSelf(actorId, input);
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

    // Two people have one direct conversation: asking again reopens it (and never re-asks someone who declined).
    if (!isGroup) {
      const existing = await this.reopenDirect(actorId, allParticipants, input);
      if (existing) return existing;
    }

    const source = input.source ?? "thinkshare";
    return await this.db.$transaction(async (tx) => {
      const conversation = await tx.thinkshareConversation.create({
        data: {
          name: input.subject,
          type: isGroup ? "group" : "direct",
          channelType: input.channelType ?? input.channelId,
          conversationType: input.conversationType,
          diplomaticClassification: input.diplomaticClassification,
          priority: input.priority,
          source,
          participants: {
            create: allParticipants.map((uid) => ({
              userId: uid,
              // A group's creator manages it (adds people); everyone else is a plain participant.
              role: isGroup && uid === actorId ? "admin" : "participant",
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
            source,
          },
        });
      }

      return conversation;
    });
  }

  /**
   * The direct conversation the two already share, brought back for the actor when they had left it. Null when
   * there is none to reuse (or the other person left it, who is not pulled back in). Throws when the other
   * person declined it as a message request.
   */
  private async reopenDirect(
    actorId: string,
    participantIds: readonly string[],
    input: CreateConversationInput
  ) {
    const otherId = participantIds.find((id) => id !== actorId);
    if (!otherId) return null;
    const existing = await this.db.thinkshareConversation.findFirst({
      where: directThreadWhere(actorId, otherId, {
        source: input.source ?? "thinkshare",
        conversationType: input.conversationType ?? null,
      }),
      include: { participants: true },
    });
    if (!existing) return null;

    const other = existing.participants.find((p) => p.userId === otherId);
    if (other?.requestStatus === "declined") throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
    if (!other?.isActive) return null;

    const mine = existing.participants.find((p) => p.userId === actorId);
    if (mine?.isActive) return existing;
    await this.db.conversationParticipant.updateMany({
      where: { conversationId: existing.id, userId: actorId },
      data: { isActive: true, leftAt: null },
    });
    return await this.db.thinkshareConversation.findUniqueOrThrow({
      where: { id: existing.id },
      include: { participants: true },
    });
  }

  /**
   * "Message myself": the actor's one active direct conversation with nobody else, created on first
   * use and reopened after that. No block, privacy or request checks apply (there is no recipient),
   * and sendMessage notifies nobody since it has no other participant.
   */
  private async noteToSelf(actorId: string, input: CreateConversationInput) {
    const existing = await this.db.thinkshareConversation.findFirst({
      where: {
        type: "direct",
        source: "thinkshare",
        participants: { some: { userId: actorId, isActive: true }, every: { userId: actorId } },
      },
      include: { participants: true },
    });
    if (existing) return existing;
    return await this.db.thinkshareConversation.create({
      data: {
        name: input.subject || NOTE_TO_SELF_NAME,
        type: "direct",
        source: "thinkshare",
        participants: { create: [{ userId: actorId, role: "participant" }] },
      },
      include: { participants: true },
    });
  }

  /**
   * Adds someone to a group conversation, with the checks createConversation makes: not someone
   * who blocked the actor, nor someone whose direct-message setting excludes them (SL-4) unless
   * they filter message requests, in which case the group waits in their Requests folder. A
   * former member who left or was removed comes back only as a request they accept; one who
   * declined it is not asked again. The group stays within MAX_GROUP_PARTICIPANTS. Only the group's
   * creator and its admins add people, and a person added reads only what is sent from then on.
   */
  public async addParticipant(actorId: string, input: AddParticipantInput) {
    const conv = await this.db.thinkshareConversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conv) throw new MessagingNotFoundError();
    const myP = conv.participants.find((p) => p.userId === actorId && p.isActive);
    if (!myP) throw new MessagingForbiddenError();
    // A request is accepted before the invitee takes any part, adding people included.
    assertNotPending(myP);
    assertWritableConversation(conv);
    // A direct message stays between its two people, and a ThinkTank's chat follows its membership (invites, joins)
    if (conv.type === "direct" || conv.source === "thinktank") throw new MessagingForbiddenError();
    if (!canManageParticipants(conv, actorId)) throw new MessagingForbiddenError();

    const target = input.targetUserId;
    const existing = conv.participants.find((p) => p.userId === target);
    if (existing?.isActive) return { success: true, pending: existing.requestStatus === "pending" };
    if (existing?.requestStatus === "declined") throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
    if (conv.participants.filter((p) => p.isActive).length >= MAX_GROUP_PARTICIPANTS) {
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
          userId: target,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: target,
        role: input.role || "member",
        isActive: true,
        requestStatus,
      },
      update: {
        isActive: true,
        role: input.role || "member",
        requestStatus,
        leftAt: null,
        // Back in the group, they read from now on, not the stretch they were away.
        joinedAt: new Date(),
      },
    });

    return { success: true, pending };
  }

  public async leaveConversation(actorId: string, input: LeaveConversationInput) {
    await this.db.conversationParticipant.updateMany({
      where: { conversationId: input.conversationId, userId: actorId },
      data: { isActive: false },
    });
    this.evictFromRoom(actorId, input.conversationId);

    return { success: true };
  }

  /** The actor's open sockets stop receiving a conversation they are no longer in. */
  private evictFromRoom(actorId: string, conversationId: string) {
    this.websocket?.evictFromRoom?.({ type: "room:evict", clerkUserId: actorId, conversationId });
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
    if (!input.accept) this.evictFromRoom(actorId, input.conversationId);
    return { success: true, accepted: input.accept };
  }

  /** Clears the actor's system notices; the rest of their notifications (social, sports, ...) stay. */
  public async clearAllSystemNotifications(actorId: string) {
    await this.db.notification.deleteMany({
      where: { userId: actorId, category: "system" },
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

    // A notice to one user also goes out by email and push (SL-5); broadcasts stay in-app.
    if (userId) void deliverNotification({ ...notification, userId }, { db: this.db });

    return notification;
  }

  public async sendAdminMessage(actorId: string, input: SendAdminMessageInput) {
    if (!input.targetUserId) {
      throw new MessagingValidationError("targetUserId is required");
    }

    // Participants are Clerk ids; the admin may name the recipient by either id.
    const recipient = await this.db.user.findFirst({
      where: { OR: [{ clerkUserId: input.targetUserId }, { id: input.targetUserId }] },
      select: { clerkUserId: true },
    });
    if (!recipient) throw new MessagingNotFoundError("Recipient not found");
    const targetId = recipient.clerkUserId;
    if (targetId === actorId) {
      throw new MessagingValidationError("You cannot message yourself as an administrator");
    }

    const source = input.source || "system";
    let conversation = await this.db.thinkshareConversation.findFirst({
      where: directThreadWhere(actorId, targetId, { source }),
      select: { id: true },
    });

    if (!conversation) {
      conversation = await this.db.thinkshareConversation.create({
        data: {
          type: "direct",
          conversationType: input.conversationType || "official",
          diplomaticClassification: input.classification || null,
          source,
          participants: {
            create: [
              { userId: actorId, role: "admin" },
              { userId: targetId, role: "member" },
            ],
          },
        },
        select: { id: true },
      });
    }

    const message = await this.db.thinkshareMessage.create({
      data: {
        conversationId: conversation.id,
        userId: actorId,
        content: input.content,
        source,
        classification: input.classification || null,
        subject: input.subject || null,
        isSystem: input.source === "system",
      },
    });

    await this.db.thinkshareConversation.update({
      where: { id: conversation.id },
      data: { lastActivity: new Date() },
    });

    this.websocket?.broadcastMessage?.({
      type: "message:new",
      conversationId: conversation.id,
      messageId: message.id,
      accountId: actorId,
      content: input.content,
      timestamp: message.ixTimeTimestamp.getTime(),
      recipientIds: [actorId, targetId],
    });

    return { success: true, conversationId: conversation.id, messageId: message.id };
  }
}
