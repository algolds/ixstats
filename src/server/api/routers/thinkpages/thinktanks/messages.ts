import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

export const thinkpagesThinktanksMessagesRouter = createTRPCRouter({
  // Search Unsplash images

  // Fetch Discord Channel Topic (Easter Egg)

  // Search Wiki Commons images

  // Calculate trending topics

  // Search users globally for ThinkTanks/ThinkShare

  // Update ThinkPages Feed Account
  // Username availability check for ThinkPages Feed Accounts

  // Generate random profile picture

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)

  // Get ThinkPages Feed Accounts by Country - For Feed only

  // Get current user's ThinkPages accounts

  // Get Account Counts by Type - For Feed only

  // Post creation

  // Update post content (edit post)

  // Delete post (soft delete)

  // Add reaction to post

  // Remove reaction

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID

  // Get post details with replies

  // Get posts by Clerk User ID - shows all posts from all accounts owned by this user

  // Trigger citizen reaction to a post

  // Calculate and store country mood metrics

  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Create a new ThinkTank group

  // Get ThinkTanks globally (no country restriction)

  // Join a ThinkTank group

  // Leave a ThinkTank group

  // Get ThinkTank messages
  getThinktankMessages: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Added to verify membership
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this group",
        });
      }

      const messages = await db.thinktankMessage.findMany({
        where: {
          groupId: input.groupId,
          deletedAt: null,
        },
        include: {
          replyTo: true,
          readReceipts: true,
          _count: {
            select: { replies: true },
          },
        },
        orderBy: { ixTimeTimestamp: "desc" },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      });

      return {
        messages: messages.map((msg) => ({
          ...msg,
          reactions: msg.reactions ? JSON.parse(msg.reactions) : {},
          mentions: msg.mentions ? JSON.parse(msg.mentions) : [],
          attachments: msg.attachments ? JSON.parse(msg.attachments) : [],
        })),
        nextCursor: messages.length === input.limit ? messages[messages.length - 1]?.id : null,
      };
    }),

  // Send message to ThinkTank
  sendThinktankMessage: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
        content: z
          .string()
          .min(1)
          .refine((content) => validateNoXSS(content).valid, {
            message: "Content contains potentially unsafe HTML",
          }),
        messageType: z.enum(["text", "image", "file", "system"]).default("text"),
        replyToId: z.string().optional(),
        mentions: z.array(z.string()).optional(),
        attachments: z
          .array(
            z.object({
              type: z.string(),
              url: z.string(),
              filename: z.string().optional(),
              size: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this group",
        });
      }

      // Get group details for notifications
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId },
        include: {
          members: {
            where: { isActive: true, userId: { not: input.userId } },
            select: { userId: true },
          },
        },
      });

      // Create the message
      const message = await db.thinktankMessage.create({
        data: {
          groupId: input.groupId,
          userId: input.userId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date(),
        },
        include: {
          replyTo: true,
        },
      });

      // Notify all active members (excluding sender)
      if (group && group.members.length > 0) {
        try {
          const sender = await db.user.findUnique({
            where: { clerkUserId: input.userId },
          });

          if (sender) {
            const senderDisplayName = `User ${input.userId.slice(0, 8)}`;
            const contentPreview = input.content.slice(0, 100);
            await notificationHooks.onThinktankActivity({
              activityType: "new_message",
              groupId: input.groupId,
              groupName: group.name,
              groupType: group.type as "public" | "private" | "invite_only",
              actorUserId: input.userId,
              actorUserName: senderDisplayName,
              targetUserIds: group.members.map((m) => m.userId),
              contentTitle: contentPreview,
              contentId: message.id,
            });
          }
        } catch (e) {
          console.warn("[ThinkTanks] Failed to send message notifications:", e);
        }
      }

      return message;
    }),

  // Update a ThinkTank group

  // Invite users to a ThinkTank group

  // Get collaborative documents for a ThinkTank

  // Create a collaborative document

  // Update a collaborative document

  // Delete a collaborative document

  // Get a single document

  // Add reaction to a Thinkshare message
  addReactionToMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, userId: _userId, reaction } = input;

      const message = await db.thinkshareMessage.findUnique({
        where: { id: messageId },
        select: { reactions: true },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      const reactions = message.reactions ? JSON.parse(message.reactions as string) : {};
      reactions[reaction] = (reactions[reaction] || 0) + 1;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
      });

      return { success: true };
    }),

  // Remove reaction from a Thinkshare message
  removeReactionFromMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        reaction: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, reaction } = input;

      const message = await db.thinkshareMessage.findUnique({
        where: { id: messageId },
        select: { reactions: true },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      const reactions = message.reactions ? JSON.parse(message.reactions as string) : {};
      if (reactions[reaction]) {
        reactions[reaction]--;
        if (reactions[reaction] === 0) {
          delete reactions[reaction];
        }
      }

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
      });

      return { success: true };
    }),

  // Edit a Thinkshare message
  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: z
          .string()
          .min(1)
          .refine((content) => validateNoXSS(content).valid, {
            message: "Content contains potentially unsafe HTML",
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, content } = input;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { content, editedAt: new Date() },
      });

      return { success: true };
    }),

  // Delete a Thinkshare message
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId } = input;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { deletedAt: new Date(), content: "[deleted]" },
      });

      return { success: true };
    }),

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Create a new conversation

  // Get conversations for a user

  // Get messages for a conversation

  // Send message to conversation

  // Mark messages as read

  // Update user presence/online status

  // Get presence for multiple users

  // Get Discord server emojis

  // Pin/unpin a post

  // Bookmark/unbookmark a post
  // Get user's bookmarked posts

  // Check if a post is bookmarked by user

  // Bookmark or unbookmark a post

  // Get all flagged posts (admin only)

  // Check if a post is flagged by user

  // Flag a post for moderation

  // Remove a flag (unflag post)

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
});
