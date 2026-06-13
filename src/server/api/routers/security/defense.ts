// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";


import {
  syncDefenseBudgetToGovernment,
  getDefenseMetricsForIntelligence,
  getDefenseOverviewMetrics,
} from "~/lib/defense-integration";
import { notificationAPI } from "~/lib/notification-api";

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

export const securityDefenseRouter = createTRPCRouter({
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

  getDefenseBudget: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        fiscalYear: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const year = input.fiscalYear ?? new Date().getFullYear();

      return ctx.db.defenseBudget.findFirst({
        where: {
          countryId: input.countryId,
          fiscalYear: year,
        },
      });
    }),

  updateDefenseBudget: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        fiscalYear: z.number(),
        totalBudget: z.number().nonnegative(),
        gdpPercent: z.number().min(0).max(100),
        personnelCosts: z.number().nonnegative().default(0),
        operationsMaintenance: z.number().nonnegative().default(0),
        procurement: z.number().nonnegative().default(0),
        rdteCosts: z.number().nonnegative().default(0),
        militaryConstruction: z.number().nonnegative().default(0),
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
          message: "You can only update your own country's defense budget",
        });
      }

      const { countryId, fiscalYear, ...budgetData } = input;

      const existingBudget = await ctx.db.defenseBudget.findFirst({
        where: {
          countryId,
          fiscalYear,
        },
      });

      let result;
      if (existingBudget) {
        result = await ctx.db.defenseBudget.update({
          where: {
            id: existingBudget.id,
          },
          data: budgetData,
        });
      } else {
        result = await ctx.db.defenseBudget.create({
          data: {
            countryId,
            fiscalYear,
            ...budgetData,
          },
        });
      }

      // 🔔 Notify country about defense budget update
      try {
        const isSignificant = input.gdpPercent >= 5; // 5% or more of GDP is significant
        await notificationAPI.create({
          title: "🛡️ Defense Budget Updated",
          message: `Defense spending set to ${input.gdpPercent.toFixed(1)}% of GDP ($${(input.totalBudget / 1e9).toFixed(2)}B) for FY${fiscalYear}`,
          countryId,
          category: "military",
          priority: isSignificant ? "high" : "medium",
          type: "info",
          href: "/mycountry/security",
          source: "security-system",
          actionable: false,
          metadata: { fiscalYear, totalBudget: input.totalBudget, gdpPercent: input.gdpPercent },
        });
      } catch (error) {
        console.error("[Security] Failed to send defense budget notification:", error);
      }

      return result;
    }),

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

  getDefenseOverview: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Validate ownership - users can only view their own defense data unless admin
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, role: true },
      });

      // Check if user is admin (role level <= 20)
      const isAdmin = userProfile?.role && (userProfile.role as any).level <= 20;

      if (!isAdmin && userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot view other countries' defense overview",
        });
      }

      return getDefenseOverviewMetrics(input.countryId);
    }),

  getDefenseIntelligenceMetrics: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Validate ownership - users can only view their own defense data unless admin
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, role: true },
      });

      // Check if user is admin (role level <= 20)
      const isAdmin = userProfile?.role && (userProfile.role as any).level <= 20;

      if (!isAdmin && userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot view other countries' defense intelligence metrics",
        });
      }

      return getDefenseMetricsForIntelligence(input.countryId);
    }),

  syncDefenseBudget: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        totalBudget: z.number().nonnegative(),
        personnelCosts: z.number().nonnegative(),
        operationsMaintenance: z.number().nonnegative(),
        procurement: z.number().nonnegative(),
        rdteCosts: z.number().nonnegative(),
        militaryConstruction: z.number().nonnegative(),
        fiscalYear: z.number().int(),
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
          message: "You can only sync defense budget for your own country",
        });
      }

      return syncDefenseBudgetToGovernment(input);
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
