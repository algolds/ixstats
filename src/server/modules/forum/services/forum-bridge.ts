/**
 * Forum Bridge — Canonical bidirectional sync between XenForo conversations and ThinkShare.
 *
 * Inbound:  Fetches user's XenForo conversations → creates ThinkShare conversations/messages
 * Outbound: Posts ThinkShare replies → XenForo conversations (as user, via impersonation)
 */

import type { PrismaClient } from "@prisma/client";
import type { BridgeAdapter, BridgeSyncResult } from "~/server/shared/bridge-types";
import { xfFetchAsUser, xfPostAsUser } from "./xenforo-service";

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
  recipient_count?: number;
  recipients?:
    Record<string, { user_id: number; username: string }> | { user_id: number; username: string }[];
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

type ForumRecipient = { user_id: number; username: string };

/** Creates the local conversation, its owner participant and the linked recipients. */
async function createForumConversation(
  db: PrismaClient,
  xfConv: XFConversation,
  userId: string,
  forumUserId: number
) {
  const conversation = await db.thinkshareConversation.create({
    data: {
      type: (xfConv.recipient_count ?? 0) > 2 ? "group" : "direct",
      name: xfConv.title,
      source: "forum",
      sourceId: String(xfConv.conversation_id),
      lastActivity: new Date(xfConv.last_message_date * 1000),
      isActive: true,
    },
  });

  await db.conversationParticipant.create({
    data: {
      conversationId: conversation.id,
      userId,
      role: "participant",
      lastReadAt: new Date(0), // Epoch — so existing messages show as unread
    },
  });

  // Add other recipients (resolve forumUserId → clerkUserId).
  // XenForo returns recipients as object keyed by user_id, or array
  const recipients: ForumRecipient[] = Object.values(xfConv.recipients ?? {});
  for (const recipient of recipients) {
    const recipientUserId = recipient?.user_id;
    if (!recipientUserId || recipientUserId === forumUserId) continue;

    const otherUser = await db.user.findFirst({
      where: { forumUserId: recipientUserId },
      select: { clerkUserId: true },
    });
    if (!otherUser) continue;

    await db.conversationParticipant.upsert({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId: otherUser.clerkUserId },
      },
      update: {},
      create: {
        conversationId: conversation.id,
        userId: otherUser.clerkUserId,
        role: "participant",
      },
    });
  }

  return conversation;
}

/** Imports messages not yet stored locally; returns how many were created. */
async function importForumMessages(
  db: PrismaClient,
  conversationId: string,
  xfMessages: XFConversationMessage[],
  userId: string,
  forumUserId: number
) {
  let created = 0;
  for (const xfMsg of xfMessages) {
    const msgExternalId = String(xfMsg.message_id);

    const existing = await db.thinkshareMessage.findFirst({
      where: { conversationId, source: "forum", sourceMessageId: msgExternalId },
    });
    if (existing) continue;

    // Resolve author: linked IxStats user, else store as forum:xfUsername for display
    let authorUserId = userId;
    if (xfMsg.user_id !== forumUserId) {
      const author = await db.user.findFirst({
        where: { forumUserId: xfMsg.user_id },
        select: { clerkUserId: true },
      });
      authorUserId = author?.clerkUserId ?? `forum:${xfMsg.username || xfMsg.user_id}`;
    }

    await db.thinkshareMessage.create({
      data: {
        conversationId,
        userId: authorUserId,
        content: xfMsg.message,
        messageType: "text",
        source: "forum",
        sourceMessageId: msgExternalId,
        isSystem: false,
        ixTimeTimestamp: new Date(xfMsg.message_date * 1000),
      },
    });
    created++;
  }
  return created;
}

async function fetchXfConversations(forumUserId: number): Promise<XFConversation[] | null> {
  try {
    const response = await xfFetchAsUser<XFConversationsResponse>(
      "/conversations/?page=1",
      forumUserId
    );
    return response?.conversations ?? [];
  } catch (err) {
    console.error("[Forum bridge] Failed to fetch conversations:", err);
    return null;
  }
}

export const forumBridge: BridgeAdapter = {
  async syncInbound(userId: string, db: PrismaClient): Promise<BridgeSyncResult> {
    const result: BridgeSyncResult = {
      conversationsCreated: 0,
      conversationsUpdated: 0,
      messagesCreated: 0,
    };

    const user = await db.user.findFirst({
      where: { clerkUserId: userId },
      select: { forumUserId: true, forumUsername: true },
    });
    if (!user?.forumUserId) return result;
    const forumUserId = user.forumUserId;

    const xfConversations = await fetchXfConversations(forumUserId);

    for (const xfConv of xfConversations ?? []) {
      try {
        let conversation = await db.thinkshareConversation.findFirst({
          where: { source: "forum", sourceId: String(xfConv.conversation_id) },
        });

        if (!conversation) {
          conversation = await createForumConversation(db, xfConv, userId, forumUserId);
          result.conversationsCreated++;
        }

        let xfMessages: XFConversationMessage[];
        try {
          const msgResponse = await xfFetchAsUser<XFConversationMessagesResponse>(
            `/conversations/${xfConv.conversation_id}/messages`,
            forumUserId
          );
          xfMessages = msgResponse?.messages ?? [];
        } catch {
          continue;
        }

        result.messagesCreated += await importForumMessages(
          db,
          conversation.id,
          xfMessages,
          userId,
          forumUserId
        );

        await db.thinkshareConversation.update({
          where: { id: conversation.id },
          data: { lastActivity: new Date(xfConv.last_message_date * 1000) },
        });
        result.conversationsUpdated++;
      } catch (err) {
        console.error(`[Forum bridge] Failed to sync conversation "${xfConv.title}":`, err);
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

    try {
      const plainContent = content.replace(/<[^>]*>/g, "");

      const response = await xfPostAsUser(
        `/conversations/${conversationSourceId}/messages`,
        { message_body: plainContent },
        user.forumUserId
      );

      if (response) return { success: true };
      return { success: false, error: "No response from XenForo" };
    } catch (err: any) {
      return {
        success: false,
        error: err.message ?? "Forum bridge error",
      };
    }
  },
};
