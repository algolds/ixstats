// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  calculateStabilityMetrics,
  type EconomicData,
  type GovernmentData,
  type DemographicData,
  type PoliticalData,
  type RecentPolicy,
} from "~/lib/stability-formulas";

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

export const securityStabilityRouter = createTRPCRouter({
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

  getInternalStability: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get country data for calculations
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Get real economic data from the database
      const economicData: EconomicData = {
        gdpGrowth: country.realGDPGrowthRate ?? country.adjustedGdpGrowth ?? 2.5,
        unemploymentRate: country.unemploymentRate ?? 5.0,
        giniIndex: country.incomeInequalityGini ?? 35,
        inflationRate: country.inflationRate ?? 2.0,
        gdpPerCapita: country.currentGdpPerCapita ?? 35000,
        povertyRate: country.povertyRate ?? 12,
      };

      // Get EconomicProfile for corruption data
      const economicProfile = await ctx.db.economicProfile.findUnique({
        where: { countryId: input.countryId },
      });

      // Get government data - TODO: integrate with government ministry when available
      const governmentData: GovernmentData = {
        policingBudget: country.currentPopulation * 200,
        educationBudget: country.currentPopulation * 1500,
        socialServicesBudget: country.currentPopulation * 800,
        totalBudget: country.currentPopulation * 5000,
        corruptionIndex: economicProfile?.corruptionIndex ?? 30,
      };

      // Get diversity data from Demographics
      const demographics = await ctx.db.demographics.findUnique({
        where: { countryId: input.countryId },
        select: {
          ethnicDiversity: true,
          religiousDiversity: true,
          linguisticDiversity: true,
          culturalDiversity: true,
        },
      });

      const demographicData: DemographicData = {
        population: country.currentPopulation,
        ethnicDiversity: demographics?.ethnicDiversity ?? 50,
        religiousDiversity: demographics?.religiousDiversity ?? 50,
        urbanizationRate: country.urbanPopulationPercent ?? 75,
        youthUnemployment: (country.unemploymentRate ?? 5) * 2, // Youth unemployment is typically 2x general
        populationDensity: country.populationDensity ?? 100,
      };

      // Get political metrics from GovernmentStructure
      const government = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        select: {
          politicalStability: true,
          politicalPolarization: true,
          democracyIndex: true,
          electionCycle: true,
          governmentEffectiveness: true,
          ruleOfLaw: true,
          corruptionIndex: true,
        },
      });

      const politicalData: PoliticalData = {
        politicalStability: government?.politicalStability ?? 0.5,
        politicalPolarization: government?.politicalPolarization ?? 50,
        electionCycle: government?.electionCycle ?? 4,
        democracyIndex: government?.democracyIndex ?? 50,
        protestFrequency: 8, // Will be overwritten by calculation
      };

      // TODO: Get recent policies from database
      const recentPolicies: RecentPolicy[] = [];

      // Calculate real stability metrics
      const calculatedMetrics = calculateStabilityMetrics(
        economicData,
        governmentData,
        demographicData,
        politicalData,
        recentPolicies
      );

      // Update or create metrics in database
      const metrics = await ctx.db.internalStabilityMetrics.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          stabilityScore: calculatedMetrics.stabilityScore,
          crimeRate: calculatedMetrics.crimeRate,
          violentCrimeRate: calculatedMetrics.violentCrimeRate,
          propertyCrimeRate: calculatedMetrics.propertyCrimeRate,
          organizedCrimeLevel: calculatedMetrics.organizedCrimeLevel,
          policingEffectiveness: calculatedMetrics.policingEffectiveness,
          justiceSystemEfficiency: calculatedMetrics.justiceSystemEfficiency,
          protestFrequency: calculatedMetrics.protestFrequency,
          riotRisk: calculatedMetrics.riotRisk,
          civilDisobedience: calculatedMetrics.civilDisobedience,
          socialCohesion: calculatedMetrics.socialCohesion,
          ethnicTension: calculatedMetrics.ethnicTension,
          politicalPolarization: calculatedMetrics.politicalPolarization,
          trustInGovernment: calculatedMetrics.trustInGovernment,
          trustInPolice: calculatedMetrics.trustInPolice,
          fearOfCrime: calculatedMetrics.fearOfCrime,
          stabilityTrend: calculatedMetrics.stabilityTrend,
          lastCalculated: new Date(),
        },
        update: {
          stabilityScore: calculatedMetrics.stabilityScore,
          crimeRate: calculatedMetrics.crimeRate,
          violentCrimeRate: calculatedMetrics.violentCrimeRate,
          propertyCrimeRate: calculatedMetrics.propertyCrimeRate,
          organizedCrimeLevel: calculatedMetrics.organizedCrimeLevel,
          policingEffectiveness: calculatedMetrics.policingEffectiveness,
          justiceSystemEfficiency: calculatedMetrics.justiceSystemEfficiency,
          protestFrequency: calculatedMetrics.protestFrequency,
          riotRisk: calculatedMetrics.riotRisk,
          civilDisobedience: calculatedMetrics.civilDisobedience,
          socialCohesion: calculatedMetrics.socialCohesion,
          ethnicTension: calculatedMetrics.ethnicTension,
          politicalPolarization: calculatedMetrics.politicalPolarization,
          trustInGovernment: calculatedMetrics.trustInGovernment,
          trustInPolice: calculatedMetrics.trustInPolice,
          fearOfCrime: calculatedMetrics.fearOfCrime,
          stabilityTrend: calculatedMetrics.stabilityTrend,
          lastCalculated: new Date(),
        },
      });

      const activeEvents = await ctx.db.securityEvent.findMany({
        where: {
          countryId: input.countryId,
          status: "active",
        },
        orderBy: { startDate: "desc" },
      });

      return { metrics, activeEvents };
    }),

  updateInternalStability: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        metrics: z.object({
          stabilityScore: z.number().min(0).max(100).optional(),
          crimeRate: z.number().nonnegative().optional(),
          violentCrimeRate: z.number().nonnegative().optional(),
          propertyCrimeRate: z.number().nonnegative().optional(),
          organizedCrimeLevel: z.number().min(0).max(100).optional(),
          protestFrequency: z.number().nonnegative().optional(),
          riotRisk: z.number().min(0).max(100).optional(),
          civilDisobedience: z.number().min(0).max(100).optional(),
          socialCohesion: z.number().min(0).max(100).optional(),
          ethnicTension: z.number().min(0).max(100).optional(),
          politicalPolarization: z.number().min(0).max(100).optional(),
          policingEffectiveness: z.number().min(0).max(100).optional(),
          justiceSystemEfficiency: z.number().min(0).max(100).optional(),
          trustInGovernment: z.number().min(0).max(100).optional(),
          trustInPolice: z.number().min(0).max(100).optional(),
          fearOfCrime: z.number().min(0).max(100).optional(),
        }),
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
          message: "You can only update your own country's stability metrics",
        });
      }

      return ctx.db.internalStabilityMetrics.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          ...input.metrics,
        },
        update: {
          ...input.metrics,
          lastCalculated: new Date(),
        },
      });
    }),

  generateStabilityEvent: premiumProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only generate events for your own country",
        });
      }

      // Get country data and stability metrics for event generation
      const [country, stability] = await Promise.all([
        ctx.db.country.findUnique({ where: { id: input.countryId } }),
        ctx.db.internalStabilityMetrics.findUnique({ where: { countryId: input.countryId } }),
      ]);

      if (!country || !stability) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country or stability metrics not found",
        });
      }

      // Generate basic event (simplified for now)
      const eventTypes = ["protest", "crime_wave", "riot", "civil_unrest"];
      const severities = ["low", "moderate", "high", "critical"];

      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)] ?? "protest";
      const severity = severities[Math.floor(Math.random() * severities.length)] ?? "moderate";

      return ctx.db.securityEvent.create({
        data: {
          countryId: input.countryId,
          eventType,
          severity,
          title: `${eventType} in ${country.name}`,
          description: `A ${severity} ${eventType} has occurred`,
          casualties: 0,
          arrested: 0,
          economicImpact: 0,
          stabilityImpact: -10,
        },
      });
    }),

  getSecurityEvents: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.securityEvent.findMany({
        where: { countryId: input.countryId },
        orderBy: { startDate: "desc" },
        take: input.limit ?? 20,
      });
    }),

  resolveSecurityEvent: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        resolutionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const event = await ctx.db.securityEvent.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Security event not found",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== event.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only resolve your own country's security events",
        });
      }

      const resolved = await ctx.db.securityEvent.update({
        where: { id: input.id },
        data: {
          status: "resolved",
          endDate: new Date(),
          resolutionNotes: input.resolutionNotes,
        },
      });

      // Notification: security event resolved (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: event.countryId,
            title: "Threat Resolved",
            message: "A security event has been successfully resolved",
            type: "info",
            category: "security",
            priority: "medium",
            metadata: { eventId: input.id },
          });
        }
      } catch {}

      return resolved;
    }),

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

  // Create a military operation and deploy units/assets

  // Recall a deployment / end an operation

  // Propose a PvP conflict (requires mutual acceptance)

  // Accept or decline a PvP conflict

  // Get conflicts involving a country

  // Resolve a PvNPC conflict automatically
});
