// src/server/api/routers/countries.ts
// FIXED: Complete countries router with proper functionality and optimizations

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, executiveProcedure, countryOwnerProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig, CONFIG_CONSTANTS } from "~/lib/config-service";
import { parseRosterFile } from "~/lib/data-parser";
import { IxStatsCalculator } from "~/lib/calculations";
import {
  calculateCountryDataWithAtomicEnhancement,
  getAtomicIntelligenceRecommendations
} from "~/lib/atomic-economic-integration.server";
import { type CountryWithAtomicComponents } from "~/lib/atomic-economic-integration";
import { getAtomicEffectivenessService } from "~/services/AtomicEffectivenessService";
import { ComponentType } from "@prisma/client";
import { calculateAllVitalityScores } from "~/lib/vitality-calculator";
import { notificationAPI } from "~/lib/notification-api";
import type { 
  SystemStatus, 
  AdminPageBotStatusView, 
  ImportAnalysis,
  EconomicConfig,
  Country,
  CountryStats,
  CountryWithEconomicData,
  CalculatedStats,
  Projection,
  HistoricalData,
  DMInput,
  EconomicProfile,
  LaborMarket,
  FiscalSystem,
  IncomeDistribution,
  GovernmentBudget,
  Demographics,
  TierChangeProjection,
  BaseCountryData,
  CalculationLog,
  EconomicTier,
  PopulationTier
} from "~/types/ixstats";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { detectEconomicMilestoneAndTriggerNarrative } from "~/lib/auto-post-service";
import { ActivityGenerator } from "~/lib/activity-generator";

// Simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cleanup expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

function getCacheKey(operation: string, params: any): string {
  return `${operation}_${JSON.stringify(params)}`;
}

function getCachedData(key: string): unknown | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedData(key: string, data: unknown, ttl = 30000): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

// Economic configuration


// Validation functions
const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

const validateNumber = (value: number | null | undefined, max = 1e18, min = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0;
  return Math.min(Math.max(numValue, min), max);
};

const prepareBaseCountryData = (country: any): BaseCountryData => ({
  country: country.name,
  continent: country.continent,
  region: country.region,
  governmentType: country.governmentType,
  religion: country.religion,
  leader: country.leader,
  population: country.baselinePopulation,
  gdpPerCapita: country.baselineGdpPerCapita,
  landArea: country.landArea,
  areaSqMi: country.areaSqMi,
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,
});

// FIXED: Helper function to safely include relations that may not exist
const safelyIncludeRelations = async (db: any) => {
  const availableRelations: any = {};
  
  try {
    // Test if each relation exists in the database
    const testQueries = [
      { name: 'economicProfile', test: () => db.economicProfile.findFirst() },
      { name: 'laborMarket', test: () => db.laborMarket.findFirst() },
      { name: 'fiscalSystem', test: () => db.fiscalSystem.findFirst() },
      { name: 'incomeDistribution', test: () => db.incomeDistribution.findFirst() },
      { name: 'governmentBudget', test: () => db.governmentBudget.findFirst() },
      { name: 'demographics', test: () => db.demographics.findFirst() },
      { name: 'nationalIdentity', test: () => db.nationalIdentity.findFirst() },
    ];

    for (const { name, test } of testQueries) {
      try {
        await test();
        availableRelations[name] = true;
      } catch (error) {
        console.warn(`[Countries API] Relation '${name}' not available in database, skipping`);
        availableRelations[name] = false;
      }
    }
  } catch (error) {
    console.warn('[Countries API] Could not test relations, proceeding without optional relations');
  }

  return availableRelations;
};

// FIXED: Economic data schema with all optional fields
const economicDataSchema = z.object({
  // Core Economic Indicators
  nominalGDP: z.number().optional(),
  realGDPGrowthRate: z.number().optional(),
  inflationRate: z.number().optional(),
  currencyExchangeRate: z.number().optional(),

  // Labor & Employment
  laborForceParticipationRate: z.number().optional(),
  employmentRate: z.number().optional(),
  unemploymentRate: z.number().optional(),
  totalWorkforce: z.number().optional(),
  averageWorkweekHours: z.number().optional(),
  minimumWage: z.number().optional(),
  averageAnnualIncome: z.number().optional(),

  // Fiscal System - Basic
  taxRevenueGDPPercent: z.number().optional(),
  governmentRevenueTotal: z.number().optional(),
  taxRevenuePerCapita: z.number().optional(),
  governmentBudgetGDPPercent: z.number().optional(),
  budgetDeficitSurplus: z.number().optional(),
  internalDebtGDPPercent: z.number().optional(),
  externalDebtGDPPercent: z.number().optional(),
  totalDebtGDPRatio: z.number().optional(),
  debtPerCapita: z.number().optional(),
  interestRates: z.number().optional(),
  debtServiceCosts: z.number().optional(),

  // Income & Wealth
  povertyRate: z.number().optional(),
  incomeInequalityGini: z.number().optional(),
  socialMobilityIndex: z.number().optional(),

  // Government Spending
  totalGovernmentSpending: z.number().optional(),
  spendingGDPPercent: z.number().optional(),
  spendingPerCapita: z.number().optional(),

  // Demographics - Basic
  lifeExpectancy: z.number().optional(),
  urbanPopulationPercent: z.number().optional(),
  ruralPopulationPercent: z.number().optional(),
  literacyRate: z.number().optional(),
});

