import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { leaveAllianceMembership } from "~/lib/diplomacy/alliance-succession";
import { notificationAPI } from "~/lib/notifications/api";

import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { ActivityHooks } from "~/lib/activity/hooks";
import {
  INVITE_STATUS,
  inviteIssuedAt,
  isProposalExpired,
} from "~/lib/diplomacy/proposal-lifecycle";
import { notifyCountryOwners } from "./notify";
import { openForeignPolicyAction } from "./foreignPolicy";
import { assertSameRealm } from "~/server/shared/same-realm-guard";
import { allianceInviteProcedures } from "./alliance-invite-procedures";
import {
  allianceNameTaken,
  assertAllianceRealm,
  autoRespondNpcAllianceInvite,
} from "./alliance-invites";

/** Collective actions that act on a target nation, and the foreign-policy action each member opens toward it. */
const TARGETED_ALLIANCE_ACTIONS = {
  collective_sanction: "sanction",
  trade_bloc: "free_trade",
} as const;

type TargetedAllianceAction = keyof typeof TARGETED_ALLIANCE_ACTIONS;
const isTargetedAction = (type: string): type is TargetedAllianceAction =>
  type in TARGETED_ALLIANCE_ACTIONS;

/** A targeted action needs a target: a real nation of the proposer's realm that is not in the alliance. */
async function assertValidAllianceTarget(
  db: PrismaClient,
  allianceId: string,
  proposerId: string,
  targetId: string | undefined
): Promise<void> {
  if (!targetId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the nation this action targets." });
  }
  const [target, member] = await Promise.all([
    db.country.findUnique({ where: { id: targetId }, select: { id: true } }),
    db.allianceMember.findUnique({
      where: { allianceId_countryId: { allianceId, countryId: targetId } },
      select: { isActive: true },
    }),
  ]);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Target nation not found." });
  if (member?.isActive) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "An alliance cannot act against one of its own members.",
    });
  }
  await assertSameRealm(db, proposerId, targetId);
}

/**
 * Carries out an approved targeted action: every voting member opens the foreign-policy action through the same path
 * a player's own proposal takes. A sanction is enacted at once (effects on both sides); a free trade offer waits for
 * the target's consent. A member that already has one in force, whose relation forbids it, or of another realm
 * than the target, is skipped.
 */
async function executeTargetedAllianceAction(
  db: PrismaClient,
  action: {
    allianceId: string;
    actionType: TargetedAllianceAction;
    targetId: string;
    title: string;
    description: string | null;
  }
): Promise<number> {
  const members = await db.allianceMember.findMany({
    where: { allianceId: action.allianceId, isActive: true, role: { not: "observer" } },
    select: { countryId: true },
  });
  let opened = 0;
  for (const member of members) {
    if (member.countryId === action.targetId) continue;
    try {
      await openForeignPolicyAction(db, {
        initiatorId: member.countryId,
        targetId: action.targetId,
        actionType: TARGETED_ALLIANCE_ACTIONS[action.actionType],
        severity: "moderate",
        reason: `Alliance action: ${action.title}`,
        description: action.description ?? undefined,
      });
      opened++;
    } catch (error) {
      if (!(error instanceof TRPCError)) throw error;
    }
  }
  return opened;
}

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
  createAlliance: rateLimitedMutationProcedure
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

      // The alliance belongs to the founding nation's realm; its name is unique within that realm.
      const founderCountry = await ctx.db.country.findUnique({
        where: { id: ctx.user.countryId },
        select: { name: true, realmId: true },
      });

      // Create alliance and add founder as first member
      const alliance = await ctx.db.alliance
        .create({
          data: {
            ...(founderCountry?.realmId && { realmId: founderCountry.realmId }),
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
        })
        .catch(allianceNameTaken);

      // Auto-news: alliance formed
      void generateDiplomaticNews(ctx.db, ctx.user.countryId, "alliance_formed", {
        allianceName: input.name,
        countryName: founderCountry?.name ?? "Unknown",
      });
      // Activity feed: only public alliances are announced (best effort, never throws).
      if (input.visibility === "public") {
        void ActivityHooks.Diplomatic.onAllianceFormed(
          ctx.user.countryId,
          input.name,
          input.type,
          ctx.auth?.userId ?? undefined
        );
      }

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
  inviteMember: rateLimitedMutationProcedure
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
        select: { id: true, realmId: true },
      });
      if (!targetExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found." });
      }
      await assertAllianceRealm(ctx.db, input.allianceId, targetExists.realmId);

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

  ...allianceInviteProcedures,

  // Leave an alliance
  leaveAlliance: rateLimitedMutationProcedure
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

      // The founder role passes to the longest-standing member; the last member out dissolves it.
      const result = await leaveAllianceMembership(ctx.db as PrismaClient, membership);
      if (!result.left) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an active member." });
      }
      return { success: true, dissolved: result.dissolved };
    }),

  // Propose an alliance action (collective sanction, shared defense, etc.)
  proposeAllianceAction: rateLimitedMutationProcedure
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

      if (isTargetedAction(input.actionType)) {
        await assertValidAllianceTarget(
          ctx.db as PrismaClient,
          input.allianceId,
          ctx.user.countryId,
          input.targetId
        );
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
  voteOnAllianceAction: rateLimitedMutationProcedure
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

      const tally = { votesFor: Math.round(votesFor), votesAgainst: Math.round(votesAgainst) };
      if (votesFor < action.requiredVotes) {
        return ctx.db.allianceAction.update({ where: { id: input.actionId }, data: tally });
      }

      // Approved: claimed conditionally, so two final votes landing together carry it out once.
      const claimed = await ctx.db.allianceAction.updateMany({
        where: { id: input.actionId, status: "proposed" },
        data: { ...tally, status: "active" },
      });
      if (claimed.count === 1 && isTargetedAction(action.actionType) && action.targetId) {
        await executeTargetedAllianceAction(ctx.db as PrismaClient, {
          allianceId: action.allianceId,
          actionType: action.actionType,
          targetId: action.targetId,
          title: action.title,
          description: action.description,
        });
      }
      const updatedAction = await ctx.db.allianceAction.findUniqueOrThrow({
        where: { id: input.actionId },
      });

      return updatedAction;
    }),
});
