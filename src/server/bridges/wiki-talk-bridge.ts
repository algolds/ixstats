/**
 * Wiki Notifications Bridge — Syncs MediaWiki notifications/alerts into ThinkShare.
 *
 * Inbound:  Fetches watchlist changes and user talk page notifications → creates ThinkShare messages
 * Outbound: Not applicable for notifications (read-only sync)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";

import { ixwikiGetNamespacedWikitext, ixwikiRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge/mysql-reader";

/** Fetch recent changes to pages (watchlist proxy). */
async function getUserWatchlistChanges(
  wikiUsername: string,
  limit = 20
): Promise<
  {
    title: string;
    user: string;
    timestamp: string;
    comment: string;
    type: string;
    newLen: number;
    oldLen: number;
  }[]
> {
  try {
    const changes = await ixwikiRecentChanges(limit);
    return changes.filter((rc) => rc.user !== wikiUsername);
  } catch {
    return [];
  }
}

/** Check if user's talk page has new messages via direct MariaDB query. */
async function getUserTalkPageMessages(
  wikiUsername: string
): Promise<{ hasMessages: boolean; content: string | null }> {
  try {
    const res = await ixwikiGetNamespacedWikitext(wikiUsername, 3);
    if (!res?.wikitext) return { hasMessages: false, content: null };
    return { hasMessages: res.wikitext.length > 0, content: res.wikitext };
  } catch {
    return { hasMessages: false, content: null };
  }
}

// ─── Bridge Implementation ───────────────────────────────────────

export const wikiTalkBridge: BridgeAdapter = {
  async syncInbound(userId: string, db: PrismaClient): Promise<BridgeSyncResult> {
    const result: BridgeSyncResult = {
      conversationsCreated: 0,
      conversationsUpdated: 0,
      messagesCreated: 0,
    };

    // Get user's wiki username
    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { wikiUsername: true },
    });

    if (!user?.wikiUsername) return result;

    // (Note: Watchlist and wiki activity stream have been promoted to the dedicated pinned LoreBot channel)

    // ── Check user talk page for new messages ──
    const talkPage = await getUserTalkPageMessages(user.wikiUsername);
    if (talkPage.hasMessages && talkPage.content) {
      const talkSourceId = `wiki-talk:${user.wikiUsername}`;
      let talkConv = await db.thinkshareConversation.findFirst({
        where: { source: "wiki", sourceId: talkSourceId },
      });

      if (!talkConv) {
        talkConv = await db.thinkshareConversation.create({
          data: {
            type: "direct",
            name: `Talk: ${user.wikiUsername}`,
            source: "wiki",
            sourceId: talkSourceId,
            isActive: true,
          },
        });
        await db.conversationParticipant.create({
          data: {
            conversationId: talkConv.id,
            userId,
            role: "participant",
            lastReadAt: new Date(0),
          },
        });
        result.conversationsCreated++;
      }
    }

    return result;
  },

  async sendOutbound(
    _conversationSourceId: string,
    _content: string,
    _userId: string,
    _db: PrismaClient
  ): Promise<{ success: boolean; error?: string }> {
    // Wiki notifications are read-only — replies go through WikiOS talk page UI
    return {
      success: false,
      error: "Wiki notifications are read-only. Use the wiki talk page to reply.",
    };
  },
};
