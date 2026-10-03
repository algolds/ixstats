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

  /** Map of other users' presence statuses */
  presenceMap?: Record<string, string>;

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
interface TypingIndicator {
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
 * ThinkShare account information
 */
interface ThinkShareAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  countryFlag?: string | null;
  countryName?: string | null;
  accountType: "government" | "media" | "citizen" | "country";
}

/**
 * ThinkShare conversation participant
 */
interface ThinkShareParticipant {
  id: string;
  accountId: string;
  account: ThinkShareAccount;
  countryFlag?: string | null;
  countryName?: string | null;
  isActive: boolean;
  joinedAt?: Date;
  lastReadAt?: Date;
}

/**
 * ThinkShare message
 */
interface ThinkShareMessage {
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
  source?: string;
  classification?: string | null;
  priority?: string | null;
  subject?: string | null;
  editedAt?: Date;
  deletedAt?: Date;
}

/**
 * Message reaction (emoji, like, etc.)
 */
interface MessageReaction {
  id: string;
  messageId: string;
  accountId: string;
  emoji: string;
  createdAt: Date;
}

/**
 * Message mention (@username)
 */
interface MessageMention {
  id: string;
  messageId: string;
  accountId: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Message attachment (file, image, etc.)
 */
interface MessageAttachment {
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
interface MessageReadReceipt {
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
  source?: string;
  sourceId?: string | null;
  conversationType?: string;
  diplomaticClassification?: string | null;
  priority?: string | null;
  isActive: boolean;
  lastActivity: Date;
  otherParticipants: ThinkShareParticipant[];
  lastMessage?: ThinkShareMessage;
  lastReadAt?: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}
