import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticPoliciesForeignPolicyRouter = createTRPCRouter({
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

  // Get a single alliance dashboard

  // Create a new alliance

  // Invite a country to join an alliance

  // Leave an alliance

  // Propose an alliance action (collective sanction, shared defense, etc.)

  // Vote on an alliance action

  // Create an alliance document

  // Get documents for an alliance

  // Get active embassy missions for a country
});

// Helper function to determine category from option value
// Helper functions for embassy game mechanics
// Influence and Relationship Mechanics
