/**
 * Wiki talk bridge — surfaces a user's MediaWiki talk page as a ThinkShare conversation.
 * Inbound only; replies go through the WikiOS talk page UI. (Watchlist and wiki activity live in the
 * pinned LoreBot channel.)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";

import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { primaryNameOf } from "~/lib/identity/wiki-names";

/** Whether the user's talk page has any content (treated as new messages). */
async function userTalkPageHasMessages(wikiName: string): Promise<boolean> {
  try {
    const article = await getArticleWikitext(`User talk:${wikiName.replace(/ /g, "_")}`, "ixwiki");
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

    // The user's own inbox: their first approved claim (a hidden one too), else their passport handle
    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { id: true, handle: true },
    });
    const wikiName = user ? ((await primaryNameOf(db, user.id)) ?? user.handle) : null;

    if (!wikiName) return result;

    if (await userTalkPageHasMessages(wikiName)) {
      const talkSourceId = `wiki-talk:${wikiName}`;
      let talkConv = await db.thinkshareConversation.findFirst({
        where: { source: "wiki", sourceId: talkSourceId },
      });

      if (!talkConv) {
        talkConv = await db.thinkshareConversation.create({
          data: {
            type: "direct",
            name: `Talk: ${wikiName}`,
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
