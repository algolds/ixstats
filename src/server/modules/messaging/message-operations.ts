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
import { MessagingBlockedError, MessagingForbiddenError, MessagingNotFoundError } from "./errors";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { realmBoardChatRestriction } from "~/server/shared/realm-board";
import {
  recipientsRefusing,
  splitDirectMessageRefusals,
} from "~/server/shared/privacy-permissions";

const DM_REFUSED_MESSAGE = "This user is not accepting direct messages from you";
/** Q14 (phase 4b): conversations imported from the retired XenForo forum keep their history but take no replies. */
const FORUM_READ_ONLY_MESSAGE = "This conversation came from the old forum and is read-only";
const CONVERSATION_SOURCE = { conversation: { select: { source: true } } } as const;

/** Q14: nothing in an old forum conversation changes (sends, edits, deletes, reactions). */
function assertNotOldForum(conversation: { source?: string | null } | null | undefined): void {
  if (conversation?.source === "forum") throw new MessagingBlockedError(FORUM_READ_ONLY_MESSAGE);
}
const EXEMPT_ROLES = new Set(["admin", "system-owner", "owner", "staff"]);
const EXEMPT_MEMBERSHIP_TIERS = new Set(["premium", "pro", "vip"]);

export class MessagingMessageOperations {
  private db: any;
  private notifications?: any;
  private websocket?: any;
  private wikiBridge?: any;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.notifications = dependencies.notifications;
    this.websocket = dependencies.websocket;
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
    const participant = await this.findSendingParticipant(actorId, targetConvId, conv);
    if (!participant) throw new MessagingForbiddenError();
    const source = conv?.source || participant.conversation?.source;
    assertNotOldForum({ source });

    // A board mute or ban covers the realm board's chat as well as its posts.
    const restricted = await realmBoardChatRestriction(
      this.db,
      conv ?? participant.conversation,
      actorId
    );
    if (restricted) throw new MessagingBlockedError(restricted);

    const newlyPending =
      (conv ?? participant.conversation)?.type === "direct"
        ? await this.checkDirectRecipients(actorId, targetConvId)
        : new Set<string>();

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

      const now = new Date();
      await tx.thinkshareConversation.update({
        where: { id: targetConvId },
        data: { lastActivity: now, updatedAt: now },
      });

