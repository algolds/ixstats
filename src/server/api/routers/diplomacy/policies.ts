import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import { DiplomaticChoiceTracker } from "~/lib/diplomatic-choice-tracker";
import {
  calculateCulturalCompatibility,
  type CountryBasicInfo,
  type DiplomaticRelationship,
  type EmbassyConnection,
} from "~/lib/cultural-compatibility";
import {
  NPCCulturalParticipation,
  type NPCParticipationContext,
} from "~/lib/npc-cultural-participation";
import { NPCPersonalitySystem, type ObservableData } from "~/lib/diplomatic-npc-personality";
import {
  STRATEGIC_PRIORITIES,
  PARTNERSHIP_GOALS,
  KEY_ACHIEVEMENTS,
} from "~/lib/diplomatic-profile-options";
import { vaultService } from "~/lib/vault-service";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";

import { normalizeFlagUrl } from "~/lib/unified-flag-service";

// Helper functions for cultural exchange <-> embassy mission integration

/**
 * Calculate cultural exchange bonus from completed embassy missions
 * Returns percentage boost based on number of completed missions
 * @param completedMissionCount - Number of completed cultural_outreach missions
 * @returns Object with cultural impact and diplomatic value bonus percentages
 */
function _calculateMissionCulturalBonus(completedMissionCount: number) {
  // 20% cultural impact bonus per mission (max 60%)
  const culturalImpactBonus = Math.min(completedMissionCount * 20, 60);

  // 15% diplomatic value bonus per mission (max 45%)
  const diplomaticValueBonus = Math.min(completedMissionCount * 15, 45);

  return {
    culturalImpactBonus,
    diplomaticValueBonus,
    reasoning:
      completedMissionCount > 0
        ? `Embassy mission support provides +${culturalImpactBonus}% cultural impact and +${diplomaticValueBonus}% diplomatic value`
        : "No embassy mission support",
  };
}

/**
 * Apply cultural exchange boost when completing a cultural_outreach mission
 * Increases cultural impact and diplomatic value of linked exchange
 * @param culturalImpact - Base cultural impact boost amount (default: 15)
 * @param diplomaticValue - Base diplomatic value boost amount (default: 10)
 */
function _getCulturalExchangeBoostValues(culturalImpact = 15, diplomaticValue = 10) {
  return {
    culturalImpactBoost: culturalImpact,
    diplomaticValueBoost: diplomaticValue,
    reasoning: `Completed embassy mission boosts exchange by +${culturalImpact} cultural impact and +${diplomaticValue} diplomatic value`,
  };
}