const countriesRouter = createTRPCRouter({
  // Get all countries with basic info + total count
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
        continent: z.string().optional(),
        economicTier: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.search) {
        where.name = { contains: input.search };
      }
      if (input?.continent) {
        where.continent = input.continent;
      }
      if (input?.economicTier) {
        where.economicTier = input.economicTier;
      }

      const [rawCountries, total] = await Promise.all([
        ctx.db.country.findMany({
          where,
          take: input?.limit,
          skip: input?.offset,
          orderBy: { name: "asc" },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
          }),
        ctx.db.country.count({ where }),
      ]);

      const countries: CountryWithEconomicData[] = rawCountries.map((country: any) => ({
        ...country,
        // Ensure critical fields are properly mapped
        currentPopulation: country.currentPopulation ?? country.baselinePopulation ?? 0,
        currentGdpPerCapita: country.currentGdpPerCapita ?? country.baselineGdpPerCapita ?? 0,
        currentTotalGdp: country.currentTotalGdp ?? ((country.currentPopulation ?? 0) * (country.currentGdpPerCapita ?? 0)),
        economicTier: country.economicTier ?? 'Developing',
        populationTier: country.populationTier ?? '1',
        nominalGDP: country.nominalGDP ?? 0,
        realGDPGrowthRate: country.realGDPGrowthRate ?? 0,
        inflationRate: country.inflationRate ?? 0,
        currencyExchangeRate: country.currencyExchangeRate ?? 1,
        laborForceParticipationRate: country.laborForceParticipationRate ?? undefined,
        employmentRate: country.employmentRate ?? undefined,
        unemploymentRate: country.unemploymentRate ?? undefined,
        totalWorkforce: country.totalWorkforce ?? undefined,
        averageWorkweekHours: country.averageWorkweekHours ?? undefined,
        minimumWage: country.minimumWage ?? undefined,
        averageAnnualIncome: country.averageAnnualIncome ?? undefined,
        taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? undefined,
        taxRevenuePerCapita: country.taxRevenuePerCapita ?? undefined,
        governmentBudgetGDPPercent: country.governmentBudgetGDPPercent ?? undefined,
        budgetDeficitSurplus: country.budgetDeficitSurplus ?? undefined,
        internalDebtGDPPercent: country.internalDebtGDPPercent ?? undefined,
        externalDebtGDPPercent: country.externalDebtGDPPercent ?? undefined,
        totalDebtGDPRatio: country.totalDebtGDPRatio ?? undefined,
        debtPerCapita: country.debtPerCapita ?? undefined,
        interestRates: country.interestRates ?? undefined,
        debtServiceCosts: country.debtServiceCosts ?? undefined,
        povertyRate: country.povertyRate ?? undefined,
        incomeInequalityGini: country.incomeInequalityGini ?? undefined,
        socialMobilityIndex: country.socialMobilityIndex ?? undefined,
        totalGovernmentSpending: country.totalGovernmentSpending ?? undefined,
        spendingGDPPercent: country.spendingGDPPercent ?? undefined,
        spendingPerCapita: country.spendingPerCapita ?? undefined,
        lifeExpectancy: country.lifeExpectancy ?? undefined,
        literacyRate: country.literacyRate ?? undefined,
        landArea: country.landArea ?? undefined,
        areaSqMi: country.areaSqMi ?? undefined,
        populationDensity: country.populationDensity ?? undefined,
        gdpDensity: country.gdpDensity ?? undefined,
        continent: country.continent ?? undefined,
        region: country.region ?? undefined,
        governmentType: country.governmentType ?? undefined,
        religion: country.religion ?? undefined,
        leader: country.leader ?? undefined,
        calculatedStats: {
          gdpGrowth: country.adjustedGdpGrowth || 0,
          populationGrowth: country.populationGrowthRate || 0,
          inflation: 0.02, // Default inflation rate
        },
        projections: [], // Will be calculated when needed
        historical: [], // Will be calculated when needed
        dmInputs: country.dmInputs ? country.dmInputs.map((dm: any) => ({
          id: dm.id,
          countryId: dm.countryId,
          inputType: dm.inputType,
          value: dm.value,
          description: dm.description,
          timestamp: dm.ixTimeTimestamp,
        })) : [],
        analytics: {
          growthTrends: {
            avgPopGrowth: country.populationGrowthRate || 0,
            avgGdpGrowth: country.adjustedGdpGrowth || 0,
          },
          volatility: {
            popVolatility: 0,
            gdpVolatility: 0,
          },
          riskFlags: [],
          tierChangeProjection: { year: new Date().getFullYear(), newTier: country.economicTier },
          vulnerabilities: [],
        },
      }));

      return { countries, total };
    }),

  getByIdWithEconomicData: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

      const availableRelations = await safelyIncludeRelations(ctx.db);

      const includeObject: any = {
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
      };

      if (availableRelations.economicProfile) includeObject.economicProfile = true;
      if (availableRelations.laborMarket) includeObject.laborMarket = true;
      if (availableRelations.fiscalSystem) includeObject.fiscalSystem = true;
      if (availableRelations.incomeDistribution) includeObject.incomeDistribution = true;
      if (availableRelations.governmentBudget) includeObject.governmentBudget = true;
      if (availableRelations.demographics) includeObject.demographics = true;
      if (availableRelations.nationalIdentity) includeObject.nationalIdentity = true;

      let country;
      try {
        // Try finding by slug first (lowercase for case-insensitive match)
        const slugLower = input.id.toLowerCase();
        country = await ctx.db.country.findFirst({
          where: {
            OR: [
              { id: input.id },
              { slug: slugLower },
              { name: input.id }
            ]
          },
          include: includeObject,
        });
      } catch (dbError) {
        console.warn('[Countries API] Error with complex query, falling back to basic query:', dbError);
        const slugLower = input.id.toLowerCase();
        country = await ctx.db.country.findFirst({
          where: {
            OR: [
              { id: input.id },
              { slug: slugLower },
              { name: input.id }
            ]
          },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
      }

      if (!country) {
        throw new Error(`Country with identifier ${input.id} not found`);
      }

      const econCfg = getDefaultEconomicConfig();
      const baselineDate = country.baselineDate ? country.baselineDate.getTime() : Date.now();

      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);

      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const result = calc.calculateTimeProgression(
        baselineStats,
        targetTime,
        dmInputs
      );
      const projections = [];
      for (let i = 1; i <= 5; i++) {
        const futureTime = targetTime + i * ONE_YEAR_MS;
        const proj = calc.calculateTimeProgression(baselineStats, futureTime, dmInputs);
        projections.push({
          yearOffset: i,
          ixTime: futureTime,
          stats: proj.newStats,
        });
      }
      let historical = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.id,
          ixTimeTimestamp: {
            gte: new Date(targetTime - FIVE_YEARS_MS),
            lte: new Date(targetTime),
          },
        },
        orderBy: { ixTimeTimestamp: "asc" },
      });
      if (!historical || historical.length < 5) {
        historical = [];
        for (let i = 5; i >= 1; i--) {
          const pastTime = targetTime - i * ONE_YEAR_MS;
          const hist = calc.calculateTimeProgression(baselineStats, pastTime, dmInputs);
          historical.push({
            id: '',
            createdAt: new Date(pastTime),
            countryId: input.id,
            ixTimeTimestamp: new Date(pastTime),
            population: hist.newStats.currentPopulation,
            gdpPerCapita: hist.newStats.currentGdpPerCapita,
            totalGdp: hist.newStats.currentTotalGdp,
            populationGrowthRate: hist.newStats.populationGrowthRate,
            gdpGrowthRate: hist.newStats.adjustedGdpGrowth,
            landArea: typeof hist.newStats.landArea === 'number' ? hist.newStats.landArea : null,
            populationDensity: typeof hist.newStats.populationDensity === 'number' ? hist.newStats.populationDensity : null,
            gdpDensity: typeof hist.newStats.gdpDensity === 'number' ? hist.newStats.gdpDensity : null,
          });
        }
      }
      function getGrowthRates(arr: any[], key: string): number[] {
        const rates: number[] = [];
        for (let i = 1; i < arr.length; i++) {
          const prev = arr[i - 1]![key];
          const curr = arr[i]![key];
          if (prev && curr && prev > 0) {
            rates.push((curr - prev) / prev);
          }
        }
        return rates;
      }
      function stddev(arr: number[]): number {
        if (!arr.length) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
      }
      const popGrowthRates = getGrowthRates(historical, 'population');
      const gdpGrowthRates = getGrowthRates(historical, 'gdpPerCapita');
      const avgPopGrowth = popGrowthRates.length ? popGrowthRates.reduce((a, b) => a + b, 0) / popGrowthRates.length : 0;
      const avgGdpGrowth = gdpGrowthRates.length ? gdpGrowthRates.reduce((a, b) => a + b, 0) / gdpGrowthRates.length : 0;
      const popVolatility = stddev(popGrowthRates);
      const gdpVolatility = stddev(gdpGrowthRates);
      const riskFlags = [];
      if (avgPopGrowth < 0) riskFlags.push('negative_population_growth');
      if (avgGdpGrowth < 0) riskFlags.push('negative_gdp_per_capita_growth');
      if (popVolatility > 0.05) riskFlags.push('high_population_volatility');
      if (gdpVolatility > 0.05) riskFlags.push('high_gdp_per_capita_volatility');
      let tierChangeProjection = null;
      const currentGDPPC = result.newStats.currentGdpPerCapita;
      const projectionsGDPPC = projections.map(p => p.stats.currentGdpPerCapita);
      const tierThresholds = Object.values(econCfg.economicTierThresholds).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
      let nextTier = null;
      for (let i = 0; i < tierThresholds.length; i++) {
        if (tierThresholds[i]! > currentGDPPC) {
          nextTier = tierThresholds[i]!;
          break;
        }
      }
      if (nextTier) {
        for (let i = 0; i < projectionsGDPPC.length; i++) {
          if (projectionsGDPPC[i]! >= nextTier) {
            tierChangeProjection = { year: new Date().getFullYear() + i + 1, newTier: getEconomicTierFromGdpPerCapita(projectionsGDPPC[i]!) };
            break;
          }
        }
      }
      const vulnerabilities = [];
      if (avgPopGrowth < 0.002) vulnerabilities.push('low_population_growth');
      if (avgGdpGrowth < 0.01) vulnerabilities.push('low_gdp_per_capita_growth');
      if (popVolatility > 0.05) vulnerabilities.push('population_volatility');
      if (gdpVolatility > 0.05) vulnerabilities.push('gdp_per_capita_volatility');
      if (riskFlags.includes('negative_population_growth')) vulnerabilities.push('population_decline');
      if (riskFlags.includes('negative_gdp_per_capita_growth')) vulnerabilities.push('gdp_per_capita_decline');
      // CRITICAL FIX: Preserve all database fields, only override calculated population/GDP fields
      // Do NOT spread result.newStats as it wipes out economic indicators!

      // DEBUG LOGGING
      console.log('=== getByIdWithEconomicData DEBUG ===');
      console.log('Country Name:', country.name);
      console.log('Database unemploymentRate:', country.unemploymentRate);
      console.log('Database taxRevenueGDPPercent:', country.taxRevenueGDPPercent);
      console.log('Database totalDebtGDPRatio:', country.totalDebtGDPRatio);
      console.log('Database laborForceParticipationRate:', country.laborForceParticipationRate);
      console.log('Database currentPopulation:', country.currentPopulation);
      console.log('Calculated currentPopulation:', result.newStats.currentPopulation);

      const response: CountryWithEconomicData = {
        ...country,  // All database fields including economic indicators

        // Override ONLY the calculated population and GDP fields from calculation engine
        currentPopulation: result.newStats.currentPopulation,
        currentGdpPerCapita: result.newStats.currentGdpPerCapita,
        currentTotalGdp: result.newStats.currentTotalGdp,
        adjustedGdpGrowth: result.newStats.adjustedGdpGrowth,
        populationGrowthRate: result.newStats.populationGrowthRate,
        populationDensity: result.newStats.populationDensity,
        gdpDensity: result.newStats.gdpDensity,
        economicTier: result.newStats.economicTier,
        populationTier: result.newStats.populationTier,

        // Preserve all economic indicators from database (these are NOT in result.newStats)
        nominalGDP: country.nominalGDP ?? 0,
        realGDPGrowthRate: country.realGDPGrowthRate ?? 0,
        inflationRate: country.inflationRate ?? 0,
        currencyExchangeRate: country.currencyExchangeRate ?? 1,
        laborForceParticipationRate: country.laborForceParticipationRate ?? undefined,
        employmentRate: country.employmentRate ?? undefined,
        unemploymentRate: country.unemploymentRate ?? undefined,
        totalWorkforce: country.totalWorkforce ?? undefined,
        averageWorkweekHours: country.averageWorkweekHours ?? undefined,
        minimumWage: country.minimumWage ?? undefined,
        averageAnnualIncome: country.averageAnnualIncome ?? undefined,
        taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? undefined,
        taxRevenuePerCapita: country.taxRevenuePerCapita ?? undefined,
        governmentRevenueTotal: country.governmentRevenueTotal ?? undefined,
        governmentBudgetGDPPercent: country.governmentBudgetGDPPercent ?? undefined,
        budgetDeficitSurplus: country.budgetDeficitSurplus ?? undefined,
        internalDebtGDPPercent: country.internalDebtGDPPercent ?? undefined,
        externalDebtGDPPercent: country.externalDebtGDPPercent ?? undefined,
        totalDebtGDPRatio: country.totalDebtGDPRatio ?? undefined,
        debtPerCapita: country.debtPerCapita ?? undefined,
        interestRates: country.interestRates ?? undefined,
        debtServiceCosts: country.debtServiceCosts ?? undefined,
        povertyRate: country.povertyRate ?? undefined,
        incomeInequalityGini: country.incomeInequalityGini ?? undefined,
        socialMobilityIndex: country.socialMobilityIndex ?? undefined,
        totalGovernmentSpending: country.totalGovernmentSpending ?? undefined,
        spendingGDPPercent: country.spendingGDPPercent ?? undefined,
        spendingPerCapita: country.spendingPerCapita ?? undefined,
        lifeExpectancy: country.lifeExpectancy ?? undefined,
        literacyRate: country.literacyRate ?? undefined,
        urbanPopulationPercent: country.urbanPopulationPercent ?? undefined,
        ruralPopulationPercent: country.ruralPopulationPercent ?? undefined,
        calculatedStats: {
          gdpGrowth: result.newStats.adjustedGdpGrowth || 0,
          populationGrowth: result.newStats.populationGrowthRate || 0,
          inflation: 0.02, // Default inflation rate
        },
        projections: projections.map(p => ({
          year: new Date(p.ixTime).getFullYear(),
          gdp: p.stats.currentTotalGdp,
          population: p.stats.currentPopulation,
        })),
        historical: historical.map((h: any) => ({
          year: new Date(h.ixTimeTimestamp).getFullYear(), 
          gdp: h.totalGdp,
          population: h.population,
        })),
        dmInputs: (country.dmInputs as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
        analytics: {
          growthTrends: {
            avgPopGrowth,
            avgGdpGrowth,
          },
          volatility: {
            popVolatility,
            gdpVolatility,
          },
          riskFlags,
          tierChangeProjection: tierChangeProjection || { year: new Date().getFullYear(), newTier: country.economicTier as EconomicTier },
          vulnerabilities,
        },
        lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : (country.lastCalculated ? new Date(country.lastCalculated).getTime() : Date.now()),
      };

      // DEBUG: Log what we're actually returning
      console.log('Response unemploymentRate:', response.unemploymentRate);
      console.log('Response taxRevenueGDPPercent:', response.taxRevenueGDPPercent);
      console.log('Response laborForceParticipationRate:', response.laborForceParticipationRate);
      console.log('=== END DEBUG ===');

      return response;
    }),

  // IMPORTANT: This mutation updates ECONOMIC INDICATORS only.
  // It does NOT update currentPopulation, currentGdpPerCapita, or currentTotalGdp.
  // Those fields are calculated and updated by the IxStats calculation engine.
  // The editor should display current* values but only allow editing of indicators.
  updateEconomicData: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      economicData: economicDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, economicData } = input;

      if (!ctx.auth?.userId) {
        throw new Error('Not authenticated');
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      try {
        // NOTE: These are economic indicators, not calculated current values
        const basicFields = {
          nominalGDP: economicData.nominalGDP,
          realGDPGrowthRate: economicData.realGDPGrowthRate,
          inflationRate: economicData.inflationRate,
          currencyExchangeRate: economicData.currencyExchangeRate,
          laborForceParticipationRate: economicData.laborForceParticipationRate,
          employmentRate: economicData.employmentRate,
          unemploymentRate: economicData.unemploymentRate,
          totalWorkforce: economicData.totalWorkforce,
          averageWorkweekHours: economicData.averageWorkweekHours,
          minimumWage: economicData.minimumWage,
          averageAnnualIncome: economicData.averageAnnualIncome,
          taxRevenueGDPPercent: economicData.taxRevenueGDPPercent,
          governmentRevenueTotal: economicData.governmentRevenueTotal,
          taxRevenuePerCapita: economicData.taxRevenuePerCapita,
          governmentBudgetGDPPercent: economicData.governmentBudgetGDPPercent,
          budgetDeficitSurplus: economicData.budgetDeficitSurplus,
          internalDebtGDPPercent: economicData.internalDebtGDPPercent,
          externalDebtGDPPercent: economicData.externalDebtGDPPercent,
          totalDebtGDPRatio: economicData.totalDebtGDPRatio,
          debtPerCapita: economicData.debtPerCapita,
          interestRates: economicData.interestRates,
          debtServiceCosts: economicData.debtServiceCosts,
          povertyRate: economicData.povertyRate,
          incomeInequalityGini: economicData.incomeInequalityGini,
          socialMobilityIndex: economicData.socialMobilityIndex,
          totalGovernmentSpending: economicData.totalGovernmentSpending,
          spendingGDPPercent: economicData.spendingGDPPercent,
          spendingPerCapita: economicData.spendingPerCapita,
          lifeExpectancy: economicData.lifeExpectancy,
          urbanPopulationPercent: economicData.urbanPopulationPercent,
          ruralPopulationPercent: economicData.ruralPopulationPercent,
          literacyRate: economicData.literacyRate,
          updatedAt: new Date(),
        };

        const filteredBasicFields = Object.fromEntries(
          Object.entries(basicFields).filter(([_, value]) => value !== undefined)
        );

        const updatedCountry = await ctx.db.country.update({
          where: { id: countryId },
          data: filteredBasicFields,
        });

        return { 
          success: true, 
          message: "Economic data updated successfully",
          country: updatedCountry
        };
      } catch (error) {
        console.error('[Countries API] Failed to update economic data:', error);
        throw new Error(`Failed to update economic data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // General update mutation for country fields (used by editor)
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
    }).passthrough()) // Allow any additional fields
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error('Not authenticated');
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId }
      });

      if (!userProfile || userProfile.countryId !== id) {
        throw new Error('You do not have permission to edit this country.');
      }

      try {
        // Filter out undefined values and update
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const updatedCountry = await ctx.db.country.update({
          where: { id },
          data: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        return updatedCountry;
      } catch (error) {
        console.error('[Countries API] Failed to update country:', error);
        throw new Error(`Failed to update country: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  updateNationalIdentity: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      officialName: z.string().optional(),
      motto: z.string().optional(),
      nationalAnthem: z.string().optional(),
      capitalCity: z.string().optional(),
      officialLanguages: z.string().optional(),
      currency: z.string().optional(),
      currencySymbol: z.string().optional(),
      demonym: z.string().optional(),
      governmentType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error('Not authenticated');
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId }
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      try {
        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        // Update or create national identity
        const nationalIdentity = await ctx.db.nationalIdentity.upsert({
          where: { countryId },
          create: {
            countryId,
            ...filteredUpdates,
          },
          update: {
            ...filteredUpdates,
            updatedAt: new Date(),
          },
        });

        return nationalIdentity;
      } catch (error) {
        console.error('[Countries API] Failed to update national identity:', error);
        throw new Error(`Failed to update national identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  getByIdAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countryFromDb = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
          nationalIdentity: true,
        },
      });
      
      if (!countryFromDb) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const currentTime = IxTime.getCurrentIxTime();
      const timeDiff = Math.abs(targetTime - currentTime);
      const isCurrentTime = timeDiff < (5 * 60 * 1000);

      let calculatedStats: CountryStats;

      if (isCurrentTime) {
        // FIXED: Use current values, not baseline values
        // This ensures editor and frontend display the same data
        calculatedStats = {
          country: countryFromDb.name,
          continent: countryFromDb.continent,
          region: countryFromDb.region,
          governmentType: countryFromDb.governmentType,
          religion: countryFromDb.religion,
          leader: countryFromDb.leader,
          population: validateNumber(countryFromDb.currentPopulation, 1e11),  // Use current, not baseline
          gdpPerCapita: validateNumber(countryFromDb.currentGdpPerCapita, 1e7, 1),  // Use current, not baseline
          landArea: countryFromDb.landArea,
          areaSqMi: countryFromDb.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(countryFromDb.maxGdpGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth),
          populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
          actualGdpGrowth: validateGrowthRate((countryFromDb as any).actualGdpGrowth),
          projected2040Population: countryFromDb.projected2040Population || 0,
          projected2040Gdp: countryFromDb.projected2040Gdp || 0,
          projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
          localGrowthFactor: countryFromDb.localGrowthFactor,
          id: countryFromDb.id,
          name: countryFromDb.name,
          totalGdp: countryFromDb.currentTotalGdp,
          currentPopulation: validateNumber(countryFromDb.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(countryFromDb.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(countryFromDb.currentTotalGdp, 1e18, 1),
          lastCalculated: countryFromDb.lastCalculated.getTime(),
          baselineDate: countryFromDb.baselineDate.getTime(),
          economicTier: countryFromDb.economicTier as any,
          populationTier: countryFromDb.populationTier as any,
          populationDensity: countryFromDb.populationDensity,
          gdpDensity: countryFromDb.gdpDensity,
          globalGrowthFactor: getDefaultEconomicConfig().globalGrowthFactor,
        };
      } else {
        const econCfg = getDefaultEconomicConfig();
        const baselineDate = countryFromDb.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(countryFromDb);
        const initialStats = calc.initializeCountryStats(base);

        const dmInputs = (countryFromDb.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(
          initialStats,
          targetTime,
          dmInputs
        );
        
        calculatedStats = {
          ...result.newStats,
          currentPopulation: validateNumber(result.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(result.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(result.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: result.newStats.populationDensity ? validateNumber(result.newStats.populationDensity, 1e7) : null,
          gdpDensity: result.newStats.gdpDensity ? validateNumber(result.newStats.gdpDensity, 1e12) : null,
          populationGrowthRate: validateGrowthRate(result.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(result.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(result.newStats.actualGdpGrowth),
          country: result.newStats.country || base.country,
          name: result.newStats.name || base.country,
          id: countryFromDb.id,
          continent: result.newStats.continent || base.continent,
          region: result.newStats.region || base.region,
          governmentType: result.newStats.governmentType || base.governmentType,
          religion: result.newStats.religion || base.religion,
          leader: result.newStats.leader || base.leader,
          population: result.newStats.population,
          gdpPerCapita: result.newStats.gdpPerCapita,
          landArea: result.newStats.landArea || base.landArea,
          areaSqMi: result.newStats.areaSqMi || base.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(result.newStats.maxGdpGrowthRate),
          projected2040Population: result.newStats.projected2040Population || 0,
          projected2040Gdp: result.newStats.projected2040Gdp || 0,
          projected2040GdpPerCapita: result.newStats.projected2040GdpPerCapita || 0,
          localGrowthFactor: result.newStats.localGrowthFactor,
          totalGdp: result.newStats.totalGdp,
          lastCalculated: result.newStats.lastCalculated,
          baselineDate: result.newStats.baselineDate,
          economicTier: result.newStats.economicTier,
          populationTier: result.newStats.populationTier,
          globalGrowthFactor: result.newStats.globalGrowthFactor,
        };
      }

      return {
        id: countryFromDb.id,
        name: countryFromDb.name,
        continent: countryFromDb.continent,
        region: countryFromDb.region,
        governmentType: countryFromDb.governmentType,
        religion: countryFromDb.religion,
        leader: countryFromDb.leader,
        areaSqMi: countryFromDb.areaSqMi,
        landArea: countryFromDb.landArea,
        baselinePopulation: countryFromDb.baselinePopulation,
        baselineGdpPerCapita: countryFromDb.baselineGdpPerCapita,
        maxGdpGrowthRate: validateGrowthRate(countryFromDb.maxGdpGrowthRate),
        adjustedGdpGrowth: validateGrowthRate(countryFromDb.adjustedGdpGrowth),
        populationGrowthRate: validateGrowthRate(countryFromDb.populationGrowthRate),
        localGrowthFactor: countryFromDb.localGrowthFactor,
        projected2040Population: countryFromDb.projected2040Population || 0,
        projected2040Gdp: countryFromDb.projected2040Gdp || 0,
        projected2040GdpPerCapita: countryFromDb.projected2040GdpPerCapita || 0,
        createdAt: countryFromDb.createdAt,
        updatedAt: countryFromDb.updatedAt,
        baselineDate: countryFromDb.baselineDate,
        lastCalculated: countryFromDb.lastCalculated,
        calculatedStats,
        dmInputs: (countryFromDb.dmInputs as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
        nationalIdentity: countryFromDb.nationalIdentity,
      };
    }),

  getHistoricalAtTime: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      limit: z.number().optional().default(500),
      interval: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
    }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: input.id,
          ixTimeTimestamp: {
            gte: new Date(input.startTime),
            lte: new Date(input.endTime),
          },
        },
        orderBy: { ixTimeTimestamp: "asc" },
        take: input.limit,
      });
      
      if (existing.length >= Math.min(input.limit, 50) || existing.length > 10) {
        return existing.map((p) => ({
          ...p,
          ixTimeTimestamp: p.ixTimeTimestamp.getTime(),
          population: validateNumber(p.population, 1e11),
          gdpPerCapita: validateNumber(p.gdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(p.totalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(p.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(p.gdpGrowthRate),
          landArea: p.landArea,
          populationDensity: p.populationDensity ? validateNumber(p.populationDensity, 1e7) : null,
          gdpDensity: p.gdpDensity ? validateNumber(p.gdpDensity, 1e12) : null,
        }));
      }

      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const intervalMs =
        input.interval === "daily"
          ? 24 * 60 * 60 * 1000
          : input.interval === "weekly"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

      const econCfg = getDefaultEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (
        let t = input.startTime;
        t <= input.endTime && dataPoints.length < input.limit;
        t += intervalMs
      ) {
        const res = calc.calculateTimeProgression(baselineStats, t, dmInputs);
        dataPoints.push({
          ixTimeTimestamp: t,
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: res.newStats.landArea,
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
        });
      }
      return dataPoints;
    }),

  getForecast: publicProcedure
    .input(z.object({
      id: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      points: z.number().optional().default(40),
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }

      const totalDuration = input.endTime - input.startTime;
      if (totalDuration <= 0 || input.points <= 0) {
        return {
          countryId: input.id,
          countryName: country.name,
          startTime: input.startTime,
          endTime: input.endTime,
          dataPoints: [],
        };
      }
      
      const intervalMs = totalDuration / input.points;

      const econCfg = getDefaultEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (let i = 0; i <= input.points; i++) {
        let forecastTime = input.startTime + (i * intervalMs);
        
        if (i === input.points) {
          forecastTime = Math.min(forecastTime, input.endTime);
        }
        if (forecastTime > input.endTime && i < input.points) break;

        const res = calc.calculateTimeProgression(
          baselineStats,
          forecastTime,
          dmInputs
        );
        
        dataPoints.push({
          ixTime: forecastTime,
          formattedTime: IxTime.formatIxTime(forecastTime),
          gameYear: IxTime.getCurrentGameYear(forecastTime),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          economicTier: res.newStats.economicTier,
          populationTier: res.newStats.populationTier,
        });
        
        if (forecastTime >= input.endTime) break;
      }
      
      return {
        countryId: input.id,
        countryName: country.name,
        startTime: input.startTime,
        endTime: input.endTime,
        dataPoints,
      };
    }),

  getMultipleAtTime: publicProcedure
    .input(z.object({
      ids: z.array(z.string()),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countriesFromDb = await ctx.db.country.findMany({
        where: { id: { in: input.ids } },
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });
      
      const econCfg = getDefaultEconomicConfig();
      const results = [];

      for (const country of countriesFromDb) {
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        
        const res = calc.calculateTimeProgression(
          baselineStats,
          targetTime,
          dmInputs
        );
        
        const calculatedCountryStats: CountryStats = {
          ...res.newStats,
          id: country.id,
          name: res.newStats.name || base.country,
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          country: res.newStats.country || base.country,
          continent: res.newStats.continent || base.continent,
          region: res.newStats.region || base.region,
          governmentType: res.newStats.governmentType || base.governmentType,
          religion: res.newStats.religion || base.religion,
          leader: res.newStats.leader || base.leader,
          population: res.newStats.population,
          gdpPerCapita: res.newStats.gdpPerCapita,
          landArea: res.newStats.landArea || base.landArea,
          areaSqMi: res.newStats.areaSqMi || base.areaSqMi,
          maxGdpGrowthRate: validateGrowthRate(res.newStats.maxGdpGrowthRate),
          projected2040Population: res.newStats.projected2040Population || 0,
          projected2040Gdp: res.newStats.projected2040Gdp || 0,
          projected2040GdpPerCapita: res.newStats.projected2040GdpPerCapita || 0,
          localGrowthFactor: res.newStats.localGrowthFactor,
          totalGdp: res.newStats.totalGdp,
          lastCalculated: res.newStats.lastCalculated,
          baselineDate: res.newStats.baselineDate,
          economicTier: res.newStats.economicTier,
          populationTier: res.newStats.populationTier,
          globalGrowthFactor: res.newStats.globalGrowthFactor,
        };

        results.push({
          id: country.id,
          name: country.name,
          continent: country.continent,
          region: country.region,
          calculatedStats: calculatedCountryStats,
          dmInputs: (country.dmInputs as any[]).map((dm: any) => ({
            ...dm,
            ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
          })),
        });
      }
      return results;
    }),

  getGlobalStats: publicProcedure
    .input(z.object({
      timestamp: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const targetTime = input?.timestamp ?? IxTime.getCurrentIxTime();
      
      const cacheKey = getCacheKey('globalStats', { timestamp: targetTime });
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await ctx.db.$queryRaw`
        SELECT 
          COUNT(*) as totalCountries,
          SUM(COALESCE(currentPopulation, 0)) as totalPopulation,
          SUM(COALESCE(currentTotalGdp, 0)) as totalGdp,
          SUM(COALESCE(landArea, 0)) as totalLand,
          COUNT(CASE WHEN economicTier = 'Advanced' THEN 1 END) as advancedCount,
          COUNT(CASE WHEN economicTier = 'Developed' THEN 1 END) as developedCount,
          COUNT(CASE WHEN economicTier = 'Emerging' THEN 1 END) as emergingCount,
          COUNT(CASE WHEN economicTier = 'Developing' THEN 1 END) as developingCount,
          COUNT(CASE WHEN economicTier = 'Impoverished' THEN 1 END) as impoverishedCount,
          COUNT(CASE WHEN populationTier = '1' THEN 1 END) as popTier1Count,
          COUNT(CASE WHEN populationTier = '2' THEN 1 END) as popTier2Count,
          COUNT(CASE WHEN populationTier = '3' THEN 1 END) as popTier3Count,
          COUNT(CASE WHEN populationTier = '4' THEN 1 END) as popTier4Count,
          COUNT(CASE WHEN populationTier = '5' THEN 1 END) as popTier5Count
        FROM Country
      `;

      const stats = (result as any[])[0];
      
      const totalPopulation = validateNumber(Number(stats.totalPopulation) || 0, 1e11);
      const totalGdp = validateNumber(Number(stats.totalGdp) || 0, 1e18);
      const totalLand = Number(stats.totalLand) || 0;
      const totalCountries = Number(stats.totalCountries) || 0;

      const avgGdpPc = totalPopulation > 0 ? totalGdp / totalPopulation : 0;
      const avgPopD = totalLand > 0 ? totalPopulation / totalLand : 0;
      const avgGdpD = totalLand > 0 ? totalGdp / totalLand : 0;

      const economicTierDistribution = {
        'Advanced': Number(stats.advancedCount) || 0,
        'Developed': Number(stats.developedCount) || 0,
        'Emerging': Number(stats.emergingCount) || 0,
        'Developing': Number(stats.developingCount) || 0,
        'Impoverished': Number(stats.impoverishedCount) || 0,
      };

      const populationTierDistribution = {
        '1': Number(stats.popTier1Count) || 0,
        '2': Number(stats.popTier2Count) || 0,
        '3': Number(stats.popTier3Count) || 0,
        '4': Number(stats.popTier4Count) || 0,
        '5': Number(stats.popTier5Count) || 0,
      };

      const globalGrowthFactor = getDefaultEconomicConfig().globalGrowthFactor;
      const globalGrowthRate = (globalGrowthFactor - 1); // Convert multiplier (1.0321) to rate (0.0321)

      const response = {
        totalPopulation,
        totalGdp,
        averageGdpPerCapita: avgGdpPc,
        averagePopulation: totalCountries > 0 ? totalPopulation / totalCountries : 0,
        countryCount: totalCountries, // Add countryCount field that UI expects
        totalCountries, // Keep for backward compatibility
        economicTierDistribution,
        populationTierDistribution,
        averagePopulationDensity: avgPopD || null,
        averageGdpDensity: avgGdpD || null,
        globalGrowthFactor, // Keep original for any other uses
        globalGrowthRate,   // Add the rate that UI expects
        timestamp: targetTime, // Add timestamp field that UI expects
        ixTimeTimestamp: targetTime,
      };

      setCachedData(cacheKey, response, 30000);

      return response;
    }),

  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = getDefaultEconomicConfig();
      const now = IxTime.getCurrentIxTime();

      if (input.countryId) {
        const c = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" }
            }
          },
        });
        
        if (!c) throw new Error(`Country ${input.countryId} not found`);

        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (c.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime()
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);

        // Check for tier changes and milestones before update
        const oldEconomicTier = c.economicTier;
        const oldPopulationTier = c.populationTier;
        const oldGdp = c.currentTotalGdp || 0;
        const oldPopulation = c.currentPopulation || 0;
        
        // Calculate vitality scores before updating
        const updatedCountryData = {
          ...c,
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          economicTier: res.newStats.economicTier.toString(),
          populationTier: res.newStats.populationTier.toString(),
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
        };

        const vitalityScores = calculateAllVitalityScores(updatedCountryData);

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: updatedCountryData.currentPopulation,
            currentGdpPerCapita: updatedCountryData.currentGdpPerCapita,
            currentTotalGdp: updatedCountryData.currentTotalGdp,
            economicTier: updatedCountryData.economicTier,
            populationTier: updatedCountryData.populationTier,
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
            adjustedGdpGrowth: updatedCountryData.adjustedGdpGrowth,
            actualGdpGrowth: updatedCountryData.actualGdpGrowth,
            populationGrowthRate: updatedCountryData.populationGrowthRate,
            // Update vitality scores
            economicVitality: vitalityScores.economicVitality,
            populationWellbeing: vitalityScores.populationWellbeing,
            diplomaticStanding: vitalityScores.diplomaticStanding,
            governmentalEfficiency: vitalityScores.governmentalEfficiency,
            overallNationalHealth: vitalityScores.overallNationalHealth,
            lastCalculated: new Date(now),
          },
        });

        // Generate activities for this country update
        try {
          // Get userId if country is claimed by a user
          const user = await ctx.db.user.findFirst({
            where: { countryId: c.id },
            select: { clerkUserId: true }
          });
          const userId = user?.clerkUserId;

          // Check for economic tier changes
          if (oldEconomicTier !== res.newStats.economicTier.toString()) {
            await ActivityGenerator.createTierChange(
              c.id,
              'economic',
              oldEconomicTier,
              res.newStats.economicTier.toString(),
              userId
            );

            // 🔔 Notify country about economic tier change
            try {
              const tierDirection = parseInt(res.newStats.economicTier.toString()) > parseInt(oldEconomicTier) ? 'advanced' : 'changed';
              await notificationAPI.notifyCountry({
                countryId: c.id,
                title: `📈 Economic Tier ${tierDirection === 'advanced' ? 'Advancement!' : 'Change'}`,
                message: `Your country ${tierDirection} from tier ${oldEconomicTier} to tier ${res.newStats.economicTier}`,
                category: 'economic',
                priority: tierDirection === 'advanced' ? 'high' : 'medium',
              });
            } catch (error) {
              console.error('[Countries] Failed to send tier change notification:', error);
            }
          }

          // Check for population tier changes
          if (oldPopulationTier !== res.newStats.populationTier.toString()) {
            await ActivityGenerator.createTierChange(
              c.id,
              'population',
              oldPopulationTier,
              res.newStats.populationTier.toString(),
              userId
            );

            // 🔔 Notify country about population tier change
            try {
              const tierDirection = parseInt(res.newStats.populationTier.toString()) > parseInt(oldPopulationTier) ? 'advanced' : 'changed';
              await notificationAPI.notifyCountry({
                countryId: c.id,
                title: `👥 Population Tier ${tierDirection === 'advanced' ? 'Advancement!' : 'Change'}`,
                message: `Your country ${tierDirection} from tier ${oldPopulationTier} to tier ${res.newStats.populationTier}`,
                category: 'social',
                priority: tierDirection === 'advanced' ? 'high' : 'medium',
              });
            } catch (error) {
              console.error('[Countries] Failed to send tier change notification:', error);
            }
          }

          // Check for significant GDP milestones (every 100B, 500B, 1T, etc.)
          const newGdp = res.newStats.currentTotalGdp;
          const gdpMilestones = [100e9, 500e9, 1e12, 2e12, 5e12, 10e12, 50e12]; // 100B to 50T
          for (const milestone of gdpMilestones) {
            if (oldGdp < milestone && newGdp >= milestone) {
              await ActivityGenerator.createEconomicMilestone(
                c.id,
                'Total GDP',
                milestone,
                userId
              );

              // 🔔 Notify country about GDP milestone
              try {
                const formatGDP = (val: number) => {
                  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
                  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
                  return `$${(val / 1e6).toFixed(0)}M`;
                };

                await notificationAPI.notifyCountry({
                  countryId: c.id,
                  title: `🎉 GDP Milestone Reached!`,
                  message: `Your country's GDP has reached ${formatGDP(milestone)}! A major economic achievement.`,
                  category: 'achievement',
                  priority: 'high',
                });
              } catch (error) {
                console.error('[Countries] Failed to send GDP milestone notification:', error);
              }

              break; // Only trigger one milestone per update
            }
          }

          // Check for population milestones (every 10M, 50M, 100M, etc.)
          const newPopulation = res.newStats.currentPopulation;
          const populationMilestones = [10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9]; // 10M to 1B
          for (const milestone of populationMilestones) {
            if (oldPopulation < milestone && newPopulation >= milestone) {
              await ActivityGenerator.createPopulationMilestone(
                c.id,
                milestone,
                userId
              );

              // 🔔 Notify country about population milestone
              try {
                const formatPop = (val: number) => {
                  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
                  if (val >= 1e6) return `${(val / 1e6).toFixed(0)}M`;
                  return `${(val / 1e3).toFixed(0)}K`;
                };

                await notificationAPI.notifyCountry({
                  countryId: c.id,
                  title: `🎊 Population Milestone Reached!`,
                  message: `Your country's population has reached ${formatPop(milestone)} citizens! A demographic milestone.`,
                  category: 'achievement',
                  priority: 'high',
                });
              } catch (error) {
                console.error('[Countries] Failed to send population milestone notification:', error);
              }

              break; // Only trigger one milestone per update
            }
          }

          // Check for high economic growth
          const growthRate = res.newStats.adjustedGdpGrowth || 0;
          if (growthRate >= 0.04) { // 4%+ growth rate
            await ActivityGenerator.createHighGrowthActivity(
              c.id,
              growthRate,
              userId
            );
          }
        } catch (activityError) {
          console.warn('Failed to generate activities for country', c.id, ':', activityError);
          // Don't throw - continue with the update process
        }

        await ctx.db.historicalDataPoint.create({
          data: {
            countryId: c.id,
            ixTimeTimestamp: new Date(now),
            population: validateNumber(res.newStats.currentPopulation, 1e11),
            gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            landArea: c.landArea,
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          },
        });
        return updated;
      }

      const all = await ctx.db.country.findMany({
        include: {
          dmInputs: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" }
          }
        },
      });
      
      const start = Date.now();
      const results = [];
      const historicalPointsToCreate = [];
      let activitiesCreated = 0;

      for (const c of all) {
        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (c.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime()
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);
        
        // Store old values for comparison
        const oldEconomicTier = c.economicTier;
        const oldPopulationTier = c.populationTier;
        const oldGdp = c.currentTotalGdp || 0;
        const oldPopulation = c.currentPopulation || 0;
        
        // Calculate vitality scores for batch update
        const updatedCountryData = {
          ...c,
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          economicTier: res.newStats.economicTier.toString(),
          populationTier: res.newStats.populationTier.toString(),
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
        };

        const vitalityScores = calculateAllVitalityScores(updatedCountryData);

        const updateData = {
          currentPopulation: updatedCountryData.currentPopulation,
          currentGdpPerCapita: updatedCountryData.currentGdpPerCapita,
          currentTotalGdp: updatedCountryData.currentTotalGdp,
          economicTier: updatedCountryData.economicTier,
          populationTier: updatedCountryData.populationTier,
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          adjustedGdpGrowth: updatedCountryData.adjustedGdpGrowth,
          actualGdpGrowth: updatedCountryData.actualGdpGrowth,
          populationGrowthRate: updatedCountryData.populationGrowthRate,
          // Update vitality scores
          economicVitality: vitalityScores.economicVitality,
          populationWellbeing: vitalityScores.populationWellbeing,
          diplomaticStanding: vitalityScores.diplomaticStanding,
          governmentalEfficiency: vitalityScores.governmentalEfficiency,
          overallNationalHealth: vitalityScores.overallNationalHealth,
          lastCalculated: new Date(now),
        };

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: updateData
        });
        results.push(updated);

        // Generate activities for significant changes (batch updates are less frequent, so we're more selective)
        try {
          // Get userId if country is claimed
          const user = await ctx.db.user.findFirst({
            where: { countryId: c.id },
            select: { clerkUserId: true }
          });
          const userId = user?.clerkUserId;

          // Only create activities for significant tier changes
          if (oldEconomicTier !== res.newStats.economicTier.toString()) {
            await ActivityGenerator.createTierChange(
              c.id,
              'economic',
              oldEconomicTier,
              res.newStats.economicTier.toString(),
              userId
            );
            activitiesCreated++;
          }

          // Only create activities for major milestones (larger thresholds for batch updates)
          const newGdp = res.newStats.currentTotalGdp;
          const majorGdpMilestones = [500e9, 1e12, 5e12, 10e12]; // 500B, 1T, 5T, 10T
          for (const milestone of majorGdpMilestones) {
            if (oldGdp < milestone && newGdp >= milestone) {
              await ActivityGenerator.createEconomicMilestone(
                c.id,
                'Total GDP',
                milestone,
                userId
              );
              activitiesCreated++;
              break;
            }
          }

          // Major population milestones only
          const newPopulation = res.newStats.currentPopulation;
          const majorPopulationMilestones = [50e6, 100e6, 500e6]; // 50M, 100M, 500M
          for (const milestone of majorPopulationMilestones) {
            if (oldPopulation < milestone && newPopulation >= milestone) {
              await ActivityGenerator.createPopulationMilestone(
                c.id,
                milestone,
                userId
              );
              activitiesCreated++;
              break;
            }
          }
        } catch (activityError) {
          console.warn('Failed to generate activity for country', c.id, ':', activityError);
          // Don't interrupt the batch process
        }
        
        historicalPointsToCreate.push({
          countryId: c.id,
          ixTimeTimestamp: new Date(now),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: c.landArea,
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
        });
      }

      if (historicalPointsToCreate.length > 0) {
        try {
          await ctx.db.calculationLog.create({
            data: {
              timestamp: new Date(),
              ixTimeTimestamp: new Date(now),
              countriesUpdated: results.length,
              executionTimeMs: Date.now() - start,
              globalGrowthFactor: econCfg.globalGrowthFactor,
              notes: "Bulk update triggered manually or by schedule",
            },
          });
        } catch (error) {
          console.warn("Failed to create calculation log:", error);
        }
      }
      
      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: Date.now() - start,
      };
    }),

  getDmInputs: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const whereClause = input.countryId 
          ? { countryId: input.countryId, isActive: true }
          : { isActive: true };

        const dmInputs = await ctx.db.dmInputs.findMany({
          where: whereClause,
          orderBy: { ixTimeTimestamp: "desc" },
          include: {
            country: {
              select: { name: true }
            }
          }
        });

        return dmInputs;
      } catch (error) {
        console.error("Failed to get DM inputs:", error);
        throw new Error("Failed to retrieve DM inputs");
      }
    }),

  addDmInput: executiveProcedure
    .input(z.object({
      countryId: z.string().optional(),
      inputType: z.string(),
      value: z.number(),
      description: z.string(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dmInput = await ctx.db.dmInputs.create({
          data: {
            countryId: input.countryId || null,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            inputType: input.inputType,
            value: input.value,
            description: input.description,
            duration: input.duration || null,
            isActive: true,
            createdBy: ctx.user?.id ?? "system", // Use authenticated user ID
          },
        });

        return dmInput;
      } catch (error) {
        console.error("Failed to add DM input:", error);
        throw new Error("Failed to add DM input");
      }
    }),

  updateDmInput: executiveProcedure
    .input(z.object({
      id: z.string(),
      inputType: z.string(),
      value: z.number(),
      description: z.string(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dmInput = await ctx.db.dmInputs.update({
          where: { id: input.id },
          data: {
            inputType: input.inputType,
            value: input.value,
            description: input.description,
            duration: input.duration || null,
            updatedAt: new Date(),
          },
        });

        return dmInput;
      } catch (error) {
        console.error("Failed to update DM input:", error);
        throw new Error("Failed to update DM input");
      }
    }),

  deleteDmInput: executiveProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dmInput = await ctx.db.dmInputs.update({
          where: { id: input.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        return dmInput;
      } catch (error) {
        console.error("Failed to delete DM input:", error);
        throw new Error("Failed to delete DM input");
      }
    }),

  updateCountryName: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error('You do not have permission to update this country.');
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            name: input.name.trim(),
            updatedAt: new Date(),
          },
        });

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update country name:", error);
        throw new Error("Failed to update country name");
      }
    }),

  updateProfileVisibility: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      hideDiplomaticOps: z.boolean().optional(),
      hideStratcommIntel: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error('You do not have permission to update this country.');
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.hideDiplomaticOps !== undefined) {
          updateData.hideDiplomaticOps = input.hideDiplomaticOps;
        }
        if (input.hideStratcommIntel !== undefined) {
          updateData.hideStratcommIntel = input.hideStratcommIntel;
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: updateData,
        });

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update profile visibility:", error);
        throw new Error("Failed to update profile visibility");
      }
    }),

  updateCountryFlag: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      flag: z.string().min(1), // Data URL or external URL
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error('You do not have permission to update this country.');
        }

        // Validate that it's either a data URL or a valid URL
        if (!input.flag.startsWith('data:') && !input.flag.startsWith('http')) {
          throw new Error('Invalid flag URL format');
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            flag: input.flag,
            updatedAt: new Date(),
          },
        });

        console.log(`[CountryUpdate] Updated flag for country ${updatedCountry.name} (${updatedCountry.id})`);

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update country flag:", error);
        throw new Error("Failed to update country flag");
      }
    }),

  updateCountryCoatOfArms: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      coatOfArms: z.string().min(1), // Data URL or external URL
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error('You do not have permission to update this country.');
        }

        // Validate that it's either a data URL or a valid URL
        if (!input.coatOfArms.startsWith('data:') && !input.coatOfArms.startsWith('http')) {
          throw new Error('Invalid coat of arms URL format');
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            coatOfArms: input.coatOfArms,
            updatedAt: new Date(),
          },
        });

        console.log(`[CountryUpdate] Updated coat of arms for country ${updatedCountry.name} (${updatedCountry.id})`);

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update coat of arms:", error);
        throw new Error("Failed to update coat of arms");
      }
    }),

  updateCountrySymbols: countryOwnerProcedure
    .input(z.object({
      countryId: z.string(),
      flag: z.string().optional(),
      coatOfArms: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error('You do not have permission to update this country.');
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        // Validate and add flag if provided
        if (input.flag !== undefined) {
          if (!input.flag.startsWith('data:') && !input.flag.startsWith('http')) {
            throw new Error('Invalid flag URL format');
          }
          updateData.flag = input.flag;
        }

        // Validate and add coat of arms if provided
        if (input.coatOfArms !== undefined) {
          if (!input.coatOfArms.startsWith('data:') && !input.coatOfArms.startsWith('http')) {
            throw new Error('Invalid coat of arms URL format');
          }
          updateData.coatOfArms = input.coatOfArms;
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: updateData,
        });

        console.log(`[CountryUpdate] Updated symbols for country ${updatedCountry.name} (${updatedCountry.id})`);

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update country symbols:", error);
        throw new Error("Failed to update country symbols");
      }
    }),

  getHistoricalData: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const now = IxTime.getCurrentIxTime();
        const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months ago
        
        const existingData = await ctx.db.historicalDataPoint.findMany({
          where: {
            countryId: input.countryId,
            ixTimeTimestamp: {
              gte: new Date(now - SIX_MONTHS_MS),
              lte: new Date(now),
            },
          },
          orderBy: { ixTimeTimestamp: "asc" },
          take: input.limit,
        });

        if (existingData.length >= Math.min(input.limit, 10)) {
          return existingData.map((point) => ({
            ...point,
            ixTimeTimestamp: point.ixTimeTimestamp.getTime(),
            population: validateNumber(point.population, 1e11),
            gdpPerCapita: validateNumber(point.gdpPerCapita, 1e7, 1),
            totalGdp: validateNumber(point.totalGdp, 1e18, 1),
            populationGrowthRate: validateGrowthRate(point.populationGrowthRate),
            gdpGrowthRate: validateGrowthRate(point.gdpGrowthRate),
            populationDensity: point.populationDensity ? validateNumber(point.populationDensity, 1e7) : null,
            gdpDensity: point.gdpDensity ? validateNumber(point.gdpDensity, 1e12) : null,
          }));
        }

        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);

        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const dataPoints = [];
        const intervalMs = SIX_MONTHS_MS / input.limit;

        for (let i = 0; i < input.limit; i++) {
          const timePoint = now - SIX_MONTHS_MS + (i * intervalMs);
          const res = calc.calculateTimeProgression(baselineStats, timePoint, dmInputs);
          
          dataPoints.push({
            ixTimeTimestamp: timePoint,
            population: validateNumber(res.newStats.currentPopulation, 1e11),
            gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            landArea: res.newStats.landArea,
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          });
        }

        return dataPoints;
      } catch (error) {
        console.error("Failed to get historical data:", error);
        throw new Error("Failed to retrieve historical data");
      }
    }),

  getTopCountriesByGdpPerCapita: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(10),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("topCountriesByGdpPerCapita", { limit: input.limit });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const countries = await ctx.db.country.findMany({
          select: {
            id: true,
            name: true,
            currentGdpPerCapita: true,
            currentPopulation: true,
            currentTotalGdp: true,
            economicTier: true,
            populationTier: true,
          },
          orderBy: { currentGdpPerCapita: "desc" },
          take: input.limit,
        });

        const result = countries.map((country) => ({
          ...country,
          currentGdpPerCapita: validateNumber(country.currentGdpPerCapita ?? 0, 1e7, 1),
          currentTotalGdp: validateNumber(country.currentTotalGdp ?? 0, 1e18, 1),
          currentPopulation: validateNumber(country.currentPopulation ?? 0, 1e11, 1),
        }));

        setCachedData(cacheKey, result, 5 * 60 * 1000);
        return result;
      } catch (error) {
        console.error("Failed to get top countries by GDP per capita:", error);
        throw new Error("Failed to retrieve top countries data");
      }
    }),

  getTopCountriesByPopulation: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(15),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("topCountriesByPopulation", { limit: input.limit });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const countries = await ctx.db.country.findMany({
          select: {
            id: true,
            name: true,
            currentPopulation: true,
            currentGdpPerCapita: true,
            currentTotalGdp: true,
            populationTier: true,
            economicTier: true,
            populationGrowthRate: true,
          },
          orderBy: { currentPopulation: "desc" },
          take: input.limit,
        });

        const result = countries.map((country) => ({
          ...country,
          currentPopulation: validateNumber(country.currentPopulation ?? 0, 1e11, 1),
          currentGdpPerCapita: validateNumber(country.currentGdpPerCapita ?? 0, 1e7, 1),
          currentTotalGdp: validateNumber(country.currentTotalGdp ?? 0, 1e18, 1),
          populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
        }));

        setCachedData(cacheKey, result, 5 * 60 * 1000);
        return result;
      } catch (error) {
        console.error("Failed to get top countries by population:", error);
        throw new Error("Failed to retrieve top countries population data");
      }
    }),

  getEconomicData: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("economicData", { countryId: input.countryId });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const currentTime = IxTime.getCurrentIxTime();
        
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(
          baselineStats,
          currentTime,
          dmInputs
        );

        const economicData = {
          id: country.id,
          name: country.name,
          currentPopulation: validateNumber(result.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(result.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(result.newStats.currentTotalGdp, 1e18, 1),
          baselinePopulation: country.baselinePopulation,
          baselineGdpPerCapita: country.baselineGdpPerCapita,
          populationGrowthRate: validateGrowthRate(result.newStats.populationGrowthRate),
          adjustedGdpGrowth: validateGrowthRate(result.newStats.adjustedGdpGrowth),
          economicTier: result.newStats.economicTier,
          populationTier: result.newStats.populationTier,
          continent: country.continent,
          region: country.region,
          landArea: country.landArea,
          populationDensity: result.newStats.populationDensity,
          gdpDensity: result.newStats.gdpDensity,
          lastCalculated: result.newStats.lastCalculated,
          baselineDate: country.baselineDate.getTime(),
        };

        setCachedData(cacheKey, economicData, 60000);
        return economicData;
      } catch (error) {
        console.error("Failed to get economic data:", error);
        throw new Error("Failed to retrieve economic data");
      }
    }),

  searchWiki: publicProcedure
    .input(z.object({
      query: z.string(),
      site: z.enum(['ixwiki', 'iiwiki', 'althistory']),
      categoryFilter: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log("[searchWiki] Starting search with input:", input);
        const { searchWiki } = await import("~/lib/wiki-search-service");
        console.log("[searchWiki] Successfully imported searchWiki function");
        const result = await searchWiki(input.query, input.site, input.categoryFilter);
        console.log("[searchWiki] Search completed, results:", result?.length || 0, "items");
        return result;
      } catch (error) {
        console.error("[searchWiki] ERROR:", error);
        if (error instanceof Error) {
          console.error("[searchWiki] Error message:", error.message);
          console.error("[searchWiki] Error stack:", error.stack);
        }
        throw new Error(`Failed to search wiki: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  parseInfobox: publicProcedure
    .input(z.object({
      pageName: z.string(),
      site: z.enum(['ixwiki', 'iiwiki', 'althistory']),
    }))
    .mutation(async ({ input }) => {
      try {
        const { parseCountryInfobox } = await import("~/lib/wiki-search-service");
        return await parseCountryInfobox(input.pageName, input.site);
      } catch (error) {
        console.error("Infobox parsing failed:", error);
        throw new Error("Failed to parse country infobox");
      }
    }),

  getIntelligenceBriefings: publicProcedure
    .input(z.object({
      countryId: z.string(),
      timeframe: z.enum(['week', 'month', 'quarter']).optional().default('week'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
              take: 10,
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const timeframeDuration = {
          'week': 7 * 24 * 60 * 60 * 1000,
          'month': 30 * 24 * 60 * 60 * 1000,
          'quarter': 90 * 24 * 60 * 60 * 1000,
        }[input.timeframe];

        const recentData = await ctx.db.historicalDataPoint.findMany({
          where: {
            countryId: input.countryId,
            ixTimeTimestamp: {
              gte: new Date(currentTime - timeframeDuration),
              lte: new Date(currentTime),
            },
          },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 30,
        });

        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        const briefings: any[] = [];

        let gdpChange = 0;
        if (recentData.length >= 2) {
          const latestGdp = recentData[0]?.gdpPerCapita || currentStats.newStats.currentGdpPerCapita;
          const previousGdp = recentData[recentData.length - 1]?.gdpPerCapita || country.baselineGdpPerCapita;
          if (previousGdp && previousGdp !== 0) {
            gdpChange = ((latestGdp - previousGdp) / previousGdp) * 100;
          } else {
            gdpChange = 0;
          }
          
          briefings.push({
            id: 'economic-performance',
            category: 'Economic Intelligence',
            title: 'Economic Performance Analysis',
            priority: gdpChange < -5 ? 'critical' : gdpChange < 0 ? 'high' : 'medium',
            confidenceScore: 85,
            summary: `GDP per capita ${gdpChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(gdpChange).toFixed(1)}% over the ${input.timeframe}`,
            details: [
              `Current GDP per capita: $${latestGdp.toLocaleString()}`,
              `Growth rate: ${(currentStats.newStats.adjustedGdpGrowth * 100).toFixed(2)}%`,
              `Economic tier: ${currentStats.newStats.economicTier}`,
            ],
            timestamp: currentTime,
            source: 'Economic Analytics Engine',
          });
        } else {
          gdpChange = currentStats.newStats.adjustedGdpGrowth * 100;
          
          briefings.push({
            id: 'economic-performance',
            category: 'Economic Intelligence',
            title: 'Economic Performance Analysis',
            priority: gdpChange < -5 ? 'critical' : gdpChange < 0 ? 'high' : 'medium',
            confidenceScore: 75,
            summary: `Current GDP growth rate at ${gdpChange.toFixed(1)}% annually`,
            details: [
              `Current GDP per capita: $${currentStats.newStats.currentGdpPerCapita.toLocaleString()}`,
              `Growth rate: ${gdpChange.toFixed(2)}%`,
              `Economic tier: ${currentStats.newStats.economicTier}`,
            ],
            timestamp: currentTime,
            source: 'Economic Analytics Engine',
          });
        }

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        briefings.push({
          id: 'population-dynamics',
          category: 'Demographic Intelligence',
          title: 'Population Dynamics Assessment',
          priority: popGrowthRate < 0 ? 'high' : 'medium',
          confidenceScore: 90,
          summary: `Population growth rate at ${(popGrowthRate * 100).toFixed(2)}% annually`,
          details: [
            `Current population: ${currentStats.newStats.currentPopulation.toLocaleString()}`,
            `Population tier: ${currentStats.newStats.populationTier}`,
            `Growth trend: ${popGrowthRate >= 0 ? 'Positive' : 'Negative'}`,
          ],
          timestamp: currentTime,
          source: 'Demographic Analysis Unit',
        });

        const riskFactors = [];
        if (gdpChange < -3) riskFactors.push('Economic decline detected');
        if (popGrowthRate < 0.005) riskFactors.push('Low population growth');
        if (country.dmInputs.length > 5) riskFactors.push('High external influence activity');

        if (riskFactors.length > 0) {
          briefings.push({
            id: 'risk-assessment',
            category: 'Risk Intelligence',
            title: 'Strategic Risk Assessment',
            priority: riskFactors.length >= 3 ? 'critical' : 'high',
            confidenceScore: 75,
            summary: `${riskFactors.length} risk factor${riskFactors.length > 1 ? 's' : ''} identified`,
            details: riskFactors,
            timestamp: currentTime,
            source: 'Risk Assessment Division',
          });
        }

        return {
          countryId: input.countryId,
          countryName: country.name,
          timeframe: input.timeframe,
          briefings,
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate intelligence briefings:", error);
        throw new Error("Failed to generate intelligence briefings");
      }
    }),

  getFocusCardsData: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        const economicHealthScore = Math.min(100, Math.max(0, 
          (currentStats.newStats.currentGdpPerCapita / 50000) * 100
        ));

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        const populationHealthScore = Math.min(100, Math.max(0,
          50 + (popGrowthRate * 1000) // Convert to 0-100 scale
        ));

        const diplomaticHealthScore = Math.min(100, Math.max(20,
          ((country as any).globalDiplomaticInfluence || 50) + 
          ((country as any).tradeRelationshipStrength || 10) + 
          ((country as any).allianceStrength || 15) - 
          ((country as any).diplomaticTensions || 5)
        ));

        const govEfficiency = Math.min(100, Math.max(30,
          70 + (currentStats.newStats.adjustedGdpGrowth * 500)
        ));

        const alerts = [];
        if (economicHealthScore < 40) {
          alerts.push({
            id: 'economic-concern',
            type: 'warning',
            title: 'Economic Performance Below Target',
            message: 'GDP per capita growth has slowed significantly',
            urgent: economicHealthScore < 25,
          });
        }

        if (popGrowthRate < 0) {
          alerts.push({
            id: 'population-decline',
            type: 'error',
            title: 'Population Decline Detected',
            message: 'Negative population growth may impact long-term sustainability',
            urgent: true,
          });
        }

        return {
          economic: {
            healthScore: Math.round(economicHealthScore),
            gdpPerCapita: currentStats.newStats.currentGdpPerCapita,
            growthRate: currentStats.newStats.adjustedGdpGrowth * 100,
            economicTier: currentStats.newStats.economicTier,
            alerts: alerts.filter(a => a.id.includes('economic')),
          },
          population: {
            healthScore: Math.round(populationHealthScore),
            population: currentStats.newStats.currentPopulation,
            growthRate: popGrowthRate * 100,
            populationTier: currentStats.newStats.populationTier,
            alerts: alerts.filter(a => a.id.includes('population')),
          },
          diplomatic: {
            healthScore: Math.round(diplomaticHealthScore),
            allies: Math.floor(((country as any).globalDiplomaticInfluence || 50) / 10) + 3,
            reputation: diplomaticHealthScore > 75 ? 'Strong' : diplomaticHealthScore > 50 ? 'Stable' : 'Improving',
            treaties: Math.floor(((country as any).tradeRelationshipStrength || 25) / 2) + 5,
            alerts: [],
          },
          government: {
            healthScore: Math.round(govEfficiency),
            approval: Math.round(Math.min(95, Math.max(25, 
              50 + (currentStats.newStats.adjustedGdpGrowth * 1500) + 
              (economicHealthScore - 50) / 2
            ))),
            efficiency: govEfficiency > 80 ? 'Excellent' : govEfficiency > 60 ? 'Good' : 'Improving',
            stability: diplomaticHealthScore > 70 && govEfficiency > 60 ? 'Stable' : 'Monitored',
            alerts: [],
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate focus cards data:", error);
        throw new Error("Failed to generate focus cards data");
      }
    }),

  getActivityRingsData: publicProcedure
    .input(z.object({
      countryId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        // Use stored vitality scores from database, with live calculation fallback
        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        
        // Calculate live vitality scores if database values are not set
        const calculateEconomicVitality = () => {
          const gdpScore = Math.min(100, (currentStats.newStats.currentGdpPerCapita / 50000) * 100);
          const growthBonus = Math.min(20, Math.max(-20, currentStats.newStats.adjustedGdpGrowth * 400));
          return Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));
        };
        
        const calculatePopulationWellbeing = () => {
          const growthHealth = popGrowthRate > 0 ? 70 : 40;
          const densityFactor = country.populationDensity
            ? Math.max(50, 100 - (country.populationDensity / 500))
            : 60;
          return (growthHealth + densityFactor) / 2;
        };
        
        const calculateDiplomaticStanding = () => {
          return Math.min(100, Math.max(40, 
            ((country as any).globalDiplomaticInfluence || 50) + 
            ((country as any).tradeRelationshipStrength || 10) + 
            ((country as any).allianceStrength || 15) - 
            ((country as any).diplomaticTensions || 5)
          ));
        };
        
        const calculateGovernmentalEfficiency = () => {
          const economicTierScore = {
            "Extravagant": 95,
            "Very Strong": 85,
            "Strong": 75,
            "Healthy": 65,
            "Developed": 50,
            "Developing": 35,
            "Impoverished": 25,
          }[currentStats.newStats.economicTier] || 25;
          return economicTierScore * 0.8;
        };
        
        // Always calculate live - use database values only if they exist and are reasonable
        const economicVitality = (country.economicVitality && country.economicVitality > 5)
          ? country.economicVitality
          : calculateEconomicVitality();
          
        const populationWellbeing = (country.populationWellbeing && country.populationWellbeing > 5)
          ? country.populationWellbeing
          : calculatePopulationWellbeing();
          
        const diplomaticStanding = (country.diplomaticStanding && country.diplomaticStanding > 5)
          ? country.diplomaticStanding
          : calculateDiplomaticStanding();
          
        const governmentalEfficiency = (country.governmentalEfficiency && country.governmentalEfficiency > 5)
          ? country.governmentalEfficiency
          : calculateGovernmentalEfficiency();

        console.log(`[getFocusCardsData] Country: ${country.name}, GDP: ${currentStats.newStats.currentGdpPerCapita}, Economic: ${Math.round(economicVitality)}, Pop: ${Math.round(populationWellbeing)}, Diplo: ${Math.round(diplomaticStanding)}, Gov: ${Math.round(governmentalEfficiency)}`);

        return {
          economicVitality: Math.round(economicVitality),
          populationWellbeing: Math.round(populationWellbeing),
          diplomaticStanding: Math.round(diplomaticStanding),
          governmentalEfficiency: Math.round(governmentalEfficiency),
          economicMetrics: {
            gdpPerCapita: `$${currentStats.newStats.currentGdpPerCapita.toLocaleString()}`,
            growthRate: `${(currentStats.newStats.adjustedGdpGrowth * 100).toFixed(1)}%`,
            tier: currentStats.newStats.economicTier,
          },
          populationMetrics: {
            population: `${(currentStats.newStats.currentPopulation / 1000000).toFixed(1)}M`,
            growthRate: `${(popGrowthRate * 100).toFixed(2)}%`,
            tier: currentStats.newStats.populationTier,
          },
          diplomaticMetrics: {
            allies: `${Math.floor(((country as any).globalDiplomaticInfluence || 50) / 10) + 3}`,
            reputation: diplomaticStanding > 75 ? 'Strong' : diplomaticStanding > 50 ? 'Stable' : 'Developing',
            treaties: `${Math.floor(((country as any).tradeRelationshipStrength || 25) / 2) + 5}`,
          },
          governmentMetrics: {
            approval: `${Math.round(Math.min(95, Math.max(25, 50 + (currentStats.newStats.adjustedGdpGrowth * 1500))))}%`,
            efficiency: governmentalEfficiency > 80 ? 'Excellent' : governmentalEfficiency > 60 ? 'Good' : 'Improving',
            stability: diplomaticStanding > 70 && governmentalEfficiency > 60 ? 'Stable' : 'Monitored',
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate activity rings data:", error);
        throw new Error("Failed to generate activity rings data");
      }
    }),

  getNotifications: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(20),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
              take: 10,
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const notifications: any[] = [];

        const econCfg = getDefaultEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        let notificationId = 1;

        const gdpGrowth = currentStats.newStats.adjustedGdpGrowth * 100;
        if (gdpGrowth < 0) {
          notifications.push({
            id: `notif-${notificationId++}`,
            type: 'economic',
            priority: gdpGrowth < -3 ? 'critical' : 'high',
            title: 'Economic Growth Concern',
            message: `GDP growth has turned negative at ${gdpGrowth.toFixed(1)}%`,
            timestamp: currentTime,
            category: 'Economic Intelligence',
            actionRequired: true,
            relatedData: {
              currentGdpPerCapita: currentStats.newStats.currentGdpPerCapita,
              growthRate: gdpGrowth,
            },
          });
        } else if (gdpGrowth > 5) {
          notifications.push({
            id: `notif-${notificationId++}`,
            type: 'economic',
            priority: 'medium',
            title: 'Strong Economic Performance',
            message: `GDP growth accelerated to ${gdpGrowth.toFixed(1)}%`,
            timestamp: currentTime,
            category: 'Economic Intelligence',
            actionRequired: false,
            relatedData: {
              currentGdpPerCapita: currentStats.newStats.currentGdpPerCapita,
              growthRate: gdpGrowth,
            },
          });
        }

        const popGrowth = (currentStats.newStats.populationGrowthRate || 0) * 100;
        if (popGrowth < 0) {
          notifications.push({
            id: `notif-${notificationId++}`,
            type: 'demographic',
            priority: 'high',
            title: 'Population Decline Alert',
            message: `Population declining at ${Math.abs(popGrowth).toFixed(2)}% annually`,
            timestamp: currentTime,
            category: 'Demographic Intelligence',
            actionRequired: true,
            relatedData: {
              currentPopulation: currentStats.newStats.currentPopulation,
              growthRate: popGrowth,
            },
          });
        }

        if (country.dmInputs.length > 0) {
          const recentInput = country.dmInputs[0];
          if(recentInput){
            const inputAge = currentTime - recentInput.ixTimeTimestamp.getTime();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            
            if (inputAge < oneWeek) {
              notifications.push({
                id: `notif-${notificationId++}`,
                type: 'external',
                priority: Math.abs(recentInput.value) > 0.1 ? 'high' : 'medium',
                title: 'External Influence Detected',
                message: `${recentInput.inputType}: ${recentInput.description}`,
                timestamp: recentInput.ixTimeTimestamp.getTime(),
                category: 'External Intelligence',
                actionRequired: Math.abs(recentInput.value) > 0.1,
                relatedData: {
                  inputType: recentInput.inputType,
                  value: recentInput.value,
                  description: recentInput.description,
                },
              });
            }
          }
        }

        const tierThresholds = econCfg.economicTierThresholds;
        const currentGdpPc = currentStats.newStats.currentGdpPerCapita;
        const currentTier = currentStats.newStats.economicTier;
        
        const tierEntries = Object.entries(tierThresholds).sort(([,a], [,b]) => a - b);
        const currentTierIndex = tierEntries.findIndex(([tier]) => tier.toLowerCase().replace(' ', '') === (currentTier as string).toLowerCase().replace(' ', ''));
        
        if (currentTierIndex !== -1 && currentTierIndex < tierEntries.length - 1) {
          const nextTierThreshold = tierEntries[currentTierIndex + 1]![1];
          const progressToNext = (currentGdpPc / nextTierThreshold) * 100;
          
          if (progressToNext > 90) {
            notifications.push({
              id: `notif-${notificationId++}`,
              type: 'milestone',
              priority: 'medium',
              title: 'Economic Tier Advancement Imminent',
              message: `${progressToNext.toFixed(1)}% progress toward ${tierEntries[currentTierIndex + 1]![0]} tier`,
              timestamp: currentTime,
              category: 'Economic Intelligence',
              actionRequired: false,
              relatedData: {
                currentTier,
                nextTier: tierEntries[currentTierIndex + 1]![0],
                progress: progressToNext,
              },
            });
          }
        }

        let filteredNotifications = notifications;
        if (input.priority) {
          filteredNotifications = notifications.filter(n => n.priority === input.priority);
        }

        const priorityOrder: { [key: string]: number } = { critical: 4, high: 3, medium: 2, low: 1 };
        filteredNotifications.sort((a, b) => {
          const priorityA = priorityOrder[a.priority];
          const priorityB = priorityOrder[b.priority];
          if (priorityB && priorityA) {
            const priorityDiff = priorityB - priorityA;
            if (priorityDiff !== 0) return priorityDiff;
          }
          return b.timestamp - a.timestamp;
        });

        return {
          countryId: input.countryId,
          notifications: filteredNotifications.slice(0, input.limit),
          total: filteredNotifications.length,
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate notifications:", error);
        throw new Error("Failed to generate notifications");
      }
    }),

  triggerEconomicNarrative: publicProcedure
    .mutation(async () => {
      const { detectEconomicMilestoneAndTriggerNarrative } = await import("~/lib/auto-post-service");
      await detectEconomicMilestoneAndTriggerNarrative();
      return { success: true, message: "Economic narrative triggered" };
    }),

  getDiplomaticRelations: publicProcedure
    .input(z.object({
      countryId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const whereClause = input.countryId 
        ? {
            OR: [
              { country1: input.countryId },
              { country2: input.countryId }
            ]
          }
        : {};

      const relations = await ctx.db.diplomaticRelation.findMany({
        where: whereClause,
        orderBy: { lastContact: 'desc' },
      });

      return relations.map((relation) => ({
        id: relation.id,
        country1: relation.country1,
        country2: relation.country2,
        relationship: relation.relationship,
        strength: relation.strength,
        treaties: relation.treaties ? JSON.parse(relation.treaties) : [],
        lastContact: relation.lastContact,
        status: relation.status,
        diplomaticChannels: relation.diplomaticChannels ? JSON.parse(relation.diplomaticChannels) : [],
        tradeVolume: undefined,
        culturalExchange: undefined
      }));
    }),

  // Get economic milestones for a country
  getEconomicMilestones: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(10)
    }))
    .query(async ({ ctx, input }) => {
      // For now, return mock milestones based on country's economic performance
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId }
      });

      if (!country) return [];

      // Generate realistic milestones based on economic data
      const milestones = [];
      
      if (country.adjustedGdpGrowth > 0.03) {
        milestones.push({
          id: `milestone_${country.id}_gdp_growth`,
          title: "Strong Economic Growth",
          description: `GDP growth of ${(country.adjustedGdpGrowth * 100).toFixed(1)}% achieved`,
          value: country.adjustedGdpGrowth,
          category: "economic_growth",
          achievedAt: new Date(Date.now() - (country.adjustedGdpGrowth > 0.05 ? 3 : 7) * 24 * 60 * 60 * 1000).toISOString()
        });
      }

      if (country.currentPopulation > country.baselinePopulation * 1.05) {
        milestones.push({
          id: `milestone_${country.id}_population`,
          title: "Population Growth",
          description: "Significant population increase recorded",
          value: (country.currentPopulation - country.baselinePopulation) / country.baselinePopulation,
          category: "population",
          achievedAt: new Date(Date.now() - (country.populationGrowthRate > 0.02 ? 15 : 30) * 24 * 60 * 60 * 1000).toISOString()
        });
      }

      return milestones.slice(0, input.limit);
    }),

  // Get crisis events for a country
  getCrisisEvents: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(5)
    }))
    .query(async ({ ctx, input }) => {
      const crises = await ctx.db.crisisEvent.findMany({
        where: {
          affectedCountries: {
            contains: input.countryId
          }
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit
      });

      return crises;
    }),

  // Get trade data for a country
  getTradeData: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId }
      });

      if (!country) {
        throw new Error("Country not found");
      }

      // Calculate trade data based on country economic indicators
      const gdpBase = country.currentTotalGdp || 1000000000;
      const tradeIntensity = ((country as any).tradeRelationshipStrength || 25) / 100;
      
      const totalVolume = gdpBase * 0.6 * tradeIntensity; // Trade typically 60% of GDP * relationship strength
      const exports = totalVolume * 0.52; // Slightly export-oriented
      const imports = totalVolume * 0.48;
      const tradeBalance = exports - imports;
      
      return {
        totalVolume,
        exports,
        imports,
        tradeBalance,
        topPartners: [
          { country: "Major Trade Partner", volume: totalVolume * 0.25 },
          { country: "Regional Partner", volume: totalVolume * 0.18 },
          { country: "Economic Ally", volume: totalVolume * 0.12 }
        ]
      };
    }),

  // ============ ATOMIC COMPONENTS INTEGRATION ENDPOINTS ============

  // Get country with atomic enhancement
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { name: input.name },
        include: {
          governmentComponents: {
            where: { isActive: true }
          },
          componentSynergies: {
            include: {
              primaryComponent: true,
              secondaryComponent: true
            }
          },
          atomicEffectiveness: true
        }
      }) as CountryWithAtomicComponents | null;
      
      if (!country) return null;
      
      // Calculate with atomic enhancements
      const enhancedData = await calculateCountryDataWithAtomicEnhancement(country);
      
      return {
        ...country,
        atomicEnhancements: enhancedData.economicImpactFromAtomic,
        enhancedGdpGrowth: enhancedData.enhancedGdpGrowth,
        enhancedTaxRevenue: enhancedData.enhancedTaxRevenue,
        stabilityIndex: enhancedData.stabilityIndex,
        governmentCapacityIndex: enhancedData.governmentCapacityIndex,
        atomicModifiers: enhancedData.atomicModifiers
      };
    }),

  // Get countries filtered by atomic components
  getByAtomicComponents: publicProcedure
    .input(z.object({
      componentTypes: z.array(z.nativeEnum(ComponentType)),
      requireAll: z.boolean().default(false) // true = AND, false = OR
    }))
    .query(async ({ ctx, input }) => {
      let countries;
      
      if (input.requireAll) {
        // For AND logic, we need to check that all components exist
        countries = await ctx.db.country.findMany({
          include: {
            governmentComponents: {
              where: { isActive: true }
            }
          }
        });
        
        // Filter for countries that have ALL required components
        countries = countries.filter(country => 
          input.componentTypes.every(componentType =>
            country.governmentComponents.some(comp => 
              comp.componentType === componentType && comp.isActive
            )
          )
        );
      } else {
        // For OR logic, use Prisma's some query
        countries = await ctx.db.country.findMany({
          where: {
            governmentComponents: {
              some: {
                componentType: { in: input.componentTypes },
                isActive: true
              }
            }
          },
          include: {
            governmentComponents: {
              where: { isActive: true }
            }
          }
        });
      }
      
      return countries;
    }),

  // Get atomic effectiveness for a country
  getAtomicEffectiveness: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const atomicService = getAtomicEffectivenessService(ctx.db);
      return atomicService.getCountryEffectiveness(input.countryId);
    }),

  // Get atomic intelligence recommendations
  getAtomicIntelligenceRecommendations: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getAtomicIntelligenceRecommendations(input.countryId);
    }),

  // Get component effectiveness breakdown
  getComponentEffectivenessBreakdown: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        include: {
          governmentComponents: { where: { isActive: true } }
        }
      });
      
      if (!country) return null;
      
      const atomicService = getAtomicEffectivenessService(ctx.db);
      const componentTypes = country.governmentComponents.map(c => c.componentType);
      const breakdown = atomicService.getComponentBreakdown(componentTypes);
      
      const synergies = atomicService.detectPotentialSynergies(componentTypes);
      const conflicts = atomicService.detectConflicts(componentTypes);
      
      return {
        components: breakdown,
        synergies,
        conflicts,
        totalComponents: componentTypes.length,
        synergyCount: synergies.length,
        conflictCount: conflicts.length
      };
    }),

  // Toggle atomic government mode for a country
  toggleAtomicGovernment: protectedProcedure
    .input(z.object({ 
      countryId: z.string(),
      useAtomic: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.country.update({
        where: { id: input.countryId },
        data: { usesAtomicGovernment: input.useAtomic }
      });
      
      // Invalidate cache for this country
      const atomicService = getAtomicEffectivenessService(ctx.db);
      atomicService.invalidateCache(input.countryId);
      
      return updated;
    }),

  // Recalculate atomic effectiveness (admin function)
  recalculateAtomicEffectiveness: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const atomicService = getAtomicEffectivenessService(ctx.db);

      // Force recalculation by bypassing cache
      const effectiveness = await atomicService.calculateEffectiveness(input.countryId);

      return effectiveness;
    }),

  // Get custom geography (continents and regions)
  getCustomGeography: publicProcedure
    .query(async ({ ctx }) => {
      // For now, return empty custom geography
      // In the future, this could fetch from a CustomGeography table
      return {
        continents: [] as string[],
        regions: {} as Record<string, string[]>
      };
    }),

  // Add custom continent
  addContinent: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // For now, just return success
      // In the future, this could store in a CustomGeography table
      return { success: true, name: input.name };
    }),

  // Add custom region to a continent
  addRegion: protectedProcedure
    .input(z.object({
      continent: z.string(),
      region: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // For now, just return success
      // In the future, this could store in a CustomGeography table
      return { success: true, continent: input.continent, region: input.region };
    }),

  // Create a new country from builder
  createCountry: protectedProcedure
    .input(z.object({
      name: z.string(),
      foundationCountry: z.string().nullable(),
      economicInputs: z.any(), // Economic data from builder
      governmentComponents: z.array(z.any()).optional(),
      taxSystemData: z.any().optional(),
      governmentStructure: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get user ID from context
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Check if user already has a country (via User.countryId relation)
      const userWithCountry = await ctx.db.user.findUnique({
        where: { id: userId },
        include: { country: true }
      });

      if (userWithCountry?.country) {
        // Return the existing country instead of throwing an error
        return userWithCountry.country;
      }

      // Get foundation country data if provided
      let foundationData: any = null;
      if (input.foundationCountry) {
        const foundationCountry = await ctx.db.country.findFirst({
          where: {
            OR: [
              { slug: input.foundationCountry },
              { name: input.foundationCountry }
            ]
          }
        });
        if (foundationCountry) {
          foundationData = {
            baselinePopulation: foundationCountry.baselinePopulation,
            baselineGdpPerCapita: foundationCountry.baselineGdpPerCapita,
            continent: foundationCountry.continent,
            region: foundationCountry.region,
            landArea: foundationCountry.landArea,
            areaSqMi: foundationCountry.areaSqMi,
            flag: foundationCountry.flag,
            coatOfArms: foundationCountry.coatOfArms,
          };
        }
      }

      // Extract economic inputs with proper nested structure access
      const econ = input.economicInputs || {};
      const coreIndicators = econ.coreIndicators || {};
      const laborEmployment = econ.laborEmployment || {};
      const fiscalSystem = econ.fiscalSystem || {};
      const demographics = econ.demographics || {};
      const incomeWealth = econ.incomeWealth || {};
      const governmentSpending = econ.governmentSpending || {};
      const nationalIdentity = econ.nationalIdentity || {};
      const geography = econ.geography || {};
      
      // Calculate derived values
      const population = coreIndicators.totalPopulation || foundationData?.baselinePopulation || 10000000;
      const gdpPerCapita = coreIndicators.gdpPerCapita || foundationData?.baselineGdpPerCapita || 25000;
      const nominalGDP = coreIndicators.nominalGDP || (population * gdpPerCapita);
      const totalGdp = population * gdpPerCapita;

      // Create unique slug for the country
      const slug = input.name
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Use transaction to create country and related records atomically
      const result = await ctx.db.$transaction(async (tx) => {
        // Create the country with ALL fields from builder
        const country = await tx.country.create({
          data: {
            name: input.name,
            slug: slug,
            continent: geography.continent || foundationData?.continent || "Unknown",
            region: geography.region || foundationData?.region || "Unknown",
            governmentType: nationalIdentity.governmentType || input.governmentStructure?.governmentType || "Republic",
            religion: nationalIdentity.nationalReligion || "Secular",
            leader: nationalIdentity.leader || "Unknown",
            flag: econ.flagUrl || foundationData?.flag || undefined,
            coatOfArms: econ.coatOfArmsUrl || foundationData?.coatOfArms || undefined,
            landArea: foundationData?.landArea || 100000,
            areaSqMi: foundationData?.areaSqMi || 38610,
            
            // Baseline values (initial snapshot)
            baselinePopulation: population,
            baselineGdpPerCapita: gdpPerCapita,
            baselineDate: new Date(),
            
            // Current values (same as baseline at creation)
            currentPopulation: population,
            currentGdpPerCapita: gdpPerCapita,
            currentTotalGdp: totalGdp,
            
            // Growth rates
            maxGdpGrowthRate: 0.05,
            adjustedGdpGrowth: coreIndicators.realGDPGrowthRate || 0.03,
            populationGrowthRate: demographics.populationGrowthRate || 0.01,
            actualGdpGrowth: coreIndicators.realGDPGrowthRate || 0.03,
            localGrowthFactor: 1.0,
            
            // Tiers
            economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
            populationTier: getPopulationTierFromPopulation(population),
            
            // Core Economic Indicators
            nominalGDP: nominalGDP,
            realGDPGrowthRate: coreIndicators.realGDPGrowthRate || 3.0,
            inflationRate: coreIndicators.inflationRate || 2.0,
            currencyExchangeRate: coreIndicators.currencyExchangeRate || 1.0,
            
            // Labor & Employment
            laborForceParticipationRate: laborEmployment.laborForceParticipationRate || 65,
            employmentRate: laborEmployment.employmentRate || 95,
            unemploymentRate: laborEmployment.unemploymentRate || 5,
            totalWorkforce: laborEmployment.totalWorkforce || Math.round(population * 0.65),
            averageWorkweekHours: laborEmployment.averageWorkweekHours || 40,
            minimumWage: laborEmployment.minimumWage || Math.round(gdpPerCapita * 0.02),
            averageAnnualIncome: laborEmployment.averageAnnualIncome || Math.round(gdpPerCapita * 0.8),
            
            // Fiscal System
            taxRevenueGDPPercent: fiscalSystem.taxRevenueGDPPercent || input.taxSystemData?.totalTaxRate || 20,
            governmentRevenueTotal: fiscalSystem.governmentRevenueTotal || (nominalGDP * 0.20),
            taxRevenuePerCapita: fiscalSystem.taxRevenuePerCapita || ((nominalGDP * 0.20) / population),
            governmentBudgetGDPPercent: fiscalSystem.governmentBudgetGDPPercent || 22,
            budgetDeficitSurplus: fiscalSystem.budgetDeficitSurplus || 0,
            internalDebtGDPPercent: fiscalSystem.internalDebtGDPPercent || 45,
            externalDebtGDPPercent: fiscalSystem.externalDebtGDPPercent || 25,
            totalDebtGDPRatio: fiscalSystem.totalDebtGDPRatio || 70,
            debtPerCapita: fiscalSystem.debtPerCapita || ((nominalGDP * 0.70) / population),
            interestRates: fiscalSystem.interestRates || 3.5,
            debtServiceCosts: fiscalSystem.debtServiceCosts || (nominalGDP * 0.70 * 0.035),
            
            // Income & Wealth
            povertyRate: incomeWealth.povertyRate || 15,
            incomeInequalityGini: incomeWealth.incomeInequalityGini || 0.38,
            socialMobilityIndex: incomeWealth.socialMobilityIndex || 60,
            
            // Government Spending
            totalGovernmentSpending: governmentSpending.totalSpending || (nominalGDP * 0.22),
            spendingGDPPercent: governmentSpending.spendingGDPPercent || 22,
            spendingPerCapita: governmentSpending.spendingPerCapita || ((nominalGDP * 0.22) / population),
            
            // Demographics
            lifeExpectancy: demographics.lifeExpectancy || 78.5,
            urbanPopulationPercent: demographics.urbanRuralSplit?.urban || 65,
            ruralPopulationPercent: demographics.urbanRuralSplit?.rural || 35,
            literacyRate: demographics.literacyRate || 95,
            
            // Calculate density if we have land area
            populationDensity: foundationData?.landArea ? population / foundationData.landArea : undefined,
            gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,
            
            lastCalculated: new Date(),
          }
        });

        // Create National Identity record if provided
        if (nationalIdentity && Object.keys(nationalIdentity).length > 0) {
          await tx.nationalIdentity.create({
            data: {
              countryId: country.id,
              countryName: nationalIdentity.countryName || input.name,
              officialName: nationalIdentity.officialName,
              governmentType: nationalIdentity.governmentType,
              motto: nationalIdentity.motto,
              mottoNative: nationalIdentity.mottoNative,
              capitalCity: nationalIdentity.capitalCity,
              largestCity: nationalIdentity.largestCity,
              demonym: nationalIdentity.demonym,
              currency: nationalIdentity.currency,
              currencySymbol: nationalIdentity.currencySymbol,
              officialLanguages: nationalIdentity.officialLanguages,
              nationalLanguage: nationalIdentity.nationalLanguage,
              nationalAnthem: nationalIdentity.nationalAnthem,
              nationalDay: nationalIdentity.nationalDay,
              callingCode: nationalIdentity.callingCode,
              internetTLD: nationalIdentity.internetTLD,
              drivingSide: nationalIdentity.drivingSide,
              timeZone: nationalIdentity.timeZone,
              isoCode: nationalIdentity.isoCode,
              coordinatesLatitude: nationalIdentity.coordinatesLatitude,
              coordinatesLongitude: nationalIdentity.coordinatesLongitude,
              emergencyNumber: nationalIdentity.emergencyNumber,
              postalCodeFormat: nationalIdentity.postalCodeFormat,
              nationalSport: nationalIdentity.nationalSport,
              weekStartDay: nationalIdentity.weekStartDay,
            }
          });
        }

        // Create Demographics record
        if (demographics && Object.keys(demographics).length > 0) {
          await tx.demographics.create({
            data: {
              countryId: country.id,
              ageDistribution: JSON.stringify(demographics.ageDistribution || []),
              educationLevels: JSON.stringify(demographics.educationLevels || []),
              birthRate: demographics.birthRate,
              deathRate: demographics.deathRate,
              migrationRate: demographics.migrationRate,
              dependencyRatio: demographics.dependencyRatio,
              medianAge: demographics.medianAge,
              populationGrowthProjection: demographics.populationGrowthRate,
            }
          });
        }

        // Create Fiscal System record (separate from Country table fields)
        if (fiscalSystem && Object.keys(fiscalSystem).length > 0) {
          await tx.fiscalSystem.create({
            data: {
              countryId: country.id,
              personalIncomeTaxRates: fiscalSystem.personalIncomeTaxRates,
              corporateTaxRates: fiscalSystem.corporateTaxRates,
              salesTaxRate: fiscalSystem.salesTaxRate,
              propertyTaxRate: fiscalSystem.propertyTaxRate,
              payrollTaxRate: fiscalSystem.payrollTaxRate,
              exciseTaxRates: fiscalSystem.exciseTaxRates,
              wealthTaxRate: fiscalSystem.wealthTaxRate,
              spendingByCategory: fiscalSystem.spendingByCategory,
              fiscalBalanceGDPPercent: fiscalSystem.fiscalBalanceGDPPercent,
              primaryBalanceGDPPercent: fiscalSystem.primaryBalanceGDPPercent,
              taxEfficiency: fiscalSystem.taxEfficiency,
            }
          });
        }

        // Create Labor Market record
        if (laborEmployment && Object.keys(laborEmployment).length > 0) {
          await tx.laborMarket.create({
            data: {
              countryId: country.id,
              employmentBySector: laborEmployment.employmentBySector,
              youthUnemploymentRate: laborEmployment.youthUnemploymentRate,
              femaleParticipationRate: laborEmployment.femaleParticipationRate,
              informalEmploymentRate: laborEmployment.informalEmploymentRate,
              medianWage: laborEmployment.medianWage,
              wageGrowthRate: laborEmployment.wageGrowthRate,
              wageBySector: laborEmployment.wageBySector,
            }
          });
        }

        // Create Income Distribution record
        if (incomeWealth && Object.keys(incomeWealth).length > 0) {
          await tx.incomeDistribution.create({
            data: {
              countryId: country.id,
              economicClasses: JSON.stringify(incomeWealth.economicClasses || []),
              top10PercentWealth: incomeWealth.top10PercentWealth,
              bottom50PercentWealth: incomeWealth.bottom50PercentWealth,
              middleClassPercent: incomeWealth.middleClassPercent,
              intergenerationalMobility: incomeWealth.intergenerationalMobility,
              educationMobility: incomeWealth.educationMobility,
            }
          });
        }

        // Create Government Budget record
        if (governmentSpending && Object.keys(governmentSpending).length > 0) {
          await tx.governmentBudget.create({
            data: {
              countryId: country.id,
              spendingCategories: JSON.stringify(governmentSpending.spendingCategories || []),
              spendingEfficiency: governmentSpending.spendingEfficiency,
              publicInvestmentRate: governmentSpending.publicInvestmentRate,
              socialSpendingPercent: governmentSpending.socialSpendingPercent,
            }
          });
        }

        // Create initial historical data point
        await tx.historicalDataPoint.create({
          data: {
            countryId: country.id,
            ixTimeTimestamp: new Date(),
            population: population,
            gdpPerCapita: gdpPerCapita,
            totalGdp: totalGdp,
            populationGrowthRate: demographics.populationGrowthRate || 0.5,
            gdpGrowthRate: coreIndicators.realGDPGrowthRate || 3.0,
            landArea: foundationData?.landArea || 100000,
            populationDensity: foundationData?.landArea ? population / foundationData.landArea : undefined,
            gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,
          }
        });

        // Link user to country
        await tx.user.update({
          where: { clerkUserId: userId },
          data: { countryId: country.id },
        });

        return country;
      });

      console.log(`✅ Country created successfully: ${result.name} (ID: ${result.id})`);
      return result;
    }),
});

export { countriesRouter };
