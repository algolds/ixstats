import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { computeForeignPolicyImpact } from "~/lib/statecraft-foreign-policy";
import { assessReach, fogNumber } from "~/lib/statecraft-diplo-intel";

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

  // Get bilateral trade data between two countries
  getBilateralTrade: publicProcedure
    .input(
      z.object({
        country1Id: z.string(),
        country2Id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Normalize ordering so lookup is consistent with @@unique constraint
      const [c1, c2] =
        input.country1Id < input.country2Id
          ? [input.country1Id, input.country2Id]
          : [input.country2Id, input.country1Id];

      let trade = await ctx.db.bilateralTrade.findUnique({
        where: { country1Id_country2Id: { country1Id: c1, country2Id: c2 } },
        include: {
          country1: {
            select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
          },
          country2: {
            select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
          },
        },
      });

      // Auto-create if missing using GDP-based estimation
      if (!trade) {
        const [country1, country2] = await Promise.all([
          ctx.db.country.findUnique({
            where: { id: c1 },
            select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
          }),
          ctx.db.country.findUnique({
            where: { id: c2 },
            select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
          }),
        ]);

        if (!country1 || !country2) {
          throw new TRPCError({ code: "NOT_FOUND", message: "One or both countries not found" });
        }

        // Estimate GDP: currentGdpPerCapita * currentPopulation
        const gdp1 =
          (country1.currentGdpPerCapita ?? 10000) * (country1.currentPopulation ?? 1000000);
        const gdp2 =
          (country2.currentGdpPerCapita ?? 10000) * (country2.currentPopulation ?? 1000000);

        // Check diplomatic relationship for modifier
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: c1, country2: c2 },
              { country1: c2, country2: c1 },
            ],
          },
          select: { strength: true },
        });

        const relationMod = relation ? relation.strength / 100 : 0.5;

        // Trade volume = sqrt(GDP1 * GDP2) * relationship_modifier * scale_factor
        const tradeVolume = Math.sqrt(gdp1 * gdp2) * relationMod * 0.001;
        const exports1 = tradeVolume * (0.4 + Math.random() * 0.2);
        const exports2 = tradeVolume - exports1;

        trade = await ctx.db.bilateralTrade.create({
          data: {
            country1Id: c1,
            country2Id: c2,
            tradeVolume,
            exportsFrom1: exports1,
            exportsFrom2: exports2,
            tradeBalance1: exports1 - exports2,
            lastCalculatedIx: 0,
          },
          include: {
            country1: {
              select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
            },
            country2: {
              select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
            },
          },
        });
      }

      const formatCountry = (c: any) => {
        if (!c) return null;
        return {
          id: c.id,
          name: c.name,
          gdpPerCapita: c.currentGdpPerCapita,
          population: c.currentPopulation,
        };
      };

      return {
        ...trade,
        country1: formatCountry(trade.country1),
        country2: formatCountry(trade.country2),
      };
    }),

  // Preview the economic impact of a foreign policy action before confirming
  previewForeignPolicyImpact: publicProcedure
    .input(
      z.object({
        initiatorId: z.string(),
        targetId: z.string(),
        actionType: z.enum(["embargo", "sanction", "free_trade", "military_alliance", "blockade"]),
        severity: z.enum(["light", "moderate", "severe"]).optional().default("moderate"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get both countries' GDP data
      const [initiator, target] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.initiatorId },
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

      const gdp1 =
        (initiator.currentGdpPerCapita ?? 10000) * (initiator.currentPopulation ?? 1000000);
      const gdp2 = (target.currentGdpPerCapita ?? 10000) * (target.currentPopulation ?? 1000000);

      // Get bilateral trade for trade share calculation
      const [c1, c2] =
        input.initiatorId < input.targetId
          ? [input.initiatorId, input.targetId]
          : [input.targetId, input.initiatorId];

      const trade = await ctx.db.bilateralTrade.findUnique({
        where: { country1Id_country2Id: { country1Id: c1, country2Id: c2 } },
      });

      const tradeVol = trade?.tradeVolume ?? Math.sqrt(gdp1 * gdp2) * 0.0005;

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
        tradeVolume: tradeVol,
      });

      return {
        actionType: input.actionType,
        severity: input.severity,
        category: impact.category,
        initiator: {
          name: initiator.name,
          gdpImpact: impact.initiatorGdpImpact,
          gdpImpactPercent: (impact.initiatorGdpImpact * 100).toFixed(3),
          tradeExposure: (impact.initiatorTradeExposure * 100).toFixed(2),
        },
        target: {
          name: target.name,
          gdpImpact: impact.targetGdpImpact,
          gdpImpactPercent: (impact.targetGdpImpact * 100).toFixed(3),
          tradeExposure: (impact.targetTradeExposure * 100).toFixed(2),
        },
        relationshipDelta: impact.relationshipDelta,
        bilateralTradeVolume: tradeVol,
      };
    }),

  // Diplomacy recon (S2.B): read a target's stats fogged by YOUR reach into it (embassy →
  // clear, loose ties → estimate, nothing → unknown). Unilateral; never fabricates.
  getForeignIntel: protectedProcedure
    .input(z.object({ targetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.user?.countryId;
      const target = await ctx.db.country.findUnique({
        where: { id: input.targetId },
        select: {
          id: true,
          name: true,
          currentGdpPerCapita: true,
          currentPopulation: true,
          currentTotalGdp: true,
          economicTier: true,
        },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });

      const [embassy, relation] = me
        ? await Promise.all([
            ctx.db.embassy.findFirst({
              where: {
                status: "active",
                OR: [
                  { guestCountryId: me, hostCountryId: input.targetId },
                  { hostCountryId: me, guestCountryId: input.targetId },
                ],
              },
              select: { id: true },
            }),
            ctx.db.diplomaticRelation.findFirst({
              where: {
                OR: [
                  { country1: me, country2: input.targetId },
                  { country1: input.targetId, country2: me },
                ],
              },
              select: { strength: true },
            }),
          ])
        : [null, null];

      const reach = assessReach({
        hasEmbassy: !!embassy,
        relationStrength: relation?.strength ?? 0,
      });

      return {
        targetName: target.name,
        reach,
        stats: {
          gdpPerCapita: fogNumber(target.currentGdpPerCapita, reach.level),
          population: fogNumber(target.currentPopulation, reach.level),
          totalGdp: fogNumber(target.currentTotalGdp, reach.level),
          economicTier: reach.level === "greyed" ? null : target.economicTier,
        },
      };
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

  // S2.C: the target reviews an incoming cooperative proposal (free trade / alliance).
  getForeignPolicyProposals: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.foreignPolicyAction.findMany({
        where: { targetId: input.countryId, status: "proposed" },
        orderBy: { createdAt: "desc" },
        include: { initiator: { select: { id: true, name: true, flag: true } } },
      });
    }),

  // S2.C: foreign consent — the target accepts (enact) or declines a cooperative proposal.
  respondToForeignPolicyProposal: protectedProcedure
    .input(z.object({ actionId: z.string(), choice: z.enum(["accept", "decline"]) }))
    .mutation(async ({ ctx, input }) => {
      const action = await ctx.db.foreignPolicyAction.findUnique({
        where: { id: input.actionId },
        select: { id: true, targetId: true, status: true },
      });
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      if (ctx.user?.countryId !== action.targetId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the target country can respond." });
      }
      if (action.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });
      }

      if (input.choice === "decline") {
        await ctx.db.foreignPolicyAction.update({
          where: { id: action.id },
          data: { status: "declined" },
        });
        return { status: "declined" as const };
      }

      // Accept → enact the stored effects (initiator is the actor of record).
      const enacted = await enactForeignPolicyEffects(
        ctx.db as PrismaClient,
        action.id,
        ctx.user.id
      );
      return { status: "active" as const, action: enacted };
    }),

  // Lift / end an active foreign policy action
  liftForeignPolicyAction: protectedProcedure
    .input(
      z.object({
        actionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country.",
        });
      }

      const action = await ctx.db.foreignPolicyAction.findUnique({
        where: { id: input.actionId },
        include: {
          initiator: { select: { id: true, name: true } },
          target: { select: { id: true, name: true } },
        },
      });

      if (!action) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Foreign policy action not found." });
      }

      // Only initiator can lift
      if (action.initiatorId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the initiating country can lift this action.",
        });
      }

      if (action.status !== "active" && action.status !== "proposed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This action is already expired or lifted.",
        });
      }

      // Transaction: atomically lift action + recover relations + deactivate effects
      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedAction = await tx.foreignPolicyAction.update({
          where: { id: input.actionId },
          data: { status: "lifted" },
          include: {
            initiator: { select: { id: true, name: true } },
            target: { select: { id: true, name: true } },
          },
        });

        // Partial relationship recovery (30% of damage)
        if (action.relationshipDelta < 0) {
          const recovery = Math.round(Math.abs(action.relationshipDelta) * 0.3);
          const rel = await tx.diplomaticRelation.findFirst({
            where: {
              OR: [
                { country1: action.initiatorId, country2: action.targetId },
                { country1: action.targetId, country2: action.initiatorId },
              ],
            },
          });
          if (rel) {
            await tx.diplomaticRelation.update({
              where: { id: rel.id },
              data: {
                strength: Math.min(100, rel.strength + recovery),
                lastContact: new Date(),
              },
            });
          }
        }

        // Deactivate associated storyteller effects to stop economic drain
        await tx.storytellerEffect.updateMany({
          where: {
            description: { contains: action.actionType },
            countryId: { in: [action.initiatorId, action.targetId] },
            isActive: true,
          },
          data: { isActive: false },
        });

        return updatedAction;
      });

      return updated;
    }),
});