export const diplomaticPoliciesRouter = createTRPCRouter({
  // Get diplomatic relationships for a country

  // Get recent diplomatic changes

  // Update diplomatic relationship

  // Create a new diplomatic relationship

  // Delete/terminate a diplomatic relationship

  // Embassy Network Operations

  // Diplomatic messaging has been unified into ThinkShare (/messages).
  // Use api.messages.getConversationsByFolder with folder="diplomatic" instead.
  // Use api.messages.sendMessage with conversationType="diplomatic" instead.

  // Cultural Exchanges

  // Link existing cultural exchange to an embassy mission

  // Embassy Game System Endpoints

  // Embassy Management

  // Embassy Upgrades

  // Embassy Missions

  // Embassy Economics

  // Influence and Relationship Management Procedures

  // Follow/Unfollow system for countries

  // Embassy Shared Data System

  // Embassy Profile Management

  // Get cultural compatibility scores for a country with all other countries

  // Get recommended diplomatic partners based on cultural compatibility

  // Update cultural exchange (only title and description)

  // Cancel cultural exchange (with diplomatic penalties)

  // Get NPC responses for cultural exchange using diplomatic AI

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
      const tradeShare1 = gdp1 > 0 ? tradeVol / gdp1 : 0.01;
      const tradeShare2 = gdp2 > 0 ? tradeVol / gdp2 : 0.01;

      const severityMultiplier =
        input.severity === "light" ? 0.5 : input.severity === "severe" ? 1.5 : 1.0;

      // Calculate impacts based on action type
      let initiatorGdpImpact = 0;
      let targetGdpImpact = 0;
      let relationshipDelta = 0;
      let category = "trade";

      switch (input.actionType) {
        case "embargo":
          initiatorGdpImpact = -(tradeShare1 * 0.015 * severityMultiplier);
          targetGdpImpact = -(tradeShare2 * 0.02 * severityMultiplier);
          relationshipDelta = Math.round(-25 * severityMultiplier);
          category = "trade";
          break;
        case "sanction":
          initiatorGdpImpact = -0.005 * severityMultiplier;
          targetGdpImpact = -(tradeShare2 * 0.015 * severityMultiplier);
          relationshipDelta = Math.round(-20 * severityMultiplier);
          category = "trade";
          break;
        case "free_trade":
          initiatorGdpImpact = 0.003 * severityMultiplier;
          targetGdpImpact = 0.003 * severityMultiplier;
          relationshipDelta = Math.round(15 * severityMultiplier);
          category = "trade";
          break;
        case "military_alliance":
          initiatorGdpImpact = 0.001;
          targetGdpImpact = 0.001;
          relationshipDelta = 20;
          category = "military";
          break;
        case "blockade":
          initiatorGdpImpact = -0.008 * severityMultiplier;
          targetGdpImpact = -0.03 * severityMultiplier;
          relationshipDelta = Math.round(-35 * severityMultiplier);
          category = "military";
          break;
      }

      return {
        actionType: input.actionType,
        severity: input.severity,
        category,
        initiator: {
          name: initiator.name,
          gdpImpact: initiatorGdpImpact,
          gdpImpactPercent: (initiatorGdpImpact * 100).toFixed(3),
          tradeExposure: (tradeShare1 * 100).toFixed(2),
        },
        target: {
          name: target.name,
          gdpImpact: targetGdpImpact,
          gdpImpactPercent: (targetGdpImpact * 100).toFixed(3),
          tradeExposure: (tradeShare2 * 100).toFixed(2),
        },
        relationshipDelta,
        bilateralTradeVolume: tradeVol,
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

      const gdp1 =
        (initiator.currentGdpPerCapita ?? 10000) * (initiator.currentPopulation ?? 1000000);
      const gdp2 = (target.currentGdpPerCapita ?? 10000) * (target.currentPopulation ?? 1000000);

      // Normalize country ordering for bilateral trade lookup
      const [c1, c2] =
        initiatorId < input.targetId
          ? [initiatorId, input.targetId]
          : [input.targetId, initiatorId];

      const trade = await ctx.db.bilateralTrade.findUnique({
        where: { country1Id_country2Id: { country1Id: c1, country2Id: c2 } },
      });

      const tradeVol = trade?.tradeVolume ?? Math.sqrt(gdp1 * gdp2) * 0.0005;
      const tradeShare1 = gdp1 > 0 ? tradeVol / gdp1 : 0.01;
      const tradeShare2 = gdp2 > 0 ? tradeVol / gdp2 : 0.01;

      const severityMultiplier =
        input.severity === "light" ? 0.5 : input.severity === "severe" ? 1.5 : 1.0;

      // Calculate economic impacts
      let initiatorGdpImpact = 0;
      let targetGdpImpact = 0;
      let relationshipDelta = 0;
      let category = "trade";
      let initiatorInputType = "GDP_ADJUSTMENT";
      let targetInputType = "GDP_ADJUSTMENT";

      switch (input.actionType) {
        case "embargo":
          initiatorGdpImpact = -(tradeShare1 * 0.015 * severityMultiplier);
          targetGdpImpact = -(tradeShare2 * 0.02 * severityMultiplier);
          relationshipDelta = Math.round(-25 * severityMultiplier);
          break;
        case "sanction":
          initiatorGdpImpact = -0.005 * severityMultiplier;
          targetGdpImpact = -(tradeShare2 * 0.015 * severityMultiplier);
          relationshipDelta = Math.round(-20 * severityMultiplier);
          break;
        case "free_trade":
          initiatorGdpImpact = 0.003 * severityMultiplier;
          targetGdpImpact = 0.003 * severityMultiplier;
          relationshipDelta = Math.round(15 * severityMultiplier);
          initiatorInputType = "TRADE_AGREEMENT";
          targetInputType = "TRADE_AGREEMENT";
          break;
        case "military_alliance":
          initiatorGdpImpact = 0.001;
          targetGdpImpact = 0.001;
          relationshipDelta = 20;
          category = "military";
          initiatorInputType = "GROWTH_RATE_MODIFIER";
          targetInputType = "GROWTH_RATE_MODIFIER";
          break;
        case "blockade":
          initiatorGdpImpact = -0.008 * severityMultiplier;
          targetGdpImpact = -0.03 * severityMultiplier;
          relationshipDelta = Math.round(-35 * severityMultiplier);
          category = "military";
          break;
      }

      // Create the foreign policy action
      const action = await ctx.db.foreignPolicyAction.create({
        data: {
          initiatorId,
          targetId: input.targetId,
          actionType: input.actionType,
          category,
          severity: input.severity,
          status: "active",
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

      // Create storyteller effects for BOTH countries — economic engine auto-processes
      const actionDescription = `Foreign policy: ${input.actionType} (${input.severity}) ${input.actionType === "free_trade" || input.actionType === "military_alliance" ? "with" : "against"} ${target.name}`;

      await ctx.db.storytellerEffect.createMany({
        data: [
          {
            countryId: initiatorId,
            ixTimeTimestamp: new Date(),
            inputType: initiatorInputType,
            value: initiatorGdpImpact,
            description: actionDescription,
            duration: 4, // 4 IxTime years
            isActive: true,
            createdBy: ctx.user.id,
          },
          {
            countryId: input.targetId,
            ixTimeTimestamp: new Date(),
            inputType: targetInputType,
            value: targetGdpImpact,
            description: `Affected by ${initiator.name}: ${input.actionType} (${input.severity})`,
            duration: 4,
            isActive: true,
            createdBy: ctx.user.id,
          },
        ],
      });

      // Update DiplomaticRelation strength
      if (relation) {
        const newStrength = Math.max(0, Math.min(100, strength + relationshipDelta));
        await ctx.db.diplomaticRelation.update({
          where: { id: relation.id },
          data: {
            strength: newStrength,
            lastContact: new Date(),
            tradeVolume:
              input.actionType === "embargo" || input.actionType === "blockade"
                ? (relation.tradeVolume ?? 0) * 0.3 // Trade drops 70%
                : input.actionType === "free_trade"
                  ? (relation.tradeVolume ?? 0) * 1.2 // Trade grows 20%
                  : relation.tradeVolume,
          },
        });
      }

      // Update BilateralTrade volume
      if (trade) {
        const tradeMultiplier =
          input.actionType === "embargo"
            ? 0.2
            : input.actionType === "blockade"
              ? 0.05
              : input.actionType === "sanction"
                ? 0.7
                : input.actionType === "free_trade"
                  ? 1.25
                  : 1.0;

        await ctx.db.bilateralTrade.update({
          where: { id: trade.id },
          data: {
            tradeVolume: trade.tradeVolume * tradeMultiplier,
            exportsFrom1: trade.exportsFrom1 * tradeMultiplier,
            exportsFrom2: trade.exportsFrom2 * tradeMultiplier,
            tradeBalance1: (trade.exportsFrom1 - trade.exportsFrom2) * tradeMultiplier,
          },
        });
      }

      // Auto-news: post to ThinkPages
      const newsType =
        input.actionType === "embargo"
          ? "embargo_imposed"
          : input.actionType === "sanction"
            ? "sanction_imposed"
            : input.actionType === "free_trade"
              ? "free_trade_signed"
              : input.actionType === "military_alliance"
                ? "military_alliance_signed"
                : input.actionType === "blockade"
                  ? "blockade_imposed"
                  : null;

      if (newsType) {
        void generateDiplomaticNews(ctx.db, initiatorId, newsType, {
          countryName: initiator.name,
          targetName: target.name,
          severity: input.severity,
          reason: input.reason,
        });
      }

      return action;
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

      // Lift the action
      const updated = await ctx.db.foreignPolicyAction.update({
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
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: action.initiatorId, country2: action.targetId },
              { country1: action.targetId, country2: action.initiatorId },
            ],
          },
        });
        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: {
              strength: Math.min(100, relation.strength + recovery),
              lastContact: new Date(),
            },
          });
        }
      }

      // Deactivate associated storyteller effects to stop economic drain
      await ctx.db.storytellerEffect.updateMany({
        where: {
          description: { contains: action.actionType },
          countryId: { in: [action.initiatorId, action.targetId] },
          isActive: true,
        },
        data: { isActive: false },
      });

      return updated;
    }),

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
        name: z.string().min(2).max(100),
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
              votingPower: 2.0, // Founders get double voting power
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
      } catch {}

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

      if (existing) {
        if (existing.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Country is already a member." });
        }
        // Re-activate
        await ctx.db.allianceMember.update({
          where: { id: existing.id },
          data: { isActive: true, role: input.role },
        });
      } else {
        await ctx.db.allianceMember.create({
          data: {
            allianceId: input.allianceId,
            countryId: input.targetCountryId,
            role: input.role,
            votingPower: input.role === "observer" ? 0 : 1.0,
          },
        });
      }

      // Update member count
      const count = await ctx.db.allianceMember.count({
        where: { allianceId: input.allianceId, isActive: true },
      });

      await ctx.db.alliance.update({
        where: { id: input.allianceId },
        data: { memberCount: count },
      });

      // Notification: notify invited country (fire-and-forget)
      try {
        const targetCountry = await ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: { users: { select: { clerkUserId: true } } },
        });
        const targetUserId = targetCountry?.users[0]?.clerkUserId;
        const alliance = await ctx.db.alliance.findUnique({
          where: { id: input.allianceId },
          select: { name: true },
        });
        if (targetUserId) {
          await notificationAPI.create({
            userId: targetUserId,
            countryId: input.targetCountryId,
            title: "Alliance Invitation",
            message: `You've been invited to join ${alliance?.name ?? "an alliance"}`,
            type: "info",
            category: "diplomatic",
            priority: "high",
            metadata: { allianceId: input.allianceId },
          });
        }
      } catch {}

      return { success: true };
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
        data: { isActive: false },
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

  // Create an alliance document
  createAllianceDocument: protectedProcedure
    .input(
      z.object({
        allianceId: z.string(),
        title: z.string().min(2),
        content: z.string(),
        documentType: z
          .enum(["memo", "policy", "strategy", "communique"])
          .optional()
          .default("memo"),
        isPublic: z.boolean().optional().default(false),
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

      if (!membership || !membership.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be an active member." });
      }

      const doc = await ctx.db.allianceDocument.create({
        data: {
          allianceId: input.allianceId,
          title: input.title,
          content: input.content,
          documentType: input.documentType,
          authorCountryId: ctx.user.countryId,
          isPublic: input.isPublic,
        },
      });

      return doc;
    }),

  // Get documents for an alliance
  getAllianceDocuments: publicProcedure
    .input(
      z.object({
        allianceId: z.string(),
        countryId: z.string().optional(), // If provided, show private docs for members
      })
    )
    .query(async ({ ctx, input }) => {
      let isMember = false;
      if (input.countryId) {
        const membership = await ctx.db.allianceMember.findUnique({
          where: {
            allianceId_countryId: {
              allianceId: input.allianceId,
              countryId: input.countryId,
            },
          },
        });
        isMember = !!membership?.isActive;
      }

      const docs = await ctx.db.allianceDocument.findMany({
        where: {
          allianceId: input.allianceId,
          ...(isMember ? {} : { isPublic: true }),
        },
        orderBy: { createdAt: "desc" },
      });

      return docs;
    }),

  // Get active embassy missions for a country
});

