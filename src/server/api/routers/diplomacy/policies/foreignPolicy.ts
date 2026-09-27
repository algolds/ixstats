import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { computeForeignPolicyImpact } from "~/lib/statecraft/foreign-policy";

// Cooperative actions need the target's consent before they take effect; hostile ones
// are unilateral. See plans/statecraft-stage2.md (S2.C).
const COOPERATIVE_FP = new Set(["free_trade", "military_alliance"]);

/**
 * Apply a foreign-policy action's stored effects and flip its status to "active":
 * storyteller effects on both sides, relation strength + bilateral trade. Used by
 * proposeForeignPolicyAction (hostile, immediate) and respondToForeignPolicyProposal
 * (cooperative, on accept). Idempotent — a no-op if already active.
 */
async function enactForeignPolicyEffects(db: PrismaClient, actionId: string, actorUserId: string) {
  const action = await db.foreignPolicyAction.findUnique({
    where: { id: actionId },
    include: {
      initiator: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  });
  if (!action || action.status === "active") return action;

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

  await db.$transaction(async (tx) => {
    await tx.foreignPolicyAction.update({ where: { id: action.id }, data: { status: "active" } });
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
  });

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
      const statusFilter = input.includeExpired ? {} : { status: { in: ["proposed", "active"] } };

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

      const strength = relation?.strength ?? 50;

      // Validation: can't FTA with hostile nation, can't embargo ally
      if (input.actionType === "free_trade" && strength < 20) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot sign a free trade agreement with a hostile nation (relationship < 20).",
        });
      }
      if ((input.actionType === "embargo" || input.actionType === "blockade") && strength > 80) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot impose embargo/blockade on a close ally (relationship > 80).",
        });
      }

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
      const [initiator, target] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: initiatorId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
        ctx.db.country.findUnique({
          where: { id: input.targetId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
      ]);

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
        initiator: {
          gdpPerCapita: initiator.currentGdpPerCapita ?? 10000,
          population: initiator.currentPopulation ?? 1000000,
        },
        target: {
          gdpPerCapita: target.currentGdpPerCapita ?? 10000,
          population: target.currentPopulation ?? 1000000,
        },
        actionType: input.actionType,
        severity: input.severity,
        tradeVolume: trade?.tradeVolume ?? undefined,
      });
      const initiatorGdpImpact = impact.initiatorGdpImpact;
      const targetGdpImpact = impact.targetGdpImpact;
      const relationshipDelta = impact.relationshipDelta;
      const category = impact.category;

      // Cooperative actions await the target's consent; hostile ones are unilateral.
      const cooperative = COOPERATIVE_FP.has(input.actionType);

      const created = await ctx.db.foreignPolicyAction.create({
        data: {
          initiatorId,
          targetId: input.targetId,
          actionType: input.actionType,
          category,
          severity: input.severity,
          status: cooperative ? "proposed" : "active",
          initiatorGdpImpact,
          targetGdpImpact,
          relationshipDelta,
          reason: input.reason,
          description: input.description,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          target: { select: { id: true, name: true } },
        },
      });

      // Cooperative → no effects yet; surfaces to the target via getForeignPolicyProposals.
      if (cooperative) return { ...created, pendingConsent: true };

      // Hostile → enact immediately.
      const enacted = await enactForeignPolicyEffects(
        ctx.db as PrismaClient,
        created.id,
        ctx.user.id
      );
      return enacted ?? created;
    }),
});
