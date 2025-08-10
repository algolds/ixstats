// src/server/api/routers/countries.ts
// FIXED: Complete countries router with proper functionality and optimizations

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig, CONFIG_CONSTANTS } from "~/lib/config-service";
import { parseRosterFile } from "~/lib/data-parser";
import { IxStatsCalculator } from "~/lib/calculations";
import type { 
  SystemStatus, 
  AdminPageBotStatusView, 
  ImportAnalysis,
  BaseCountryData,
  CalculationLog,
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
  TierChangeProjection
} from "~/types/ixstats";
import { getEconomicTierFromGdpPerCapita } from "~/types/ixstats";

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
const getEconomicConfig = (): EconomicConfig => ({
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    impoverished: 0,
    developing: 10000,
    developed: 25000,
    healthy: 35000,
    strong: 45000,
    veryStrong: 55000,
    extravagant: 65000,
  },
  populationTierThresholds: {
    tier1: 0,
    tier2: 10_000_000,
    tier3: 30_000_000,
    tier4: 50_000_000,
    tier5: 80_000_000,
    tier6: 120_000_000,
    tier7: 350_000_000,
    tierX: 500_000_000,
  },
  tierGrowthModifiers: {
    "Impoverished": 1.0,
    "Developing": 1.0,
    "Developed": 1.0,
    "Healthy": 1.0,
    "Strong": 1.0,
    "Very Strong": 1.0,
    "Extravagant": 1.0,
  },
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
});

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

// Helper to extract userId from headers (adjust as needed for your auth system)
function getUserIdFromCtx(ctx: { headers: Headers }) {
  // Try common header names (adjust for your auth system)
  const header = ctx.headers.get?.('x-user-id') || (ctx.headers as any)['x-user-id'];
  return header || null;
}

