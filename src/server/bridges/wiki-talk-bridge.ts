/**
 * Wiki talk bridge — surfaces a user's MediaWiki talk page as a ThinkShare conversation.
 * Inbound only; replies go through the WikiOS talk page UI. (Watchlist and wiki activity live in the
 * pinned LoreBot channel.)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";

import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

/** Whether the user's talk page has any content (treated as new messages). */
async function userTalkPageHasMessages(wikiUsername: string): Promise<boolean> {
  try {
    const article = await getArticleWikitext(
      `User talk:${wikiUsername.replace(/ /g, "_")}`,
      "ixwiki"
    );
    return Boolean(article?.wikitext);
  } catch {
    return false;
  }
}

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

    if (await userTalkPageHasMessages(user.wikiUsername)) {
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
