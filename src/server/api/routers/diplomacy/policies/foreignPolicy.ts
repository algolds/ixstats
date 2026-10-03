import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { computeForeignPolicyImpact } from "~/lib/statecraft/foreign-policy";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  COOPERATIVE_FP_TYPES,
  PROPOSAL_STATUS,
  expireStaleDiplomaticProposals,
  isProposalExpired,
  proposalExpiresAt,
  proposalExpiryCutoff,
} from "~/lib/diplomacy/proposal-lifecycle";
import { notifyCountryOwners } from "./notify";

// Cooperative actions need the target's consent before they take effect; hostile ones
// are unilateral. See plans/statecraft-stage2.md (S2.C).
const COOPERATIVE_FP = new Set<string>(COOPERATIVE_FP_TYPES);

const FP_LABELS: Record<string, string> = {
  free_trade: "free trade agreement",
  military_alliance: "military alliance",
};

/** Mark a stale pending proposal expired and refuse the action with a clear message. */
async function rejectExpiredProposal(
  db: PrismaClient,
  action: { id: string; createdAt: Date }
): Promise<never> {
  await db.foreignPolicyAction.updateMany({
    where: { id: action.id, status: PROPOSAL_STATUS.pending },
    data: { status: PROPOSAL_STATUS.expired },
  });
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `This proposal expired on ${proposalExpiresAt(action.createdAt).toISOString().slice(0, 10)} without an answer.`,
  });
}

/**
 * Apply a foreign-policy action's stored effects and flip its status to "active":
 * storyteller effects on both sides, relation strength + bilateral trade. Used by
 * proposeForeignPolicyAction (hostile, immediate) and respondToForeignPolicyProposal
 * (cooperative, on accept).
 *
 * `claimFrom` is the status the row must still have. When set (accept path) the row is
 * claimed atomically inside the transaction (`updateMany where status = claimFrom`), so a
 * concurrent accept/decline cannot enact it twice or enact a declined proposal. When null
 * (hostile path) the row was just created as "active" and its effects have not been applied.
 */
