/**
 * Wiki Talk Bridge — Bidirectional sync between MediaWiki talk pages and ThinkShare.
 *
 * Inbound:  Fetches recent talk page activity for a user → creates ThinkShare conversations/messages
 * Outbound: Posts ThinkShare replies → MediaWiki talk page sections (as bot, attributed in summary)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";
import { getNamespacedWikitext } from "~/lib/wiki-bridge";
import { getCsrfToken } from "~/lib/wikios/csrf-cache";

const apiBase =
  process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;

// ─── Helpers ─────────────────────────────────────────────────────

/** Fetch talk pages where a user has recent edits. */
async function getUserTalkActivity(
  wikiUsername: string,
  limit = 30
): Promise<{ title: string; timestamp: string }[]> {
  try {
    const params = new URLSearchParams({
      action: "query",
      list: "usercontribs",
      ucuser: wikiUsername,
      ucnamespace: "1", // Talk namespace
      uclimit: String(limit),
      ucprop: "title|timestamp",
      format: "json",
    });

    const res = await fetch(`${apiBase}?${params}`, {
      headers: botToken
        ? { Authorization: `Bearer ${botToken}` }
        : {},
    });

    if (!res.ok) return [];
    const data = await res.json();
    const contribs = data?.query?.usercontribs ?? [];

    // Deduplicate by title, keep most recent timestamp
    const seen = new Map<string, string>();
    for (const c of contribs) {
      if (!seen.has(c.title) || c.timestamp > seen.get(c.title)!) {
        seen.set(c.title, c.timestamp);
      }
    }

    return Array.from(seen.entries()).map(([title, timestamp]) => ({
      title,
      timestamp,
    }));
  } catch {
    return [];
  }
}

/** Parse wikitext sections from a talk page. */
function parseSections(
  wikitext: string
): { level: number; title: string; content: string; index: number }[] {
  const lines = wikitext.split("\n");
  const sections: {
    level: number;
    title: string;
    content: string;
    index: number;
  }[] = [];

  let current: (typeof sections)[0] | null = null;
  let sectionIndex = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (headingMatch) {
      if (current) sections.push(current);
      sectionIndex++;
      current = {
        level: headingMatch[1]!.length,
        title: headingMatch[2]!,
        content: "",
        index: sectionIndex,
      };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);

  return sections;
}

