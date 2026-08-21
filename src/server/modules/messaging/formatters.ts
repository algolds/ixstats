/**
 * Pure Response Formatters for Messaging Surfaces (Plan 163)
 *
 * Owns deterministic mapping from canonical entities & accounts into
 * exact response shapes for both `messages` and legacy `thinkpages.messaging`.
 */

import type { UserAccount } from "./contracts";

// ─── Formatters for `api.messages` ───────────────────────────────────────────

export interface MessagesConversationResult {
  id: string;
  subject: string | null;
  isGroup: boolean;
  channelId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  source: string;
  participantCount: number;
  unreadCount: number;
  otherParticipants: UserAccount[];
  otherParticipant?: UserAccount;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    createdAt: Date;
    isDeleted: boolean;
  } | null;
}

export function formatMessagesConversation(
  conv: any,
  actorId: string,
  accountMap: Map<string, UserAccount>,
  unreadCount = 0
): MessagesConversationResult {
  const participants: any[] = conv.participants || [];
  const otherParts = participants.filter((p) => p.userId !== actorId);

  const otherAccounts: UserAccount[] = otherParts
    .map((p) => accountMap.get(p.userId))
    .filter((a): a is UserAccount => Boolean(a));

  // If no account found, generate placeholder
  if (otherAccounts.length === 0 && otherParts.length > 0) {
    const firstId = otherParts[0]!.userId;
    otherAccounts.push({
      id: firstId,
      username: firstId,
      displayName: firstId.startsWith("forum:") ? "Forum User" : firstId.startsWith("wiki:") ? "Wiki User" : "Unknown",
      profileImageUrl: null,
      accountType: "country",
    });
  }

  let lastMessageFormatted = null;
  const lastMsg = conv.messages?.[0] || conv.lastMessage;
  if (lastMsg) {
    const senderAccount = accountMap.get(lastMsg.userId);
    const isDeleted = Boolean(lastMsg.deletedAt || lastMsg.isDeleted);
    lastMessageFormatted = {
      id: lastMsg.id,
      content: isDeleted ? "This message was deleted" : lastMsg.content,
      senderId: lastMsg.userId,
      senderName: senderAccount?.displayName ?? lastMsg.senderName ?? "Unknown",
      senderAvatar: senderAccount?.profileImageUrl ?? lastMsg.senderAvatar ?? null,
      createdAt: new Date(lastMsg.ixTimeTimestamp || lastMsg.createdAt || Date.now()),
      isDeleted,
    };
  }

  return {
    id: conv.id,
    subject: conv.subject ?? null,
    isGroup: Boolean(conv.isGroup),
    channelId: conv.channelId ?? null,
    createdAt: new Date(conv.createdAt || Date.now()),
    updatedAt: new Date(conv.updatedAt || Date.now()),
    lastMessageAt: new Date(conv.lastActivity || conv.updatedAt || Date.now()),
    source: conv.source || "thinkshare",
    participantCount: participants.length,
    unreadCount,
    otherParticipants: otherAccounts,
    otherParticipant: otherAccounts[0],
    lastMessage: lastMessageFormatted,
  };
}

export function formatMessagesMessage(
  msg: any,
  actorId: string,
  accountMap: Map<string, UserAccount>
) {
  const senderAccount = accountMap.get(msg.userId) ?? {
    id: msg.userId,
    username: msg.userId,
    displayName: msg.senderName || "Unknown",
    profileImageUrl: msg.senderAvatar || null,
    accountType: "country" as const,
  };

  const isDeleted = Boolean(msg.deletedAt || msg.isDeleted);
  const isEdited = Boolean(msg.editedAt || msg.isEdited);
  const timestamp = new Date(msg.ixTimeTimestamp || msg.createdAt || Date.now());

  let replyToFormatted = undefined;
  if (msg.replyTo) {
    const replySender = accountMap.get(msg.replyTo.userId);
    const replyDeleted = Boolean(msg.replyTo.deletedAt || msg.replyTo.isDeleted);
    replyToFormatted = {
      id: msg.replyTo.id,
      content: replyDeleted ? "This message was deleted" : msg.replyTo.content,
      senderName: replySender?.displayName ?? msg.replyTo.senderName ?? "Unknown",
    };
  }

  const rawReactions = msg.reactions
    ? typeof msg.reactions === "string"
      ? JSON.parse(msg.reactions)
      : msg.reactions
    : {};
  const reactions = Object.entries(rawReactions).map(([emoji, count]) => ({
    emoji,
    count: count as number,
    users: [],
    hasReacted: false,
  }));

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.userId,
    sender: senderAccount,
    content: isDeleted ? "This message was deleted" : msg.content,
    attachments: msg.attachments
      ? typeof msg.attachments === "string"
        ? JSON.parse(msg.attachments)
        : msg.attachments
      : [],
    reactions,
    replyTo: replyToFormatted,
    isDeleted,
    isEdited,
    createdAt: timestamp,
    updatedAt: new Date(msg.editedAt || msg.ixTimeTimestamp || Date.now()),
    source: msg.source || "thinkshare",
    isOwn: msg.userId === actorId,
  };
}

