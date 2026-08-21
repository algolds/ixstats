/**
 * Wiki Notifications Bridge — Syncs MediaWiki notifications/alerts into ThinkShare.
 *
 * Inbound:  Fetches watchlist changes and user talk page notifications → creates ThinkShare messages
 * Outbound: Not applicable for notifications (read-only sync)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";

const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;

// ─── Helpers ─────────────────────────────────────────────────────

/** Fetch recent changes to pages the user has edited (watchlist proxy). */
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
    // Get pages the user has edited, then check recent changes on those pages
    const params = new URLSearchParams({
      action: "query",
      list: "recentchanges",
      rcnamespace: "0|1", // Main + Talk
      rclimit: String(limit),
      rcprop: "title|user|timestamp|comment|sizes|flags",
      rctype: "edit|new",
      format: "json",
    });

    const headers: Record<string, string> = {};
    if (botToken) headers.Authorization = `Bearer ${botToken}`;

    const res = await fetch(`${apiBase}?${params}`, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const changes = data?.query?.recentchanges ?? [];

    // Filter to changes NOT by this user (notifications about others' edits)
    return changes.filter((rc: any) => rc.user !== wikiUsername);
  } catch {
    return [];
  }
}

/** Check if user's talk page has new messages. */
async function getUserTalkPageMessages(
  wikiUsername: string
): Promise<{ hasMessages: boolean; content: string | null }> {
  try {
    const talkTitle = `User_talk:${wikiUsername}`;
    const params = new URLSearchParams({
      action: "parse",
      page: talkTitle,
      prop: "wikitext",
      format: "json",
    });

    const headers: Record<string, string> = {};
    if (botToken) headers.Authorization = `Bearer ${botToken}`;

    const res = await fetch(`${apiBase}?${params}`, { headers });
    if (!res.ok) return { hasMessages: false, content: null };

    const data = await res.json();
    if (data?.error) return { hasMessages: false, content: null };

    const wikitext = data?.parse?.wikitext?.["*"] ?? "";
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
