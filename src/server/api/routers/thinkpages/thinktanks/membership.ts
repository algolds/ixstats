import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Import the wiki search service
import { notificationHooks } from "~/lib/notifications/hooks";

export const thinkpagesThinktanksMembershipRouter = createTRPCRouter({
  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Join a ThinkTank group
  joinThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if group exists and is active
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId, isActive: true },
      });

      if (!group) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Group not found or inactive",
        });
      }

      // Verify user exists and is active
      const user = await db.user.findUnique({
        where: { clerkUserId: input.userId },
      });

      if (!user || !user.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or inactive",
        });
      }

      // Generate display name (User model doesn't have firstName/lastName - uses Clerk)
      const userDisplayName = `User ${input.userId.slice(0, 8)}`;

      // Check if user is already a member
      const existingMember = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already a member of this group",
          });
        } else {
          // Reactivate membership
          await db.thinktankMember.update({
            where: { id: existingMember.id },
            data: { isActive: true, joinedAt: new Date() },
          });
        }
      } else {
        // Create new membership
        await db.thinktankMember.create({
          data: {
            groupId: input.groupId,
            userId: input.userId,
            role: "member",
          },
        });
      }

      // Update member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { increment: 1 } },
      });

      // Synchronize ConversationParticipant if group has a linked conversation
      if (group.conversationId) {
        try {
          const existingConvParticipant = await db.conversationParticipant.findUnique({
            where: {
              conversationId_userId: {
                conversationId: group.conversationId,
                userId: input.userId,
              },
            },
          });

          if (existingConvParticipant) {
            await db.conversationParticipant.update({
              where: { id: existingConvParticipant.id },
              data: { isActive: true, joinedAt: new Date() },
            });
          } else {
            await db.conversationParticipant.create({
              data: {
                conversationId: group.conversationId,
                userId: input.userId,
                role: "participant",
              },
            });
          }
        } catch (e) {
          console.warn("[ThinkTanks] Failed to sync conversation participant on join:", e);
        }
      }

      // Notify group admins about new member
      try {
        const admins = await db.thinktankMember.findMany({
          where: {
            groupId: input.groupId,
            role: { in: ["admin", "owner"] },
            isActive: true,
            userId: { not: input.userId },
          },
          select: { userId: true },
        });

        if (admins.length > 0) {
          await notificationHooks.onThinktankActivity({
            activityType: "member_joined",
            groupId: input.groupId,
            groupName: group.name,
            groupType: group.type as "public" | "private" | "invite_only",
            actorUserId: input.userId,
            actorUserName: userDisplayName,
            targetUserIds: admins.map((a) => a.userId),
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send join notifications:", e);
      }

      return { success: true, message: "Successfully joined group" };
    }),

  // Leave a ThinkTank group
  leaveThinktank: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(), // Changed to userId (clerkUserId)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

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
          code: "NOT_FOUND",
          message: "Not a member of this group",
        });
      }

      // Can't leave if you're the owner and there are other members
      if (member.role === "owner") {
        const otherActiveMembers = await db.thinktankMember.count({
          where: {
            groupId: input.groupId,
            userId: { not: input.userId },
            isActive: true,
          },
        });

        if (otherActiveMembers > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot leave group as owner while other members exist. Transfer ownership first.",
          });
        }
      }

      // Deactivate membership
      await db.thinktankMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });

      // Update member count
      const updatedGroup = await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { decrement: 1 } },
        select: { name: true, type: true, conversationId: true },
      });

      // Deactivate ConversationParticipant if linked conversation exists
      if (updatedGroup.conversationId) {
        await db.conversationParticipant
          .updateMany({
            where: {
              conversationId: updatedGroup.conversationId,
              userId: input.userId,
            },
            data: { isActive: false, leftAt: new Date() },
          })
          .catch(() => {});
      }

      // Notify group admins about member leaving
      try {
        const admins = await db.thinktankMember.findMany({
          where: {
            groupId: input.groupId,
            role: { in: ["admin", "owner"] },
            isActive: true,
            userId: { not: input.userId },
          },
          select: { userId: true },
        });

        const leavingUser = await db.user.findUnique({
          where: { clerkUserId: input.userId },
        });

        if (admins.length > 0 && leavingUser) {
          const leavingUserDisplayName = `User ${input.userId.slice(0, 8)}`;
          await notificationHooks.onThinktankActivity({
            activityType: "member_left",
            groupId: input.groupId,
            groupName: updatedGroup.name,
            groupType: updatedGroup.type as "public" | "private" | "invite_only",
            actorUserId: input.userId,
            actorUserName: leavingUserDisplayName,
            targetUserIds: admins.map((a) => a.userId),
          });
        }
      } catch (e) {
        console.warn("[ThinkTanks] Failed to send leave notifications:", e);
      }

      return { success: true, message: "Successfully left group" };
    }),
});
