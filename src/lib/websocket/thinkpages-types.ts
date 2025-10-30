// ThinkPages WebSocket Types
// Real-time messaging, presence, and group functionality

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

export interface MessageUpdate {
  documentId: string | undefined;
  id: string;
  type: "message:new" | "message:updated" | "message:deleted" | "message:read";
  conversationId?: string;
  groupId?: string;
  messageId: string;
  accountId: string;
  content?: string;
  timestamp: number;
  readBy?: string[];
}

export interface GroupUpdate {
  id: string;
  type: "group:created" | "group:updated" | "group:deleted" | "member:joined" | "member:left";
  groupId: string;
  accountId?: string;
  data: any;
  timestamp: number;
}

export interface ConversationUpdate {
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

export interface ThinkPagesWebSocketEvent {
  type:
    | "presence:update"
    | "typing:update"
    | "message:update"
    | "group:update"
    | "conversation:update"
    | "read:receipt";
  data:
    | PresenceUpdate
    | TypingIndicator
    | MessageUpdate
    | GroupUpdate
    | ConversationUpdate
    | ReadReceipt;
  timestamp: number;
  channel: string;
  accountId?: string;
}

export interface ThinkPagesSubscription {
  type: "presence" | "conversations" | "groups" | "account";
  channel: string;
  accountId?: string;
  conversationId?: string;
  groupId?: string;
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
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  subscribeToPresence?: boolean;
  onPresenceUpdate?: (update: PresenceUpdate) => void;
  onTypingUpdate?: (update: TypingIndicator) => void;
  onMessageUpdate?: (update: MessageUpdate) => void;
  onGroupUpdate?: (update: GroupUpdate) => void;
  onConversationUpdate?: (update: ConversationUpdate) => void;
  onReadReceipt?: (receipt: ReadReceipt) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
