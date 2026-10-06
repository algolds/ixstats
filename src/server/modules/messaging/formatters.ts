/**
 * Pure Response Formatters for Messaging Surfaces (Plan 163)
 *
 * Owns deterministic mapping from canonical entities & accounts into
 * exact response shapes for both `messages` and legacy `thinkpages.messaging`.
 */

import type { UserAccount } from "./contracts";
import { UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";

const toDate = (value: Date | string | number | null | undefined) => new Date(value || Date.now());

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
    createdAt: toDate(lastMsg.ixTimeTimestamp || lastMsg.createdAt),
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
  /** The actor holds this conversation as an unanswered message request (SL-4). */
  isRequest: boolean;
  /** Another participant has not yet accepted it as a message request. */
  awaitingAcceptance: boolean;
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

function conversationDescriptor(conv: any) {
  return {
    id: conv.id,
    name: conv.name ?? conv.subject ?? conv.thinktankGroup?.name ?? null,
    avatar: conv.avatar ?? conv.thinktankGroup?.avatar ?? null,
    subject: conv.subject ?? null,
    channelId: conv.channelId ?? null,
    sourceId: conv.sourceId ?? conv.thinktankGroup?.id ?? null,
    conversationType: conv.conversationType ?? null,
    diplomaticClassification: conv.diplomaticClassification ?? null,
    priority: conv.priority ?? null,
  };
}

export function formatMessagesConversation(
  conv: any,
  actorId: string,
  accountMap: Map<string, UserAccount>,
  unreadCount = 0,
  /** Participants shown as online (presence.ts already applied their privacy setting). */
  online: ReadonlySet<string> = new Set()
): MessagesConversationResult {
  const participants: any[] = conv.participants || [];
  const others = participants.filter((p) => p.userId !== actorId);

  const otherAccounts: any[] = others.map((p) => {
    const acc = accountMap.get(p.userId) || fallbackAccount(p.userId);
    return {
      ...acc,
      id: p.id || p.userId,
      accountId: p.userId,
      account: acc,
      isOnline: online.has(p.userId),
    };
  });

  const isGroupConv = conv.type === "group" || conv.source === "thinktank" || Boolean(conv.isGroup);
  const lastActivity = toDate(conv.lastActivity || conv.updatedAt);

  return {
    ...conversationDescriptor(conv),
    type: isGroupConv ? "group" : (conv.type ?? "direct"),
    isGroup: isGroupConv,
    createdAt: toDate(conv.createdAt),
    updatedAt: toDate(conv.updatedAt),
    lastActivity,
    lastMessageAt: lastActivity,
    source: conv.source || "thinkshare",
    isActive: conv.isActive ?? true,
    participantCount: participants.length,
    unreadCount,
    isRequest: participants.some((p) => p.userId === actorId && p.requestStatus === "pending"),
    awaitingAcceptance: others.some((p) => p.requestStatus === "pending"),
    otherParticipants: otherAccounts,
    otherParticipant: otherAccounts[0]?.account ?? otherAccounts[0],
    lastMessage: formatLastMessage(conv, accountMap),
  };
}

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

  return {
    id: conv.id,
    createdAt: toDate(conv.createdAt),
    updatedAt: toDate(conv.updatedAt),
    lastMessageAt: toDate(conv.lastActivity || conv.updatedAt),
    channelId: conv.channelId ?? undefined,
    isGroup: Boolean(conv.isGroup),
    subject: conv.subject ?? undefined,
    otherParticipants: otherAccounts,
    lastMessage: formatLastMessage(conv, accountMap),
    unreadCount,
    accountId: actorId,
    account: actorAccount,
  };
}