function toCountryWithEconomicData(raw: any): CountryWithEconomicData {
  return {
    id: raw.id,
    name: raw.name,
    continent: raw.continent ?? null,
    region: raw.region ?? null,
    governmentType: raw.governmentType ?? null,
    religion: raw.religion ?? null,
    leader: raw.leader ?? null,
    areaSqMi: raw.areaSqMi ?? null,
    baselinePopulation: raw.baselinePopulation ?? 0,
    baselineGdpPerCapita: raw.baselineGdpPerCapita ?? 0,
    maxGdpGrowthRate: raw.maxGdpGrowthRate ?? 0,
    adjustedGdpGrowth: raw.adjustedGdpGrowth ?? 0,
    populationGrowthRate: raw.populationGrowthRate ?? 0,
    landArea: raw.landArea ?? null,
    currentPopulation: raw.currentPopulation ?? 0,
    currentGdpPerCapita: raw.currentGdpPerCapita ?? 0,
    currentTotalGdp: raw.currentTotalGdp ?? 0,
    populationDensity: raw.populationDensity ?? null,
    gdpDensity: raw.gdpDensity ?? null,
    lastCalculated: raw.lastCalculated ?? new Date(),
    baselineDate: raw.baselineDate ?? new Date(),
    economicTier: raw.economicTier ?? "Unknown",
    populationTier: raw.populationTier ?? "Unknown",
    localGrowthFactor: raw.localGrowthFactor ?? 1,
    createdAt: raw.createdAt ?? new Date(),
    updatedAt: raw.updatedAt ?? new Date(),
    calculatedStats: raw.calculatedStats as CalculatedStats ?? { gdpGrowth: 0, populationGrowth: 0, inflation: 0 },
    projections: Array.isArray(raw.projections) ? raw.projections as Projection[] : [],
    historical: Array.isArray(raw.historical) ? raw.historical as HistoricalData[] : [],
    dmInputs: Array.isArray(raw.dmInputs) ? raw.dmInputs as DMInput[] : [],
    nominalGDP: raw.nominalGDP ?? 0,
    realGDPGrowthRate: raw.realGDPGrowthRate ?? 0,
    inflationRate: raw.inflationRate ?? 0,
    currencyExchangeRate: raw.currencyExchangeRate ?? 1,
    laborForceParticipationRate: raw.laborForceParticipationRate ?? 0,
    employmentRate: raw.employmentRate ?? 0,
    unemploymentRate: raw.unemploymentRate ?? 0,
    totalWorkforce: raw.totalWorkforce ?? 0,
    averageWorkweekHours: raw.averageWorkweekHours ?? 0,
    minimumWage: raw.minimumWage ?? 0,
    averageAnnualIncome: raw.averageAnnualIncome ?? 0,
    governmentRevenueTotal: raw.governmentRevenueTotal ?? null,
    taxRevenueGDPPercent: raw.taxRevenueGDPPercent ?? 0,
    taxRevenuePerCapita: raw.taxRevenuePerCapita ?? 0,
    governmentBudgetGDPPercent: raw.governmentBudgetGDPPercent ?? 0,
    budgetDeficitSurplus: raw.budgetDeficitSurplus ?? 0,
    internalDebtGDPPercent: raw.internalDebtGDPPercent ?? 0,
    externalDebtGDPPercent: raw.externalDebtGDPPercent ?? 0,
    totalDebtGDPRatio: raw.totalDebtGDPRatio ?? 0,
    debtPerCapita: raw.debtPerCapita ?? 0,
    interestRates: raw.interestRates ?? 0,
    debtServiceCosts: raw.debtServiceCosts ?? 0,
    totalGovernmentSpending: raw.totalGovernmentSpending ?? 0,
    spendingGDPPercent: raw.spendingGDPPercent ?? 0,
    spendingPerCapita: raw.spendingPerCapita ?? 0,
    lifeExpectancy: raw.lifeExpectancy ?? 0,
    urbanPopulationPercent: raw.urbanPopulationPercent ?? null,
    ruralPopulationPercent: raw.ruralPopulationPercent ?? null,
    literacyRate: raw.literacyRate ?? 0,
    economicProfile: raw.economicProfile as EconomicProfile ?? undefined,
    laborMarket: raw.laborMarket as LaborMarket ?? undefined,
    fiscalSystem: raw.fiscalSystem as FiscalSystem ?? undefined,
    incomeDistribution: raw.incomeDistribution as IncomeDistribution ?? undefined,
    governmentBudget: raw.governmentBudget as GovernmentBudget ?? undefined,
    demographics: raw.demographics as Demographics ?? undefined,
    analytics: {
      growthTrends: {
        avgPopGrowth: raw.analytics?.growthTrends?.avgPopGrowth ?? 0,
        avgGdpGrowth: raw.analytics?.growthTrends?.avgGdpGrowth ?? 0,
      },
      volatility: {
        popVolatility: raw.analytics?.volatility?.popVolatility ?? 0,
        gdpVolatility: raw.analytics?.volatility?.gdpVolatility ?? 0,
      },
      riskFlags: Array.isArray(raw.analytics?.riskFlags) ? raw.analytics.riskFlags : [],
      tierChangeProjection: raw.analytics?.tierChangeProjection as TierChangeProjection ?? { year: 0, newTier: "Unknown" },
      vulnerabilities: Array.isArray(raw.analytics?.vulnerabilities) ? raw.analytics.vulnerabilities : [],
    },
  };
}

// Helper to convert CountryStats to CalculatedStats
function toCalculatedStats(stats: any): CalculatedStats {
  return {
    gdpGrowth: stats?.gdpGrowth ?? 0,
    populationGrowth: stats?.populationGrowth ?? 0,
    inflation: stats?.inflation ?? 0,
  };
}

// Helper to convert raw projections to Projection[]
function toProjections(arr: any[]): Projection[] {
  return arr.map((item) => ({
    year: item.year ?? 0,
    gdp: item.gdp ?? 0,
    population: item.population ?? 0,
  }));
}