async function enactForeignPolicyEffects(
  db: PrismaClient,
  actionId: string,
  actorUserId: string,
  claimFrom: "proposed" | null
) {
  const action = await db.foreignPolicyAction.findUnique({
    where: { id: actionId },
    include: {
      initiator: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  });
  if (!action || (claimFrom && action.status !== claimFrom)) return action;

  const relation = await db.diplomaticRelation.findFirst({
    where: {
      OR: [
        { country1: action.initiatorId, country2: action.targetId },
        { country1: action.targetId, country2: action.initiatorId },
      ],
    },
  });
  const [c1, c2] =
    action.initiatorId < action.targetId
      ? [action.initiatorId, action.targetId]
      : [action.targetId, action.initiatorId];
  const trade = await db.bilateralTrade.findUnique({
    where: { country1Id_country2Id: { country1Id: c1, country2Id: c2 } },
  });

  let initiatorInputType = "GDP_ADJUSTMENT";
  let targetInputType = "GDP_ADJUSTMENT";
  if (action.actionType === "free_trade") {
    initiatorInputType = "TRADE_AGREEMENT";
    targetInputType = "TRADE_AGREEMENT";
  } else if (action.actionType === "military_alliance") {
    initiatorInputType = "GROWTH_RATE_MODIFIER";
    targetInputType = "GROWTH_RATE_MODIFIER";
  }

  const tradeMultiplier =
    action.actionType === "embargo"
      ? 0.2
      : action.actionType === "blockade"
        ? 0.05
        : action.actionType === "sanction"
          ? 0.7
          : action.actionType === "free_trade"
            ? 1.25
            : 1.0;
  const newStrength = relation
    ? Math.max(0, Math.min(100, (relation.strength ?? 50) + action.relationshipDelta))
    : null;
  const actionDescription = `Foreign policy: ${action.actionType} (${action.severity}) ${COOPERATIVE_FP.has(action.actionType) ? "with" : "against"} ${action.target.name}`;

  const enacted = await db.$transaction(async (tx) => {
    if (claimFrom) {
      const claimed = await tx.foreignPolicyAction.updateMany({
        where: { id: action.id, status: claimFrom },
        data: { status: "active" },
      });
      if (claimed.count === 0) return false;
    }
    await tx.storytellerEffect.createMany({
      data: [
        {
          countryId: action.initiatorId,
          ixTimeTimestamp: new Date(),
          inputType: initiatorInputType,
          value: action.initiatorGdpImpact,
          description: actionDescription,
          duration: 4,
          isActive: true,
          createdBy: actorUserId,
        },
        {
          countryId: action.targetId,
          ixTimeTimestamp: new Date(),
          inputType: targetInputType,
          value: action.targetGdpImpact,
          description: `Affected by ${action.initiator.name}: ${action.actionType} (${action.severity})`,
          duration: 4,
          isActive: true,
          createdBy: actorUserId,
        },
      ],
    });
    if (relation && newStrength !== null) {
      await tx.diplomaticRelation.update({
        where: { id: relation.id },
        data: {
          strength: newStrength,
          lastContact: new Date(),
          tradeVolume:
            action.actionType === "embargo" || action.actionType === "blockade"
              ? (relation.tradeVolume ?? 0) * 0.3
              : action.actionType === "free_trade"
                ? (relation.tradeVolume ?? 0) * 1.2
                : relation.tradeVolume,
        },
      });
    }
    if (trade) {
      await tx.bilateralTrade.update({
        where: { id: trade.id },
        data: {
          tradeVolume: trade.tradeVolume * tradeMultiplier,
          exportsFrom1: trade.exportsFrom1 * tradeMultiplier,
          exportsFrom2: trade.exportsFrom2 * tradeMultiplier,
          tradeBalance1: (trade.exportsFrom1 - trade.exportsFrom2) * tradeMultiplier,
        },
      });
    }
    return true;
  });
  if (!enacted) return db.foreignPolicyAction.findUnique({ where: { id: action.id } });

  const newsType =
    action.actionType === "embargo"
      ? "embargo_imposed"
      : action.actionType === "sanction"
        ? "sanction_imposed"
        : action.actionType === "free_trade"
          ? "free_trade_signed"
          : action.actionType === "military_alliance"
            ? "military_alliance_signed"
            : action.actionType === "blockade"
              ? "blockade_imposed"
              : null;
  if (newsType) {
    void generateDiplomaticNews(db, action.initiatorId, newsType, {
      countryName: action.initiator.name,
      targetName: action.target.name,
      severity: action.severity,
      reason: action.reason ?? undefined,
    });
  }

  return db.foreignPolicyAction.findUnique({
    where: { id: action.id },
    include: {
      initiator: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  });
}

// Helper functions for cultural exchange <-> embassy mission integration
/** Relationship-strength gates: no free trade with a hostile nation, no embargo or blockade on a close ally. */
function assertRelationAllowsAction(actionType: string, strength: number) {
  if (actionType === "free_trade" && strength < 20) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot sign a free trade agreement with a hostile nation (relationship < 20).",
    });
  }
  if ((actionType === "embargo" || actionType === "blockade") && strength > 80) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot impose embargo/blockade on a close ally (relationship > 80).",
    });
  }
}

const impactParty = (country: {
  currentGdpPerCapita: number | null;
  currentPopulation: number | null;
}) => ({
  gdpPerCapita: country.currentGdpPerCapita ?? 10000,
  population: country.currentPopulation ?? 1000000,
});

