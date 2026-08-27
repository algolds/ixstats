/**
 * Wiki Notifications Bridge — Syncs MediaWiki notifications/alerts into ThinkShare.
 *
 * Inbound:  Fetches watchlist changes and user talk page notifications → creates ThinkShare messages
 * Outbound: Not applicable for notifications (read-only sync)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";

import { getArticleWikitext, getRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge";

/** Fetch recent changes to pages (watchlist proxy). */
// oxlint-disable-next-line typescript/no-unused-vars
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
    const changes = await getRecentChanges(limit);
    return (changes || [])
      .filter((rc) => rc.user !== wikiUsername)
      .map((rc) => ({
        title: rc.title,
        user: rc.user,
        timestamp: rc.timestamp,
        comment: rc.comment || "",
        type: rc.type || "edit",
        newLen: rc.newLen || 0,
        oldLen: rc.oldLen || 0,
      }));
  } catch {
    return [];
  }
}

/** Check if user's talk page has new messages. */
async function getUserTalkPageMessages(
  wikiUsername: string
): Promise<{ hasMessages: boolean; content: string | null }> {
  try {
    const talkTitle = `User talk:${wikiUsername.replace(/ /g, "_")}`;
    const article = await getArticleWikitext(talkTitle, "ixwiki");
    const wikitext = article?.wikitext ?? "";
    if (!wikitext) return { hasMessages: false, content: null };
    return { hasMessages: wikitext.length > 0, content: wikitext };
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
