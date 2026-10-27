/**
 * ThinkTank invites, invitee side (SL-13): the caller's pending invites with accept/decline, and
 * invite codes a group manager can hand out. Invites addressed to a user are created by
 * `inviteToThinktank` (groups.ts); accepting one joins through the same path as joinThinktank.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, lightMutationProcedure } from "~/server/api/trpc";
import { resolveDisplayName } from "~/server/shared/display-names";
import { requireGroupManager } from "./access";
import { joinGroup } from "./membership";
import { isRealmBoard } from "./realm-board";

/** Unambiguous upper-case code alphabet (no 0/O, 1/I). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const openInvite = () => ({
  isUsed: false,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export const thinkpagesThinktanksInvitesRouter = createTRPCRouter({
  /** The caller's open invites to active groups they are not yet a member of. */
  getMyThinktankInvites: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const invites = await ctx.db.thinktankInvite.findMany({
      where: { invitedUser: userId, ...openInvite(), group: { isActive: true } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            avatar: true,
            type: true,
            memberCount: true,
            members: { where: { userId, isActive: true }, select: { id: true } },
          },
        },
      },
    });
    const pending = invites.filter((invite) => invite.group.members.length === 0);
    const inviterNames = new Map(
      await Promise.all(
        [...new Set(pending.map((i) => i.invitedBy))].map(
          async (id) => [id, await resolveDisplayName(ctx.db, id)] as const
        )
      )
    );
    return pending.map(({ group: { members: _members, ...group }, ...invite }) => ({
      id: invite.id,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      invitedByName: inviterNames.get(invite.invitedBy) ?? "A member",
      group,
    }));
  }),

  /** Accept one of the caller's invites: join its group (the invite is consumed). */
  acceptThinktankInvite: lightMutationProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.thinktankInvite.findFirst({
        where: { id: input.inviteId, invitedUser: ctx.auth.userId, ...openInvite() },
        select: { groupId: true },
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is no longer open" });
      }
      return joinGroup(ctx, ctx.auth.userId, { groupId: invite.groupId });
    }),

  /** Decline one of the caller's invites. */
  declineThinktankInvite: lightMutationProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.thinktankInvite.updateMany({
        where: { id: input.inviteId, invitedUser: ctx.auth.userId, isUsed: false },
        data: { isUsed: true },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is no longer open" });
      }
      return { success: true };
    }),

  /** A single-use invite code for a group (owner or group admin), valid for `days` days. */
  createThinktankInviteCode: lightMutationProcedure
    .input(z.object({ groupId: z.string(), days: z.number().int().min(1).max(30).default(7) }))
    .mutation(async ({ ctx, input }) => {
      const { group } = await requireGroupManager(ctx.db, input.groupId, ctx.auth.userId);
      if (isRealmBoard(group)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Realm boards follow nation ownership, not invites",
        });
      }
      const invite = await ctx.db.thinktankInvite.create({
        data: {
          groupId: input.groupId,
          invitedBy: ctx.auth.userId,
          inviteCode: generateInviteCode(),
          expiresAt: new Date(Date.now() + input.days * 24 * 60 * 60 * 1000),
        },
        select: { inviteCode: true, expiresAt: true },
      });
      return { code: invite.inviteCode!, expiresAt: invite.expiresAt };
    }),

  /** Join a group with an invite code (the code is consumed). */
  joinThinktankByCode: lightMutationProcedure
    .input(z.object({ code: z.string().trim().min(4).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const invite = await ctx.db.thinktankInvite.findFirst({
        where: { inviteCode: code, ...openInvite(), group: { isActive: true } },
        select: { groupId: true },
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That invite code is not valid" });
      }
      const joined = await joinGroup(ctx, ctx.auth.userId, {
        groupId: invite.groupId,
        inviteCode: code,
      });
      return { ...joined, groupId: invite.groupId };
    }),
});
