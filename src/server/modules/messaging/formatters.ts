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
    lastMessageFormatted = {
      id: lastMsg.id,
      content: lastMsg.isDeleted ? "This message was deleted" : lastMsg.content,
      senderId: lastMsg.userId,
      senderName: senderAccount?.displayName ?? lastMsg.senderName ?? "Unknown",
      senderAvatar: senderAccount?.profileImageUrl ?? lastMsg.senderAvatar ?? null,
      createdAt: new Date(lastMsg.createdAt),
      isDeleted: Boolean(lastMsg.isDeleted),
    };
  }

  return {
    id: conv.id,
    subject: conv.subject ?? null,
    isGroup: Boolean(conv.isGroup),
    channelId: conv.channelId ?? null,
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
    lastMessageAt: new Date(conv.lastMessageAt || conv.updatedAt),
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

  let replyToFormatted = undefined;
  if (msg.replyTo) {
    const replySender = accountMap.get(msg.replyTo.userId);
    replyToFormatted = {
      id: msg.replyTo.id,
      content: msg.replyTo.isDeleted ? "This message was deleted" : msg.replyTo.content,
      senderName: replySender?.displayName ?? msg.replyTo.senderName ?? "Unknown",
    };
  }

  const rawReactions = msg.reactions || [];
  const reactionMap = new Map<string, string[]>();
  for (const r of rawReactions) {
    const users = reactionMap.get(r.emoji) || [];
    users.push(r.userId);
    reactionMap.set(r.emoji, users);
  }

  const reactions = Array.from(reactionMap.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.length,
    users,
    hasReacted: users.includes(actorId),
  }));

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.userId,
    sender: senderAccount,
    content: msg.isDeleted ? "This message was deleted" : msg.content,
    attachments: msg.attachments ?? [],
    reactions,
    replyTo: replyToFormatted,
    isDeleted: Boolean(msg.isDeleted),
    isEdited: Boolean(msg.isEdited),
    createdAt: new Date(msg.createdAt),
    updatedAt: new Date(msg.updatedAt),
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
    lastMessageFormatted = {
      id: lastMsg.id,
      content: lastMsg.isDeleted ? "This message was deleted" : lastMsg.content,
      senderId: lastMsg.userId,
      senderName: senderAccount?.displayName ?? lastMsg.senderName ?? "Unknown",
      senderAvatar: senderAccount?.profileImageUrl ?? lastMsg.senderAvatar ?? null,
      createdAt: new Date(lastMsg.createdAt),
      isDeleted: Boolean(lastMsg.isDeleted),
    };
  }

  return {
    id: conv.id,
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
    lastMessageAt: new Date(conv.lastMessageAt || conv.updatedAt),
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

  let replyToFormatted = undefined;
  if (msg.replyTo) {
    const replySender = accountMap.get(msg.replyTo.userId);
    replyToFormatted = {
      id: msg.replyTo.id,
      content: msg.replyTo.isDeleted ? "This message was deleted" : msg.replyTo.content,
      senderName: replySender?.displayName ?? msg.replyTo.senderName ?? "Unknown",
    };
  }

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    userId: msg.userId,
    content: msg.isDeleted ? "This message was deleted" : msg.content,
    attachments: msg.attachments ?? [],
    replyToId: msg.replyToId ?? undefined,
    isDeleted: Boolean(msg.isDeleted),
    isEdited: Boolean(msg.isEdited),
    createdAt: new Date(msg.createdAt),
    updatedAt: new Date(msg.updatedAt),
    senderName: senderAccount?.displayName ?? msg.senderName ?? "Unknown",
    senderAvatar: senderAccount?.profileImageUrl ?? msg.senderAvatar ?? null,
    replyTo: replyToFormatted,
  };
}