export const diplomaticPoliciesForeignPolicyRouter = createTRPCRouter({
  // ============================================================
  // Foreign Policy Actions (Phase 2)
  // ============================================================

  // Get active foreign policies for a country (as initiator or target)
  getActiveForeignPolicies: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeExpired: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // Pending proposals past their answer window count as expired, not live.
      const statusFilter = input.includeExpired
        ? {}
        : {
            AND: [
              {
                OR: [
                  { status: "active" },
                  { status: "proposed", createdAt: { gte: proposalExpiryCutoff() } },
                ],
              },
            ],
          };

      const actions = await ctx.db.foreignPolicyAction.findMany({
        where: {
          OR: [{ initiatorId: input.countryId }, { targetId: input.countryId }],
          ...statusFilter,
        },
        include: {
          initiator: { select: { id: true, name: true, flag: true } },
          target: { select: { id: true, name: true, flag: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return actions;
    }),

  // Propose / enact a foreign policy action
  proposeForeignPolicyAction: protectedProcedure
    .input(
      z.object({
        targetId: z.string(),
        actionType: z.enum(["embargo", "sanction", "free_trade", "military_alliance", "blockade"]),
        severity: z.enum(["light", "moderate", "severe"]).optional().default("moderate"),
        reason: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to propose foreign policy actions.",
        });
      }

      const initiatorId = ctx.user.countryId;

      if (initiatorId === input.targetId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot enact foreign policy against your own country.",
        });
      }

      // Check relationship strength for validity
      const relation = await ctx.db.diplomaticRelation.findFirst({
        where: {
          OR: [
            { country1: initiatorId, country2: input.targetId },
            { country1: input.targetId, country2: initiatorId },
          ],
        },
      });

      assertRelationAllowsAction(input.actionType, relation?.strength ?? 50);

      // Stale pending proposals must not block a fresh one.
      await expireStaleDiplomaticProposals(ctx.db, { countryId: initiatorId });

      // Check for existing active action of same type
      const existingAction = await ctx.db.foreignPolicyAction.findFirst({
        where: {
          initiatorId,
          targetId: input.targetId,
          actionType: input.actionType,
          status: { in: ["proposed", "active"] },
        },
      });

      if (existingAction) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `An active ${input.actionType} already exists against this country.`,
        });
      }

      // Get both countries for GDP calculations
      const [initiator, target] = await Promise.all(
        [initiatorId, input.targetId].map((id) =>
          ctx.db.country.findUnique({
            where: { id },
            select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
          })
        )
      );

      if (!initiator || !target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Normalize country ordering for bilateral trade lookup
      const [c1, c2] =
        initiatorId < input.targetId
          ? [initiatorId, input.targetId]
          : [input.targetId, initiatorId];

      const trade = await ctx.db.bilateralTrade.findUnique({
        where: { country1Id_country2Id: { country1Id: c1, country2Id: c2 } },
      });

      // Target-scaled impact (shared pure fn — see plans/statecraft-stage2.md).
      const impact = computeForeignPolicyImpact({
        initiator: impactParty(initiator),
        target: impactParty(target),
        actionType: input.actionType,
        severity: input.severity,
        tradeVolume: trade?.tradeVolume ?? undefined,
      });

      // Cooperative actions await the target's consent; hostile ones are unilateral.
      const cooperative = COOPERATIVE_FP.has(input.actionType);

      const created = await ctx.db.foreignPolicyAction.create({
        data: {
          initiatorId,
          targetId: input.targetId,
          actionType: input.actionType,
          category: impact.category,
          severity: input.severity,
          status: cooperative ? "proposed" : "active",
          initiatorGdpImpact: impact.initiatorGdpImpact,
          targetGdpImpact: impact.targetGdpImpact,
          relationshipDelta: impact.relationshipDelta,
          reason: input.reason,
          description: input.description,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          target: { select: { id: true, name: true } },
        },
      });

      // Cooperative → no effects yet; surfaces to the target via getForeignPolicyProposals.
      if (cooperative) {
        await notifyCountryOwners(ctx.db, [input.targetId], {
          title: "Diplomatic Proposal Received",
          message: `${initiator.name} proposes a ${FP_LABELS[input.actionType] ?? input.actionType} with ${target.name}. Review it in your diplomacy inbox.`,
          priority: "high",
          metadata: { foreignPolicyActionId: created.id, actionType: input.actionType },
        });
        return { ...created, pendingConsent: true };
      }

      // Hostile → enact immediately.
      const enacted = await enactForeignPolicyEffects(
        ctx.db as PrismaClient,
        created.id,
        ctx.user.id,
        null
      );
      return enacted ?? created;
    }),

  // The target reviews incoming cooperative proposals (free trade / alliance).
  getForeignPolicyProposals: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      await expireStaleDiplomaticProposals(ctx.db, { countryId: input.countryId });
      const proposals = await ctx.db.foreignPolicyAction.findMany({
        where: {
          targetId: input.countryId,
          status: PROPOSAL_STATUS.pending,
          createdAt: { gte: proposalExpiryCutoff() },
        },
        orderBy: { createdAt: "desc" },
        include: { initiator: { select: { id: true, name: true, flag: true } } },
      });
      return proposals.map((p) => ({ ...p, expiresAt: proposalExpiresAt(p.createdAt) }));
    }),

  // The proposer's view of its own pending cooperative proposals.
  getOutgoingForeignPolicyProposals: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      await expireStaleDiplomaticProposals(ctx.db, { countryId: input.countryId });
      const proposals = await ctx.db.foreignPolicyAction.findMany({
        where: {
          initiatorId: input.countryId,
          status: PROPOSAL_STATUS.pending,
          actionType: { in: [...COOPERATIVE_FP_TYPES] },
          createdAt: { gte: proposalExpiryCutoff() },
        },
        orderBy: { createdAt: "desc" },
        include: { target: { select: { id: true, name: true, flag: true } } },
      });
      return proposals.map((p) => ({ ...p, expiresAt: proposalExpiresAt(p.createdAt) }));
    }),

  // The proposer withdraws a pending cooperative proposal before it is answered.
  withdrawForeignPolicyProposal: protectedProcedure
    .input(z.object({ actionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const action = await ctx.db.foreignPolicyAction.findUnique({
        where: { id: input.actionId },
        select: { id: true, initiatorId: true, status: true, createdAt: true },
      });
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      await assertCountryWriteAccess(ctx, action.initiatorId);
      if (action.status !== PROPOSAL_STATUS.pending) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
      }
      if (isProposalExpired(action.createdAt)) {
        await rejectExpiredProposal(ctx.db as PrismaClient, action);
      }
      const withdrawn = await ctx.db.foreignPolicyAction.updateMany({
        where: { id: action.id, status: PROPOSAL_STATUS.pending },
        data: { status: PROPOSAL_STATUS.withdrawn },
      });
      if (withdrawn.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
      }
      return { status: PROPOSAL_STATUS.withdrawn };
    }),

  // Foreign consent: the target's owner accepts (enact the stored effects) or declines.
  respondToForeignPolicyProposal: protectedProcedure
    .input(z.object({ actionId: z.string(), choice: z.enum(["accept", "decline"]) }))
    .mutation(async ({ ctx, input }) => {
      const action = await ctx.db.foreignPolicyAction.findUnique({
        where: { id: input.actionId },
        select: {
          id: true,
          initiatorId: true,
          targetId: true,
          actionType: true,
          status: true,
          createdAt: true,
          target: { select: { name: true } },
        },
      });
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      await assertCountryWriteAccess(ctx, action.targetId);
      if (action.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
      }
      if (isProposalExpired(action.createdAt)) {
        await rejectExpiredProposal(ctx.db as PrismaClient, action);
      }
      const label = FP_LABELS[action.actionType] ?? action.actionType;

      if (input.choice === "decline") {
        const declined = await ctx.db.foreignPolicyAction.updateMany({
          where: { id: action.id, status: "proposed" },
          data: { status: "declined" },
        });
        if (declined.count === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
        }
        await notifyCountryOwners(ctx.db, [action.initiatorId], {
          title: "Proposal Declined",
          message: `${action.target.name} declined your ${label} proposal.`,
          type: "warning",
          metadata: { foreignPolicyActionId: action.id, actionType: action.actionType },
        });
        return { status: "declined" as const };
      }

      // Accept: enact the stored effects (the accepting user is the actor of record).
      const enacted = await enactForeignPolicyEffects(
        ctx.db as PrismaClient,
        action.id,
        ctx.user.id,
        "proposed"
      );
      if (!enacted || enacted.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
      }
      await notifyCountryOwners(ctx.db, [action.initiatorId], {
        title: "Proposal Accepted",
        message: `${action.target.name} accepted your ${label} proposal. It is now in effect.`,
        type: "success",
        priority: "high",
        metadata: { foreignPolicyActionId: action.id, actionType: action.actionType },
      });
      return { status: "active" as const, action: enacted };
    }),
});