// Helper to convert raw historical data to HistoricalData[]
function toHistorical(arr: any[]): HistoricalData[] {
  return arr.map((item) => ({
    year: item.year ?? 0,
    gdp: item.gdp ?? 0,
    population: item.population ?? 0,
  }));
}

// Helper to convert raw tierChangeProjection
function toTierChangeProjection(obj: any): TierChangeProjection {
  if (!obj) return { year: 0, newTier: "Unknown" };
  return {
    year: obj.year ?? 0,
    newTier: obj.newTier ?? "Unknown",
  };
}

export const countriesRouter = createTRPCRouter({
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

      // Map raw database results to CountryWithEconomicData
      const countries: CountryWithEconomicData[] = rawCountries.map((country): CountryWithEconomicData => ({
        ...country,
        // Convert null to undefined for optional fields
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
        dmInputs: country.dmInputs.map((dm: any) => ({
          id: dm.id,
          countryId: dm.countryId,
          inputType: dm.inputType,
          value: dm.value,
          description: dm.description,
          timestamp: dm.ixTimeTimestamp,
        })),
        nominalGDP: country.baselinePopulation * country.baselineGdpPerCapita,
        realGDPGrowthRate: country.adjustedGdpGrowth || 0.03,
        inflationRate: 0.02,
        currencyExchangeRate: 1.0,
        // Provide default values for all optional economic fields
        laborForceParticipationRate: undefined,
        employmentRate: undefined,
        unemploymentRate: undefined,
        totalWorkforce: undefined,
        averageWorkweekHours: undefined,
        minimumWage: undefined,
        averageAnnualIncome: undefined,
        governmentRevenueTotal: undefined,
        taxRevenueGDPPercent: undefined,
        taxRevenuePerCapita: undefined,
        governmentBudgetGDPPercent: undefined,
        budgetDeficitSurplus: undefined,
        internalDebtGDPPercent: undefined,
        externalDebtGDPPercent: undefined,
        totalDebtGDPRatio: undefined,
        debtPerCapita: undefined,
        interestRates: undefined,
        debtServiceCosts: undefined,
        totalGovernmentSpending: undefined,
        spendingGDPPercent: undefined,
        spendingPerCapita: undefined,
        lifeExpectancy: undefined,
        urbanPopulationPercent: undefined,
        ruralPopulationPercent: undefined,
        literacyRate: undefined,
        economicProfile: undefined,
        laborMarket: undefined,
        fiscalSystem: undefined,
        incomeDistribution: undefined,
        governmentBudget: undefined,
        demographics: undefined,
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

  // FIXED: Get country by ID with enhanced economic data and safe relation handling
  getByIdWithEconomicData: publicProcedure
    .input(z.object({
      id: z.string(),
      timestamp: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
      
      // Simplified include object - only include basic relations
      const includeObject: any = {
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
      };
      
      // Try to include optional relations, but don't fail if they don't exist
      try {
        includeObject.economicProfile = true;
        includeObject.laborMarket = true;
        includeObject.fiscalSystem = true;
        includeObject.incomeDistribution = true;
        includeObject.governmentBudget = true;
        includeObject.demographics = true;
      } catch (e) {
        console.warn('[Countries API] Some relations may not be available:', e);
      }
      let country;
      try {
        country = await ctx.db.country.findUnique({
          where: { id: input.id },
          include: includeObject,
        });
      } catch (dbError) {
        console.warn('[Countries API] Error with complex query, falling back to basic query:', dbError);
        // Fallback to basic query without optional relations
        country = await ctx.db.country.findUnique({
          where: { id: input.id },
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
      }
      
      if (!country) {
        throw new Error(`Country with ID ${input.id} not found`);
      }
      // Calculate current stats
      const econCfg = getEconomicConfig();
      const baselineDate = country.baselineDate.getTime();
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
      // Projections: next 5 years (yearly)
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
      // Historical data: last 5 years (yearly)
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
      // If not enough historical points, recalculate
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
      // --- Advanced Analytics ---
      // Calculate growth trends and volatility from historical data
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
      const popGrowthRates = getGrowthRates(historical, 'currentPopulation');
      const gdpGrowthRates = getGrowthRates(historical, 'currentGdpPerCapita');
      const avgPopGrowth = popGrowthRates.length ? popGrowthRates.reduce((a, b) => a + b, 0) / popGrowthRates.length : 0;
      const avgGdpGrowth = gdpGrowthRates.length ? gdpGrowthRates.reduce((a, b) => a + b, 0) / gdpGrowthRates.length : 0;
      const popVolatility = stddev(popGrowthRates);
      const gdpVolatility = stddev(gdpGrowthRates);
      // Risk flags
      const riskFlags = [];
      if (avgPopGrowth < 0) riskFlags.push('negative_population_growth');
      if (avgGdpGrowth < 0) riskFlags.push('negative_gdp_per_capita_growth');
      if (popVolatility > 0.05) riskFlags.push('high_population_volatility');
      if (gdpVolatility > 0.05) riskFlags.push('high_gdp_per_capita_volatility');
      // Tier change projection (estimate years to next tier)
      let tierChangeProjection = null;
      const currentGDPPC = result.newStats.currentGdpPerCapita;
      const projectionsGDPPC = projections.map(p => p.stats.currentGdpPerCapita);
      const tierThresholds = Object.values(econCfg.economicTierThresholds).sort((a, b) => a - b);
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
      // Vulnerabilities
      const vulnerabilities = [];
      if (avgPopGrowth < 0.002) vulnerabilities.push('low_population_growth');
      if (avgGdpGrowth < 0.01) vulnerabilities.push('low_gdp_per_capita_growth');
      if (popVolatility > 0.05) vulnerabilities.push('population_volatility');
      if (gdpVolatility > 0.05) vulnerabilities.push('gdp_per_capita_volatility');
      if (riskFlags.includes('negative_population_growth')) vulnerabilities.push('population_decline');
      if (riskFlags.includes('negative_gdp_per_capita_growth')) vulnerabilities.push('gdp_per_capita_decline');
      // Add analytics to response
      const response: CountryWithEconomicData = {
        ...country,
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
        historical: historical.map(h => ({
          year: new Date(h.ixTimeTimestamp).getFullYear(), 
          gdp: h.totalGdp,
          population: h.population,
        })),
        dmInputs: (country.dmInputs as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime()
        })),
        // economicModel, // <-- removed advanced modeling
        // FIXED: Provide fallback values for expected economic fields
        nominalGDP: country.nominalGDP || (country.baselinePopulation * country.baselineGdpPerCapita),
        realGDPGrowthRate: country.realGDPGrowthRate || country.adjustedGdpGrowth || 0.03,
        inflationRate: country.inflationRate || 0.02,
        currencyExchangeRate: country.currencyExchangeRate || 1.0,
        laborForceParticipationRate: country.laborForceParticipationRate || 65,
        employmentRate: country.employmentRate || 95,
        unemploymentRate: country.unemploymentRate || 5,
        totalWorkforce: country.totalWorkforce || Math.round(country.baselinePopulation * 0.65),
        averageWorkweekHours: country.averageWorkweekHours || 40,
        minimumWage: country.minimumWage || 12,
        averageAnnualIncome: country.averageAnnualIncome || 35000,
        // Handle nullable fields properly
        governmentRevenueTotal: country.governmentRevenueTotal ?? null,
        taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? 20,
        taxRevenuePerCapita: country.taxRevenuePerCapita ?? 0,
        governmentBudgetGDPPercent: country.governmentBudgetGDPPercent ?? 22,
        budgetDeficitSurplus: country.budgetDeficitSurplus ?? 0,
        internalDebtGDPPercent: country.internalDebtGDPPercent ?? 30,
        externalDebtGDPPercent: country.externalDebtGDPPercent ?? 20,
        totalDebtGDPRatio: country.totalDebtGDPRatio ?? 50,
        debtPerCapita: country.debtPerCapita ?? 0,
        interestRates: country.interestRates ?? 0.03,
        debtServiceCosts: country.debtServiceCosts ?? 0,
        totalGovernmentSpending: country.totalGovernmentSpending ?? 0,
        spendingGDPPercent: country.spendingGDPPercent ?? 22,
        spendingPerCapita: country.spendingPerCapita ?? 0,
        lifeExpectancy: country.lifeExpectancy ?? 75,
        urbanPopulationPercent: country.urbanPopulationPercent ?? 70,
        ruralPopulationPercent: country.ruralPopulationPercent ?? 30,
        literacyRate: country.literacyRate ?? 90,
        economicProfile: (country as any).economicProfile || null,
        laborMarket: (country as any).laborMarket || null,
        fiscalSystem: (country as any).fiscalSystem || null,
        incomeDistribution: (country as any).incomeDistribution || null,
        governmentBudget: (country as any).governmentBudget || null,
        demographics: (country as any).demographics || null,
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
          tierChangeProjection: tierChangeProjection || { year: new Date().getFullYear(), newTier: country.economicTier },
          vulnerabilities,
        },
        lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : (country.lastCalculated ? new Date(country.lastCalculated).getTime() : Date.now()),
      };
      return response;
    }),

  // FIXED: Update country economic data with graceful handling
  updateEconomicData: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      economicData: economicDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, economicData } = input;

      // --- ENFORCE: Only the country owner can update economic data ---
      if (!ctx.userId) {
        throw new Error('Not authenticated');
      }
      
      // Check if user owns this country
      const userProfile = await ctx.db.user.findUnique({ 
        where: { clerkId: ctx.userId } 
      });
      
      if (!userProfile || userProfile.countryId !== countryId) {
        throw new Error('You do not have permission to edit this country.');
      }

      try {
        // Update basic economic fields on country
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

        // Filter out undefined values
        const filteredBasicFields = Object.fromEntries(
          Object.entries(basicFields).filter(([_, value]) => value !== undefined)
        );

        // Update country with basic fields
        const updatedCountry = await ctx.db.country.update({
          where: { id: countryId },
          data: filteredBasicFields,
        });

        // --- ADVANCED MODELING: Upsert EconomicModel, SectoralOutputs, PolicyEffects ---
        // if (economicData.economicModel) {
        //   // Upsert EconomicModel
        //   const model = await ctx.db.economicModel.upsert({
        //     where: { countryId },
        //     update: {
        //       baseYear: economicData.economicModel.baseYear,
        //       projectionYears: economicData.economicModel.projectionYears,
        //       gdpGrowthRate: economicData.economicModel.gdpGrowthRate,
        //       inflationRate: economicData.economicModel.inflationRate,
        //       unemploymentRate: economicData.economicModel.unemploymentRate,
        //       interestRate: economicData.economicModel.interestRate,
        //       exchangeRate: economicData.economicModel.exchangeRate,
        //       populationGrowthRate: economicData.economicModel.populationGrowthRate,
        //       investmentRate: economicData.economicModel.investmentRate,
        //       fiscalBalance: economicData.economicModel.fiscalBalance,
        //       tradeBalance: economicData.economicModel.tradeBalance,
        //     },
        //     create: {
        //       countryId,
        //       baseYear: economicData.economicModel.baseYear,
        //       projectionYears: economicData.economicModel.projectionYears,
        //       gdpGrowthRate: economicData.economicModel.gdpGrowthRate,
        //       inflationRate: economicData.economicModel.inflationRate,
        //       unemploymentRate: economicData.economicModel.unemploymentRate,
        //       interestRate: economicData.economicModel.interestRate,
        //       exchangeRate: economicData.economicModel.exchangeRate,
        //       populationGrowthRate: economicData.economicModel.populationGrowthRate,
        //       investmentRate: economicData.economicModel.investmentRate,
        //       fiscalBalance: economicData.economicModel.fiscalBalance,
        //       tradeBalance: economicData.economicModel.tradeBalance,
        //     },
        //   });

        //   // Replace all SectoralOutputs
        //   if (economicData.economicModel.sectoralOutputs) {
        //     await ctx.db.sectoralOutput.deleteMany({ where: { economicModelId: model.id } });
        //     for (const s of economicData.economicModel.sectoralOutputs) {
        //       await ctx.db.sectoralOutput.create({
        //         data: {
        //           economicModelId: model.id,
        //           year: s.year,
        //           agriculture: s.agriculture,
        //           industry: s.industry,
        //           services: s.services,
        //           government: s.government,
        //           totalGDP: s.totalGDP,
        //         },
        //       });
        //     }
        //   }

        //   // Replace all PolicyEffects
        //   if (economicData.economicModel.policyEffects) {
        //     await ctx.db.policyEffect.deleteMany({ where: { economicModelId: model.id } });
        //     for (const p of economicData.economicModel.policyEffects) {
        //       await ctx.db.policyEffect.create({
        //         data: {
        //           economicModelId: model.id,
        //           name: p.name,
        //           description: p.description,
        //           gdpEffectPercentage: p.gdpEffectPercentage,
        //           inflationEffectPercentage: p.inflationEffectPercentage,
        //           employmentEffectPercentage: p.employmentEffectPercentage,
        //           yearImplemented: p.yearImplemented,
        //           durationYears: p.durationYears,
        //         },
        //       });
        //     }
        //   }
        // }

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

  // FIXED: Get country by ID at time with proper validation
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
        calculatedStats = {
          country: countryFromDb.name,
          continent: countryFromDb.continent,
          region: countryFromDb.region,
          governmentType: countryFromDb.governmentType,
          religion: countryFromDb.religion,
          leader: countryFromDb.leader,
          population: countryFromDb.baselinePopulation,
          gdpPerCapita: countryFromDb.baselineGdpPerCapita,
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
          globalGrowthFactor: getEconomicConfig().globalGrowthFactor,
        };
      } else {
        const econCfg = getEconomicConfig();
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
      };
    }),

  // Rest of the endpoints remain the same but with FIXED error handling...
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

      const econCfg = getEconomicConfig();
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

  // Continue with other existing endpoints...
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

      const econCfg = getEconomicConfig();
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

  // Additional endpoints continued...
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
      
      const econCfg = getEconomicConfig();
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
      
      // Check cache first
      const cacheKey = getCacheKey('globalStats', { timestamp: targetTime });
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // Use optimized database query with aggregation
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
      
      const totalPopulation = validateNumber(stats.totalPopulation || 0, 1e11);
      const totalGdp = validateNumber(stats.totalGdp || 0, 1e18);
      const totalLand = stats.totalLand || 0;
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

      const response = {
        totalPopulation,
        totalGdp,
        averageGdpPerCapita: avgGdpPc,
        averagePopulation: totalCountries > 0 ? totalPopulation / totalCountries : 0,
        totalCountries,
        economicTierDistribution,
        populationTierDistribution,
        averagePopulationDensity: avgPopD || null,
        averageGdpDensity: avgGdpD || null,
        globalGrowthRate: getEconomicConfig().globalGrowthFactor,
        ixTimeTimestamp: targetTime,
      };

      // Cache the result for 30 seconds
      setCachedData(cacheKey, response, 30000);

      return response;
    }),

  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = getEconomicConfig();
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

        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
            currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            economicTier: res.newStats.economicTier.toString(),
            populationTier: res.newStats.populationTier.toString(),
            populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
            gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
            adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            lastCalculated: new Date(now),
          },
        });

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

      // Bulk update logic for all countries
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

      for (const c of all) {
        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (c.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime()
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, dmInputs);
        
        const updateData = {
          currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          economicTier: res.newStats.economicTier.toString(),
          populationTier: res.newStats.populationTier.toString(),
          populationDensity: res.newStats.populationDensity ? validateNumber(res.newStats.populationDensity, 1e7) : null,
          gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
          adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          lastCalculated: new Date(now),
        };
        
        const updated = await ctx.db.country.update({
          where: { id: c.id },
          data: updateData
        });
        results.push(updated);
        
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

  // DM Input Management
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

  addDmInput: publicProcedure
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
            createdBy: "admin", // TODO: Get from auth context
          },
        });

        return dmInput;
      } catch (error) {
        console.error("Failed to add DM input:", error);
        throw new Error("Failed to add DM input");
      }
    }),

  updateDmInput: publicProcedure
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

  deleteDmInput: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Soft delete by setting isActive to false
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

  // Update country name
  updateCountryName: publicProcedure
    .input(z.object({
      countryId: z.string(),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
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

  // Get recent historical data for trend analysis
  getHistoricalData: publicProcedure
    .input(z.object({
      countryId: z.string(),
      limit: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const now = IxTime.getCurrentIxTime();
        const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months ago
        
        // First try to get existing historical data
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

        // If we have enough data, return it
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

        // If not enough data, calculate historical points
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

        const econCfg = getEconomicConfig();
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

  // Get top countries by GDP per capita for comparison
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

        // Cache for 5 minutes
        cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl: 5 * 60 * 1000 });
        return result;
      } catch (error) {
        console.error("Failed to get top countries by GDP per capita:", error);
        throw new Error("Failed to retrieve top countries data");
      }
    }),

  // Get top countries by population for comparison
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

        // Cache for 5 minutes
        cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl: 5 * 60 * 1000 });
        return result;
      } catch (error) {
        console.error("Failed to get top countries by population:", error);
        throw new Error("Failed to retrieve top countries population data");
      }
    }),

  // Get economic data for a country - simplified endpoint for modals
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

        // Calculate current stats for consistent data
        const econCfg = getEconomicConfig();
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

        // Cache for 1 minute since this is current economic data
        setCachedData(cacheKey, economicData, 60000);
        return economicData;
      } catch (error) {
        console.error("Failed to get economic data:", error);
        throw new Error("Failed to retrieve economic data");
      }
    }),

  // Search wiki for countries
  searchWiki: publicProcedure
    .input(z.object({
      query: z.string(),
      site: z.enum(['ixwiki', 'iiwiki']),
      categoryFilter: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { searchWiki } = await import("~/lib/wiki-search-service");
        return await searchWiki(input.query, input.site, input.categoryFilter);
      } catch (error) {
        console.error("Wiki search failed:", error);
        throw new Error("Failed to search wiki");
      }
    }),

  // Parse country infobox from wiki
  parseInfobox: publicProcedure
    .input(z.object({
      pageName: z.string(),
      site: z.enum(['ixwiki', 'iiwiki']),
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

  // === INTELLIGENCE SYSTEM ENDPOINTS ===

  // Get intelligence briefings for a country
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

        // Get recent historical data for analysis
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

        // Calculate current stats
        const econCfg = getEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        // Generate intelligence briefings
        const briefings = [];

        // Calculate GDP change for risk assessment
        let gdpChange = 0;
        if (recentData.length >= 2) {
          const latestGdp = recentData[0]?.gdpPerCapita || currentStats.newStats.currentGdpPerCapita;
          const previousGdp = recentData[recentData.length - 1]?.gdpPerCapita || country.baselineGdpPerCapita;
          gdpChange = ((latestGdp - previousGdp) / previousGdp) * 100;
          
          // Economic Intelligence
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
          // Use current growth rate as fallback
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

        // Population Intelligence
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

        // Risk Assessment
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

  // Get focus cards data for intelligence dashboard
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

        // Calculate current stats
        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = getEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        // Generate economic health score (0-100)
        const economicHealthScore = Math.min(100, Math.max(0, 
          (currentStats.newStats.currentGdpPerCapita / 50000) * 100
        ));

        // Generate population health score
        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        const populationHealthScore = Math.min(100, Math.max(0,
          50 + (popGrowthRate * 1000) // Convert to 0-100 scale
        ));

        // Generate diplomatic health score (placeholder - could be enhanced with actual diplomatic data)
        const diplomaticHealthScore = Math.min(100, Math.max(20,
          60 + Math.random() * 40 // Placeholder calculation
        ));

        // Generate government health score
        const govEfficiency = Math.min(100, Math.max(30,
          70 + (currentStats.newStats.adjustedGdpGrowth * 500)
        ));

        // Generate alerts based on country data
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
            allies: Math.floor(Math.random() * 15) + 5, // Placeholder
            reputation: 'Stable', // Placeholder
            treaties: Math.floor(Math.random() * 20) + 10, // Placeholder
            alerts: [],
          },
          government: {
            healthScore: Math.round(govEfficiency),
            approval: Math.round(60 + Math.random() * 30), // Placeholder
            efficiency: 'Good', // Placeholder
            stability: 'Stable', // Placeholder
            alerts: [],
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate focus cards data:", error);
        throw new Error("Failed to generate focus cards data");
      }
    }),

  // Get activity rings data for intelligence dashboard
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

        // Calculate current stats
        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = getEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        // Calculate vitality scores
        const economicVitality = Math.min(100, Math.max(0, 
          (currentStats.newStats.currentGdpPerCapita / 50000) * 100
        ));

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        const populationWellbeing = Math.min(100, Math.max(0,
          50 + (popGrowthRate * 1000)
        ));

        const diplomaticStanding = Math.min(100, Math.max(20,
          60 + Math.random() * 40 // Placeholder
        ));

        const governmentalEfficiency = Math.min(100, Math.max(30,
          70 + (currentStats.newStats.adjustedGdpGrowth * 500)
        ));

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
            allies: `${Math.floor(Math.random() * 15) + 5}`, // Placeholder
            reputation: 'Stable', // Placeholder
            treaties: `${Math.floor(Math.random() * 20) + 10}`, // Placeholder
          },
          governmentMetrics: {
            approval: `${Math.round(60 + Math.random() * 30)}%`, // Placeholder
            efficiency: 'Good', // Placeholder
            stability: 'Stable', // Placeholder
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate activity rings data:", error);
        throw new Error("Failed to generate activity rings data");
      }
    }),

  // Get notifications for a country's intelligence system
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
        const notifications = [];

        // Calculate current stats for analysis
        const econCfg = getEconomicConfig();
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const dmInputs = (country.dmInputs as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, dmInputs);

        // Generate notifications based on country data
        let notificationId = 1;

        // Economic notifications
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

        // Population notifications
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

        // DM Input notifications (recent external influences)
        if (country.dmInputs.length > 0) {
          const recentInput = country.dmInputs[0];
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

        // Economic tier changes
        const tierThresholds = econCfg.economicTierThresholds;
        const currentGdpPc = currentStats.newStats.currentGdpPerCapita;
        const currentTier = currentStats.newStats.economicTier;
        
        // Check if close to tier change
        const tierEntries = Object.entries(tierThresholds).sort(([,a], [,b]) => a - b);
        const currentTierIndex = tierEntries.findIndex(([tier]) => tier.toLowerCase().replace(' ', '') === currentTier.toLowerCase().replace(' ', ''));
        
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

        // Filter by priority if specified
        let filteredNotifications = notifications;
        if (input.priority) {
          filteredNotifications = notifications.filter(n => n.priority === input.priority);
        }

        // Sort by priority and timestamp
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        filteredNotifications.sort((a, b) => {
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
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
});