import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { globalCache } from "~/lib/cache";

export const thinkpagesThinktanksDocumentsRouter = createTRPCRouter({
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

  // Send message to ThinkTank

  // Update a ThinkTank group

  // Invite users to a ThinkTank group

  // Get collaborative documents for a ThinkTank
  getThinktankDocuments: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const documents = await db.collaborativeDoc.findMany({
        where: { groupId: input.groupId },
        orderBy: { updatedAt: "desc" },
        take: 10, // Limit to 10 documents per group
      });

      return documents;
    }),

  // Create a collaborative document
  createThinktankDocument: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        title: z.string().min(1).max(200),
        createdBy: z.string(), // userId (clerkUserId)
        content: z
          .string()
          .optional()
          .refine((content) => !content || validateNoXSS(content).valid, {
            message: "Content contains potentially unsafe HTML",
          }),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check document count limit (10 per group)
      const documentCount = await db.collaborativeDoc.count({
        where: { groupId: input.groupId },
      });

      if (documentCount >= 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum document limit (10) reached for this group",
        });
      }

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.createdBy,
          },
        },
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this group",
        });
      }

      const document = await db.collaborativeDoc.create({
        data: {
          groupId: input.groupId,
          title: input.title,
          content: input.content || "",
          version: 1,
          createdBy: input.createdBy,
          lastEditBy: input.createdBy,
          isPublic: input.isPublic,
        },
      });

      // Notify all group members about new document
      try {
        const group = await db.thinktankGroup.findUnique({
          where: { id: input.groupId },
          include: {
            members: {
              where: { isActive: true, userId: { not: input.createdBy } },
              select: { userId: true },
            },
          },
        });

        const creator = await db.user.findUnique({
          where: { clerkUserId: input.createdBy },
        });

        if (group && group.members.length > 0 && creator) {
          const creatorDisplayName = `User ${input.createdBy.slice(0, 8)}`;
          await notificationHooks.onThinktankActivity({
            activityType: "document_created",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.createdBy,
            actorUserName: creatorDisplayName,
            targetUserIds: group.members.map((m) => m.userId),
            contentTitle: input.title,
            contentId: document.id,
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send document creation notifications:", e);
      }

      return document;
    }),

  // Update a collaborative document
  updateThinktankDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        userId: z.string(),
        title: z.string().min(1).max(200).optional(),
        content: z
          .string()
          .optional()
          .refine((content) => !content || validateNoXSS(content).valid, {
            message: "Content contains potentially unsafe HTML",
          }),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the document to check permissions
      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: { group: { include: { members: true } } },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Verify user is a member
      const isMember = document.group.members.some((m) => m.userId === input.userId && m.isActive);

      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this group",
        });
      }

      const updateData: any = {
        lastEditBy: input.userId,
        version: { increment: 1 },
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

      const updatedDocument = await db.collaborativeDoc.update({
        where: { id: input.documentId },
        data: updateData,
      });

      // Notify all group members about document update
      try {
        const group = await db.thinktankGroup.findUnique({
          where: { id: document.groupId },
          include: {
            members: {
              where: { isActive: true, userId: { not: input.userId } },
              select: { userId: true },
            },
          },
        });

        const editor = await db.user.findUnique({
          where: { clerkUserId: input.userId },
        });

        if (group && group.members.length > 0 && editor) {
          const editorDisplayName = `User ${input.userId.slice(0, 8)}`;
          await notificationHooks.onThinktankActivity({
            activityType: "document_updated",
            groupId: document.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.userId,
            actorUserName: editorDisplayName,
            targetUserIds: group.members.map((m) => m.userId),
            contentTitle: updatedDocument.title,
            contentId: updatedDocument.id,
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send document update notifications:", e);
      }

      return updatedDocument;
    }),

  // Delete a collaborative document
  deleteThinktankDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: { group: true },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Only creator or group owner can delete
      const isCreator = document.createdBy === input.userId;
      const isGroupOwner = document.group.createdBy === input.userId;

      if (!isCreator && !isGroupOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only document creator or group owner can delete documents",
        });
      }

      await db.collaborativeDoc.delete({
        where: { id: input.documentId },
      });

      return { success: true };
    }),

  // Get a single document
  getThinktankDocument: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: {
          group: {
            include: {
              members: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Check permissions
      if (!document.isPublic) {
        const isMember = document.group.members.some((m) => m.userId === input.userId);

        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }
      }

      return document;
    }),

  // Add reaction to a Thinkshare message

  // Remove reaction from a Thinkshare message

  // Edit a Thinkshare message

  // Delete a Thinkshare message

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