// Helper function to determine category from option value
function determineCategoryFromValue(value: string): string {
  const lowerValue = value.toLowerCase();

  // Economic & Trade keywords
  if (
    lowerValue.includes("economic") ||
    lowerValue.includes("trade") ||
    lowerValue.includes("investment") ||
    lowerValue.includes("market") ||
    lowerValue.includes("financial") ||
    lowerValue.includes("agricultural")
  ) {
    return "Economic";
  }

  // Military & Security keywords
  if (
    lowerValue.includes("military") ||
    lowerValue.includes("defense") ||
    lowerValue.includes("security") ||
    lowerValue.includes("intelligence") ||
    lowerValue.includes("counter-terrorism") ||
    lowerValue.includes("border") ||
    lowerValue.includes("maritime") ||
    lowerValue.includes("cybersecurity")
  ) {
    return "Military";
  }

  // Technology & Innovation keywords
  if (
    lowerValue.includes("technology") ||
    lowerValue.includes("research") ||
    lowerValue.includes("innovation") ||
    lowerValue.includes("digital") ||
    lowerValue.includes("space") ||
    lowerValue.includes("artificial intelligence") ||
    lowerValue.includes("telecommunications") ||
    lowerValue.includes("ai ")
  ) {
    return "Technology";
  }

  // Cultural & Social keywords
  if (
    lowerValue.includes("cultural") ||
    lowerValue.includes("educational") ||
    lowerValue.includes("scientific") ||
    lowerValue.includes("healthcare") ||
    lowerValue.includes("sports") ||
    lowerValue.includes("media") ||
    lowerValue.includes("student") ||
    lowerValue.includes("scholar") ||
    lowerValue.includes("artist") ||
    lowerValue.includes("festival") ||
    lowerValue.includes("language") ||
    lowerValue.includes("heritage")
  ) {
    return "Cultural";
  }

  // Environmental & Energy keywords
  if (
    lowerValue.includes("climate") ||
    lowerValue.includes("energy") ||
    lowerValue.includes("renewable") ||
    lowerValue.includes("environmental") ||
    lowerValue.includes("sustainable") ||
    lowerValue.includes("water") ||
    lowerValue.includes("conservation") ||
    lowerValue.includes("emission") ||
    lowerValue.includes("circular economy")
  ) {
    return "Environmental";
  }

  // Diplomatic & Political keywords
  if (
    lowerValue.includes("diplomatic") ||
    lowerValue.includes("regional") ||
    lowerValue.includes("humanitarian") ||
    lowerValue.includes("conflict") ||
    lowerValue.includes("democratic") ||
    lowerValue.includes("governance") ||
    lowerValue.includes("embassy") ||
    lowerValue.includes("consulate") ||
    lowerValue.includes("ambassadorial") ||
    lowerValue.includes("state visit") ||
    lowerValue.includes("summit") ||
    lowerValue.includes("partnership") ||
    lowerValue.includes("crisis") ||
    lowerValue.includes("mediation") ||
    lowerValue.includes("refugee")
  ) {
    return "Diplomatic";
  }

  // Default category
  return "General";
}

