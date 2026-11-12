/**
 * Messaging Message Operations (Plan 163)
 *
 * Encapsulates message creation, editing, soft deletion,
 * read-state tracking, reactions, and automated quota pruning.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DEFAULT_USER_MESSAGE_CAP,
  type SendMessageInput,
  type EditMessageInput,
  type DeleteMessageInput,
  type MarkMessagesAsReadInput,
  type AddReactionInput,
  type RemoveReactionInput,
  type MessagingDependencies,
  type NotificationCollaborator,
  type WebSocketCollaborator,
} from "./contracts";
import {
  MessagingBlockedError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";
import { assertNotPending, assertWritableConversation } from "./access";
import { preferencesOf } from "./preferences";
import {
  MAX_REACTION_KINDS,
  MAX_REACTION_LENGTH,
  parseReactions,
  serializeReactions,
  withReaction,
  withoutReaction,
  type ReactionMap,
} from "./reactions";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { realmBoardChatRestriction } from "~/server/shared/realm-board";
import { enrollThinktankMember } from "./thinktank-enrollment";
import {
  recipientsRefusing,
  splitDirectMessageRefusals,
} from "~/server/shared/privacy-permissions";

const DM_REFUSED_MESSAGE = "This user is not accepting direct messages from you";
const CONVERSATION_SOURCE = { conversation: { select: { source: true } } } as const;
const EXEMPT_ROLES = new Set(["admin", "system-owner", "owner", "staff"]);
const EXEMPT_MEMBERSHIP_TIERS = new Set(["premium", "pro", "vip"]);
/** Most message ids one markMessagesAsRead call may name. */
export const MAX_MARK_READ_IDS = 200;
/** Most people one message may mention. */
const MAX_MENTIONS = 20;
/** How many times a reaction retries after losing a race with another reaction on the same message. */
const REACTION_ATTEMPTS = 5;

type Tx = Prisma.TransactionClient;
interface MemberRef {
  userId: string;
  requestStatus: string;
  notificationSettings: string | null;
}

