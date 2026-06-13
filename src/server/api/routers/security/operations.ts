// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  premiumProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";




import { notificationAPI } from "~/lib/notification-api";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";

// ===========================
// Input Validation Schemas
// ===========================

// Base schema with all fields
const militaryBranchBaseSchema = z.object({
  branchType: z.enum([
    "army",
    "navy",
    "air_force",
    "space_force",
    "marines",
    "coast_guard",
    "cyber_command",
    "special_forces",
  ]),
  name: z.string().min(1, "Branch name is required"),
  description: z.string().optional(),
  motto: z.string().optional(),
  imageUrl: z.string().optional(),
  established: z.string().optional(),
  activeDuty: z.number().int().nonnegative().default(0),
  reserves: z.number().int().nonnegative().default(0),
  civilianStaff: z.number().int().nonnegative().default(0),
  annualBudget: z.number().nonnegative().default(0),
  budgetPercent: z.number().min(0).max(100).default(0),
  readinessLevel: z.number().min(0).max(100).default(50),
  technologyLevel: z.number().min(0).max(100).default(50),
  trainingLevel: z.number().min(0).max(100).default(50),
  morale: z.number().min(0).max(100).default(50),
  deploymentCapacity: z.number().min(0).max(100).default(50),
  sustainmentCapacity: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

// Create schema - all required fields with defaults
const militaryBranchCreateSchema = militaryBranchBaseSchema;

// Update schema - all fields optional
const militaryBranchUpdateSchema = militaryBranchBaseSchema.partial();

const militaryUnitInputSchema = z.object({
  name: z.string().min(1),
  unitType: z.string(),
  designation: z.string().optional(),
  description: z.string().optional(),
  personnel: z.number().int().nonnegative().default(0),
  commanderName: z.string().optional(),
  commanderRank: z.string().optional(),
  headquarters: z.string().optional(),
  readiness: z.number().min(0).max(100).default(50),
  imageUrl: z.string().optional(),
});

const militaryAssetInputSchema = z.object({
  assetType: z.enum(["aircraft", "ship", "vehicle", "weapon_system", "installation"]),
  category: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  operational: z.number().int().nonnegative().default(1),
  capability: z.string().optional(),
  status: z.enum(["operational", "maintenance", "reserve", "retired"]).default("operational"),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().default(0),
  maintenanceCost: z.number().nonnegative().default(0),
  imageUrl: z.string().optional(),
});

const securityThreatInputSchema = z.object({
  threatName: z.string().min(1),
  threatType: z.enum([
    "military",
    "terrorism",
    "insurgency",
    "cyber",
    "organized_crime",
    "espionage",
    "nuclear",
    "biological",
    "natural_disaster",
  ]),
  description: z.string().min(10),
  severity: z.enum(["existential", "critical", "high", "moderate", "low"]),
  likelihood: z.number().min(0).max(100).default(50),
  urgency: z.enum(["low", "medium", "high", "immediate"]).default("medium"),
  actorType: z.enum(["state", "non-state", "terrorist", "criminal", "unknown"]).optional(),
  actorName: z.string().optional(),
  actorLocation: z.string().optional(),
  actorCapability: z.number().min(0).max(100).default(50),
  potentialCasualties: z.number().int().nonnegative().default(0),
  economicImpact: z.number().nonnegative().default(0),
  politicalImpact: z.string().optional(),
  infrastructureRisk: z.number().min(0).max(100).default(0),
  responseLevel: z.enum(["minimal", "standard", "elevated", "maximum"]).default("standard"),
  intelligenceSource: z.string().optional(),
  confidenceLevel: z.number().min(0).max(100).default(50),
  estimatedTimeline: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const neighborThreatInputSchema = z.object({
  neighborName: z.string().min(1),
  neighborCountryId: z.string().optional(),
  borderType: z.enum(["land", "maritime", "both"]),
  borderLength: z.number().nonnegative().optional(),
  threatLevel: z.enum(["minimal", "low", "moderate", "high", "critical"]).default("low"),
  threatScore: z.number().min(0).max(100).default(20),
  militaryThreat: z.number().min(0).max(100).default(10),
  terrorismRisk: z.number().min(0).max(100).default(15),
  smugglingRisk: z.number().min(0).max(100).default(25),
  refugeeFlow: z.number().min(0).max(100).default(20),
  politicalStability: z.number().min(0).max(100).default(60),
  diplomaticRelations: z
    .enum(["hostile", "tense", "neutral", "friendly", "allied"])
    .default("neutral"),
  tradeVolume: z.number().nonnegative().default(0),
  treatyStatus: z.string().optional(),
  notes: z.string().optional(),
});

// ===========================
// Security Router
// ===========================

export const securityOperationsRouter = createTRPCRouter({
  // ===========================
  // Security Assessment Endpoints
  // ===========================

  // ===========================
  // Military Branch Endpoints
  // ===========================

  // ===========================
  // Military Unit Endpoints
  // ===========================

  // ===========================
  // Military Asset Endpoints
  // ===========================

  // ===========================
  // Defense Budget Endpoints
  // ===========================

  // ===========================
  // Internal Stability Endpoints
  // ===========================

  // ===========================
  // Border Security Endpoints
  // ===========================

  // ===========================
  // Security Threats Endpoints
  // ===========================

  // ===========================
  // Integration Endpoints
  // ===========================

  // ============================================================
  // Military Operations (Phase 4)
  // ============================================================

  // Get active and past operations
  getOperations: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeCompleted: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const statusFilter = input.includeCompleted ? {} : { status: { in: ["planned", "active"] } };

      const operations = await ctx.db.militaryOperation.findMany({
        where: { countryId: input.countryId, ...statusFilter },
        include: {
          targetCountry: { select: { id: true, name: true, flag: true } },
          deployments: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return operations.map((op) => ({
        ...op,
        targetCountry: op.targetCountry
          ? {
              id: op.targetCountry.id,
              name: op.targetCountry.name,
              flagUrl: op.targetCountry.flag,
            }
          : null,
      }));
    }),

  // Create a military operation and deploy units/assets
  createOperation: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        operationType: z.enum([
          "peacekeeping",
          "defense_pact",
          "blockade",
          "intervention",
          "training",
        ]),
        name: z.string().min(2),
        description: z.string().optional(),
        targetCountryId: z.string().optional(),
        personnelDeployed: z.number().min(0).default(0),
        unitIds: z.array(z.string()).optional().default([]),
        assetIds: z.array(z.string()).optional().default([]),
        duration: z.number().min(1).optional(), // Planned IxTime days
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create operations for your own country.",
        });
      }

      // Get country GDP for cost calculation
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Calculate daily cost: (personnel * $200/day) + (asset maintenance * 1.5x)
      let assetMaintenanceCost = 0;
      if (input.assetIds.length > 0) {
        const assets = await ctx.db.militaryAsset.findMany({
          where: { id: { in: input.assetIds } },
          select: { maintenanceCost: true },
        });
        assetMaintenanceCost = assets.reduce((sum, a) => sum + (a.maintenanceCost ?? 0), 0);
      }

      const dailyCost = input.personnelDeployed * 200 + assetMaintenanceCost * 1.5;
      const annualCost = dailyCost * 365;
      const gdp = (country.currentGdpPerCapita ?? 10000) * (country.currentPopulation ?? 1000000);
      const gdpDrain = gdp > 0 ? annualCost / gdp : 0;

      // Create the operation
      const operation = await ctx.db.militaryOperation.create({
        data: {
          countryId: input.countryId,
          operationType: input.operationType,
          name: input.name,
          description: input.description,
          targetCountryId: input.targetCountryId,
          status: "active",
          personnelDeployed: input.personnelDeployed,
          dailyCost,
          gdpDrain,
          duration: input.duration,
        },
        include: {
          targetCountry: { select: { id: true, name: true } },
        },
      });

      // Create deployments for units
      if (input.unitIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: input.unitIds.map((unitId) => ({
            operationId: operation.id,
            unitId,
            status: "deployed",
          })),
        });

        // Reduce unit readiness
        await ctx.db.militaryUnit.updateMany({
          where: { id: { in: input.unitIds } },
          data: { readiness: { decrement: 10 } },
        });
      }

      // Create deployments for assets
      if (input.assetIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: input.assetIds.map((assetId) => ({
            operationId: operation.id,
            assetId,
            status: "deployed",
          })),
        });
      }

      // Create storyteller effects for GDP drain
      if (gdpDrain > 0) {
        await ctx.db.storytellerEffect.create({
          data: {
            countryId: input.countryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -gdpDrain,
            description: `Military operation: ${input.name} (${input.operationType})`,
            duration: input.duration ? Math.ceil(input.duration / 365) : 1,
            isActive: true,
            createdBy: userProfile.id,
          },
        });
      }

      // Diplomatic impact for certain operation types
      if (input.targetCountryId && input.operationType === "peacekeeping") {
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.countryId, country2: input.targetCountryId },
              { country1: input.targetCountryId, country2: input.countryId },
            ],
          },
        });
        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: { strength: Math.min(100, relation.strength + 10) },
          });
        }
      }

      // Auto-news: military deployment
      void generateDiplomaticNews(ctx.db as any, input.countryId, "military_deployed", {
        countryName: country.name,
        operationName: input.name,
        personnel: input.personnelDeployed,
        targetName: operation.targetCountry?.name,
      });

      return operation;
    }),

  // Recall a deployment / end an operation
  endOperation: premiumProcedure
    .input(
      z.object({
        operationId: z.string(),
        successRating: z.enum(["success", "partial", "failure"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      const operation = await ctx.db.militaryOperation.findUnique({
        where: { id: input.operationId },
        include: { deployments: true },
      });

      if (!operation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Operation not found." });
      }

      if (operation.countryId !== userProfile?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your operation." });
      }

      if (operation.status !== "active" && operation.status !== "planned") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Operation is not active." });
      }

      // Recall all deployments
      await ctx.db.deployment.updateMany({
        where: { operationId: input.operationId, status: "deployed" },
        data: { status: "recalled", recalledAt: new Date() },
      });

      // Restore partial unit readiness (+5 per recalled unit)
      const unitDeployments = operation.deployments.filter(
        (d) => d.unitId && d.status === "deployed"
      );
      if (unitDeployments.length > 0) {
        const unitIds = unitDeployments.map((d) => d.unitId!);
        await ctx.db.militaryUnit.updateMany({
          where: { id: { in: unitIds } },
          data: { readiness: { increment: 5 } },
        });
      }

      // End operation
      const updated = await ctx.db.militaryOperation.update({
        where: { id: input.operationId },
        data: {
          status: "completed",
          successRating: input.successRating,
        },
      });

      // Deactivate storyteller effects for this operation
      await ctx.db.storytellerEffect.updateMany({
        where: {
          countryId: operation.countryId,
          description: { contains: operation.name },
          isActive: true,
        },
        data: { isActive: false },
      });

      // Notification: operation completed (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: operation.countryId,
            title: "Operation Complete",
            message: `Operation "${operation.name}" ended: ${input.successRating ?? "completed"}`,
            type: "info",
            category: "military",
            priority: "high",
            metadata: { operationId: input.operationId, result: input.successRating },
          });
        }
      } catch {}

      return updated;
    }),

  // Propose a PvP conflict (requires mutual acceptance)
  proposePvPConflict: premiumProcedure
    .input(
      z.object({
        defenderId: z.string(),
        reason: z.string().optional(),
        pvpRules: z
          .object({
            victoryConditions: z.string(),
            maxDuration: z.number(), // IxTime days
            stakes: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (!userProfile?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      if (userProfile.countryId === input.defenderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot declare conflict against yourself.",
        });
      }

      // Check for existing active conflict
      const existing = await ctx.db.militaryConflict.findFirst({
        where: {
          OR: [
            { initiatorId: userProfile.countryId, defenderId: input.defenderId },
            { initiatorId: input.defenderId, defenderId: userProfile.countryId },
          ],
          status: { in: ["proposed", "accepted", "active"] },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active or pending conflict already exists between these nations.",
        });
      }

      const conflict = await ctx.db.militaryConflict.create({
        data: {
          type: "pvp",
          initiatorId: userProfile.countryId,
          defenderId: input.defenderId,
          status: "proposed",
          initiatorApproved: true,
          defenderApproved: false,
          reason: input.reason,
          pvpRules: input.pvpRules ? JSON.stringify(input.pvpRules) : null,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Notification: notify defender about PvP conflict proposal (fire-and-forget)
      try {
        const defenderCountry = await ctx.db.country.findUnique({
          where: { id: input.defenderId },
          select: { name: true, users: { select: { clerkUserId: true } } },
        });
        const defenderUserId = defenderCountry?.users[0]?.clerkUserId;
        if (defenderUserId) {
          await notificationAPI.create({
            userId: defenderUserId,
            countryId: input.defenderId,
            title: "Conflict Proposed",
            message: `${conflict.initiator.name} has proposed a military conflict against your nation`,
            type: "warning",
            category: "military",
            priority: "high",
            metadata: { conflictId: conflict.id, initiatorId: userProfile.countryId },
          });
        }
      } catch {}

      return conflict;
    }),

  // Accept or decline a PvP conflict
  respondToConflict: premiumProcedure
    .input(
      z.object({
        conflictId: z.string(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      const conflict = await ctx.db.militaryConflict.findUnique({
        where: { id: input.conflictId },
      });

      if (!conflict) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conflict not found." });
      }

      if (conflict.defenderId !== userProfile?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the defender can respond." });
      }

      if (conflict.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conflict is not in proposed state." });
      }

      if (!input.accept) {
        const declined = await ctx.db.militaryConflict.update({
          where: { id: input.conflictId },
          data: { status: "resolved", winner: "declined" },
        });

        // Notification: notify initiator of decline (fire-and-forget)
        try {
          const initiatorCountry = await ctx.db.country.findUnique({
            where: { id: conflict.initiatorId },
            select: { users: { select: { clerkUserId: true } } },
          });
          const initiatorUserId = initiatorCountry?.users[0]?.clerkUserId;
          if (initiatorUserId) {
            await notificationAPI.create({
              userId: initiatorUserId,
              countryId: conflict.initiatorId,
              title: "Conflict Declined",
              message: "Your conflict proposal was declined",
              type: "warning",
              category: "military",
              priority: "medium",
              metadata: { conflictId: input.conflictId },
            });
          }
        } catch {}

        return declined;
      }

      const accepted = await ctx.db.militaryConflict.update({
        where: { id: input.conflictId },
        data: {
          defenderApproved: true,
          status: "active",
          startDate: new Date(),
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Notification: notify initiator of acceptance (fire-and-forget)
      try {
        const initiatorCountry = await ctx.db.country.findUnique({
          where: { id: conflict.initiatorId },
          select: { users: { select: { clerkUserId: true } } },
        });
        const initiatorUserId = initiatorCountry?.users[0]?.clerkUserId;
        if (initiatorUserId) {
          await notificationAPI.create({
            userId: initiatorUserId,
            countryId: conflict.initiatorId,
            title: "Conflict Accepted",
            message: `${accepted.defender.name} has accepted your conflict proposal - hostilities begin`,
            type: "warning",
            category: "military",
            priority: "high",
            metadata: { conflictId: input.conflictId },
          });
        }
      } catch {}

      return accepted;
    }),

  // Get conflicts involving a country
  getConflicts: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conflicts = await ctx.db.militaryConflict.findMany({
        where: {
          OR: [{ initiatorId: input.countryId }, { defenderId: input.countryId }],
        },
        include: {
          initiator: { select: { id: true, name: true, flag: true } },
          defender: { select: { id: true, name: true, flag: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return conflicts.map((c) => ({
        ...c,
        initiator: c.initiator
          ? {
              id: c.initiator.id,
              name: c.initiator.name,
              flagUrl: c.initiator.flag,
            }
          : null,
        defender: c.defender
          ? {
              id: c.defender.id,
              name: c.defender.name,
              flagUrl: c.defender.flag,
            }
          : null,
      }));
    }),

  // Resolve a PvNPC conflict automatically
  resolvePvNPCConflict: premiumProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (!userProfile?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Get both countries' military data
      const [initiatorBranches, defenderBranches, initiator, defender] = await Promise.all([
        ctx.db.militaryBranch.findMany({
          where: { countryId: userProfile.countryId, isActive: true },
          include: { units: true, assets: true },
        }),
        ctx.db.militaryBranch.findMany({
          where: { countryId: input.targetCountryId, isActive: true },
          include: { units: true, assets: true },
        }),
        ctx.db.country.findUnique({
          where: { id: userProfile.countryId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
        ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
      ]);

      if (!initiator || !defender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Calculate military strength
      const calcStrength = (branches: typeof initiatorBranches) =>
        branches.reduce((sum, b) => {
          const unitStr = b.units.reduce(
            (s, u) => s + (u.personnel ?? 0) * ((u.readiness ?? 50) / 100),
            0
          );
          const assetStr = b.assets.reduce(
            (s, a) => s + (a.quantity ?? 0) * (a.operational ?? 0) * 10,
            0
          );
          return sum + unitStr + assetStr;
        }, 0);

      const initiatorStrength = calcStrength(initiatorBranches);
      const defenderStrength = calcStrength(defenderBranches);
      const totalStrength = initiatorStrength + defenderStrength || 1;

      // Random swing factor (10-30%)
      const swing = 0.1 + Math.random() * 0.2;
      const effectiveRatio =
        initiatorStrength / totalStrength + (Math.random() > 0.5 ? swing : -swing);

      const initiatorWins = effectiveRatio > 0.5;
      const marginOfVictory = Math.abs(effectiveRatio - 0.5);

      // Calculate casualties proportional to strength ratio
      const baseCasualties = Math.round((initiatorStrength + defenderStrength) * 0.05);
      const initiatorCasualties = Math.round(
        baseCasualties * (initiatorWins ? 0.3 : 0.7) * (1 + Math.random() * 0.3)
      );
      const defenderCasualties = Math.round(
        baseCasualties * (initiatorWins ? 0.7 : 0.3) * (1 + Math.random() * 0.3)
      );

      // Economic damage
      const econDamage = marginOfVictory < 0.1 ? 0.02 : marginOfVictory < 0.2 ? 0.01 : 0.005;

      const conflict = await ctx.db.militaryConflict.create({
        data: {
          type: "pvnpc",
          initiatorId: userProfile.countryId,
          defenderId: input.targetCountryId,
          status: "resolved",
          initiatorApproved: true,
          defenderApproved: true,
          reason: input.reason,
          startDate: new Date(),
          endDate: new Date(),
          winner: initiatorWins ? userProfile.countryId : input.targetCountryId,
          initiatorCasualties,
          defenderCasualties,
          economicDamage: econDamage,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Create storyteller effects for economic damage
      await ctx.db.storytellerEffect.createMany({
        data: [
          {
            countryId: userProfile.countryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -econDamage * (initiatorWins ? 0.5 : 1.5),
            description: `Military conflict with ${defender.name}: ${initiatorWins ? "victory" : "defeat"}`,
            duration: 2,
            isActive: true,
            createdBy: userProfile.id,
          },
          {
            countryId: input.targetCountryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -econDamage * (initiatorWins ? 1.5 : 0.5),
            description: `Military conflict with ${initiator.name}: ${initiatorWins ? "defeat" : "defense"}`,
            duration: 2,
            isActive: true,
            createdBy: userProfile.id,
          },
        ],
      });

      return conflict;
    }),
});
