/**
 * Shared types for bridge adapters that sync external messaging systems
 * (MediaWiki talk pages, XenForo conversations) into ThinkShare.
 */

import type { PrismaClient } from "@prisma/client";

export interface BridgeMessage {
  externalId: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: Date;
}

export interface BridgeSyncResult {
  conversationsCreated: number;
  conversationsUpdated: number;
  messagesCreated: number;
}

export interface BridgeAdapter {
  /** Pull external messages into ThinkShare for a given user. */
  syncInbound(userId: string, db: PrismaClient): Promise<BridgeSyncResult>;

  /** Push a ThinkShare reply to the external system. */
  sendOutbound(
    conversationSourceId: string,
    content: string,
    userId: string,
    db: PrismaClient
  ): Promise<{ success: boolean; error?: string }>;
}
