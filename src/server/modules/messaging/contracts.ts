/**
 * Messaging Domain Contracts (Plan 163)
 *
 * Defines canonical domain types, collaborator interfaces, command inputs,
 * and query parameters shared by both `messages` and `thinkpages.messaging` adapters.
 */

import type { PrismaClient } from "@prisma/client";

export type MessageSource = "thinkshare" | "thinktank" | "diplomatic" | "wiki" | "forum" | "system";

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
  | "conversations";

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  accountType: "country";
}

export interface NotificationCollaborator {
  create(data: {
    userId: string;
    type?: string;
    actorId?: string | null;
    entityId?: string | null;
    entityType?: string | null;
    message?: string | null;
    title?: string | null;
    link?: string | null;
    href?: string | null;
    category?: string;
    priority?: string;
    metadata?: any;
    source?: string;
    actionable?: boolean;
  }): Promise<any>;
}

export interface WebSocketCollaborator {
  broadcastMessage?(payload: any): void;
  broadcastToUsers?(userIds: string[], event: string, payload: any): void;
}

export interface BridgeCollaborator {
  syncInbound?(actorId: string, db: any): Promise<any>;
  postOutbound?(data: any): Promise<any>;
  sendOutbound?(sourceId: string, content: string, principalId: string, db: any): Promise<any>;
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
  db: PrismaClient | any;
  notifications?: NotificationCollaborator | any;
  websocket?: WebSocketCollaborator | any | null;
  forumBridge?: BridgeCollaborator | any;
  wikiBridge?: BridgeCollaborator | any;
  telemetry?: TelemetryLogger;
}

// ─── Command / Query Inputs ──────────────────────────────────────────────────

export interface GetConversationsByFolderInput {
  folder: MessageFolder;
  limit?: number;
  cursor?: string;
}

export interface GetConversationsLegacyInput {
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
}

export interface CreateConversationByCountriesInput {
  countryIds: string[];
  subject?: string;
  initialMessage?: string;
  source?: MessageSource;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  replyToId?: string;
  attachments?: any[];
  source?: MessageSource;
  subject?: string;
  // Diplomatic metadata fields
  senderCountryId?: string;
  senderCountryName?: string;
  senderCountryFlag?: string;
  recipientCountryId?: string;
  recipientCountryName?: string;
  recipientCountryFlag?: string;
  diplomaticType?: string;
  importance?: string;
  title?: string;
  metadata?: any;
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

export interface SearchUsersInput {
  query: string;
  limit?: number;
  excludeCurrent?: boolean;
}

export interface UpdatePresenceInput {
  status: "online" | "away" | "offline";
  currentCountryId?: string;
  customStatus?: string;
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
