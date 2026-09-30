import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationHooks } from "~/lib/notifications/hooks";
import { validateNoXSS } from "~/lib/utils";
import { resolveDisplayName } from "~/server/shared/display-names";
import { getGroupAccess, requireGroupMember, requireGroupReader } from "./access";

export const thinkpagesThinktanksDocumentsRouter = createTRPCRouter({
  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Get collaborative documents for a ThinkTank. Non-public groups: members only (SL-2).
  getThinktankDocuments: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      await requireGroupReader(db, input.groupId, ctx.auth?.userId);

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
      const createdBy = ctx.auth.userId;

      // Only members can create documents
      await requireGroupMember(db, input.groupId, createdBy);

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

      const document = await db.collaborativeDoc.create({
        data: {
          groupId: input.groupId,
          title: input.title,
          content: input.content || "",
          version: 1,
          createdBy,
          lastEditBy: createdBy,
          isPublic: input.isPublic,
        },
      });

      // Notify all group members about new document
      try {
        const group = await db.thinktankGroup.findUnique({
          where: { id: input.groupId },
          include: {
            members: {
              where: { isActive: true, userId: { not: createdBy } },
              select: { userId: true },
            },
          },
        });

        if (group && group.members.length > 0) {
          const creatorDisplayName = await resolveDisplayName(db, createdBy);
          await notificationHooks.onThinktankActivity({
            activityType: "document_created",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: createdBy,
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
      const userId = ctx.auth.userId;

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
      const isMember =
        document.group.createdBy === userId ||
        document.group.members.some((m) => m.userId === userId && m.isActive);

      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this group",
        });
      }

      const updateData: any = {
        lastEditBy: userId,
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
              where: { isActive: true, userId: { not: userId } },
              select: { userId: true },
            },
          },
        });

        if (group && group.members.length > 0) {
          const editorDisplayName = await resolveDisplayName(db, userId);
          await notificationHooks.onThinktankActivity({
            activityType: "document_updated",
            groupId: document.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: userId,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

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

      // Only the document's creator (while still a member) or a group owner/admin can delete
      const access = await getGroupAccess(db, document.group, userId);
      const isCreator = document.createdBy === userId && access.isMember;

      if (!isCreator && !access.isManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the document creator or a group owner/admin can delete documents",
        });
      }

      await db.collaborativeDoc.delete({
        where: { id: input.documentId },
      });

      return { success: true };
    }),
});
