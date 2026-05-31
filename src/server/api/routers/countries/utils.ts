import { z } from "zod";
import { globalCache } from "~/lib/advanced-cache-system";
import { getArticleIntro } from "~/lib/wiki-bridge";
import type { BaseCountryData } from "~/types/ixstats";

// Cache helpers
export function getCacheKey(operation: string, params: any): string {
  return `countries:${operation}:${JSON.stringify(params)}`;
}

export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  return globalCache.get<T>(key);
}

export async function setCachedData(key: string, data: unknown, ttlMs = 30000): Promise<void> {
  await globalCache.set(key, data, { ttl: Math.round(ttlMs / 1000) });
}

// Validation functions
export const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

export const validateNumber = (value: number | null | undefined, max = 1e18, min = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0;
  return Math.min(Math.max(numValue, min), max);
};

export const prepareBaseCountryData = (country: any): BaseCountryData => ({
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

// Helper function to safely include relations that may not exist
let _cachedRelations: Record<string, boolean> | null = null;

export const safelyIncludeRelations = async (db: any) => {
  if (_cachedRelations !== null) return _cachedRelations;

  const availableRelations: Record<string, boolean> = {};
  const modelNames = [
    "economicProfile",
    "laborMarket",
    "fiscalSystem",
    "incomeDistribution",
    "governmentBudget",
    "demographics",
    "nationalIdentity",
  ];

  for (const name of modelNames) {
    try {
      await (db as any)[name].findFirst({ take: 1 });
      availableRelations[name] = true;
    } catch {
      availableRelations[name] = false;
    }
  }

  _cachedRelations = availableRelations;
  return availableRelations;
};

// Economic data schema with all optional fields
export const economicDataSchema = z.object({
  nominalGDP: z.number().optional(),
  realGDPGrowthRate: z.number().optional(),
  inflationRate: z.number().optional(),
  currencyExchangeRate: z.number().optional(),
  laborForceParticipationRate: z.number().optional(),
  employmentRate: z.number().optional(),
  unemploymentRate: z.number().optional(),
  totalWorkforce: z.number().optional(),
  averageWorkweekHours: z.number().optional(),
  minimumWage: z.number().optional(),
  averageAnnualIncome: z.number().optional(),
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
  povertyRate: z.number().optional(),
  incomeInequalityGini: z.number().optional(),
  socialMobilityIndex: z.number().optional(),
  totalGovernmentSpending: z.number().optional(),
  spendingGDPPercent: z.number().optional(),
  spendingPerCapita: z.number().optional(),
  lifeExpectancy: z.number().optional(),
  urbanPopulationPercent: z.number().optional(),
  ruralPopulationPercent: z.number().optional(),
  literacyRate: z.number().optional(),
});

/** Fetch a single wiki intro from ixwiki or iiwiki fallback. */
export async function fetchWikiIntro(
  name: string
): Promise<{ extract: string; wikiSource: "ixwiki" | "iiwiki"; wikiUrl: string } | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    const result = await getArticleIntro(name, wiki);
    if (result?.text) {
      return {
        extract: result.text,
        wikiSource: wiki,
        wikiUrl:
          wiki === "ixwiki"
            ? `https://ixwiki.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`
            : `https://iiwiki.us/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`,
      };
    }
  }
  return null;
}

export function getGrowthRates(arr: any[], key: string): number[] {
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

export function stddev(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
}
