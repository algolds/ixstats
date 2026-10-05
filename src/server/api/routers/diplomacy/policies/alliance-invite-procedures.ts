/**
 * Alliance invite procedures (list, withdraw, respond), spread into the alliances router.
 */
import { z } from "zod";
import { protectedProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  INVITE_STATUS,
  expireStaleDiplomaticProposals,
  inviteIssuedAt,
  isProposalExpired,
  proposalExpiresAt,
} from "~/lib/diplomacy/proposal-lifecycle";
import { notifyCountryOwners } from "./notify";
import { ALLIANCE_LEADER_ROLES, inviteProposerCountryIds } from "./alliance-invites";

/** Mark a stale pending invite expired and refuse the action with a clear message. */
async function rejectExpiredInvite(
  db: any,
  invite: { id: string; invitedAt?: Date | null; updatedAt: Date }
): Promise<never> {
  const expiresAt = proposalExpiresAt(inviteIssuedAt(invite));
  await db.allianceMember.updateMany({
    where: { id: invite.id, status: INVITE_STATUS.pending },
    data: { status: INVITE_STATUS.expired },
  });
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `This invitation expired on ${expiresAt.toISOString().slice(0, 10)} without an answer.`,
  });
}

export const allianceInviteProcedures = {
  // Pending alliance invitations addressed to a country
  getAllianceInvites: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      await expireStaleDiplomaticProposals(ctx.db, { countryId: input.countryId });
      const invites = await ctx.db.allianceMember.findMany({
        where: { countryId: input.countryId, status: INVITE_STATUS.pending, isActive: false },
        orderBy: { createdAt: "desc" },
        include: {
          alliance: {
            select: {
              id: true,
              name: true,
              shortName: true,
              type: true,
              description: true,
              color: true,
              memberCount: true,
            },
          },
        },
      });
      const live = invites.filter((i) => !isProposalExpired(inviteIssuedAt(i)));
      const inviterIds = [
        ...new Set(live.map((i) => i.invitedByCountryId).filter((id): id is string => !!id)),
      ];
      const inviters = inviterIds.length
        ? await ctx.db.country.findMany({
            where: { id: { in: inviterIds } },
            select: { id: true, name: true, flag: true },
          })
        : [];
      const inviterById = new Map(inviters.map((c) => [c.id, c]));
      return live.map((i) => ({
        allianceId: i.allianceId,
        countryId: i.countryId,
        role: i.role,
        invitedAt: inviteIssuedAt(i),
        expiresAt: proposalExpiresAt(inviteIssuedAt(i)),
        invitedBy: i.invitedByCountryId ? (inviterById.get(i.invitedByCountryId) ?? null) : null,
        alliance: i.alliance,
      }));
    }),

  // Pending invitations this country has issued (legacy invites with no recorded inviter
  // are shown to the alliance's founder/leaders).
  getOutgoingAllianceInvites: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      await expireStaleDiplomaticProposals(ctx.db, { countryId: input.countryId });
      const invites = await ctx.db.allianceMember.findMany({
        where: {
          status: INVITE_STATUS.pending,
          isActive: false,
          OR: [
            { invitedByCountryId: input.countryId },
            {
              invitedByCountryId: null,
              alliance: {
                members: {
                  some: {
                    countryId: input.countryId,
                    isActive: true,
                    role: { in: ALLIANCE_LEADER_ROLES },
                  },
                },
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          alliance: { select: { id: true, name: true, shortName: true, color: true } },
          country: { select: { id: true, name: true, flag: true } },
        },
      });
      return invites
        .filter((i) => !isProposalExpired(inviteIssuedAt(i)))
        .map((i) => ({
          allianceId: i.allianceId,
          countryId: i.countryId,
          role: i.role,
          invitedAt: inviteIssuedAt(i),
          expiresAt: proposalExpiresAt(inviteIssuedAt(i)),
          alliance: i.alliance,
          country: i.country,
        }));
    }),

  // The inviting country withdraws a pending invitation before it is answered.
  withdrawAllianceInvite: rateLimitedMutationProcedure
    .input(z.object({ allianceId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: { allianceId: input.allianceId, countryId: input.countryId },
        },
      });
      if (!invite || invite.status !== INVITE_STATUS.pending || invite.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No pending invitation found." });
      }

      if (invite.invitedByCountryId) {
        await assertCountryWriteAccess(ctx, invite.invitedByCountryId);
      } else {
        // Legacy invite with no recorded inviter: the alliance's leadership speaks for it.
        const leaders = await inviteProposerCountryIds(ctx.db, invite);
        if (!ctx.user?.countryId || !leaders.includes(ctx.user.countryId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the inviting country can withdraw this invitation.",
          });
        }
      }

      if (isProposalExpired(inviteIssuedAt(invite))) {
        await rejectExpiredInvite(ctx.db, invite);
      }

      const withdrawn = await ctx.db.allianceMember.updateMany({
        where: { id: invite.id, status: INVITE_STATUS.pending },
        data: { isActive: false, status: INVITE_STATUS.withdrawn },
      });
      if (withdrawn.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation is no longer pending." });
      }
      return { status: INVITE_STATUS.withdrawn };
    }),

  // The invited country's owner accepts (becomes a member) or declines
  respondToAllianceInvite: rateLimitedMutationProcedure
    .input(
      z.object({
        allianceId: z.string(),
        countryId: z.string(),
        choice: z.enum(["accept", "decline"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const invite = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: { allianceId: input.allianceId, countryId: input.countryId },
        },
      });
      if (!invite || invite.status !== "invited" || invite.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No pending invitation found." });
      }
      if (isProposalExpired(inviteIssuedAt(invite))) {
        await rejectExpiredInvite(ctx.db, invite);
      }

      // Claim atomically so a double response cannot flip it twice.
      const claimed = await ctx.db.allianceMember.updateMany({
        where: { id: invite.id, status: "invited" },
        data:
          input.choice === "accept"
            ? { isActive: true, status: "active", joinedAt: new Date() }
            : { isActive: false, status: "declined" },
      });
      if (claimed.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation is no longer pending." });
      }

      const [alliance, invitee, proposerIds] = await Promise.all([
        ctx.db.alliance.findUnique({ where: { id: input.allianceId }, select: { name: true } }),
        ctx.db.country.findUnique({ where: { id: input.countryId }, select: { name: true } }),
        inviteProposerCountryIds(ctx.db, invite),
      ]);
      const allianceName = alliance?.name ?? "the alliance";
      const inviteeName = invitee?.name ?? "The invited country";

      if (input.choice === "decline") {
        await notifyCountryOwners(ctx.db, proposerIds, {
          title: "Alliance Invitation Declined",
          message: `${inviteeName} declined the invitation to join ${allianceName}.`,
          type: "warning",
          metadata: { allianceId: input.allianceId, countryId: input.countryId },
        });
        return { status: "declined" as const };
      }

      const count = await ctx.db.allianceMember.count({
        where: { allianceId: input.allianceId, isActive: true },
      });
      await ctx.db.alliance.update({
        where: { id: input.allianceId },
        data: { memberCount: count },
      });
      await notifyCountryOwners(ctx.db, proposerIds, {
        title: "Alliance Invitation Accepted",
        message: `${inviteeName} accepted the invitation and joined ${allianceName}.`,
        type: "success",
        priority: "high",
        metadata: { allianceId: input.allianceId, countryId: input.countryId },
      });
      return { status: "active" as const };
    }),
};
