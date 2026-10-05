import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";

import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  INVITE_STATUS,
  expireStaleDiplomaticProposals,
  inviteIssuedAt,
  isProposalExpired,
  proposalExpiresAt,
} from "~/lib/diplomacy/proposal-lifecycle";
import { notifyCountryOwners } from "./notify";
import {
  ALLIANCE_LEADER_ROLES,
  autoRespondNpcAllianceInvite,
  inviteProposerCountryIds,
} from "./alliance-invites";

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

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticPoliciesAlliancesRouter = createTRPCRouter({
  // ============================================================
  // Alliance / Bloc System (Phase 3)
  // ============================================================

  // Get alliances a country belongs to
  getAlliances: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const memberships = await ctx.db.allianceMember.findMany({
        where: { countryId: input.countryId, isActive: true },
        include: {
          alliance: {
            include: {
              members: {
                where: { isActive: true },
                include: {
                  country: { select: { id: true, name: true, flag: true } },
                },
              },
              _count: { select: { actions: true, documents: true } },
            },
          },
        },
      });

      return memberships.map((m) => ({
        ...m.alliance,
        myRole: m.role,
        myVotingPower: m.votingPower,
        myContributionLevel: m.contributionLevel,
      }));
    }),

  // Get a single alliance dashboard
  getAllianceDashboard: publicProcedure
    .input(z.object({ allianceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const alliance = await ctx.db.alliance.findUnique({
        where: { id: input.allianceId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              country: {
                select: {
                  id: true,
                  name: true,
                  flag: true,
                  currentGdpPerCapita: true,
                  currentPopulation: true,
                },
              },
            },
            orderBy: { role: "asc" },
          },
          actions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          documents: {
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!alliance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alliance not found" });
      }

      // Calculate aggregate stats
      const totalGdp = alliance.members.reduce((sum, m) => {
        const gdp = (m.country.currentGdpPerCapita ?? 0) * (m.country.currentPopulation ?? 0);
        return sum + gdp;
      }, 0);

      const totalPop = alliance.members.reduce(
        (sum, m) => sum + (m.country.currentPopulation ?? 0),
        0
      );

      return {
        ...alliance,
        calculatedTotalGdp: totalGdp,
        calculatedTotalPopulation: totalPop,
        pendingActions: alliance.actions.filter((a) => a.status === "proposed").length,
        activeActions: alliance.actions.filter((a) => a.status === "active").length,
      };
    }),

  // Create a new alliance
  createAlliance: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Alliance name must be at least 2 characters long").max(100),
        shortName: z.string().max(10).optional(),
        type: z.enum(["military", "economic", "political", "regional"]),
        description: z.string().optional(),
        charter: z.string().optional(),
        color: z.string().optional().default("#6366f1"),
        visibility: z.enum(["public", "private", "secret"]).optional().default("public"),
        joinPolicy: z.enum(["open", "invite", "application"]).optional().default("invite"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to create an alliance.",
        });
      }

      // Create alliance and add founder as first member
      const alliance = await ctx.db.alliance.create({
        data: {
          name: input.name,
          shortName: input.shortName,
          type: input.type,
          description: input.description,
          charter: input.charter,
          color: input.color,
          visibility: input.visibility,
          joinPolicy: input.joinPolicy,
          memberCount: 1,
          members: {
            create: {
              countryId: ctx.user.countryId,
              role: "founder",
              votingPower: 1.0, // Standard 1 vote per member
              contributionLevel: "high",
            },
          },
        },
        include: {
          members: {
            include: {
              country: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Auto-news: alliance formed
      const founderCountry = await ctx.db.country.findUnique({
        where: { id: ctx.user.countryId },
        select: { name: true },
      });
      void generateDiplomaticNews(ctx.db, ctx.user.countryId, "alliance_formed", {
        allianceName: input.name,
        countryName: founderCountry?.name ?? "Unknown",
      });

      // Notification: alliance formed (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: ctx.user.countryId,
            title: "Alliance Formed",
            message: `You founded the ${input.name} alliance`,
            type: "info",
            category: "diplomatic",
            priority: "high",
            metadata: { allianceId: alliance.id, allianceName: input.name },
          });
        }
      } catch (err) {
        console.warn("[Alliances] Formation notification failed for alliance", alliance.id, err);
      }

      return alliance;
    }),

  // Invite a country to join an alliance
  inviteMember: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        targetCountryId: z.string(),
        role: z.enum(["member", "observer"]).optional().default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Verify requester is a leader/founder of the alliance
      const myMembership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!myMembership || (myMembership.role !== "founder" && myMembership.role !== "leader")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only founders and leaders can invite members.",
        });
      }

      // Check if already a member
      const existing = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: input.targetCountryId,
          },
        },
      });

      if (existing?.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Country is already a member." });
      }
      // A stale invite no longer blocks a fresh one (it is re-issued below).
      if (existing?.status === "invited" && !isProposalExpired(inviteIssuedAt(existing))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An invitation to this country is already pending.",
        });
      }

      const targetExists = await ctx.db.country.findUnique({
        where: { id: input.targetCountryId },
        select: { id: true },
      });
      if (!targetExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found." });
      }

      // An invite is a pending row (isActive=false, status="invited"): the target's owner must
      // accept via respondToAllianceInvite before the country becomes a member.
      const votingPower = input.role === "observer" ? 0 : 1.0;
      const inviteFields = {
        isActive: false,
        status: INVITE_STATUS.pending,
        role: input.role,
        votingPower,
        invitedByCountryId: ctx.user.countryId,
        invitedAt: new Date(),
      };
      // Previously left, declined, withdrawn or expired: re-issue the invite.
      const invite = existing
        ? await ctx.db.allianceMember.update({ where: { id: existing.id }, data: inviteFields })
        : await ctx.db.allianceMember.create({
            data: {
              allianceId: input.allianceId,
              countryId: input.targetCountryId,
              ...inviteFields,
            },
          });

      // NPC (unowned) nations answer at once from their personality; players use their inbox.
      const npcStatus = await autoRespondNpcAllianceInvite(ctx.db, invite);
      if (npcStatus) return { success: true, pending: false, status: npcStatus };

      // Notification: notify invited country's owner (best effort)
      const alliance = await ctx.db.alliance.findUnique({
        where: { id: input.allianceId },
        select: { name: true },
      });
      await notifyCountryOwners(ctx.db, [input.targetCountryId], {
        title: "Alliance Invitation",
        message: `You've been invited to join ${alliance?.name ?? "an alliance"}. Review it in your diplomacy inbox.`,
        priority: "high",
        metadata: { allianceId: input.allianceId },
      });

      return { success: true, pending: true };
    }),

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
  withdrawAllianceInvite: protectedProcedure
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
  respondToAllianceInvite: protectedProcedure
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

  // Leave an alliance
  leaveAlliance: protectedProcedure
    .input(z.object({ allianceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an active member." });
      }

      await ctx.db.allianceMember.update({
        where: { id: membership.id },
        data: { isActive: false, status: "left" },
      });

      // Update count
      const count = await ctx.db.allianceMember.count({
        where: { allianceId: input.allianceId, isActive: true },
      });

      await ctx.db.alliance.update({
        where: { id: input.allianceId },
        data: { memberCount: count },
      });

      return { success: true };
    }),

  // Propose an alliance action (collective sanction, shared defense, etc.)
  proposeAllianceAction: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        actionType: z.enum([
          "collective_sanction",
          "shared_defense",
          "trade_bloc",
          "joint_statement",
        ]),
        targetId: z.string().optional(),
        title: z.string().min(2),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Verify membership
      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: input.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive || membership.role === "observer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Observers cannot propose actions. Active members only.",
        });
      }

      // Calculate required votes: simple majority of voting members
      const votingMembers = await ctx.db.allianceMember.count({
        where: {
          allianceId: input.allianceId,
          isActive: true,
          role: { not: "observer" },
        },
      });

      const requiredVotes = Math.ceil(votingMembers / 2);

      const action = await ctx.db.allianceAction.create({
        data: {
          allianceId: input.allianceId,
          actionType: input.actionType,
          targetId: input.targetId,
          title: input.title,
          description: input.description,
          status: "proposed",
          proposedBy: ctx.user.countryId,
          requiredVotes,
        },
      });

      return action;
    }),

  // Vote on an alliance action
  voteOnAllianceAction: protectedProcedure
    .input(
      z.object({
        actionId: z.string(),
        vote: z.enum(["for", "against", "abstain"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      const action = await ctx.db.allianceAction.findUnique({
        where: { id: input.actionId },
        include: { alliance: true },
      });

      if (!action) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action not found." });
      }

      if (action.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Voting is closed on this action." });
      }

      // Verify voter is a member
      const membership = await ctx.db.allianceMember.findUnique({
        where: {
          allianceId_countryId: {
            allianceId: action.allianceId,
            countryId: ctx.user.countryId,
          },
        },
      });

      if (!membership || !membership.isActive || membership.role === "observer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not eligible to vote." });
      }

      // Upsert vote
      await ctx.db.allianceVote.upsert({
        where: {
          actionId_countryId: {
            actionId: input.actionId,
            countryId: ctx.user.countryId,
          },
        },
        create: {
          allianceId: action.allianceId,
          actionId: input.actionId,
          countryId: ctx.user.countryId,
          vote: input.vote,
          votingPower: membership.votingPower,
          comment: input.comment,
        },
        update: {
          vote: input.vote,
          votingPower: membership.votingPower,
          comment: input.comment,
          votedAt: new Date(),
        },
      });

      // Tally votes
      const allVotes = await ctx.db.allianceVote.findMany({
        where: { actionId: input.actionId },
      });

      const votesFor = allVotes
        .filter((v) => v.vote === "for")
        .reduce((sum, v) => sum + v.votingPower, 0);
      const votesAgainst = allVotes
        .filter((v) => v.vote === "against")
        .reduce((sum, v) => sum + v.votingPower, 0);

      const updatedAction = await ctx.db.allianceAction.update({
        where: { id: input.actionId },
        data: {
          votesFor: Math.round(votesFor),
          votesAgainst: Math.round(votesAgainst),
          status: votesFor >= action.requiredVotes ? "approved" : "proposed",
        },
      });

      // If approved, execute the action
      if (updatedAction.status === "approved" && action.status === "proposed") {
        // For collective sanctions: create individual ForeignPolicyAction per member
        if (
          (action.actionType === "collective_sanction" || action.actionType === "trade_bloc") &&
          action.targetId
        ) {
          const members = await ctx.db.allianceMember.findMany({
            where: { allianceId: action.allianceId, isActive: true, role: { not: "observer" } },
            select: { countryId: true },
          });

          const fpType = action.actionType === "collective_sanction" ? "sanction" : "free_trade";

          for (const member of members) {
            // Skip if action already exists
            const existing = await ctx.db.foreignPolicyAction.findFirst({
              where: {
                initiatorId: member.countryId,
                targetId: action.targetId,
                actionType: fpType,
                status: "active",
              },
            });

            if (!existing) {
              await ctx.db.foreignPolicyAction.create({
                data: {
                  initiatorId: member.countryId,
                  targetId: action.targetId,
                  actionType: fpType,
                  category: "trade",
                  severity: "moderate",
                  status: "active",
                  reason: `Alliance action: ${action.title}`,
                  description: action.description,
                  relationshipDelta: fpType === "sanction" ? -15 : 10,
                },
              });
            }
          }
        }

        // Mark as active
        await ctx.db.allianceAction.update({
          where: { id: input.actionId },
          data: { status: "active" },
        });
      }

      return updatedAction;
    }),
});
