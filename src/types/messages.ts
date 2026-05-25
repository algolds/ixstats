/**
 * ThinkShare Unified Messaging System — Type Definitions
 *
 * Extends the base ThinkShare types with folder organization,
 * contextual identity resolution, and cross-system message sources.
 */

import type { LucideIcon } from "lucide-react";
import type { ThinkShareConversation } from "./thinkshare";

// ─── Folder System ───────────────────────────────────────────────

export type MessageFolder =
  | "inbox"
  | "personal"
  | "diplomatic"
  | "discussions"
  | "groups"
  | "system";

export interface MessageFolderConfig {
  id: MessageFolder;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Accent color class for the icon, e.g. "text-blue-500" */
  gradient: string;
  /** Active state classes: tinted bg + border, e.g. "bg-blue-500/10 border-blue-500/40" */
  activeGlow: string;
  emptyTitle: string;
  emptyDescription: string;
}

// ─── Identity Resolution ─────────────────────────────────────────

export interface ResolvedIdentity {
  displayName: string;
  avatar: string | null;
  badgeIcon?: LucideIcon;
  badgeColor?: string;
  /** Source system label, e.g. "Wiki", "Forum", "Diplomatic" */
  sourceLabel?: string;
}

export interface IxnayIdStatus {
  wikiUsername: string | null;
  wikiUserId: number | null;
  forumUsername: string | null;
  forumUserId: number | null;
  discordUsername: string | null;
  discordUserId: string | null;
}

// ─── Message Source (Phase 2 prep) ───────────────────────────────

export type MessageSource = "thinkshare" | "thinktank" | "diplomatic" | "wiki" | "forum" | "system";

// ─── Folder Classification ──────────────────────────────────────

export type FolderClassification = Record<MessageFolder, ThinkShareConversation[]>;

// ─── Router State ────────────────────────────────────────────────

export interface MessagesRouterState {
  activeFolder: MessageFolder;
  selectedConversationId: string | null;
  searchQuery: string;
  showNewConversationModal: boolean;
}