      return createdMsg;
    });

    // Recipients holding the conversation as a message request are not notified or pushed it;
    // it waits in their Requests folder.
    let otherParticipants: Array<{ userId: string; requestStatus?: string }> = (
      await this.db.conversationParticipant.findMany({
        where: { conversationId: targetConvId, userId: { not: actorId }, isActive: true },
      })
    ).filter(
      (p: { userId: string; requestStatus?: string }) =>
        p.requestStatus !== "pending" && !newlyPending.has(p.userId)
    );
    // Group members who blocked the sender are not notified or pushed the message.
    if ((conv ?? participant.conversation)?.type !== "direct" && otherParticipants.length > 0) {
      const blocking = new Set(
        await recipientsBlockingSender(
          this.db,
          actorId,
          otherParticipants.map((p) => p.userId)
        )
      );
      if (blocking.size > 0)
        otherParticipants = otherParticipants.filter((p) => !blocking.has(p.userId));
    }

    this.notifyRecipients(otherParticipants, targetConvId, input.content);
    this.broadcastNewMessage(otherParticipants, targetConvId, message, actorId, input.content);

    const sourceId = conv?.sourceId || participant.conversation?.sourceId;
    if (source === "wiki") {
      this.wikiBridge
        ?.sendOutbound?.(sourceId || targetConvId, input.content, actorId, this.db)
        .catch(() => {});
    }

    // Auto-prune default user messages beyond 1000 cap
    void this.pruneOldMessagesForUser(actorId, DEFAULT_USER_MESSAGE_CAP).catch(() => {});
    void this.pruneConversationMessages(targetConvId, DEFAULT_USER_MESSAGE_CAP).catch(() => {});

    return message;
  }

  /**
   * Only existing active participants may send. The one exception is a ThinkTank chat:
   * an active member of the linked ThinktankGroup may be (re)joined to its conversation
   * (membership sync in thinktanks/membership.ts normally does this already).
   */
  private async findSendingParticipant(actorId: string, conversationId: string, conv: any) {
    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId, userId: actorId, isActive: true },
      include: { conversation: true },
    });
    if (participant || !conv) return participant;

    const membership = await this.db.thinktankGroup?.findFirst?.({
      where: {
        conversationId,
        isActive: true,
        members: { some: { userId: actorId, isActive: true } },
      },
      select: { id: true },
    });
    if (!membership) return null;

    return this.db.conversationParticipant
      .upsert({
        where: { conversationId_userId: { conversationId, userId: actorId } },
        create: { conversationId, userId: actorId, role: "participant" },
        update: { isActive: true, leftAt: null },
        include: { conversation: true },
      })
      .catch(() => null);
  }

  /**
   * A direct conversation goes quiet once the other person blocks the sender or declines the
   * conversation as a message request. When their direct-message audience excludes the sender
   * (SL-4) the message is refused, unless they filter message requests: then the conversation
   * moves to their Requests folder. A recipient who accepted the request is not re-checked.
   * Returns the recipients whose conversation just became a request.
   */
  private async checkDirectRecipients(actorId: string, conversationId: string) {
    const others: Array<{ userId: string; requestStatus?: string | null }> =
      (await this.db.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: actorId },
          OR: [{ isActive: true }, { requestStatus: "declined" }],
        },
        select: { userId: true, requestStatus: true },
      })) ?? [];
    if (others.some((p) => p.requestStatus === "declined")) {
      throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
    }
    const otherIds = others.map((p) => p.userId);
    const blocking = await recipientsBlockingSender(this.db, actorId, otherIds);
    if (blocking.length > 0) throw new MessagingBlockedError();

    const unaccepted = others.filter((p) => p.requestStatus !== "accepted").map((p) => p.userId);
    const refusing = await recipientsRefusing(this.db, actorId, unaccepted, "directMessages");
    if (refusing.length === 0) return new Set<string>();

    const { requests, refused } = await splitDirectMessageRefusals(this.db, refusing);
    if (refused.length > 0) throw new MessagingBlockedError(DM_REFUSED_MESSAGE);
    const fresh = others
      .filter((p) => requests.includes(p.userId) && (p.requestStatus ?? "none") === "none")
      .map((p) => p.userId);
    if (fresh.length > 0) {
      await this.db.conversationParticipant.updateMany({
        where: { conversationId, userId: { in: fresh } },
        data: { requestStatus: "pending" },
      });
    }
    return new Set(fresh);
  }

  private notifyRecipients(
    recipients: Array<{ userId: string }>,
    conversationId: string,
    content: string
  ) {
    const notifFn = this.notifications?.create ?? this.notifications?.createNotification;
    if (!notifFn) return;
    for (const p of recipients) {
      notifFn
        .call(this.notifications, {
          userId: p.userId,
          type: "info",
          category: "social",
          priority: "low",
          title: "New Message",
          message: content.slice(0, 100),
          href: `/messages?id=${conversationId}`,
        })
        .catch(() => {});
    }
  }

  private broadcastNewMessage(
    recipients: Array<{ userId: string }>,
    conversationId: string,
    message: { id: string },
    actorId: string,
    content: string
  ) {
    if (this.websocket?.broadcastToUsers) {
      this.websocket.broadcastToUsers(
        recipients.map((p) => p.userId),
        "message:new",
        { conversationId, message }
      );
    } else if (this.websocket?.broadcastMessage) {
      this.websocket.broadcastMessage({
        type: "message:new",
        conversationId,
        messageId: message.id,
        accountId: actorId,
        content,
        timestamp: Date.now(),
      });
    }
  }

  public async editMessage(actorId: string, input: EditMessageInput) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: input.messageId },
      include: CONVERSATION_SOURCE,
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError();
    assertNotOldForum(msg.conversation);
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
      include: CONVERSATION_SOURCE,
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError();
    assertNotOldForum(msg.conversation);
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

  private async assertActiveParticipantOfMessage(actorId: string, messageId: string) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });

    if (!msg) throw new MessagingNotFoundError();
    const isParticipant = msg.conversation?.participants.some(
      (p: any) => p.userId === actorId && p.isActive
    );
    if (!isParticipant) throw new MessagingForbiddenError();
    assertNotOldForum(msg.conversation);
  }

  public async addReaction(actorId: string, input: AddReactionInput) {
    await this.assertActiveParticipantOfMessage(actorId, input.messageId);

    const reaction = { messageId: input.messageId, userId: actorId, emoji: input.emoji };
    await this.db.messageReaction.upsert({
      where: { messageId_userId_emoji: reaction },
      create: reaction,
      update: {},
    });

    return { success: true };
  }

  public async removeReaction(actorId: string, input: RemoveReactionInput) {
    await this.assertActiveParticipantOfMessage(actorId, input.messageId);

    await this.db.messageReaction.deleteMany({
      where: { messageId: input.messageId, userId: actorId, emoji: input.emoji },
    });

    return { success: true };
  }

  /** Deletes the oldest messages matching `where` beyond `cap`; returns how many were removed. */
  private async deleteOldestBeyondCap(where: Record<string, string>, cap: number): Promise<number> {
    const totalCount = await this.db.thinkshareMessage.count({ where });
    if (totalCount <= cap) return 0;

    const oldestMessages = await this.db.thinkshareMessage.findMany({
      where,
      orderBy: { ixTimeTimestamp: "asc" },
      take: totalCount - cap,
      select: { id: true },
    });
    if (oldestMessages.length === 0) return 0;

    const deleteResult = await this.db.thinkshareMessage.deleteMany({
      where: { id: { in: oldestMessages.map((m: any) => m.id) } },
    });
    return deleteResult.count;
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
        EXEMPT_ROLES.has(user?.role?.name) || EXEMPT_MEMBERSHIP_TIERS.has(user?.membershipTier);
      if (isExempt) return 0;

      return await this.deleteOldestBeyondCap({ userId }, cap);
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
      return await this.deleteOldestBeyondCap({ conversationId }, cap);
    } catch (err) {
      console.error(
        `[MessagingMessageOperations] Auto-prune error for conversation ${conversationId}:`,
        err
      );
      return 0;
    }
  }
}