// Helper functions for embassy game mechanics
function getUpgradeEffects(upgradeType: string, level: number) {
  const effects: Record<string, any> = {};

  switch (upgradeType) {
    case "staff_expansion":
      effects.maxStaff = level * 2;
      effects.maxMissions = Math.ceil(level / 2);
      break;
    case "security_enhancement":
      effects.securityLevel = level;
      effects.missionSuccessBonus = level * 5;
      break;
    case "tech_upgrade":
      effects.efficiencyBonus = level * 10;
      effects.informationGatheringBonus = level * 15;
      break;
    case "facility_expansion":
      effects.capacityBonus = level * 20;
      effects.reputationBonus = level * 5;
      break;
    case "specialization_improvement":
      effects.specializationBonus = level * 25;
      effects.specializedMissionBonus = level * 20;
      break;
  }

  return effects;
}

function generateAvailableMissions(embassy: any) {
  const missions = [
    {
      id: "trade_negotiation_1",
      type: "trade_negotiation",
      name: "Local Trade Agreement",
      description: "Negotiate trade partnerships with local businesses",
      difficulty: "easy",
      duration: 5,
      cost: 2000,
      rewards: { experience: 100, influence: 5, economic: 15000 },
      requirements: { level: 1, staff: 1 },
    },
    {
      id: "cultural_outreach_1",
      type: "cultural_outreach",
      name: "Cultural Festival Participation",
      description: "Organize embassy participation in local cultural events",
      difficulty: "easy",
      duration: 3,
      cost: 1500,
      rewards: { experience: 75, reputation: 8, influence: 3 },
      requirements: { level: 1, staff: 2 },
    },
    {
      id: "intelligence_gathering_1",
      type: "intelligence_gathering",
      name: "Economic Intelligence Report",
      description: "Gather intelligence on local economic conditions",
      difficulty: "medium",
      duration: 7,
      cost: 3000,
      rewards: { experience: 150, influence: 8, economic: 5000 },
      requirements: { level: 2, staff: 2, specialization: "intelligence" },
    },
  ];

  return missions.filter(
    (mission) =>
      embassy.level >= mission.requirements.level &&
      embassy.staffCount >= mission.requirements.staff &&
      (!mission.requirements.specialization ||
        embassy.specialization === mission.requirements.specialization)
  );
}

