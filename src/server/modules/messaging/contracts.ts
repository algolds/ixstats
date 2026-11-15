/**
 * Messaging Domain Contracts (Plan 163)
 *
 * Defines canonical domain types, collaborator interfaces, command inputs,
 * and query parameters shared by both `messages` and `thinkpages.messaging` adapters.
 */

import type { PrismaClient } from "@prisma/client";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-types";

export const DEFAULT_USER_MESSAGE_CAP = 1000;
/** Most people a group conversation holds, its creator included (creating and adding). */
export const MAX_GROUP_PARTICIPANTS = 50;
/** Longest message body, the same as a ThinkPages post. */
export const MAX_MESSAGE_LENGTH = 10_000;

export type MessageSource =
  | "thinkshare"
  | "thinktank"
  | "diplomatic"
  | "wiki"
  | "forum"
  | "system"
  | "sports"
  | "lorebot";

export type MessageFolder =
  | "inbox"
  | "sent"
  | "archive"
  | "trash"
  | "thinktank"
  | "diplomatic"
  | "wiki"
  | "forum"
  | "personal"
  | "discussions"
  | "groups"
  | "system"
  | "conversations"
  /** Message requests (SL-4): conversations the actor holds as a pending request. */
  | "requests";

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  /** The player's nation flag and name (null for a player with no nation). */
  countryFlag: string | null;
  countryName: string | null;
  country: { flag: string | null; name: string } | null;
  accountType: "country";
}

/** What the service asks of the notification API (a new-message notice to one user). */
export interface NotificationCollaborator {
  create(data: {
    userId: string;
    type: "info";
    category: "social";
    priority: "low";
    title: string;
    message: string;
    href: string;
  }): Promise<unknown>;
}

export interface WebSocketCollaborator {
  /** Delivers the event to the sockets of `event.recipientIds` in the conversation's room. */
  broadcastMessage?(event: ThinkPagesMessageEvent): void;
  /** Takes a user's sockets out of a conversation room they left or declined. */
  evictFromRoom?(event: { type: "room:evict"; clerkUserId: string; conversationId: string }): void;
}

export interface BridgeCollaborator {
  syncInbound?(actorId: string, db: PrismaClient): Promise<unknown>;
}

export interface TelemetryPayload {
  surface: "thinkpages" | "messages";
  procedure: string;
  authenticated: boolean;
  success: boolean;
  durationMs?: number;
}

export interface TelemetryLogger {
  logEvent(payload: TelemetryPayload): void;
}

export interface MessagingDependencies {
  db: PrismaClient;
  notifications?: NotificationCollaborator;
  websocket?: WebSocketCollaborator | null;
  wikiBridge?: BridgeCollaborator;
  telemetry?: TelemetryLogger;
}

export interface GetConversationsByFolderInput {
  folder: MessageFolder;
  limit?: number;
  cursor?: string;
}

export interface GetConversationMessagesInput {
  conversationId: string;
  limit?: number;
  cursor?: string;
  direction?: "before" | "after";
}

export interface CreateConversationInput {
  participantIds: string[];
  subject?: string;
  initialMessage?: string;
  source?: MessageSource;
  channelId?: string;
  conversationType?: "personal" | "diplomatic" | "official";
  diplomaticClassification?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";
  channelType?: "BILATERAL" | "MULTILATERAL" | "EMERGENCY";
  /** The caller is an administrator (the router decides): only they may start an "official" conversation. */
  actorIsAdmin?: boolean;
}

export interface MessageAttachment {
  type: string;
  url: string;
  filename?: string;
  size?: number;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  replyToId?: string;
  attachments?: MessageAttachment[];
  messageType?: "text" | "image" | "file";
  /** Clerk ids the message mentions; only people in the conversation are kept. */
  mentions?: string[];
  /** Kept only in a diplomatic conversation. */
  classification?: string;
  priority?: string;
  subject?: string;
}

export interface EditMessageInput {
  messageId: string;
  content: string;
}

export interface DeleteMessageInput {
  messageId: string;
}

export interface MarkMessagesAsReadInput {
  conversationId: string;
  messageIds?: string[];
}

export interface AddReactionInput {
  messageId: string;
  emoji: string;
}

export interface RemoveReactionInput {
  messageId: string;
  emoji: string;
}

export interface AddParticipantInput {
  conversationId: string;
  targetUserId: string;
  role?: "admin" | "member";
}

export interface LeaveConversationInput {
  conversationId: string;
}

export interface RespondToRequestInput {
  conversationId: string;
  accept: boolean;
}

export interface SetConversationPreferencesInput {
  conversationId: string;
  muted?: boolean;
  archived?: boolean;
}

export interface SearchUsersInput {
  query: string;
  limit?: number;
  excludeCurrent?: boolean;
}

export interface SendAdminBroadcastInput {
  title: string;
  description?: string;
  message?: string;
  category?: string;
  level?: "low" | "medium" | "high" | "critical";
  type?: string;
  href?: string;
  scope: "global" | "country" | "user";
  countryId?: string;
  userId?: string;
  actionable?: boolean;
  metadata?: any;
}

export interface SendAdminMessageInput {
  targetUserId: string;
  content: string;
  subject?: string;
  source?: MessageSource;
  conversationType?: "personal" | "diplomatic" | "official";
  classification?: string;
}
