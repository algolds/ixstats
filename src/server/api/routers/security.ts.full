// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { calculateStabilityMetrics, type EconomicData, type GovernmentData, type DemographicData, type PoliticalData, type RecentPolicy } from "~/lib/stability-formulas";
import {
  createIntelligenceFromThreat,
  syncDefenseBudgetToGovernment,
  getDefenseMetricsForIntelligence,
  getDefenseOverviewMetrics,
  generateIntelligenceFromBranchUpdate,
} from "~/lib/defense-integration";

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
  customData: z.string().optional(),
});

const militaryUnitInputSchema = z.object({
  name: z.string().min(1),
  unitType: z.enum(['division', 'brigade', 'regiment', 'fleet', 'squadron', 'battalion']),
  specialization: z.string().optional(),
  personnel: z.number().int().nonnegative().default(0),
  commanderName: z.string().optional(),
  commanderRank: z.string().optional(),
  homeBase: z.string().optional(),
  currentLocation: z.string().optional(),
  deploymentStatus: z.enum(['garrison', 'training', 'deployed', 'combat', 'reserve']).default('garrison'),
  readiness: z.number().min(0).max(100).default(50),
  effectiveness: z.number().min(0).max(100).default(50),
});

const militaryAssetInputSchema = z.object({
  assetType: z.enum(['aircraft', 'ship', 'vehicle', 'installation', 'weapon_system']),
  category: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  operational: z.number().int().nonnegative().default(1),
  capability: z.string().optional(),
  range: z.number().nonnegative().optional(),
  payload: z.number().nonnegative().optional(),
  status: z.enum(['operational', 'maintenance', 'reserve', 'retired']).default('operational'),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().default(0),
  maintenanceCost: z.number().nonnegative().default(0),
});