function getMissionData(type: string, embassyLevel: number, _priority: string) {
  const baseData = {
    trade_negotiation: {
      name: "Trade Negotiation Mission",
      description: "Negotiate beneficial trade agreements",
      difficulty: "medium",
      baseDuration: 7,
      cost: 2500,
      experienceReward: 120,
      influenceReward: 6,
      reputationReward: 4,
      economicReward: 18000,
    },
    intelligence_gathering: {
      name: "Intelligence Gathering Operation",
      description: "Collect strategic intelligence information",
      difficulty: "hard",
      baseDuration: 10,
      cost: 4000,
      experienceReward: 200,
      influenceReward: 10,
      reputationReward: 2,
      economicReward: 8000,
    },
    cultural_outreach: {
      name: "Cultural Outreach Program",
      description: "Strengthen cultural ties with local community",
      difficulty: "easy",
      baseDuration: 5,
      cost: 1800,
      experienceReward: 80,
      influenceReward: 4,
      reputationReward: 12,
      economicReward: 3000,
    },
    security_cooperation: {
      name: "Security Cooperation Initiative",
      description: "Collaborate on security matters",
      difficulty: "hard",
      baseDuration: 12,
      cost: 5000,
      experienceReward: 250,
      influenceReward: 15,
      reputationReward: 8,
      economicReward: 12000,
    },
    research_collaboration: {
      name: "Research Collaboration Project",
      description: "Joint research initiative with local institutions",
      difficulty: "expert",
      baseDuration: 14,
      cost: 6000,
      experienceReward: 300,
      influenceReward: 12,
      reputationReward: 15,
      economicReward: 25000,
    },
  };

  const data = baseData[type as keyof typeof baseData];
  const levelMultiplier = 1 + (embassyLevel - 1) * 0.2;

  return {
    ...data,
    cost: Math.round(data.cost * levelMultiplier),
    experienceReward: Math.round(data.experienceReward * levelMultiplier),
    economicReward: Math.round(data.economicReward * levelMultiplier),
  };
}

