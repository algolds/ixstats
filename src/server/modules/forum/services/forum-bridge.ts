/**
 * Forum Bridge — Bidirectional sync between XenForo conversations and ThinkShare.
 *
 * Inbound:  Fetches user's XenForo conversations → creates ThinkShare conversations/messages
 * Outbound: Posts ThinkShare replies → XenForo conversations (as user, via impersonation)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "./bridge-types";
import { xfFetchAsUser, xfPostAsUser } from "./xenforo-service";

// ─── XenForo Response Types ──────────────────────────────────────

interface XFConversation {
  conversation_id: number;
  title: string;
  user_id: number;
  username: string;
  start_date: number;
  reply_count: number;
  last_message_date: number;
  last_message_user_id: number;
  last_message_username: string;
  is_unread: boolean;
  recipients?: { user_id: number; username: string }[];
}

interface XFConversationMessage {
  message_id: number;
  conversation_id: number;
  user_id: number;
  username: string;
  message_date: number;
  message: string;
}

interface XFConversationsResponse {
  conversations: XFConversation[];
}

interface XFConversationMessagesResponse {
  messages: XFConversationMessage[];
}

// ─── Bridge Implementation ───────────────────────────────────────

export const forumBridge: BridgeAdapter = {
  async syncInbound(userId: string, db: PrismaClient): Promise<BridgeSyncResult> {
    const result: BridgeSyncResult = {
      conversationsCreated: 0,
      conversationsUpdated: 0,
      messagesCreated: 0,
    };

    // Get user's forum ID
    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { forumUserId: true, forumUsername: true },
    });

    if (!user?.forumUserId) return result;

    // Fetch user's XenForo conversations
    let xfConversations: XFConversation[];
    try {
      const response = await xfFetchAsUser<XFConversationsResponse>(
        "/conversations/?page=1",
        user.forumUserId
      );
      xfConversations = response?.conversations ?? [];
    } catch {
      return result;
    }

    if (xfConversations.length === 0) return result;

    for (const xfConv of xfConversations) {
      try {
        const sourceId = String(xfConv.conversation_id);

        // Check if conversation already exists
        let conversation = await db.thinkshareConversation.findFirst({
          where: { source: "forum", sourceId },
        });

        if (!conversation) {
          // Create new conversation
          conversation = await db.thinkshareConversation.create({
            data: {
              type: xfConv.recipients && xfConv.recipients.length > 2 ? "group" : "direct",
              name: xfConv.title,
              source: "forum",
              sourceId,
              lastActivity: new Date(xfConv.last_message_date * 1000),
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

          // Add other recipients (resolve forumUserId → clerkUserId)
          if (xfConv.recipients) {
            for (const recipient of xfConv.recipients) {
              if (recipient.user_id === user.forumUserId) continue;

              const otherUser = await db.user.findFirst({
                where: { forumUserId: recipient.user_id },
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
        }

        // Fetch messages for this conversation
        let xfMessages: XFConversationMessage[];
        try {
          const msgResponse = await xfFetchAsUser<XFConversationMessagesResponse>(
            `/conversations/${xfConv.conversation_id}/messages`,
            user.forumUserId
          );
          xfMessages = msgResponse?.messages ?? [];
        } catch {
          continue;
        }

        // Sync messages
        for (const xfMsg of xfMessages) {
          const msgExternalId = String(xfMsg.message_id);

          // Check if message already exists
          const existing = await db.thinkshareMessage.findFirst({
            where: {
              conversationId: conversation.id,
              source: "forum",
              sourceMessageId: msgExternalId,
            },
          });

          if (!existing) {
            // Resolve author: try forumUserId → clerkUserId
            let authorUserId = userId; // Default to current user
            if (xfMsg.user_id !== user.forumUserId) {
              const author = await db.user.findFirst({
                where: { forumUserId: xfMsg.user_id },
                select: { clerkUserId: true },
              });
              if (author) {
                authorUserId = author.clerkUserId;
              }
            }

            await db.thinkshareMessage.create({
              data: {
                conversationId: conversation.id,
                userId: authorUserId,
                content: xfMsg.message,
                messageType: "text",
                source: "forum",
                sourceMessageId: msgExternalId,
                isSystem: false,
                ixTimeTimestamp: new Date(xfMsg.message_date * 1000),
              },
            });
            result.messagesCreated++;
          }
        }

        // Update conversation lastActivity
        await db.thinkshareConversation.update({
          where: { id: conversation.id },
          data: {
            lastActivity: new Date(xfConv.last_message_date * 1000),
          },
        });
        result.conversationsUpdated++;
      } catch (err) {
        console.error(`Forum bridge: failed to sync conversation "${xfConv.title}":`, err);
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
    // Get user's forum ID
    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { forumUserId: true },
    });

    if (!user?.forumUserId) {
      return {
        success: false,
        error: "No linked forum account. Link your account in Profile > IxnayID.",
      };
    }

    const xfConversationId = conversationSourceId;

    try {
      // Strip HTML for plain text message
      const plainContent = content.replace(/<[^>]*>/g, "");

      const response = await xfPostAsUser(
        `/conversations/${xfConversationId}/messages`,
        { message_body: plainContent },
        user.forumUserId
      );

      if (response) {
        return { success: true };
      }
      return { success: false, error: "No response from XenForo" };
    } catch (err: any) {
      return { success: false, error: err.message ?? "Forum bridge error" };
    }
  },
};
