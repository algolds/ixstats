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

    // ── 1. Sync watchlist-style notifications ──
    const changes = await getUserWatchlistChanges(user.wikiUsername);

    if (changes.length > 0) {
      // Get or create the wiki alerts conversation
      const alertsSourceId = `wiki-alerts:${user.wikiUsername}`;
      let alertsConv = await db.thinkshareConversation.findFirst({
        where: { source: "wiki", sourceId: alertsSourceId },
      });

      if (!alertsConv) {
        alertsConv = await db.thinkshareConversation.create({
          data: {
            type: "direct",
            name: "Wiki Activity",
            source: "wiki",
            sourceId: alertsSourceId,
            isActive: true,
          },
        });
        await db.conversationParticipant.create({
          data: {
            conversationId: alertsConv.id,
            userId,
            role: "participant",
            lastReadAt: new Date(0),
          },
        });
        result.conversationsCreated++;
      }

      // Add recent changes as messages
      for (const rc of changes) {
        const msgId = `wiki-rc:${rc.title}:${rc.timestamp}`;

        const existing = await db.thinkshareMessage.findFirst({
          where: {
            conversationId: alertsConv.id,
            source: "wiki",
            sourceMessageId: msgId,
          },
        });

        if (!existing) {
          const sizeChange = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
          const sizeStr = sizeChange > 0 ? `+${sizeChange}` : String(sizeChange);
          const isNew = rc.type === "new";
          const comment = rc.comment?.replace(/\/\*.*?\*\/\s*/, "").trim();

          const basePath = process.env.BASE_PATH || "";
          const wikiUrl = `${basePath}/wiki/${encodeURIComponent(rc.title)}`;
          const description = isNew
            ? `<strong>${rc.user}</strong> created <a href="${wikiUrl}"><strong>${rc.title}</strong></a> (${sizeStr} bytes)`
            : `<strong>${rc.user}</strong> edited <a href="${wikiUrl}"><strong>${rc.title}</strong></a> (${sizeStr} bytes)${comment ? `: ${comment}` : ""}`;

          await db.thinkshareMessage.create({
            data: {
              conversationId: alertsConv.id,
              userId: `wiki:${rc.user}`, // External wiki user — ensures unread count works
              content: description,
              messageType: "text",
              source: "wiki",
              sourceMessageId: msgId,
              isSystem: true,
              ixTimeTimestamp: new Date(rc.timestamp),
            },
          });
          result.messagesCreated++;
        }
      }

      // Update lastActivity
      if (result.messagesCreated > 0) {
        await db.thinkshareConversation.update({
          where: { id: alertsConv.id },
          data: { lastActivity: new Date() },
        });
        result.conversationsUpdated++;
      }
    }

    // ── 2. Check user talk page for new messages ──
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