/** Extract usernames from wikitext signatures (~~~~). */
function extractSignatureUsers(wikitext: string): string[] {
  // Match [[User:Username|...]] patterns common in signatures
  const matches = wikitext.matchAll(
    /\[\[User:([^|\]]+)/gi
  );
  const users = new Set<string>();
  for (const match of matches) {
    users.add(match[1]!);
  }
  return Array.from(users);
}

// ─── Bridge Implementation ───────────────────────────────────────

export const wikiTalkBridge: BridgeAdapter = {
  async syncInbound(
    userId: string,
    db: PrismaClient
  ): Promise<BridgeSyncResult> {
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

    // Fetch user's recent talk page activity
    const talkPages = await getUserTalkActivity(user.wikiUsername);
    if (talkPages.length === 0) return result;

    for (const page of talkPages) {
      try {
        // Check if conversation already exists for this talk page
        let conversation = await db.thinkshareConversation.findFirst({
          where: { source: "wiki", sourceId: page.title },
        });

        // Get talk page wikitext to parse sections
        const articleTitle = page.title.replace(/^Talk:/, "");
        const wikitext = await getNamespacedWikitext(articleTitle, 1);
        if (!wikitext) continue;

        const sections = parseSections(wikitext);
        if (sections.length === 0) continue;

        if (!conversation) {
          // Create new conversation
          const participants = extractSignatureUsers(wikitext);
          conversation = await db.thinkshareConversation.create({
            data: {
              type: "group",
              name: page.title.replace(/^Talk:/, ""),
              source: "wiki",
              sourceId: page.title,
              lastActivity: new Date(page.timestamp),
              isActive: true,
            },
          });
          result.conversationsCreated++;

          // Add current user as participant
          await db.conversationParticipant.create({
            data: {
              conversationId: conversation.id,
              userId,
              role: "participant",
            },
          });

          // Add other known participants (resolve wiki usernames to clerkUserIds)
          for (const wikiUser of participants) {
            if (wikiUser === user.wikiUsername) continue;
            const otherUser = await db.user.findFirst({
              where: { wikiUsername: wikiUser },
              select: { clerkUserId: true },
            });
            if (otherUser) {
              await db.conversationParticipant.upsert({
                where: {
                  conversationId_userId: {
                    conversationId: conversation.id,
                    userId: otherUser.clerkUserId,
                  },
                },
                update: {},
                create: {
                  conversationId: conversation.id,
                  userId: otherUser.clerkUserId,
                  role: "participant",
                },
              });
            }
          }
        }

        // Sync sections as messages
        for (const section of sections) {
          const msgExternalId = `${page.title}#section${section.index}`;

          // Check if message already exists
          const existing = await db.thinkshareMessage.findFirst({
            where: {
              conversationId: conversation.id,
              source: "wiki",
              sourceMessageId: msgExternalId,
            },
          });

          if (!existing) {
            // Determine author from section signatures
            const sectionUsers = extractSignatureUsers(section.content);
            const authorWikiName = sectionUsers[sectionUsers.length - 1]; // Last signer
            let authorUserId = userId; // Default to current user

            if (authorWikiName && authorWikiName !== user.wikiUsername) {
              const author = await db.user.findFirst({
                where: { wikiUsername: authorWikiName },
                select: { clerkUserId: true },
              });
              if (author) authorUserId = author.clerkUserId;
            }

            await db.thinkshareMessage.create({
              data: {
                conversationId: conversation.id,
                userId: authorUserId,
                content: `<strong>${section.title}</strong><br/>${section.content.trim().substring(0, 2000)}`,
                messageType: "text",
                source: "wiki",
                sourceMessageId: msgExternalId,
                isSystem: false,
              },
            });
            result.messagesCreated++;
          }
        }

        // Update conversation lastActivity
        await db.thinkshareConversation.update({
          where: { id: conversation.id },
          data: { lastActivity: new Date(page.timestamp) },
        });
        result.conversationsUpdated++;
      } catch (err) {
        console.error(
          `Wiki bridge: failed to sync talk page "${page.title}":`,
          err
        );
      }
    }

    return result;
  },

  async sendOutbound(
    conversationSourceId: string,
    content: string,
    userId: string,
    db: PrismaClient
  ): Promise<{ success: boolean; error?: string }> {
    if (!botToken) {
      return { success: false, error: "WIKIOS_MEDIAWIKI_BOT_TOKEN not configured" };
    }

    // Get user's wiki username for attribution
    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { wikiUsername: true },
    });

    const wikiUsername = user?.wikiUsername ?? "Unknown";
    const talkPageTitle = conversationSourceId; // sourceId is the talk page title

    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();

      // Strip HTML tags for wikitext content
      const plainContent = content.replace(/<[^>]*>/g, "");

      // Post as new section or append to last section
      const params = new URLSearchParams({
        action: "edit",
        title: talkPageTitle,
        section: "new",
        sectiontitle: `Reply from ${wikiUsername}`,
        text: `${plainContent} ~~~~`,
        summary: `Reply via ThinkShare (${wikiUsername})`,
        token: csrfToken,
        format: "json",
      });

      const res = await fetch(apiBase, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await res.json();

      if (data?.edit?.result === "Success") {
        return { success: true };
      }

      return {
        success: false,
        error: data?.error?.info ?? "Unknown MediaWiki error",
      };
    } catch (err: any) {
      return { success: false, error: err.message ?? "Wiki bridge error" };
    }
  },
};
