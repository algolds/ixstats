import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { notificationHooks } from "~/lib/notifications/hooks";
import { resolveDisplayName } from "~/server/shared/display-names";
import { getRealmBoardAccess, isRealmBoard } from "./realm-board";

interface JoinContext {
  db: PrismaClient;
  user?: { isActive?: boolean | null } | null;
}

/**
 * Join a ThinkTank group as `userId`. Private and invite-only groups need an open invite: one
 * addressed to the user or, with `inviteCode`, an unused invite code for the group (SL-13).
 */
export async function joinGroup(
  ctx: JoinContext,
  userId: string,
  input: { groupId: string; inviteCode?: string }
) {
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

  if (ctx.user && ctx.user.isActive === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is inactive",
    });
  }

  // Check if user is already a member
  const existingMember = await db.thinktankMember.findUnique({
    where: {
      groupId_userId: {
        groupId: input.groupId,
        userId,
      },
    },
  });

  if (existingMember?.isActive) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Already a member of this group",
    });
  }

  // Realm boards: open to owners of a nation in the realm (and its moderators), never by invite.
  if (isRealmBoard(group)) {
    const { isMember } = await getRealmBoardAccess(db, group.id, userId);
    if (!isMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only owners of a nation in this realm can join its board",
      });
    }
  } else if (group.type !== "public" && group.createdBy !== userId) {
    // Private and invite-only groups: consume an open invite addressed to the caller (or the code).
    const invite = await db.thinktankInvite.findFirst({
      where: {
        groupId: input.groupId,
        ...(input.inviteCode ? { inviteCode: input.inviteCode } : { invitedUser: userId }),
        isUsed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!invite) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This group is invite-only. Ask the group owner for an invitation.",
      });
    }
    const claimed = await db.thinktankInvite.updateMany({
      where: { id: invite.id, isUsed: false },
      data: { isUsed: true },
    });
    if (claimed.count === 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This invitation has already been used",
      });
    }
  }

  if (existingMember) {
    // Reactivate membership
    await db.thinktankMember.update({
      where: { id: existingMember.id },
      data: { isActive: true, joinedAt: new Date() },
    });
  } else {
    // Create new membership
    await db.thinktankMember.create({
      data: {
        groupId: input.groupId,
        userId,
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
            userId,
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
            userId,
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
        userId: { not: userId },
      },
      select: { userId: true },
    });

    if (admins.length > 0) {
      await notificationHooks.onThinktankActivity({
        activityType: "member_joined",
        groupId: input.groupId,
        groupName: group.name,
        groupType: group.type as "public" | "private" | "invite_only",
        actorUserId: userId,
        actorUserName: await resolveDisplayName(db, userId),
        targetUserIds: admins.map((a) => a.userId),
      });
    }
  } catch (e) {
    console.warn("[ThinkTanks] Failed to send join notifications:", e);
  }

  // Any other invites to this group addressed to the user are settled by joining.
  await db.thinktankInvite.updateMany({
    where: { groupId: input.groupId, invitedUser: userId, isUsed: false },
    data: { isUsed: true },
  });

  return { success: true, message: "Successfully joined group" };
}

export const thinkpagesThinktanksMembershipRouter = createTRPCRouter({
  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Join a ThinkTank group as the caller. Private and invite-only groups need an open invite.
  joinThinktank: rateLimitedMutationProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(({ ctx, input }) => joinGroup(ctx, ctx.auth.userId, input)),

  // Leave a ThinkTank group (the caller's own membership)
  leaveThinktank: rateLimitedMutationProcedure
    .input(
      z.object({
        groupId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId,
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
            userId: { not: userId },
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
              userId,
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
            userId: { not: userId },
          },
          select: { userId: true },
        });

        if (admins.length > 0) {
          const leavingUserDisplayName = await resolveDisplayName(db, userId);
          await notificationHooks.onThinktankActivity({
            activityType: "member_left",
            groupId: input.groupId,
            groupName: updatedGroup.name,
            groupType: updatedGroup.type as "public" | "private" | "invite_only",
            actorUserId: userId,
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
