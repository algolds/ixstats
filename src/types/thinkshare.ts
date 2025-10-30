/**
 * ThinkShare Type Definitions
 *
 * Comprehensive types for the ThinkShare messaging and collaboration system.
 */

/**
 * Client-side state for ThinkShare features
 */
export interface ThinkShareClientState {
  /** Current user's presence status */
  presenceStatus: "online" | "away" | "busy" | "offline";

  /** Map of active typing indicators by indicator ID */
  typingIndicators: Map<string, TypingIndicator>;

  /** Connection status to real-time services */
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";

  /** Last sync timestamp */
  lastSyncTime?: Date;

  /** Active notifications count */
  unreadCount: number;
}

/**
 * Typing indicator for real-time collaboration
 */
export interface TypingIndicator {
  /** Unique identifier for this typing indicator */
  id: string;

  /** Conversation where typing is occurring */
  conversationId: string;

  /** Account ID of the user typing */
  accountId: string;

  /** When typing started */
  startedAt: Date;

  /** When typing indicator expires */
  expiresAt: Date;
}

/**
 * State for individual conversation
 */
export interface ConversationState {
  /** Conversation ID */
  id: string;

  /** Whether conversation is currently selected/active */
  isSelected: boolean;

  /** Whether user is typing in this conversation */
  isTyping: boolean;

  /** Draft message content */
  draftMessage: string;

  /** Unread message count */
  unreadCount: number;

  /** Last read timestamp */
  lastReadAt?: Date;

  /** Whether conversation is muted */
  isMuted: boolean;

  /** Whether conversation is pinned */
  isPinned: boolean;
}

/**
 * ThinkShare account information
 */
export interface ThinkShareAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: "government" | "media" | "citizen" | "country";
}

/**
 * ThinkShare conversation participant
 */
export interface ThinkShareParticipant {
  id: string;
  accountId: string;
  account: ThinkShareAccount;
  isActive: boolean;
  joinedAt?: Date;
  lastReadAt?: Date;
}

/**
 * ThinkShare message
 */
export interface ThinkShareMessage {
  id: string;
  conversationId: string;
  accountId: string;
  account: ThinkShareAccount;
  content: string;
  messageType: "text" | "system" | "announcement";
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: MessageReaction[];
  mentions?: MessageMention[];
  attachments?: MessageAttachment[];
  replyTo?: ThinkShareMessage;
  readReceipts?: MessageReadReceipt[];
  isSystem?: boolean;
  editedAt?: Date;
  deletedAt?: Date;
}

/**
 * Message reaction (emoji, like, etc.)
 */
export interface MessageReaction {
  id: string;
  messageId: string;
  accountId: string;
  emoji: string;
  createdAt: Date;
}

/**
 * Message mention (@username)
 */
export interface MessageMention {
  id: string;
  messageId: string;
  accountId: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Message attachment (file, image, etc.)
 */
export interface MessageAttachment {
  id: string;
  messageId: string;
  url: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
}

/**
 * Message read receipt
 */
export interface MessageReadReceipt {
  id: string;
  messageId: string;
  accountId: string;
  readAt: Date;
}

/**
 * ThinkShare conversation
 */
export interface ThinkShareConversation {
  id: string;
  type: "direct" | "group" | "channel";
  name?: string | null;
  avatar?: string | null;
  isActive: boolean;
  lastActivity: Date;
  otherParticipants: ThinkShareParticipant[];
  lastMessage?: ThinkShareMessage;
  lastReadAt?: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation list filters
 */
export interface ConversationFilters {
  searchQuery: string;
  showArchived: boolean;
  showMuted: boolean;
  filterByType?: "direct" | "group" | "channel";
  sortBy: "recent" | "unread" | "alphabetical";
}

/**
 * ThinkShare notification
 */
export interface ThinkShareNotification {
  id: string;
  accountId: string;
  type: "message" | "mention" | "reaction" | "invitation";
  conversationId?: string;
  messageId?: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Real-time event types for ThinkShare
 */
export type ThinkShareEvent =
  | { type: "message.new"; data: ThinkShareMessage }
  | { type: "message.edited"; data: ThinkShareMessage }
  | { type: "message.deleted"; data: { messageId: string; conversationId: string } }
  | { type: "typing.start"; data: TypingIndicator }
  | { type: "typing.stop"; data: { accountId: string; conversationId: string } }
  | {
      type: "presence.update";
      data: { accountId: string; status: ThinkShareClientState["presenceStatus"] };
    }
  | { type: "conversation.updated"; data: ThinkShareConversation }
  | { type: "read.receipt"; data: MessageReadReceipt };
