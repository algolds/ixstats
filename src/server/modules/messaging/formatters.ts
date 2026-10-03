/**
 * Pure Response Formatters for Messaging Surfaces (Plan 163)
 *
 * Owns deterministic mapping from canonical entities & accounts into
 * exact response shapes for both `messages` and legacy `thinkpages.messaging`.
 */

import type { UserAccount } from "./contracts";
import { UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";

// ─── Formatters for `api.messages` ───────────────────────────────────────────

/** Stand-in account for a participant the account lookup did not resolve. */
function fallbackAccount(userId: string) {
  return {
    id: userId,
    username: userId,
    displayName: userId.startsWith("forum:")
      ? "Forum User"
      : userId.startsWith("wiki:")
        ? "Wiki User"
        : UNKNOWN_DISPLAY_NAME,
    profileImageUrl: null,
    countryFlag: null,
    countryName: null,
    accountType: "country" as const,
  };
}

function formatLastMessage(conv: any, accountMap: Map<string, UserAccount>) {
  const lastMsg = conv.messages?.[0] || conv.lastMessage;
  if (!lastMsg) return null;
  const senderAccount = accountMap.get(lastMsg.userId);
  const isDeleted = Boolean(lastMsg.deletedAt || lastMsg.isDeleted);
  return {
    id: lastMsg.id,
    content: isDeleted ? "This message was deleted" : lastMsg.content,
    senderId: lastMsg.userId,
    senderName: senderAccount?.displayName ?? lastMsg.senderName ?? "Unknown",
    senderAvatar: senderAccount?.profileImageUrl ?? lastMsg.senderAvatar ?? null,
    createdAt: new Date(lastMsg.ixTimeTimestamp || lastMsg.createdAt || Date.now()),
    isDeleted,
  };
}

interface MessagesConversationResult {
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
    const acc = accountMap.get(p.userId) || fallbackAccount(p.userId);
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
    const fallbackAcc = fallbackAccount(firstId);
    otherAccounts.push({
      ...fallbackAcc,
      id: firstId,
      accountId: firstId,
      account: fallbackAcc,
    });
  }

  const lastMessageFormatted = formatLastMessage(conv, accountMap);

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

  const lastMessageFormatted = formatLastMessage(conv, accountMap);

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
