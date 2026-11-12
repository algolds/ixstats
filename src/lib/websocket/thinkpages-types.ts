// ThinkPages WebSocket Types
// Real-time messaging, presence, and group functionality
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";

export interface PresenceUpdate {
  id: string;
  accountId: string;
  status: "online" | "away" | "busy" | "offline";
  lastSeen: number;
  activity?: string;
}

export interface TypingIndicator {
  id: string;
  accountId: string;
  conversationId?: string;
  groupId?: string;
  isTyping: boolean;
  timestamp: number;
}

/** A message event as the server broadcasts it to a room (and through the Redis bridge). */
export interface ThinkPagesMessageEvent {
  type: "message:new" | "message:updated" | "message:deleted";
  conversationId?: string;
  groupId?: string;
  messageId: string;
  accountId: string;
  content?: string;
  timestamp: number;
  /**
   * Clerk ids allowed to receive this event. When set, only those users' sockets in the room get
   * it (the sender filtered out blockers and pending requests); unset means every room member.
   */
  recipientIds?: string[];
}

/** What the server emits on `message:update`: the event wrapped, which the client hook unwraps. */
export interface MessageUpdateEnvelope {
  type: "message:update";
  data: ThinkPagesMessageEvent;
  timestamp: number;
  channel: string;
}

/** A lightweight "something arrived in this thread" ping to a recipient's user room: no content. */
export interface InboxUpdate {
  type: "inbox:update";
  conversationId: string;
  timestamp: number;
}

interface GroupUpdate {
  id: string;
  type: "group:created" | "group:updated" | "group:deleted" | "member:joined" | "member:left";
  groupId: string;
  accountId?: string;
  data: any;
  timestamp: number;
}

interface ConversationUpdate {
  id: string;
  type: "conversation:created" | "conversation:updated" | "conversation:deleted";
  conversationId: string;
  participants: string[];
  data: any;
  timestamp: number;
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  conversationId?: string;
  groupId?: string;
  accountId: string;
  readAt: number;
}

export interface ThinkPagesClientState {
  connected: boolean;
  authenticated: boolean;
  accountId?: string;
  subscriptions: Set<string>;
  presenceStatus: "online" | "away" | "busy" | "offline";
  activeConversations: Set<string>;
  activeGroups: Set<string>;
  typingIndicators: Map<string, TypingIndicator>;
  lastHeartbeat: number;
  connectionId?: string;
}

export interface ThinkPagesWebSocketHookOptions {
  accountId?: string;
  /** Connect without a session (a signed-out reader): the server lets it into public realm board rooms only. */
  anonymous?: boolean;
  onBoardEvent?: (event: BoardLiveEvent) => void;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  subscribeToPresence?: boolean;
  onPresenceUpdate?: (update: PresenceUpdate) => void;
  onTypingUpdate?: (update: TypingIndicator) => void;
  /** Receives the unwrapped event (`message:new`, `message:updated` or `message:deleted`). */
  onMessageUpdate?: (event: ThinkPagesMessageEvent) => void;
  /** A thread the user is not viewing got a message (the inbox should refresh). */
  onInboxUpdate?: (update: InboxUpdate) => void;
  onGroupUpdate?: (update: GroupUpdate) => void;
  onConversationUpdate?: (update: ConversationUpdate) => void;
  onReadReceipt?: (receipt: ReadReceipt) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
