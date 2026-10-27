// Folder System

export type MessageFolder = "conversations" | "requests";

export type ChannelFilter = "all" | "diplomatic" | "direct" | "community";

export const SYSTEM_CONVERSATION_ID = "system_messages";
export const LOREBOT_CONVERSATION_ID = "lorebot_feed";

export interface MessageFolderConfig {
  id: MessageFolder;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

// Identity Resolution

export interface ResolvedIdentity {
  displayName: string;
  avatar: string | null;
  badgeIcon?: React.ComponentType<{ className?: string }>;
  badgeColor?: string;
  /** Source system label, e.g. "Wiki", "Forum", "Diplomatic" */
  sourceLabel?: string;
}

// Message Source (Phase 2 prep)
// Folder Classification
// Router State