export class MessagingMessageOperations {
  private db: PrismaClient;
  private notifications?: NotificationCollaborator;
  private websocket?: WebSocketCollaborator | null;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.notifications = dependencies.notifications;
    this.websocket = dependencies.websocket;
  }

  public async sendMessage(actorId: string, input: SendMessageInput) {
    const conv = await this.db.thinkshareConversation.findFirst({
      where: {
        OR: [
          { id: input.conversationId },
          { sourceId: input.conversationId },
          { thinktankGroup: { id: input.conversationId } },
        ],
      },
    });

    const targetConvId = conv?.id ?? input.conversationId;
    const participant = await this.findSendingParticipant(actorId, targetConvId, conv);
    if (!participant) throw new MessagingForbiddenError();
    // A recipient holding the conversation as a request accepts it first; replying does not.
    assertNotPending(participant);
    const target = conv ?? participant.conversation;
    assertWritableConversation(target);

    // A board mute or ban covers the realm board's chat as well as its posts.
    const restricted = await realmBoardChatRestriction(this.db, target, actorId);
    if (restricted) throw new MessagingBlockedError(restricted);

    const newlyPending =
      target.type === "direct"
        ? await this.checkDirectRecipients(actorId, targetConvId)
        : new Set<string>();

    // A reply quotes a live message of this conversation, never one from elsewhere.
    if (input.replyToId) {
      const replyTo = await this.db.thinkshareMessage.findFirst({
        where: { id: input.replyToId, conversationId: targetConvId, deletedAt: null },
        select: { id: true },
      });
      if (!replyTo) {
        throw new MessagingValidationError(
          "The message you replied to is not in this conversation"
        );
      }
    }

    const members: MemberRef[] = await this.db.conversationParticipant.findMany({
      where: { conversationId: targetConvId, userId: { not: actorId }, isActive: true },
      select: { userId: true, requestStatus: true, notificationSettings: true },
    });
    const mentions = mentionedMembers(input.mentions, actorId, members);
    const diplomatic = target.conversationType === "diplomatic";

    const message = await this.db.$transaction(async (tx) => {
      const createdMsg = await tx.thinkshareMessage.create({
        data: {
          conversationId: targetConvId,
          userId: actorId,
          content: input.content,
          messageType: input.messageType ?? "text",
          replyToId: input.replyToId,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          mentions: mentions.length > 0 ? JSON.stringify(mentions) : null,
          classification: diplomatic ? (input.classification ?? null) : null,
          priority: diplomatic ? (input.priority ?? null) : null,
          source: target.source ?? "thinkshare",
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
    // it waits in their Requests folder. Nor is anyone who declined it.
    let recipients = members.filter(
      (p) =>
        p.requestStatus !== "pending" &&
        p.requestStatus !== "declined" &&
        !newlyPending.has(p.userId)
    );
    // Group members who blocked the sender are not notified or pushed the message.
    if (target.type !== "direct" && recipients.length > 0) {
      const blocking = new Set(
        await recipientsBlockingSender(
          this.db,
          actorId,
          recipients.map((p) => p.userId)
        )
      );
      if (blocking.size > 0) recipients = recipients.filter((p) => !blocking.has(p.userId));
    }

    this.notifyRecipients(
      recipients.filter((p) => !preferencesOf(p.notificationSettings).muted),
      targetConvId,
      input.content
    );
    this.broadcast(
      "message:new",
      targetConvId,
      message.id,
      actorId,
      input.content,
      // The sender is listed too: their other tabs and devices get the inbox update.
      [actorId, ...recipients.map((p) => p.userId)]
    );

    // Storage stays bounded per sender: each (non-exempt) user keeps their newest 1000 messages.
    // There is no per-conversation cap, which let any member erase a group's history by sending
    // 1000 messages; a sender's spam now only ever evicts their own messages.
    void this.pruneOldMessagesForUser(actorId, DEFAULT_USER_MESSAGE_CAP).catch(() => {});

    return message;
  }

  /**
   * Only existing active participants may send. The one exception is a ThinkTank chat:
   * an active member of the linked ThinktankGroup may be (re)joined to its conversation
   * (membership sync in thinktanks/membership.ts normally does this already).
   */
  private async findSendingParticipant(
    actorId: string,
    conversationId: string,
    conv: object | null
  ) {
    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId, userId: actorId, isActive: true },
      include: { conversation: true },
    });
    if (participant || !conv) return participant;
    return enrollThinktankMember(this.db, actorId, conversationId);
  }

  /**
   * A direct conversation goes quiet once the other person blocks the sender or declines the
   * conversation as a message request. When their direct-message audience excludes the sender
   * (SL-4) the message is refused, unless they filter message requests: then the conversation
   * moves to their Requests folder. A recipient who accepted the request is not re-checked.
   * Returns the recipients whose conversation just became a request.
   */
  private async checkDirectRecipients(actorId: string, conversationId: string) {
    const others = await this.db.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: actorId },
        OR: [{ isActive: true }, { requestStatus: "declined" }],
      },
      select: { userId: true, requestStatus: true },
    });
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
    const notifications = this.notifications;
    if (!notifications?.create) return;
    for (const p of recipients) {
      notifications
        .create({
          userId: p.userId,
          type: "info",
          category: "social",
          priority: "low",
          title: "New Message",
          message: content.slice(0, 100),
          href: `/messages?conversation=${conversationId}`,
        })
        .catch(() => {});
    }
  }

  /** Hands a message event to the realtime server, for the sockets of `recipientIds` only. */
  private broadcast(
    type: "message:new" | "message:updated" | "message:deleted",
    conversationId: string,
    messageId: string,
    accountId: string,
    content: string | undefined,
    recipientIds: string[]
  ) {
    if (!this.websocket?.broadcastMessage || recipientIds.length === 0) return;
    this.websocket.broadcastMessage({
      type,
      conversationId,
      messageId,
      accountId,
      content,
      timestamp: Date.now(),
      recipientIds,
    });
  }

  /** Everyone who sees a change to a message: the active participants not holding the conversation as a pending request. */
  private async changeRecipients(conversationId: string): Promise<string[]> {
    const rows = await this.db.conversationParticipant.findMany({
      where: { conversationId, isActive: true, requestStatus: { not: "pending" } },
      select: { userId: true },
    });
    return rows.map((p) => p.userId);
  }

  /** The actor's own message, in a conversation that takes changes and that they are still in. */
  private async loadOwnMessage(actorId: string, messageId: string) {
    const msg = await this.db.thinkshareMessage.findUnique({
      where: { id: messageId },
      include: CONVERSATION_SOURCE,
    });

    if (!msg) throw new MessagingNotFoundError();
    if (msg.userId !== actorId) throw new MessagingForbiddenError();
    assertWritableConversation(msg.conversation);
    // A member who left no longer changes what they said there.
    const member = await this.db.conversationParticipant.findFirst({
      where: { conversationId: msg.conversationId, userId: actorId, isActive: true },
      select: { id: true },
    });
    if (!member) throw new MessagingForbiddenError();
    return msg;
  }

  public async editMessage(actorId: string, input: EditMessageInput) {
    const msg = await this.loadOwnMessage(actorId, input.messageId);
    if (msg.deletedAt) throw new MessagingForbiddenError("Cannot edit a deleted message");

    const updated = await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        content: input.content,
        editedAt: new Date(),
      },
    });

    this.broadcast(
      "message:updated",
      msg.conversationId,
      msg.id,
      actorId,
      input.content,
      await this.changeRecipients(msg.conversationId)
    );

    return updated;
  }

  public async deleteMessage(actorId: string, input: DeleteMessageInput) {
    const msg = await this.loadOwnMessage(actorId, input.messageId);
    if (msg.deletedAt) return { success: true };

    await this.db.thinkshareMessage.update({
      where: { id: input.messageId },
      data: {
        content: "This message was deleted",
        deletedAt: new Date(),
        attachments: null,
        mentions: null,
      },
    });

    this.broadcast(
      "message:deleted",
      msg.conversationId,
      msg.id,
      actorId,
      undefined,
      await this.changeRecipients(msg.conversationId)
    );

    return { success: true };
  }

  /**
   * Marks the conversation read for the actor. `messageIds`, when given, must all be messages of this
   * conversation (a bounded list, so a caller cannot probe other conversations' ids). No per-message receipt rows
   * are written: nothing reads them, and the "seen" state shown to the other person comes from `lastReadAt`
   * (getSeenState), which honours the read-receipt privacy switch.
   */
  public async markMessagesAsRead(actorId: string, input: MarkMessagesAsReadInput) {
    const ids = [...new Set(input.messageIds ?? [])];
    if (ids.length > MAX_MARK_READ_IDS) {
      throw new MessagingValidationError(`Mark at most ${MAX_MARK_READ_IDS} messages at a time`);
    }

    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: input.conversationId, userId: actorId, isActive: true },
      select: { conversationId: true },
    });
    if (!participant) throw new MessagingForbiddenError();

    if (ids.length > 0) {
      const inConversation = await this.db.thinkshareMessage.count({
        where: { id: { in: ids }, conversationId: participant.conversationId },
      });
      if (inConversation !== ids.length) {
        throw new MessagingValidationError("Some of those messages are not in this conversation");
      }
    }

    await this.db.conversationParticipant.updateMany({
      where: { conversationId: participant.conversationId, userId: actorId },
      data: { lastReadAt: new Date() },
    });

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

  /**
   * Applies `change` to a message's reactions, for an actor who is an active, non-pending participant of a
   * conversation that takes changes. Read-modify-write inside a transaction, compare-and-swapped on the stored
   * string so two people reacting at once never overwrite each other (the loser re-reads and retries).
   */
  private async changeReactions(
    actorId: string,
    messageId: string,
    change: (map: ReactionMap) => ReactionMap
  ) {
    await this.db.$transaction(async (tx: Tx) => {
      for (let attempt = 0; attempt < REACTION_ATTEMPTS; attempt++) {
        const msg = await tx.thinkshareMessage.findUnique({
          where: { id: messageId },
          select: {
            reactions: true,
            deletedAt: true,
            conversationId: true,
            conversation: { select: { source: true } },
          },
        });
        if (!msg) throw new MessagingNotFoundError();
        assertWritableConversation(msg.conversation);
        const member = await tx.conversationParticipant.findFirst({
          where: { conversationId: msg.conversationId, userId: actorId, isActive: true },
          select: { requestStatus: true },
        });
        if (!member) throw new MessagingForbiddenError();
        assertNotPending(member);
        if (msg.deletedAt) throw new MessagingForbiddenError("Cannot react to a deleted message");

        const before = parseReactions(msg.reactions);
        const after = change(before);
        if (after === before) return;
        if (Object.keys(after).length > MAX_REACTION_KINDS) {
          throw new MessagingValidationError("That message already carries as many reactions as it can");
        }

        const swapped = await tx.thinkshareMessage.updateMany({
          where: { id: messageId, reactions: msg.reactions },
          data: { reactions: serializeReactions(after) },
        });
        if (swapped.count > 0) return;
      }
      throw new MessagingValidationError("That message is busy, try again");
    });
  }

  public async addReaction(actorId: string, input: AddReactionInput) {
    const emoji = reactionEmoji(input.emoji);
    await this.changeReactions(actorId, input.messageId, (map) =>
      withReaction(map, actorId, emoji)
    );
    return { success: true };
  }

  public async removeReaction(actorId: string, input: RemoveReactionInput) {
    const emoji = reactionEmoji(input.emoji);
    await this.changeReactions(actorId, input.messageId, (map) =>
      withoutReaction(map, actorId, emoji)
    );
    return { success: true };
  }

  /** Deletes the oldest messages matching `where` beyond `cap`; returns how many were removed. */
  private async deleteOldestBeyondCap(
    where: Prisma.ThinkshareMessageWhereInput,
    cap: number
  ): Promise<number> {
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
      where: { id: { in: oldestMessages.map((m) => m.id) } },
    });
    return deleteResult.count;
  }

  public async pruneOldMessagesForUser(
    userId: string,
    cap: number = DEFAULT_USER_MESSAGE_CAP
  ): Promise<number> {
    try {
      const user = await this.db.user.findFirst({
        where: { OR: [{ id: userId }, { clerkUserId: userId }] },
        select: { membershipTier: true, role: { select: { name: true } } },
      });

      const isExempt =
        EXEMPT_ROLES.has(user?.role?.name ?? "") ||
        EXEMPT_MEMBERSHIP_TIERS.has(user?.membershipTier ?? "");
      if (isExempt) return 0;

      return await this.deleteOldestBeyondCap({ userId }, cap);
    } catch (err) {
      console.error(`[MessagingMessageOperations] Auto-prune error for user ${userId}:`, err);
      return 0;
    }
  }
}

/** The emoji a reaction names, trimmed; refused when empty or longer than any emoji sequence. */
function reactionEmoji(emoji: string): string {
  const trimmed = emoji.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REACTION_LENGTH) {
    throw new MessagingValidationError("Invalid reaction");
  }
  return trimmed;
}

/** The mentioned Clerk ids that are in the conversation: at most MAX_MENTIONS, never the author. */
function mentionedMembers(
  mentions: readonly string[] | undefined,
  actorId: string,
  members: readonly MemberRef[]
): string[] {
  if (!mentions || mentions.length === 0) return [];
  const present = new Set(members.map((m) => m.userId));
  return [...new Set(mentions)]
    .filter((id) => id !== actorId && present.has(id))
    .slice(0, MAX_MENTIONS);
}