// ─── Formatters for `api.thinkpages.messaging` ───────────────────────────────

export function formatThinkpagesConversation(
  conv: any,
  actorId: string,
  accountMap: Map<string, UserAccount>,
  unreadCount = 0
) {
  const participants: any[] = conv.participants || [];
  const otherParts = participants.filter((p) => p.userId !== actorId);

  const otherAccounts: UserAccount[] = otherParts
    .map((p) => accountMap.get(p.userId))
    .filter((a): a is UserAccount => Boolean(a));

  const actorAccount = accountMap.get(actorId) ?? {
    id: actorId,
    username: actorId,
    displayName: "Current User",
    profileImageUrl: null,
    accountType: "country" as const,
  };

  let lastMessageFormatted = null;
  const lastMsg = conv.messages?.[0] || conv.lastMessage;
  if (lastMsg) {
    const senderAccount = accountMap.get(lastMsg.userId);
    const isDeleted = Boolean(lastMsg.deletedAt || lastMsg.isDeleted);
    lastMessageFormatted = {
      id: lastMsg.id,
      content: isDeleted ? "This message was deleted" : lastMsg.content,
      senderId: lastMsg.userId,
      senderName: senderAccount?.displayName ?? lastMsg.senderName ?? "Unknown",
      senderAvatar: senderAccount?.profileImageUrl ?? lastMsg.senderAvatar ?? null,
      createdAt: new Date(lastMsg.ixTimeTimestamp || lastMsg.createdAt || Date.now()),
      isDeleted,
    };
  }

  return {
    id: conv.id,
    createdAt: new Date(conv.createdAt || Date.now()),
    updatedAt: new Date(conv.updatedAt || Date.now()),
    lastMessageAt: new Date(conv.lastActivity || conv.updatedAt || Date.now()),
    channelId: conv.channelId ?? undefined,
    isGroup: Boolean(conv.isGroup),
    subject: conv.subject ?? undefined,
    otherParticipants: otherAccounts,
    lastMessage: lastMessageFormatted,
    unreadCount,
    accountId: actorId,
    account: actorAccount,
  };
}

export function formatThinkpagesMessage(
  msg: any,
  _actorId: string,
  accountMap: Map<string, UserAccount>
) {
  const senderAccount = accountMap.get(msg.userId);
  const isDeleted = Boolean(msg.deletedAt || msg.isDeleted);
  const isEdited = Boolean(msg.editedAt || msg.isEdited);
  const timestamp = new Date(msg.ixTimeTimestamp || msg.createdAt || Date.now());

  let replyToFormatted = undefined;
  if (msg.replyTo) {
    const replySender = accountMap.get(msg.replyTo.userId);
    const replyDeleted = Boolean(msg.replyTo.deletedAt || msg.replyTo.isDeleted);
    replyToFormatted = {
      id: msg.replyTo.id,
      content: replyDeleted ? "This message was deleted" : msg.replyTo.content,
      senderName: replySender?.displayName ?? msg.replyTo.senderName ?? "Unknown",
    };
  }

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    userId: msg.userId,
    content: isDeleted ? "This message was deleted" : msg.content,
    attachments: msg.attachments
      ? typeof msg.attachments === "string"
        ? JSON.parse(msg.attachments)
        : msg.attachments
      : [],
    replyToId: msg.replyToId ?? undefined,
    isDeleted,
    isEdited,
    createdAt: timestamp,
    updatedAt: new Date(msg.editedAt || msg.ixTimeTimestamp || Date.now()),
    senderName: senderAccount?.displayName ?? msg.senderName ?? "Unknown",
    senderAvatar: senderAccount?.profileImageUrl ?? msg.senderAvatar ?? null,
    replyTo: replyToFormatted,
  };
}
