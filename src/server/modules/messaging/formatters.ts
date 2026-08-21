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
  type: string;
  name: string | null;
  avatar: string | null;
  subject: string | null;
  isGroup: boolean;
  channelId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  lastMessageAt: Date;
  source: string;
  sourceId: string | null;
  conversationType: string | null;
  diplomaticClassification: string | null;
  priority: string | null;
  isActive: boolean;
  participantCount: number;
  unreadCount: number;
  otherParticipants: any[];
  otherParticipant?: any;
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

  const otherAccounts: any[] = otherParts.map((p) => {
    const acc = accountMap.get(p.userId) || {
      id: p.userId,
      username: p.userId,
      displayName: p.userId.startsWith("forum:")
        ? "Forum User"
        : p.userId.startsWith("wiki:")
          ? "Wiki User"
          : `User ${p.userId.slice(0, 8)}`,
      profileImageUrl: null,
      countryFlag: null,
      countryName: null,
      accountType: "country" as const,
    };
    return {
      ...acc,
      id: p.id || p.userId,
      accountId: p.userId,
      account: acc,
    };
  });

  // If no account found but other participants exist, generate fallback
  if (otherAccounts.length === 0 && otherParts.length > 0) {
    const firstId = otherParts[0]!.userId;
    const fallbackAcc = {
      id: firstId,
      username: firstId,
      displayName: firstId.startsWith("forum:")
        ? "Forum User"
        : firstId.startsWith("wiki:")
          ? "Wiki User"
          : `User ${firstId.slice(0, 8)}`,
      profileImageUrl: null,
      countryFlag: null,
      countryName: null,
      accountType: "country" as const,
    };
    otherAccounts.push({
      ...fallbackAcc,
      id: firstId,
      accountId: firstId,
      account: fallbackAcc,
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

  const isGroupConv = conv.type === "group" || conv.source === "thinktank" || Boolean(conv.isGroup);

  return {
    id: conv.id,
    type: isGroupConv ? "group" : (conv.type ?? "direct"),
    name: conv.name ?? conv.subject ?? conv.thinktankGroup?.name ?? null,
    avatar: conv.avatar ?? conv.thinktankGroup?.avatar ?? null,
    subject: conv.subject ?? null,
    isGroup: isGroupConv,
    channelId: conv.channelId ?? null,
    createdAt: new Date(conv.createdAt || Date.now()),
    updatedAt: new Date(conv.updatedAt || Date.now()),
    lastActivity: new Date(conv.lastActivity || conv.updatedAt || Date.now()),
    lastMessageAt: new Date(conv.lastActivity || conv.updatedAt || Date.now()),
    source: conv.source || "thinkshare",
    sourceId: conv.sourceId ?? conv.thinktankGroup?.id ?? null,
    conversationType: conv.conversationType ?? null,
    diplomaticClassification: conv.diplomaticClassification ?? null,
    priority: conv.priority ?? null,
    isActive: conv.isActive ?? true,
    participantCount: participants.length,
    unreadCount,
    otherParticipants: otherAccounts,
    otherParticipant: otherAccounts[0]?.account ?? otherAccounts[0],
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