const securityThreatInputSchema = z.object({
  threatName: z.string().min(1),
  threatType: z.enum([
    'terrorism', 'insurgency', 'cyber_attack', 'espionage',
    'military_conflict', 'organized_crime', 'wmd_proliferation'
  ]),
  description: z.string().min(10),
  severity: z.enum(['low', 'moderate', 'high', 'critical', 'existential']),
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

  createMilitaryBranch: publicProcedure
    .input(z.object({
      countryId: z.string(),
      branch: militaryBranchInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryBranch.create({
        data: {
          countryId: input.countryId,
          ...input.branch,
        },
      });
    }),

  updateMilitaryBranch: publicProcedure
    .input(z.object({
      id: z.string(),
      branch: militaryBranchInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryBranch.update({
        where: { id: input.id },
        data: input.branch,
      });
    }),

  deleteMilitaryBranch: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryBranch.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // ===========================
  // Military Unit Endpoints
  // ===========================

  createMilitaryUnit: publicProcedure
    .input(z.object({
      branchId: z.string(),
      unit: militaryUnitInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryUnit.create({
        data: {
          branchId: input.branchId,
          ...input.unit,
        },
      });
    }),

  updateMilitaryUnit: publicProcedure
    .input(z.object({
      id: z.string(),
      unit: militaryUnitInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryUnit.update({
        where: { id: input.id },
        data: input.unit,
      });
    }),

  deleteMilitaryUnit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryUnit.delete({
        where: { id: input.id },
      });
    }),

  // ===========================
  // Military Asset Endpoints
  // ===========================

  createMilitaryAsset: publicProcedure
    .input(z.object({
      branchId: z.string(),
      asset: militaryAssetInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryAsset.create({
        data: {
          branchId: input.branchId,
          ...input.asset,
        },
      });
    }),

  updateMilitaryAsset: publicProcedure
    .input(z.object({
      id: z.string(),
      asset: militaryAssetInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.militaryAsset.update({
        where: { id: input.id },
        data: input.asset,
      });
    }),

  deleteMilitaryAsset: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

  updateDefenseBudget: publicProcedure
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
      const { countryId, fiscalYear, ...budgetData } = input;

      const existingBudget = await ctx.db.defenseBudget.findFirst({
        where: {
          countryId,
          fiscalYear,
        },
      });

      if (existingBudget) {
        return ctx.db.defenseBudget.update({
          where: {
            id: existingBudget.id,
          },
          data: budgetData,
        });
      } else {
        return ctx.db.defenseBudget.create({
          data: {
            countryId,
            fiscalYear,
            ...budgetData,
          },
        });
      }
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

  updateInternalStability: publicProcedure
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
        corruptionIndex: z.number().min(0).max(100).optional(),
        trustInGovernment: z.number().min(0).max(100).optional(),
        trustInPolice: z.number().min(0).max(100).optional(),
        fearOfCrime: z.number().min(0).max(100).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
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

  generateStabilityEvent: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

      // Sophisticated event probability based on metrics
      const rngSeed = Math.random().toString(36).substring(7);

      // Calculate weighted event probabilities based on specific metrics
      const crimeWeight = stability.crimeRate * 0.8;
      const riotWeight = stability.riotRisk * 1.2;
      const protestWeight = stability.protestFrequency * 2;
      const ethnicWeight = stability.ethnicTension * 0.7;
      const organizedCrimeWeight = stability.organizedCrimeLevel * 0.9;
      const polarizationWeight = stability.politicalPolarization * 0.6;

      // Determine event type based on highest risk factor
      let eventType: string;
      let baseSeverity: number;

      if (riotWeight > 70 && riotWeight > crimeWeight) {
        eventType = 'riot';
        baseSeverity = riotWeight;
      } else if (crimeWeight > 60 && organizedCrimeWeight > 50) {
        eventType = 'crime_wave';
        baseSeverity = (crimeWeight + organizedCrimeWeight) / 2;
      } else if (ethnicWeight > 60) {
        eventType = 'ethnic_tension';
        baseSeverity = ethnicWeight;
      } else if (polarizationWeight > 65 && protestWeight > 15) {
        eventType = 'civil_unrest';
        baseSeverity = (polarizationWeight + protestWeight * 2) / 2;
      } else if (protestWeight > 12) {
        eventType = 'protest';
        baseSeverity = protestWeight * 3;
      } else if (organizedCrimeWeight > 40) {
        eventType = 'gang_activity';
        baseSeverity = organizedCrimeWeight;
      } else {
        // Low-level event
        eventType = Math.random() > 0.5 ? 'minor_incident' : 'crime_spike';
        baseSeverity = 20;
      }

      // Determine severity tier
      const instabilityBonus = (100 - stability.stabilityScore) * 0.4;
      const finalSeverity = Math.min(100, baseSeverity + instabilityBonus);

      let severity: string;
      if (finalSeverity > 80) severity = 'critical';
      else if (finalSeverity > 60) severity = 'high';
      else if (finalSeverity > 35) severity = 'moderate';
      else severity = 'low';

      // Generate contextual event descriptions
      const cities = ['Capital City', 'Northern District', 'Southern Province', 'Industrial Zone', 'Port District'];
      const location = cities[Math.floor(Math.random() * cities.length)];

      const eventTemplates = {
        riot: {
          critical: [`Major Riots Erupt in ${location}`, `Widespread violence and looting as protests turn violent. Security forces overwhelmed by scale of unrest.`],
          high: [`Violent Clashes in ${location}`, `Protesters clash with police as demonstrations escalate into violence.`],
          moderate: [`Unrest in ${location}`, `Protests turn confrontational with isolated incidents of violence.`],
          low: [`Minor Disturbance`, `Small protest dispersed by authorities without major incidents.`],
        },
        crime_wave: {
          critical: [`Organized Crime Crisis`, `Major crime syndicate operations detected across multiple cities. Law enforcement struggling to respond.`],
          high: [`Surge in Criminal Activity`, `Sharp increase in violent crime and organized criminal operations.`],
          moderate: [`Rising Crime Rates`, `Noticeable uptick in criminal activity concerns citizens.`],
          low: [`Crime Incident`, `Isolated criminal activity reported in ${location}.`],
        },
        ethnic_tension: {
          critical: [`Ethnic Violence Erupts`, `Long-simmering tensions explode into communal violence.`],
          high: [`Ethnic Clashes`, `Tensions between communities escalate into confrontations.`],
          moderate: [`Community Tensions`, `Rising tensions between ethnic groups cause concern.`],
          low: [`Minor Incident`, `Isolated incident reflects underlying community tensions.`],
        },
        civil_unrest: {
          critical: [`Mass Demonstrations Paralyze Nation`, `Huge crowds demand government action as country grinds to halt.`],
          high: [`Widespread Protests`, `Large-scale demonstrations challenge government authority.`],
          moderate: [`Public Demonstrations`, `Organized protests voice popular grievances.`],
          low: [`Small Rally`, `Peaceful gathering highlights citizen concerns.`],
        },
        protest: {
          critical: [`Massive Protest Movement`, `Hundreds of thousands take to streets in unprecedented show of discontent.`],
          high: [`Large-Scale Protests`, `Major demonstrations draw tens of thousands.`],
          moderate: [`Protest March`, `Organized march through ${location} draws significant crowd.`],
          low: [`Small Protest`, `Peaceful demonstration in ${location}.`],
        },
        gang_activity: {
          critical: [`Gang War Erupts`, `Rival criminal organizations engage in open warfare.`],
          high: [`Major Gang Operation`, `Organized crime activity escalates significantly.`],
          moderate: [`Gang Incident`, `Gang-related activity disrupts neighborhood.`],
          low: [`Minor Gang Activity`, `Small-scale gang activity reported.`],
        },
        crime_spike: {
          critical: [`Crime Wave`, `Dramatic spike in criminal activity.`],
          high: [`Increased Crime`, `Notable rise in reported crimes.`],
          moderate: [`Crime Uptick`, `Modest increase in crime rates.`],
          low: [`Crime Report`, `Minor increase in local crime.`],
        },
        minor_incident: {
          critical: [`Security Incident`, `Significant security event.`],
          high: [`Security Concern`, `Notable security incident.`],
          moderate: [`Security Event`, `Minor security situation.`],
          low: [`Routine Incident`, `Standard security matter.`],
        },
      };

      const template = eventTemplates[eventType as keyof typeof eventTemplates] ?? eventTemplates.minor_incident;
      const [title, description] = template[severity as keyof typeof template] ?? template.low;

      // Calculate realistic casualties based on event type and severity
      const casualtyFactors = {
        riot: severity === 'critical' ? 30 + Math.floor(Math.random() * 50) :
              severity === 'high' ? 5 + Math.floor(Math.random() * 20) :
              severity === 'moderate' ? Math.floor(Math.random() * 8) : 0,
        crime_wave: severity === 'critical' ? 10 + Math.floor(Math.random() * 25) :
                    severity === 'high' ? 2 + Math.floor(Math.random() * 10) :
                    Math.floor(Math.random() * 3),
        ethnic_tension: severity === 'critical' ? 40 + Math.floor(Math.random() * 100) :
                        severity === 'high' ? 10 + Math.floor(Math.random() * 40) :
                        severity === 'moderate' ? Math.floor(Math.random() * 15) :
                        Math.floor(Math.random() * 3),
        civil_unrest: severity === 'critical' ? 15 + Math.floor(Math.random() * 35) :
                      severity === 'high' ? Math.floor(Math.random() * 15) :
                      Math.floor(Math.random() * 5),
        default: severity === 'critical' ? Math.floor(Math.random() * 20) :
                severity === 'high' ? Math.floor(Math.random() * 10) :
                severity === 'moderate' ? Math.floor(Math.random() * 3) : 0,
      };

      const casualties = casualtyFactors[eventType as keyof typeof casualtyFactors] ?? casualtyFactors.default;

      // Calculate arrests for crime events
      const arrested = ['crime_wave', 'gang_activity', 'riot'].includes(eventType)
        ? Math.floor(casualties * (1 + Math.random() * 3))
        : 0;

      // Calculate economic impact based on event severity and type
      const economicMultipliers = {
        riot: 500000,
        crime_wave: 200000,
        ethnic_tension: 800000,
        civil_unrest: 1000000,
        default: 100000,
      };

      const baseImpact = economicMultipliers[eventType as keyof typeof economicMultipliers] ?? economicMultipliers.default;
      const economicImpact = casualties * baseImpact + (finalSeverity * 50000) + (Math.random() * baseImpact);

      return ctx.db.securityEvent.create({
        data: {
          countryId: input.countryId,
          eventType,
          severity,
          title,
          description,
          casualties,
          arrested,
          economicImpact: Math.floor(economicImpact),
          stabilityImpact: -Math.floor(finalSeverity * 0.3),
          region: location,
          triggerFactors: JSON.stringify({
            stabilityScore: stability.stabilityScore,
            crimeRate: stability.crimeRate,
            riotRisk: stability.riotRisk,
            ethnicTension: stability.ethnicTension,
            politicalPolarization: stability.politicalPolarization,
            organizedCrime: stability.organizedCrimeLevel,
            baseSeverity: Math.round(baseSeverity),
            finalSeverity: Math.round(finalSeverity),
          }),
          rngSeed,
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

  resolveSecurityEvent: publicProcedure
    .input(z.object({
      id: z.string(),
      resolutionNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
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

  updateBorderSecurity: publicProcedure
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

  createNeighborThreat: publicProcedure
    .input(z.object({
      countryId: z.string(),
      threat: neighborThreatInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
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

  updateNeighborThreat: publicProcedure
    .input(z.object({
      id: z.string(),
      threat: neighborThreatInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.neighborThreatAssessment.update({
        where: { id: input.id },
        data: {
          ...input.threat,
          lastAssessed: new Date(),
        },
      });
    }),

  deleteNeighborThreat: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

  createSecurityThreat: publicProcedure
    .input(z.object({
      countryId: z.string(),
      userId: z.string(),
      threat: securityThreatInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const tagsJson = input.threat.tags ? JSON.stringify(input.threat.tags) : null;

      return ctx.db.securityThreat.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
          ...input.threat,
          tags: tagsJson,
        },
      });
    }),

  updateSecurityThreat: publicProcedure
    .input(z.object({
      id: z.string(),
      threat: securityThreatInputSchema.partial().extend({
        status: z.enum(['identified', 'monitoring', 'responding', 'contained', 'neutralized']).optional(),
        mitigationActions: z.array(z.string()).optional(),
        resourcesAllocated: z.number().nonnegative().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
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

  deleteSecurityThreat: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.securityThreat.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  createThreatIncident: publicProcedure
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
      const { responseActions, ...rest } = input;

      return ctx.db.threatIncident.create({
        data: {
          ...rest,
          responseActions: responseActions ? JSON.stringify(responseActions) : null,
        },
      });
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

  syncDefenseBudget: publicProcedure
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
    .mutation(async ({ input }) => {
      return syncDefenseBudgetToGovernment(input);
    }),

  createThreatIntelligence: publicProcedure
    .input(z.object({
      threatId: z.string(),
      countryId: z.string(),
      title: z.string(),
      content: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
    }))
    .mutation(async ({ input }) => {
      return createIntelligenceFromThreat(input);
    }),

  notifyBranchUpdate: publicProcedure
    .input(z.object({
      branchId: z.string(),
      changeType: z.enum(['created', 'readiness_change', 'budget_change', 'deployment']),
      details: z.string(),
    }))
    .mutation(async ({ input }) => {
      return generateIntelligenceFromBranchUpdate(input);
    }),
});