function calculateSuccessChance(embassy: any, difficulty: string, staffAssigned: number) {
  let baseChance = 60;

  // Difficulty modifier
  const difficultyModifiers = { easy: 20, medium: 0, hard: -15, expert: -25 };
  baseChance += difficultyModifiers[difficulty as keyof typeof difficultyModifiers];

  // Embassy level bonus
  baseChance += (embassy.level - 1) * 8;

  // Staff bonus
  baseChance += (staffAssigned - 1) * 5;

  // Effectiveness bonus
  baseChance += (embassy.effectiveness - 50) * 0.3;

  // Specialization bonus (if applicable)
  if (embassy.specialization && embassy.specializationLevel > 0) {
    baseChance += embassy.specializationLevel * 10;
  }

  return Math.min(Math.max(baseChance, 10), 95); // Cap between 10-95%
}

// Influence and Relationship Mechanics
function _calculateInfluenceGain(
  missionType: string,
  success: boolean,
  embassyLevel: number
): number {
  const baseInfluence =
    {
      TRADE_NEGOTIATION: 50,
      CULTURAL_EXCHANGE: 30,
      INTELLIGENCE_GATHERING: 20,
      CRISIS_MANAGEMENT: 80,
      ECONOMIC_COOPERATION: 60,
    }[missionType] || 25;

  let multiplier = success ? 1.0 : 0.3; // Reduced gain on failure
  multiplier *= 1 + (embassyLevel - 1) * 0.2; // 20% bonus per level above 1

  return Math.floor(baseInfluence * multiplier);
}

function calculateRelationshipImpact(influenceChange: number, currentRelationship: string): number {
  // Relationship impact based on influence gain
  const baseImpact = Math.floor(influenceChange / 10);

  // Diminishing returns for already strong relationships
  const relationshipMultiplier =
    {
      alliance: 0.5,
      trade: 0.7,
      neutral: 1.0,
      tension: 1.5, // Easier to improve from tension
    }[currentRelationship] || 1.0;

  return Math.floor(baseImpact * relationshipMultiplier);
}

function getInfluenceEffects(totalInfluence: number): Record<string, number> {
  const effects: Record<string, number> = {};

  // Trade bonuses
  if (totalInfluence >= 100) effects.tradeBonus = Math.floor(totalInfluence / 100) * 5;

  // Mission success bonuses
  if (totalInfluence >= 200) effects.missionSuccessBonus = Math.floor(totalInfluence / 200) * 3;

  // Diplomatic immunity level
  if (totalInfluence >= 300) effects.diplomaticImmunity = Math.floor(totalInfluence / 300);

  // Intelligence gathering bonus
  if (totalInfluence >= 500) effects.intelligenceBonus = Math.floor(totalInfluence / 500) * 10;

  // Crisis response bonus
  if (totalInfluence >= 750) effects.crisisResponseBonus = Math.floor(totalInfluence / 750) * 15;

  return effects;
}
