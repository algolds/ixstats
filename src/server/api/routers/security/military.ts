// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { generateIntelligenceFromBranchUpdate } from "~/lib/military/defense-integration";

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

const _securityThreatInputSchema = z.object({
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

const _neighborThreatInputSchema = z.object({
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

export const securityMilitaryRouter = createTRPCRouter({
  // ===========================
  // Security Assessment Endpoints
  // ===========================

  // ===========================
  // Military Branch Endpoints
  // ===========================

  getMilitaryBranches: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.militaryBranch.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          units: true,
          assets: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  createMilitaryBranch: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        branch: militaryBranchCreateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create military branches for your own country",
        });
      }

      return ctx.db.militaryBranch.create({
        data: {
          countryId: input.countryId,
          ...input.branch,
        },
      });
    }),

  updateMilitaryBranch: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        branch: militaryBranchUpdateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch's country
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own military branches",
        });
      }

      return ctx.db.militaryBranch.update({
        where: { id: input.id },
        data: input.branch,
      });
    }),

  deleteMilitaryBranch: premiumProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch's country
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own military branches",
        });
      }

      return ctx.db.militaryBranch.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // ===========================
  // Military Unit Endpoints
  // ===========================

  createMilitaryUnit: premiumProcedure
    .input(
      z.object({
        branchId: z.string(),
        unit: militaryUnitInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create units for your own military branches",
        });
      }

      return ctx.db.militaryUnit.create({
        data: {
          branchId: input.branchId,
          ...input.unit,
        },
      });
    }),

  updateMilitaryUnit: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        unit: militaryUnitInputSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const unit = await ctx.db.militaryUnit.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!unit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military unit not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== unit.branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own military units",
        });
      }

      return ctx.db.militaryUnit.update({
        where: { id: input.id },
        data: input.unit,
      });
    }),

  deleteMilitaryUnit: premiumProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const unit = await ctx.db.militaryUnit.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!unit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military unit not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== unit.branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own military units",
        });
      }

      return ctx.db.militaryUnit.delete({
        where: { id: input.id },
      });
    }),

  // ===========================
  // Military Asset Endpoints
  // ===========================

  createMilitaryAsset: premiumProcedure
    .input(
      z.object({
        branchId: z.string(),
        asset: militaryAssetInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create assets for your own military branches",
        });
      }

      return ctx.db.militaryAsset.create({
        data: {
          branchId: input.branchId,
          ...input.asset,
        },
      });
    }),

  updateMilitaryAsset: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        asset: militaryAssetInputSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const asset = await ctx.db.militaryAsset.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military asset not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== asset.branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own military assets",
        });
      }

      return ctx.db.militaryAsset.update({
        where: { id: input.id },
        data: input.asset,
      });
    }),

  deleteMilitaryAsset: premiumProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const asset = await ctx.db.militaryAsset.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military asset not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== asset.branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own military assets",
        });
      }

      return ctx.db.militaryAsset.delete({
        where: { id: input.id },
      });
    }),

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

  notifyBranchUpdate: premiumProcedure
    .input(
      z.object({
        branchId: z.string(),
        changeType: z.enum(["created", "readiness_change", "budget_change", "deployment"]),
        details: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only notify updates for your own branches",
        });
      }

      return generateIntelligenceFromBranchUpdate(input);
    }),

  // ============================================================
  // Military Operations (Phase 4)
  // ============================================================

  // Get active and past operations

  // Create a military operation and deploy units/assets

  // Recall a deployment / end an operation

  // Propose a PvP conflict (requires mutual acceptance)

  // Accept or decline a PvP conflict

  // Get conflicts involving a country

  // Resolve a PvNPC conflict automatically
});
