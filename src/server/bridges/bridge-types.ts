/**
 * Shared types for ThinkShare bridge adapters (the MediaWiki talk page bridge; the XenForo forum bridge was
 * retired in ThinkPages forum phase 4b).
 */

import type { PrismaClient } from "@prisma/client";

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
