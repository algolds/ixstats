// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { calculateStabilityMetrics, type EconomicData, type GovernmentData, type DemographicData, type PoliticalData, type RecentPolicy } from "~/lib/stability-formulas";
import {
  createIntelligenceFromThreat,
  syncDefenseBudgetToGovernment,
  getDefenseMetricsForIntelligence,
  getDefenseOverviewMetrics,
  generateIntelligenceFromBranchUpdate,
} from "~/lib/defense-integration";
import { notificationAPI } from "~/lib/notification-api";

// ===========================
// Input Validation Schemas
// ===========================

const militaryBranchInputSchema = z.object({
  branchType: z.enum([
    'army', 'navy', 'air_force', 'space_force', 'marines',
    'coast_guard', 'cyber_command', 'special_forces'
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
});

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
  assetType: z.enum(['aircraft', 'ship', 'vehicle', 'weapon_system', 'installation']),
  category: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  operational: z.number().int().nonnegative().default(1),
  capability: z.string().optional(),
  status: z.enum(['operational', 'maintenance', 'reserve', 'retired']).default('operational'),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().default(0),
  maintenanceCost: z.number().nonnegative().default(0),
  imageUrl: z.string().optional(),
});

const securityThreatInputSchema = z.object({
  threatName: z.string().min(1),
  threatType: z.enum([
    'military', 'terrorism', 'insurgency', 'cyber',
    'organized_crime', 'espionage', 'nuclear', 'biological',
    'natural_disaster'
  ]),
  description: z.string().min(10),
  severity: z.enum(['existential', 'critical', 'high', 'moderate', 'low']),
  likelihood: z.number().min(0).max(100).default(50),
  urgency: z.enum(['low', 'medium', 'high', 'immediate']).default('medium'),
  actorType: z.enum(['state', 'non-state', 'terrorist', 'criminal', 'unknown']).optional(),
  actorName: z.string().optional(),
  actorLocation: z.string().optional(),
  actorCapability: z.number().min(0).max(100).default(50),
  potentialCasualties: z.number().int().nonnegative().default(0),
  economicImpact: z.number().nonnegative().default(0),
  politicalImpact: z.string().optional(),
  infrastructureRisk: z.number().min(0).max(100).default(0),
  responseLevel: z.enum(['minimal', 'standard', 'elevated', 'maximum']).default('standard'),
  intelligenceSource: z.string().optional(),
  confidenceLevel: z.number().min(0).max(100).default(50),
  estimatedTimeline: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const neighborThreatInputSchema = z.object({
  neighborName: z.string().min(1),
  neighborCountryId: z.string().optional(),
  borderType: z.enum(['land', 'maritime', 'both']),
  borderLength: z.number().nonnegative().optional(),
  threatLevel: z.enum(['minimal', 'low', 'moderate', 'high', 'critical']).default('low'),
  threatScore: z.number().min(0).max(100).default(20),
  militaryThreat: z.number().min(0).max(100).default(10),
  terrorismRisk: z.number().min(0).max(100).default(15),
  smugglingRisk: z.number().min(0).max(100).default(25),
  refugeeFlow: z.number().min(0).max(100).default(20),
  politicalStability: z.number().min(0).max(100).default(60),
  diplomaticRelations: z.enum(['hostile', 'tense', 'neutral', 'friendly', 'allied']).default('neutral'),
  tradeVolume: z.number().nonnegative().default(0),
  treatyStatus: z.string().optional(),
  notes: z.string().optional(),
});

// ===========================
// Security Router
// ===========================

export const securityRouter = createTRPCRouter({

  // ===========================
  // Security Assessment Endpoints
  // ===========================

  getSecurityAssessment: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      let assessment = await ctx.db.securityAssessment.findUnique({
        where: { countryId: input.countryId },
      });

      if (!assessment) {
        // Create default assessment
        assessment = await ctx.db.securityAssessment.create({
          data: {
            countryId: input.countryId,
            overallSecurityScore: 60,
            securityLevel: 'moderate',
            securityTrend: 'stable',
            militaryStrength: 60,
            internalStability: 60,
            borderSecurity: 60,
            cybersecurity: 50,
            counterTerrorism: 55,
            militaryReadiness: 65,
            emergencyResponse: 60,
            disasterPreparedness: 55,
          },
        });
      }

      // Get related data
      const [
        internalStability,
        borderSecurity,
        activeThreats,
        militaryBranches
      ] = await Promise.all([
        ctx.db.internalStabilityMetrics.findUnique({
          where: { countryId: input.countryId }
        }),
        ctx.db.borderSecurity.findUnique({
          where: { countryId: input.countryId },
          include: { neighborThreats: true }
        }),
        ctx.db.securityThreat.findMany({
          where: {
            countryId: input.countryId,
            isActive: true
          }
        }),
        ctx.db.militaryBranch.findMany({
          where: {
            countryId: input.countryId,
            isActive: true
          }
        })
      ]);

      return {
        ...assessment,
        internalStability,
        borderSecurity,
        activeThreats,
        militaryBranches,
      };
    }),

  updateSecurityAssessment: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Calculate security score based on components
      const [
        internalStability,
        borderSecurity,
        threats,
        militaryBranches
      ] = await Promise.all([
        ctx.db.internalStabilityMetrics.findUnique({
          where: { countryId: input.countryId }
        }),
        ctx.db.borderSecurity.findUnique({
          where: { countryId: input.countryId }
        }),
        ctx.db.securityThreat.findMany({
          where: { countryId: input.countryId, isActive: true }
        }),
        ctx.db.militaryBranch.findMany({
          where: { countryId: input.countryId, isActive: true }
        })
      ]);

      const stabilityScore = internalStability?.stabilityScore ?? 60;
      const borderScore = borderSecurity?.overallSecurityLevel ?? 60;
      const militaryScore = militaryBranches.length > 0
        ? militaryBranches.reduce((sum, b) => sum + b.readinessLevel, 0) / militaryBranches.length
        : 60;

      const highSeverityThreats = threats.filter(t =>
        t.severity === 'critical' || t.severity === 'existential'
      ).length;

      const overallScore = (stabilityScore * 0.3 + borderScore * 0.3 + militaryScore * 0.4);

      let securityLevel = 'moderate';
      if (overallScore >= 80) securityLevel = 'very_secure';
      else if (overallScore >= 65) securityLevel = 'secure';
      else if (overallScore >= 40) securityLevel = 'moderate';
      else if (overallScore >= 25) securityLevel = 'high_risk';
      else securityLevel = 'critical';

      return ctx.db.securityAssessment.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          overallSecurityScore: overallScore,
          securityLevel,
          militaryStrength: militaryScore,
          internalStability: stabilityScore,
          borderSecurity: borderScore,
          activeThreatCount: threats.length,
          highSeverityThreats,
          militaryReadiness: militaryScore,
        },
        update: {
          overallSecurityScore: overallScore,
          securityLevel,
          militaryStrength: militaryScore,
          internalStability: stabilityScore,
          borderSecurity: borderScore,
          activeThreatCount: threats.length,
          highSeverityThreats,
          militaryReadiness: militaryScore,
          lastAssessed: new Date(),
        },
      });
    }),

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
        orderBy: { createdAt: 'asc' },
      });
    }),

  createMilitaryBranch: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      branch: militaryBranchInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create military branches for your own country',
        });
      }

      return ctx.db.militaryBranch.create({
        data: {
          countryId: input.countryId,
          ...input.branch,
        },
      });
    }),

  updateMilitaryBranch: protectedProcedure
    .input(z.object({
      id: z.string(),
      branch: militaryBranchInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch's country
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military branch not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own military branches',
        });
      }

      return ctx.db.militaryBranch.update({
        where: { id: input.id },
        data: input.branch,
      });
    }),

  deleteMilitaryBranch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch's country
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military branch not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own military branches',
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

  createMilitaryUnit: protectedProcedure
    .input(z.object({
      branchId: z.string(),
      unit: militaryUnitInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military branch not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create units for your own military branches',
        });
      }

      return ctx.db.militaryUnit.create({
        data: {
          branchId: input.branchId,
          ...input.unit,
        },
      });
    }),

  updateMilitaryUnit: protectedProcedure
    .input(z.object({
      id: z.string(),
      unit: militaryUnitInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const unit = await ctx.db.militaryUnit.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!unit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military unit not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== unit.branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own military units',
        });
      }

      return ctx.db.militaryUnit.update({
        where: { id: input.id },
        data: input.unit,
      });
    }),

  deleteMilitaryUnit: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const unit = await ctx.db.militaryUnit.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!unit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military unit not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== unit.branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own military units',
        });
      }

      return ctx.db.militaryUnit.delete({
        where: { id: input.id },
      });
    }),

  // ===========================
  // Military Asset Endpoints
  // ===========================

  createMilitaryAsset: protectedProcedure
    .input(z.object({
      branchId: z.string(),
      asset: militaryAssetInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military branch not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create assets for your own military branches',
        });
      }

      return ctx.db.militaryAsset.create({
        data: {
          branchId: input.branchId,
          ...input.asset,
        },
      });
    }),

  updateMilitaryAsset: protectedProcedure
    .input(z.object({
      id: z.string(),
      asset: militaryAssetInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const asset = await ctx.db.militaryAsset.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military asset not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== asset.branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own military assets',
        });
      }

      return ctx.db.militaryAsset.update({
        where: { id: input.id },
        data: input.asset,
      });
    }),

  deleteMilitaryAsset: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      const asset = await ctx.db.militaryAsset.findUnique({
        where: { id: input.id },
        include: { branch: { select: { countryId: true } } },
      });

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military asset not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== asset.branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own military assets',
        });
      }

      return ctx.db.militaryAsset.delete({
        where: { id: input.id },
      });
    }),

  // ===========================
  // Defense Budget Endpoints
  // ===========================

  getDefenseBudget: publicProcedure
    .input(z.object({
      countryId: z.string(),
      fiscalYear: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.fiscalYear ?? new Date().getFullYear();

      return ctx.db.defenseBudget.findFirst({
        where: {
          countryId: input.countryId,
          fiscalYear: year,
        },
      });
    }),

  updateDefenseBudget: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      fiscalYear: z.number(),
      totalBudget: z.number().nonnegative(),
      gdpPercent: z.number().min(0).max(100),
      personnelCosts: z.number().nonnegative().default(0),
      operationsMaintenance: z.number().nonnegative().default(0),
      procurement: z.number().nonnegative().default(0),
      rdteCosts: z.number().nonnegative().default(0),
      militaryConstruction: z.number().nonnegative().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own country\'s defense budget',
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
          title: '🛡️ Defense Budget Updated',
          message: `Defense spending set to ${input.gdpPercent.toFixed(1)}% of GDP ($${(input.totalBudget / 1e9).toFixed(2)}B) for FY${fiscalYear}`,
          countryId,
          category: 'military',
          priority: isSignificant ? 'high' : 'medium',
          type: 'info',
          href: '/mycountry/security',
          source: 'security-system',
          actionable: false,
          metadata: { fiscalYear, totalBudget: input.totalBudget, gdpPercent: input.gdpPercent },
        });
      } catch (error) {
        console.error('[Security] Failed to send defense budget notification:', error);
      }

      return result;
    }),

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
          code: 'NOT_FOUND',
          message: 'Country not found',
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

      const demographicData: DemographicData = {
        population: country.currentPopulation,
        ethnicDiversity: 40, // TODO: Add to Demographics model
        religiousDiversity: 30, // TODO: Add to Demographics model
        urbanizationRate: country.urbanPopulationPercent ?? 75,
        youthUnemployment: (country.unemploymentRate ?? 5) * 2, // Youth unemployment is typically 2x general
        populationDensity: country.populationDensity ?? 100,
      };

      const politicalData: PoliticalData = {
        politicalStability: 0.5, // TODO: Add to Country or GovernmentStructure model
        politicalPolarization: 45, // TODO: Add to Country or GovernmentStructure model
        electionCycle: 2, // TODO: Get from government data
        democracyIndex: 70, // TODO: Add to GovernmentStructure model
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
          status: 'active',
        },
        orderBy: { startDate: 'desc' },
      });

      return { metrics, activeEvents };
    }),

  updateInternalStability: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own country\'s stability metrics',
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

  generateStabilityEvent: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only generate events for your own country',
        });
      }

      // Get country data and stability metrics for event generation
      const [country, stability] = await Promise.all([
        ctx.db.country.findUnique({ where: { id: input.countryId } }),
        ctx.db.internalStabilityMetrics.findUnique({ where: { countryId: input.countryId } }),
      ]);

      if (!country || !stability) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Country or stability metrics not found',
        });
      }

      // Generate basic event (simplified for now)
      const eventTypes = ['protest', 'crime_wave', 'riot', 'civil_unrest'];
      const severities = ['low', 'moderate', 'high', 'critical'];
      
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)] ?? 'protest';
      const severity = severities[Math.floor(Math.random() * severities.length)] ?? 'moderate';

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
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.securityEvent.findMany({
        where: { countryId: input.countryId },
        orderBy: { startDate: 'desc' },
        take: input.limit ?? 20,
      });
    }),

  resolveSecurityEvent: protectedProcedure
    .input(z.object({
      id: z.string(),
      resolutionNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const event = await ctx.db.securityEvent.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Security event not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== event.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only resolve your own country\'s security events',
        });
      }

      return ctx.db.securityEvent.update({
        where: { id: input.id },
        data: {
          status: 'resolved',
          endDate: new Date(),
          resolutionNotes: input.resolutionNotes,
        },
      });
    }),

  // ===========================
  // Border Security Endpoints
  // ===========================

  getBorderSecurity: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      let borderSecurity = await ctx.db.borderSecurity.findUnique({
        where: { countryId: input.countryId },
        include: {
          neighborThreats: true,
        },
      });

      if (!borderSecurity) {
        borderSecurity = await ctx.db.borderSecurity.create({
          data: {
            countryId: input.countryId,
          },
          include: {
            neighborThreats: true,
          },
        });
      }

      return borderSecurity;
    }),

  updateBorderSecurity: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      data: z.object({
        overallSecurityLevel: z.number().min(0).max(100).optional(),
        securityStatus: z.enum(['weak', 'moderate', 'strong', 'maximum']).optional(),
        borderLength: z.number().nonnegative().optional(),
        landBorders: z.number().int().nonnegative().optional(),
        maritimeBorders: z.number().int().nonnegative().optional(),
        borderAgents: z.number().int().nonnegative().optional(),
        checkpoints: z.number().int().nonnegative().optional(),
        surveillanceSystems: z.number().int().nonnegative().optional(),
        interceptionRate: z.number().min(0).max(100).optional(),
        processingEfficiency: z.number().min(0).max(100).optional(),
        illegalCrossings: z.number().int().nonnegative().optional(),
        smugglingActivity: z.number().min(0).max(100).optional(),
        traffickingRisk: z.number().min(0).max(100).optional(),
        refugeePresure: z.number().min(0).max(100).optional(),
        technologyLevel: z.number().min(0).max(100).optional(),
        infrastructureQuality: z.number().min(0).max(100).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own country\'s border security',
        });
      }

      return ctx.db.borderSecurity.upsert({
        where: { countryId: input.countryId },
        create: {
          countryId: input.countryId,
          ...input.data,
        },
        update: {
          ...input.data,
          lastAssessed: new Date(),
        },
      });
    }),

  createNeighborThreat: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      threat: neighborThreatInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create neighbor threats for your own country',
        });
      }

      const borderSecurity = await ctx.db.borderSecurity.findUnique({
        where: { countryId: input.countryId },
      });

      if (!borderSecurity) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Border security record not found',
        });
      }

      return ctx.db.neighborThreatAssessment.create({
        data: {
          borderSecurityId: borderSecurity.id,
          ...input.threat,
        },
      });
    }),

  updateNeighborThreat: protectedProcedure
    .input(z.object({
      id: z.string(),
      threat: neighborThreatInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through border security
      const threat = await ctx.db.neighborThreatAssessment.findUnique({
        where: { id: input.id },
        include: { borderSecurity: { select: { countryId: true } } },
      });

      if (!threat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Neighbor threat not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.borderSecurity.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own neighbor threats',
        });
      }

      return ctx.db.neighborThreatAssessment.update({
        where: { id: input.id },
        data: {
          ...input.threat,
          lastAssessed: new Date(),
        },
      });
    }),

  deleteNeighborThreat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through border security
      const threat = await ctx.db.neighborThreatAssessment.findUnique({
        where: { id: input.id },
        include: { borderSecurity: { select: { countryId: true } } },
      });

      if (!threat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Neighbor threat not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.borderSecurity.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own neighbor threats',
        });
      }

      return ctx.db.neighborThreatAssessment.delete({
        where: { id: input.id },
      });
    }),

  // ===========================
  // Security Threats Endpoints
  // ===========================

  getSecurityThreats: publicProcedure
    .input(z.object({
      countryId: z.string(),
      activeOnly: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.securityThreat.findMany({
        where: {
          countryId: input.countryId,
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        include: {
          incidents: {
            orderBy: { occurredAt: 'desc' },
            take: 5,
          },
        },
        orderBy: [
          { severity: 'desc' },
          { likelihood: 'desc' },
        ],
      });
    }),

  createSecurityThreat: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      userId: z.string(),
      threat: securityThreatInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create threats for your own country',
        });
      }

      const tagsJson = input.threat.tags ? JSON.stringify(input.threat.tags) : null;

      const threat = await ctx.db.securityThreat.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          ...input.threat,
          tags: tagsJson,
        },
      });

      // 🔔 Notify country about new security threat
      try {
        const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
          'existential': 'high',
          'critical': 'high',
          'high': 'high',
          'moderate': 'medium',
          'low': 'low'
        };

        await notificationAPI.create({
          title: '🚨 Security Threat Detected',
          message: `${input.threat.severity.toUpperCase()} threat: ${input.threat.threatName} (${input.threat.threatType})`,
          countryId: input.countryId,
          category: 'security',
          priority: priorityMap[input.threat.severity] || 'high',
          type: input.threat.severity === 'existential' || input.threat.severity === 'critical' ? 'error' : 'warning',
          href: '/mycountry/security',
          source: 'security-system',
          actionable: true,
          metadata: { threatId: threat.id, severity: input.threat.severity, threatType: input.threat.threatType },
        });
      } catch (error) {
        console.error('[Security] Failed to send threat notification:', error);
      }

      return threat;
    }),

  updateSecurityThreat: protectedProcedure
    .input(z.object({
      id: z.string(),
      threat: securityThreatInputSchema.partial().extend({
        status: z.enum(['monitoring', 'responding', 'contained', 'resolved']).optional(),
        mitigationActions: z.array(z.string()).optional(),
        resourcesAllocated: z.number().nonnegative().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Security threat not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own security threats',
        });
      }

      const { tags, mitigationActions, ...rest } = input.threat;

      return ctx.db.securityThreat.update({
        where: { id: input.id },
        data: {
          ...rest,
          ...(tags ? { tags: JSON.stringify(tags) } : {}),
          ...(mitigationActions ? { mitigationActions: JSON.stringify(mitigationActions) } : {}),
          lastUpdated: new Date(),
        },
      });
    }),

  deleteSecurityThreat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.id },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Security threat not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own security threats',
        });
      }

      return ctx.db.securityThreat.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  createThreatIncident: protectedProcedure
    .input(z.object({
      threatId: z.string(),
      title: z.string().min(1),
      description: z.string(),
      incidentType: z.enum(['attack', 'attempt', 'intelligence', 'warning', 'activity']),
      casualties: z.number().int().nonnegative().default(0),
      damage: z.number().nonnegative().default(0),
      location: z.string().optional(),
      responseActions: z.array(z.string()).optional(),
      effectiveness: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of threat
      const threat = await ctx.db.securityThreat.findUnique({
        where: { id: input.threatId },
        select: { countryId: true },
      });

      if (!threat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Security threat not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== threat.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create incidents for your own threats',
        });
      }

      const { responseActions, ...rest } = input;

      const incident = await ctx.db.threatIncident.create({
        data: {
          ...rest,
          responseActions: responseActions ? JSON.stringify(responseActions) : null,
        },
      });

      // 🔔 Notify country about threat incident
      try {
        const isCritical = input.incidentType === 'attack' || (input.casualties > 0 || input.damage > 1000000);
        await notificationAPI.create({
          title: `⚠️ Threat Incident: ${input.title}`,
          message: `${input.incidentType.toUpperCase()} reported${input.casualties > 0 ? ` - ${input.casualties} casualties` : ''}${input.damage > 0 ? ` - $${(input.damage / 1e6).toFixed(1)}M damage` : ''}`,
          countryId: threat.countryId,
          category: 'security',
          priority: isCritical ? 'high' : 'medium',
          type: isCritical ? 'error' : 'warning',
          href: '/mycountry/security',
          source: 'security-system',
          actionable: true,
          metadata: { incidentId: incident.id, threatId: input.threatId, incidentType: input.incidentType, casualties: input.casualties, damage: input.damage },
        });
      } catch (error) {
        console.error('[Security] Failed to send incident notification:', error);
      }

      return incident;
    }),

  // ===========================
  // Integration Endpoints
  // ===========================

  getDefenseOverview: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ input }) => {
      return getDefenseOverviewMetrics(input.countryId);
    }),

  getDefenseIntelligenceMetrics: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ input }) => {
      return getDefenseMetricsForIntelligence(input.countryId);
    }),

  syncDefenseBudget: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      totalBudget: z.number().nonnegative(),
      personnelCosts: z.number().nonnegative(),
      operationsMaintenance: z.number().nonnegative(),
      procurement: z.number().nonnegative(),
      rdteCosts: z.number().nonnegative(),
      militaryConstruction: z.number().nonnegative(),
      fiscalYear: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only sync defense budget for your own country',
        });
      }

      return syncDefenseBudgetToGovernment(input);
    }),

  createThreatIntelligence: protectedProcedure
    .input(z.object({
      threatId: z.string(),
      countryId: z.string(),
      title: z.string(),
      content: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only create intelligence for your own country',
        });
      }

      return createIntelligenceFromThreat(input);
    }),

  notifyBranchUpdate: protectedProcedure
    .input(z.object({
      branchId: z.string(),
      changeType: z.enum(['created', 'readiness_change', 'budget_change', 'deployment']),
      details: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Military branch not found',
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (userProfile?.countryId !== branch.countryId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only notify updates for your own branches',
        });
      }

      return generateIntelligenceFromBranchUpdate(input);
    }),
});
