// src/server/api/routers/countries.ts
// FIXED: Complete countries router with proper functionality and optimizations

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  executiveProcedure,
  countryOwnerProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
  // Cached procedures for high-traffic endpoints
  cachedPublicProcedure,
  cachedStaticProcedure,
} from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig, getEconomicConfigFromDB } from "~/lib/config-service";
import { IxStatsCalculator } from "~/lib/calculations";
import {
  calculateCountryDataWithAtomicEnhancement,
  getAtomicIntelligenceRecommendations,
} from "~/lib/atomic-economic-integration.server";
import { type CountryWithAtomicComponents } from "~/lib/atomic-economic-integration";
import { getAtomicEffectivenessService } from "~/services/AtomicEffectivenessService";
import { ComponentType } from "@prisma/client";
import { calculateAllVitalityScores } from "~/lib/vitality-calculator";
import { notificationAPI } from "~/lib/notification-api";
import {
  getArticleIntro,
  getPageSections,
  getArticleWikitext,
  getPageImages as wikiBridgePageImages,
  searchPages as wikiBridgeSearch,
  getInfobox as wikiBridgeInfobox,
} from "~/lib/wiki-bridge";
import { checkComponentSynergy } from "~/lib/government-synergy";
import type {
  CoreEconomicIndicators,
  LaborEmploymentData,
  FiscalSystemData,
  DemographicData,
  IncomeWealthData,
  GovernmentSpendingData,
  NationalIdentityData,
  GeographyData,
} from "~/app/builder/lib/economy-data-service";
import type {
  CountryStats,
  CountryWithEconomicData,
  BaseCountryData,
  EconomicTier,
} from "~/types/ixstats";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { ActivityGenerator } from "~/lib/activity-generator";
import { achievementService } from "~/lib/achievement-service";
import { globalCache } from "~/lib/advanced-cache-system";

// Cache helpers using consolidated globalCache (eliminates per-router Map + setInterval)
function getCacheKey(operation: string, params: any): string {
  return `countries:${operation}:${JSON.stringify(params)}`;
}

async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  return globalCache.get<T>(key);
}

async function setCachedData(key: string, data: unknown, ttlMs = 30000): Promise<void> {
  await globalCache.set(key, data, { ttl: Math.round(ttlMs / 1000), skipRedis: true });
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

// Helper function to safely include relations that may not exist
// Cached at module scope since schema doesn't change at runtime
let _cachedRelations: Record<string, boolean> | null = null;

const safelyIncludeRelations = async (db: any) => {
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

import { normalizeFlagUrl } from "~/lib/unified-flag-service";

/**
 * Wiki helpers — all use WikiBridge (direct MySQL for ixwiki, HTTP for iiwiki).
 */

/** Fetch a single wiki intro from ixwiki or iiwiki fallback. */
async function fetchWikiIntro(
  name: string
): Promise<{ extract: string; wikiSource: "ixwiki" | "iiwiki"; wikiUrl: string } | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    const result = await getArticleIntro(name, wiki);
    if (result?.text) {
      const base = wiki === "ixwiki" ? "https://ixwiki.com" : "https://iiwiki.com";
      return {
        extract: result.text.substring(0, 400),
        wikiSource: wiki,
        wikiUrl: `${base}/wiki/${encodeURIComponent(result.title)}`,
      };
    }
  }
  return null;
}

/** Fetch table-of-contents sections from a country's wiki page. */
async function fetchWikiSections(
  name: string
): Promise<Array<{ level: number; line: string; number: string; anchor: string }> | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    const sections = await getPageSections(name, wiki);
    if (sections.length > 0) {
      return sections.map((s, i) => ({
        level: s.level,
        line: s.title,
        number: String(i + 1),
        anchor: s.title.replace(/\s+/g, "_"),
      }));
    }
  }
  return null;
}

/** Common icon/template image filenames to exclude from media galleries. */
const EXCLUDED_IMAGE_PATTERNS = [
  /^File:Flag.icon/i, /^File:Crystal/i, /^File:Nuvola/i,
  /^File:Commons-logo/i, /^File:Wikisource-logo/i, /^File:Wiktionary-logo/i,
  /^File:Symbol /i, /^File:Yes ?check/i, /^File:X ?mark/i,
  /^File:Increase/i, /^File:Decrease/i, /^File:Steady/i,
  /^File:Green ?arrow/i, /^File:Red ?arrow/i, /\.svg$/i,
];

/** Fetch images from a country's wiki page with thumbnail URLs.
 * Delegates to WikiBridge.getPageImages (HTTP API for image metadata). */
async function fetchWikiPageImages(
  name: string
): Promise<Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }> | null> {
  return wikiBridgePageImages(name, { excludePatterns: EXCLUDED_IMAGE_PATTERNS });
}

/**
 * Fetch raw wikitext intro, clean it, and convert wiki markup to HTML paragraphs.
 * This moves the 80-line regex chain from useCountryPageState.ts to the server.
 */
async function fetchWikiRichIntro(
  name: string
): Promise<{ paragraphs: string[]; wikiUrl: string } | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    try {
      const article = await getArticleWikitext(name, wiki);
      if (!article) continue;

      const base = wiki === "ixwiki" ? "https://ixwiki.com" : "https://iiwiki.com";
      const wikitext = article.wikitext;
      const wikiUrl = `${base}/wiki/${encodeURIComponent(article.title)}`;

      // Strip infobox template (match balanced braces)
      let contentAfterInfobox = wikitext;
      const infoboxMatch = wikitext.match(/\{\{\s*Infobox/i);
      if (infoboxMatch) {
        const startIdx = wikitext.indexOf(infoboxMatch[0]);
        let depth = 0;
        let i = startIdx;
        while (i < wikitext.length - 1) {
          if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i += 2; }
          else if (wikitext[i] === "}" && wikitext[i + 1] === "}") { depth--; i += 2; if (depth === 0) break; }
          else { i++; }
        }
        contentAfterInfobox = wikitext.substring(i).trim();
      }

      // Take content before first heading (==)
      const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

      // Clean wikitext templates, refs, categories, files
      const cleanContent = beforeFirstHeading
        .replace(/\{\{wp\|[^|}]+\|([^}]+)\}\}/g, "$1")
        .replace(/\{\{wp\|([^}]+)\}\}/g, "$1")
        .replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/g, "$1")
        .replace(/\{\{nowrap\|([^}]+)\}\}/g, "$1")
        .replace(/\{\{convert[^}]*\}\}/gi, "")
        .replace(/\{\{[^}]+\|([^|}]+)\}\}/g, "$1")
        .replace(/\{\{[^}]+\}\}/g, "")
        .replace(/\[\[Template:[^\]]*\]\]/gi, "")
        .replace(/\[\[Category:[^\]]*\]\]/gi, "")
        .replace(/\[\[File:[^\]]*\]\]/gi, "")
        .replace(/\[\[Image:[^\]]*\]\]/gi, "")
        .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, "")
        .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
        .replace(/<ref[^>]*\/>/gi, "")
        .replace(/<!--.*?-->/gs, "")
        .replace(/\{\|.*?\|\}/gs, "")
        .replace(/__[A-Z_]+__/g, "")
        .replace(/\n\n+/g, "|||PARA|||")
        .replace(/[ \t]+/g, " ")
        .replace(/\n/g, " ")
        .trim();

      // Convert wiki links to HTML
      const linkBase = base;
      const processedContent = cleanContent
        .replace(/\[\[([^\[\]|]+)\|([^\[\]]+?)\]\]/g, (_, pg: string, display: string) => {
          if (pg.toLowerCase().includes("template:")) return "";
          return `<a href="${linkBase}/wiki/${encodeURIComponent(pg)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
        })
        .replace(/\[\[([^\[\]]+?)\]\]/g, (_, pg: string) => {
          if (pg.toLowerCase().includes("template:")) return "";
          return `<a href="${linkBase}/wiki/${encodeURIComponent(pg)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${pg}</a>`;
        })
        .replace(
          /\[([^\s\]]+)\s+([^\]]+)\]/g,
          '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>'
        )
        .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
        .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

      // Split into paragraphs, filter short/empty
      const paragraphs = processedContent
        .split("|||PARA|||")
        .map((p) => p.trim())
        .filter((p) => p.length > 50)
        .slice(0, 5);

      if (paragraphs.length > 0) {
        return { paragraphs, wikiUrl };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetch wiki infobox server-side via WikiBridge (direct MySQL, ~2ms).
 */
async function fetchWikiInfoboxCached(name: string): Promise<Record<string, unknown> | null> {
  try {
    const infobox = await wikiBridgeInfobox(name, "ixwiki") ?? await wikiBridgeInfobox(name, "iiwiki");
    if (!infobox) return null;
    const result: Record<string, unknown> = { templateName: infobox.templateName };
    for (const field of infobox.fields) {
      result[field.key] = field.value;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch wiki sections with plain-text previews for level-2 headers.
 * Used by the map info panel for richer section display.
 */
async function fetchWikiSectionPreviews(
  name: string
): Promise<Array<{ level: number; line: string; number: string; anchor: string; preview?: string }> | null> {
  const sections = await fetchWikiSections(name);
  if (!sections || sections.length === 0) return null;

  // Get full wikitext to extract section previews from it directly (single MySQL query)
  const article = await getArticleWikitext(name, "ixwiki") ?? await getArticleWikitext(name, "iiwiki");
  if (!article) return sections.map((s) => ({ ...s, preview: undefined as string | undefined }));

  const wikitext = article.wikitext;
  const results = sections.map((s) => ({ ...s, preview: undefined as string | undefined }));
  const level2Indices = results
    .map((s, i) => (s.level === 2 ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, 10);

  // Extract section content from wikitext by splitting on headings
  const headingPattern = /^(={2,6})\s*(.+?)\s*\1$/gm;
  const headingPositions: Array<{ title: string; start: number }> = [];
  let m;
  while ((m = headingPattern.exec(wikitext)) !== null) {
    headingPositions.push({ title: m[2]!.trim(), start: m.index + m[0].length });
  }

  for (const idx of level2Indices) {
    const section = results[idx]!;
    const hIdx = headingPositions.findIndex((h) => h.title === section.line);
    if (hIdx < 0) continue;

    const start = headingPositions[hIdx]!.start;
    const end = hIdx + 1 < headingPositions.length ? headingPositions[hIdx + 1]!.start - 10 : start + 1000;
    const sectionText = wikitext.substring(start, Math.min(end, start + 1000));

    const cleaned = sectionText
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
      .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/^==+[^=]+=+\s*/gm, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length > 20) {
      section.preview = cleaned.slice(0, 200) + (cleaned.length > 200 ? "..." : "");
    }
  }

  return results;
}

const countriesRouter = createTRPCRouter({
  getSelectList: rateLimitedPublicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().optional().default(500),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = { isDemo: false };
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" as const } },
          { slug: { contains: input.search, mode: "insensitive" as const } },
        ];
      }

      const countries = await ctx.db.country.findMany({
        where,
        take: input?.limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          coatOfArms: true,
          economicTier: true,
        },
      });

      return countries.map((country) => ({
        id: country.id,
        name: country.name,
        slug: country.slug ?? undefined,
        flagUrl: normalizeFlagUrl(country.flag),
        coatOfArmsUrl: country.coatOfArms ?? undefined,
        economicTier: country.economicTier ?? undefined,
      }));
    }),

  // Get all countries with basic info + total count
  // Using cachedPublicProcedure for Redis-backed caching (60s TTL)
  getAll: cachedPublicProcedure
    .input(
      z
        .object({
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
          search: z.string().optional(),
          continent: z.string().optional(),
          economicTier: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isDemo: false };
      if (input?.search) {
        where.name = { contains: input.search, mode: "insensitive" };
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
            nationalIdentity: true,
          },
        }),
        ctx.db.country.count({ where }),
      ]);

      const countries: CountryWithEconomicData[] = rawCountries.map((country: any) => {
        // Extract bounding box coordinates if available
        // boundingBox format: [minLat, minLng, maxLat, maxLng]
        const boundingBox = country.boundingBox as any;
        const bounds = boundingBox && Array.isArray(boundingBox) && boundingBox.length === 4
          ? {
              minLat: boundingBox[0],
              minLng: boundingBox[1],
              maxLat: boundingBox[2],
              maxLng: boundingBox[3],
            }
          : boundingBox?.minLng !== undefined
          ? {
              minLat: boundingBox.minLat,
              minLng: boundingBox.minLng,
              maxLat: boundingBox.maxLat,
              maxLng: boundingBox.maxLng,
            }
          : {};

        // Extract centroid coordinates
        // centroid format: { type: "Point", coordinates: [lng, lat] }
        const centroid = country.centroid as any;
        const centerCoords = centroid?.coordinates && Array.isArray(centroid.coordinates) && centroid.coordinates.length === 2
          ? {
              centerLng: centroid.coordinates[0],
              centerLat: centroid.coordinates[1],
            }
          : {};

        return {
        ...country,
        flagUrl: normalizeFlagUrl(country.flag),
        // Add bounding box coordinates for map search (fallback)
        ...bounds,
        // Add centroid coordinates for map navigation (primary)
        ...centerCoords,
        // Ensure critical fields are properly mapped
        currentPopulation: country.currentPopulation ?? country.baselinePopulation ?? 0,
        currentGdpPerCapita: country.currentGdpPerCapita ?? country.baselineGdpPerCapita ?? 0,
        currentTotalGdp:
          country.currentTotalGdp ??
          (country.currentPopulation ?? 0) * (country.currentGdpPerCapita ?? 0),
        economicTier: country.economicTier ?? "Developing",
        populationTier: country.populationTier ?? "1",
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
        storytellerEffects: country.storytellerEffects
          ? country.storytellerEffects.map((dm: any) => ({
              id: dm.id,
              countryId: dm.countryId,
              inputType: dm.inputType,
              value: dm.value,
              description: dm.description,
              timestamp: dm.ixTimeTimestamp,
            }))
          : [],
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
      };
      });

      return { countries, total };
    }),

  getByIdWithEconomicData: rateLimitedPublicProcedure
    .input(
      z.object({
        id: z.string(),
        timestamp: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

      const availableRelations = await safelyIncludeRelations(ctx.db);

      const includeObject: any = {
        storytellerEffects: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
        users: {
          select: {
            clerkUserId: true,
          },
          take: 1,
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
            OR: [{ id: input.id }, { slug: slugLower }, { name: input.id }],
          },
          include: includeObject,
        });
      } catch (dbError) {
        console.warn(
          "[Countries API] Error with complex query, falling back to basic query:",
          dbError
        );
        const slugLower = input.id.toLowerCase();
        country = await ctx.db.country.findFirst({
          where: {
            OR: [{ id: input.id }, { slug: slugLower }, { name: input.id }],
          },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });
      }

      if (!country) {
        throw new Error(`Country with identifier ${input.id} not found`);
      }

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const baselineDate = country.baselineDate ? country.baselineDate.getTime() : Date.now();

      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);

      const baselineStats = calc.initializeCountryStats(base);

      const effects = (country.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const result = calc.calculateTimeProgression(baselineStats, targetTime, effects);
      const projections = [];
      for (let i = 1; i <= 5; i++) {
        const futureTime = targetTime + i * ONE_YEAR_MS;
        const proj = calc.calculateTimeProgression(baselineStats, futureTime, effects);
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
        take: 1000,
      });
      if (!historical || historical.length < 5) {
        historical = [];
        for (let i = 5; i >= 1; i--) {
          const pastTime = targetTime - i * ONE_YEAR_MS;
          const hist = calc.calculateTimeProgression(baselineStats, pastTime, effects);
          historical.push({
            id: "",
            createdAt: new Date(pastTime),
            countryId: input.id,
            ixTimeTimestamp: new Date(pastTime),
            population: hist.newStats.currentPopulation,
            gdpPerCapita: hist.newStats.currentGdpPerCapita,
            totalGdp: hist.newStats.currentTotalGdp,
            populationGrowthRate: hist.newStats.populationGrowthRate,
            gdpGrowthRate: hist.newStats.adjustedGdpGrowth,
            landArea: typeof hist.newStats.landArea === "number" ? hist.newStats.landArea : null,
            populationDensity:
              typeof hist.newStats.populationDensity === "number"
                ? hist.newStats.populationDensity
                : null,
            gdpDensity:
              typeof hist.newStats.gdpDensity === "number" ? hist.newStats.gdpDensity : null,
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
      const popGrowthRates = getGrowthRates(historical, "population");
      const gdpGrowthRates = getGrowthRates(historical, "gdpPerCapita");
      const avgPopGrowth = popGrowthRates.length
        ? popGrowthRates.reduce((a, b) => a + b, 0) / popGrowthRates.length
        : 0;
      const avgGdpGrowth = gdpGrowthRates.length
        ? gdpGrowthRates.reduce((a, b) => a + b, 0) / gdpGrowthRates.length
        : 0;
      const popVolatility = stddev(popGrowthRates);
      const gdpVolatility = stddev(gdpGrowthRates);
      const riskFlags = [];
      if (avgPopGrowth < 0) riskFlags.push("negative_population_growth");
      if (avgGdpGrowth < 0) riskFlags.push("negative_gdp_per_capita_growth");
      if (popVolatility > 0.05) riskFlags.push("high_population_volatility");
      if (gdpVolatility > 0.05) riskFlags.push("high_gdp_per_capita_volatility");
      let tierChangeProjection = null;
      const currentGDPPC = result.newStats.currentGdpPerCapita;
      const projectionsGDPPC = projections.map((p) => p.stats.currentGdpPerCapita);
      const tierThresholds = Object.values(econCfg.economicTierThresholds)
        .filter((v): v is number => typeof v === "number")
        .sort((a, b) => a - b);
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
            tierChangeProjection = {
              year: new Date().getFullYear() + i + 1,
              newTier: getEconomicTierFromGdpPerCapita(projectionsGDPPC[i]!),
            };
            break;
          }
        }
      }
      const vulnerabilities = [];
      if (avgPopGrowth < 0.002) vulnerabilities.push("low_population_growth");
      if (avgGdpGrowth < 0.01) vulnerabilities.push("low_gdp_per_capita_growth");
      if (popVolatility > 0.05) vulnerabilities.push("population_volatility");
      if (gdpVolatility > 0.05) vulnerabilities.push("gdp_per_capita_volatility");
      if (riskFlags.includes("negative_population_growth"))
        vulnerabilities.push("population_decline");
      if (riskFlags.includes("negative_gdp_per_capita_growth"))
        vulnerabilities.push("gdp_per_capita_decline");
      // CRITICAL FIX: Preserve all database fields, only override calculated population/GDP fields
      // Do NOT spread result.newStats as it wipes out economic indicators!

      const response = {
        ...country, // All database fields including economic indicators
        flagUrl: normalizeFlagUrl(country.flag),

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
        projections: projections.map((p) => ({
          year: new Date(p.ixTime).getFullYear(),
          gdp: p.stats.currentTotalGdp,
          population: p.stats.currentPopulation,
        })),
        historical: historical.map((h: any) => ({
          year: new Date(h.ixTimeTimestamp).getFullYear(),
          gdp: h.totalGdp,
          population: h.population,
        })),
        storytellerEffects: (country.storytellerEffects as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
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
          tierChangeProjection: tierChangeProjection || {
            year: new Date().getFullYear(),
            newTier: country.economicTier as EconomicTier,
          },
          vulnerabilities,
        },
        lastCalculated:
          typeof country.lastCalculated === "number"
            ? country.lastCalculated
            : country.lastCalculated
              ? new Date(country.lastCalculated).getTime()
              : Date.now(),
      };

      // Include owner's clerkUserId for ThinkPages profile integration
      const ownerClerkUserId = (country as any).users?.[0]?.clerkUserId ?? null;

      return {
        ...response,
        ownerClerkUserId,
      } as any;
    }),

  // Lightweight endpoint for basic country data (optimized for map info windows)
  // Client-side usage: api.countries.getByIdBasic.useQuery({ id }, { staleTime: 300000 }) // 5 min cache
  getByIdBasic: rateLimitedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findFirst({
        where: {
          OR: [
            { id: input.id },
            { slug: input.id.toLowerCase() },
            { name: input.id },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          continent: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          landArea: true,
          populationDensity: true,
          geometry: true,
        },
      });

      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country with identifier ${input.id} not found`,
        });
      }

      return {
        id: country.id,
        name: country.name,
        slug: country.slug,
        flagUrl: normalizeFlagUrl(country.flag),
        continent: country.continent,
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        landArea: country.landArea,
        populationDensity: country.populationDensity,
        geometry: country.geometry,
      };
    }),

  // IMPORTANT: This mutation updates ECONOMIC INDICATORS only.
  // It does NOT update currentPopulation, currentGdpPerCapita, or currentTotalGdp.
  // Those fields are calculated and updated by the IxStats calculation engine.
  // The editor should display current* values but only allow editing of indicators.
  updateEconomicData: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        economicData: economicDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, economicData } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      // System owners can edit any country
      if (
        !isSystemOwner(ctx.auth.userId) &&
        (!userProfile || userProfile.countryId !== countryId)
      ) {
        throw new Error("You do not have permission to edit this country.");
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

        // 🏆 Auto-unlock economic achievements (non-blocking)
        if (ctx.auth?.userId && countryId) {
          achievementService
            .checkAndUnlockCategory(ctx.auth.userId, countryId, ctx.db, "Economic")
            .then((unlocked) => {
              if (unlocked.length > 0) {
                console.log(
                  `[Achievements] Unlocked ${unlocked.length} economic achievements:`,
                  unlocked
                );
              }
            })
            .catch((err) => console.error("[Achievements] Auto-unlock failed:", err));
        }

        return {
          success: true,
          message: "Economic data updated successfully",
          country: updatedCountry,
        };
      } catch (error) {
        console.error("[Countries API] Failed to update economic data:", error);
        throw new Error(
          `Failed to update economic data: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // General update mutation for country fields (used by editor)
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string(),
        })
        .passthrough()
    ) // Allow any additional fields
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      // System owners can edit any country
      if (!isSystemOwner(ctx.auth.userId) && (!userProfile || userProfile.countryId !== id)) {
        throw new Error("You do not have permission to edit this country.");
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
        console.error("[Countries API] Failed to update country:", error);
        throw new Error(
          `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  updateNationalIdentity: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...updates } = input;

      if (!ctx.auth?.userId) {
        throw new Error("Not authenticated");
      }

      // Verify user owns this country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      // System owners can edit any country
      if (
        !isSystemOwner(ctx.auth.userId) &&
        (!userProfile || userProfile.countryId !== countryId)
      ) {
        throw new Error("You do not have permission to edit this country.");
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
        console.error("[Countries API] Failed to update national identity:", error);
        throw new Error(
          `Failed to update national identity: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  getByIdAtTime: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        timestamp: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate input - return null for invalid IDs instead of throwing
      if (!input.id || input.id.trim() === "") {
        console.log(`[countries.getByIdAtTime] Invalid or empty ID provided: "${input.id}"`);
        return null;
      }

      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countryFromDb = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          storytellerEffects: {
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
      const isCurrentTime = timeDiff < 5 * 60 * 1000;

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
          population: validateNumber(countryFromDb.currentPopulation, 1e11), // Use current, not baseline
          gdpPerCapita: validateNumber(countryFromDb.currentGdpPerCapita, 1e7, 1), // Use current, not baseline
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
          globalGrowthFactor: (await getEconomicConfigFromDB(ctx.db)).globalGrowthFactor,
        };
      } else {
        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = countryFromDb.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(countryFromDb);
        const initialStats = calc.initializeCountryStats(base);

        const effects = (countryFromDb.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(initialStats, targetTime, effects);

        calculatedStats = {
          ...result.newStats,
          currentPopulation: validateNumber(result.newStats.currentPopulation, 1e11),
          currentGdpPerCapita: validateNumber(result.newStats.currentGdpPerCapita, 1e7, 1),
          currentTotalGdp: validateNumber(result.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: result.newStats.populationDensity
            ? validateNumber(result.newStats.populationDensity, 1e7)
            : null,
          gdpDensity: result.newStats.gdpDensity
            ? validateNumber(result.newStats.gdpDensity, 1e12)
            : null,
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

      // Parse centroid for map navigation (if available)
      let centerLng: number | undefined = undefined;
      let centerLat: number | undefined = undefined;

      if (countryFromDb.centroid) {
        try {
          const centroidData = countryFromDb.centroid as any;
          // Centroid is stored as GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
          if (centroidData.type === "Point" && Array.isArray(centroidData.coordinates) && centroidData.coordinates.length === 2) {
            centerLng = centroidData.coordinates[0];
            centerLat = centroidData.coordinates[1];
          }
        } catch (error) {
          console.error(`[countries.getByIdAtTime] Failed to parse centroid for country ${input.id}:`, error);
        }
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
        storytellerEffects: (countryFromDb.storytellerEffects as any[]).map((dm: any) => ({
          ...dm,
          ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
        })),
        nationalIdentity: countryFromDb.nationalIdentity,
        laborMarket: (countryFromDb as any).laborMarket ?? null,
        economicProfile: (countryFromDb as any).economicProfile ?? null,
        // Map navigation coordinates (extracted from centroid)
        centerLng,
        centerLat,
      };
    }),

  getHistoricalAtTime: publicProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        limit: z.number().optional().default(500),
        interval: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly"),
      })
    )
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
          storytellerEffects: {
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

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const effects = (country.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (
        let t = input.startTime;
        t <= input.endTime && dataPoints.length < input.limit;
        t += intervalMs
      ) {
        const res = calc.calculateTimeProgression(baselineStats, t, effects);
        dataPoints.push({
          ixTimeTimestamp: t,
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: res.newStats.landArea,
          populationDensity: res.newStats.populationDensity
            ? validateNumber(res.newStats.populationDensity, 1e7)
            : null,
          gdpDensity: res.newStats.gdpDensity
            ? validateNumber(res.newStats.gdpDensity, 1e12)
            : null,
        });
      }
      return dataPoints;
    }),

  getForecast: publicProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        points: z.number().optional().default(40),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        include: {
          storytellerEffects: {
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

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const baselineDate = country.baselineDate.getTime();
      const calc = new IxStatsCalculator(econCfg, baselineDate);
      const base = prepareBaseCountryData(country);
      const baselineStats = calc.initializeCountryStats(base);

      const effects = (country.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const dataPoints = [];
      for (let i = 0; i <= input.points; i++) {
        let forecastTime = input.startTime + i * intervalMs;

        if (i === input.points) {
          forecastTime = Math.min(forecastTime, input.endTime);
        }
        if (forecastTime > input.endTime && i < input.points) break;

        const res = calc.calculateTimeProgression(baselineStats, forecastTime, effects);

        dataPoints.push({
          ixTime: forecastTime,
          formattedTime: IxTime.formatIxTime(forecastTime),
          gameYear: IxTime.getCurrentGameYear(forecastTime),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationDensity: res.newStats.populationDensity
            ? validateNumber(res.newStats.populationDensity, 1e7)
            : null,
          gdpDensity: res.newStats.gdpDensity
            ? validateNumber(res.newStats.gdpDensity, 1e12)
            : null,
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
    .input(
      z.object({
        ids: z.array(z.string()),
        timestamp: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const countriesFromDb = await ctx.db.country.findMany({
        where: { id: { in: input.ids } },
        include: {
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
          },
        },
      });

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const results = [];

      for (const country of countriesFromDb) {
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const res = calc.calculateTimeProgression(baselineStats, targetTime, effects);

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
          storytellerEffects: (country.storytellerEffects as any[]).map((dm: any) => ({
            ...dm,
            ixTimeTimestamp: dm.ixTimeTimestamp.getTime(),
          })),
        });
      }
      return results;
    }),

  // Using cachedStaticProcedure for longer cache (1hr TTL) - global stats change slowly
  getGlobalStats: cachedStaticProcedure
    .input(
      z
        .object({
          timestamp: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input?.timestamp ?? IxTime.getCurrentIxTime();

      const cacheKey = getCacheKey("globalStats", { timestamp: targetTime });
      const cached = await getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await ctx.db.$queryRaw`
        SELECT
          COUNT(*) as "totalCountries",
          SUM(COALESCE("currentPopulation", 0)) as "totalPopulation",
          SUM(COALESCE("currentTotalGdp", 0)) as "totalGdp",
          SUM(COALESCE("landArea", 0)) as "totalLand",
          COUNT(CASE WHEN "economicTier" = 'Advanced' THEN 1 END) as "advancedCount",
          COUNT(CASE WHEN "economicTier" = 'Developed' THEN 1 END) as "developedCount",
          COUNT(CASE WHEN "economicTier" = 'Emerging' THEN 1 END) as "emergingCount",
          COUNT(CASE WHEN "economicTier" = 'Developing' THEN 1 END) as "developingCount",
          COUNT(CASE WHEN "economicTier" = 'Impoverished' THEN 1 END) as "impoverishedCount",
          COUNT(CASE WHEN "populationTier" = '1' THEN 1 END) as "popTier1Count",
          COUNT(CASE WHEN "populationTier" = '2' THEN 1 END) as "popTier2Count",
          COUNT(CASE WHEN "populationTier" = '3' THEN 1 END) as "popTier3Count",
          COUNT(CASE WHEN "populationTier" = '4' THEN 1 END) as "popTier4Count",
          COUNT(CASE WHEN "populationTier" = '5' THEN 1 END) as "popTier5Count"
        FROM "public"."Country"
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
        Advanced: Number(stats.advancedCount) || 0,
        Developed: Number(stats.developedCount) || 0,
        Emerging: Number(stats.emergingCount) || 0,
        Developing: Number(stats.developingCount) || 0,
        Impoverished: Number(stats.impoverishedCount) || 0,
      };

      const populationTierDistribution = {
        "1": Number(stats.popTier1Count) || 0,
        "2": Number(stats.popTier2Count) || 0,
        "3": Number(stats.popTier3Count) || 0,
        "4": Number(stats.popTier4Count) || 0,
        "5": Number(stats.popTier5Count) || 0,
      };

      const globalGrowthFactor = (await getEconomicConfigFromDB(ctx.db)).globalGrowthFactor;
      const globalGrowthRate = globalGrowthFactor - 1; // Convert multiplier (1.0321) to rate (0.0321)

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
        globalGrowthRate, // Add the rate that UI expects
        timestamp: targetTime, // Add timestamp field that UI expects
        ixTimeTimestamp: targetTime,
      };

      await setCachedData(cacheKey, response, 30000);

      return response;
    }),

  updateStats: publicProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const now = IxTime.getCurrentIxTime();

      if (input.countryId) {
        const c = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!c) throw new Error(`Country ${input.countryId} not found`);

        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (c.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, effects);

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
            populationDensity: res.newStats.populationDensity
              ? validateNumber(res.newStats.populationDensity, 1e7)
              : null,
            gdpDensity: res.newStats.gdpDensity
              ? validateNumber(res.newStats.gdpDensity, 1e12)
              : null,
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
            select: { clerkUserId: true },
          });
          const userId = user?.clerkUserId;

          // Check for economic tier changes
          if (oldEconomicTier !== res.newStats.economicTier.toString()) {
            await ActivityGenerator.createTierChange(
              c.id,
              "economic",
              oldEconomicTier,
              res.newStats.economicTier.toString(),
              userId
            );

            // 🔔 Notify country about economic tier change
            try {
              const tierDirection =
                parseInt(res.newStats.economicTier.toString()) > parseInt(oldEconomicTier)
                  ? "advanced"
                  : "changed";
              await notificationAPI.notifyCountry({
                countryId: c.id,
                title: `📈 Economic Tier ${tierDirection === "advanced" ? "Advancement!" : "Change"}`,
                message: `Your country ${tierDirection} from tier ${oldEconomicTier} to tier ${res.newStats.economicTier}`,
                category: "economic",
                priority: tierDirection === "advanced" ? "high" : "medium",
              });
            } catch (error) {
              console.error("[Countries] Failed to send tier change notification:", error);
            }
          }

          // Check for population tier changes
          if (oldPopulationTier !== res.newStats.populationTier.toString()) {
            await ActivityGenerator.createTierChange(
              c.id,
              "population",
              oldPopulationTier,
              res.newStats.populationTier.toString(),
              userId
            );

            // 🔔 Notify country about population tier change
            try {
              const tierDirection =
                parseInt(res.newStats.populationTier.toString()) > parseInt(oldPopulationTier)
                  ? "advanced"
                  : "changed";
              await notificationAPI.notifyCountry({
                countryId: c.id,
                title: `👥 Population Tier ${tierDirection === "advanced" ? "Advancement!" : "Change"}`,
                message: `Your country ${tierDirection} from tier ${oldPopulationTier} to tier ${res.newStats.populationTier}`,
                category: "social",
                priority: tierDirection === "advanced" ? "high" : "medium",
              });
            } catch (error) {
              console.error("[Countries] Failed to send tier change notification:", error);
            }
          }

          // Check for significant GDP milestones (every 100B, 500B, 1T, etc.)
          const newGdp = res.newStats.currentTotalGdp;
          const gdpMilestones = [100e9, 500e9, 1e12, 2e12, 5e12, 10e12, 50e12]; // 100B to 50T
          for (const milestone of gdpMilestones) {
            if (oldGdp < milestone && newGdp >= milestone) {
              await ActivityGenerator.createEconomicMilestone(c.id, "Total GDP", milestone, userId);

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
                  category: "achievement",
                  priority: "high",
                });
              } catch (error) {
                console.error("[Countries] Failed to send GDP milestone notification:", error);
              }

              break; // Only trigger one milestone per update
            }
          }

          // Check for population milestones (every 10M, 50M, 100M, etc.)
          const newPopulation = res.newStats.currentPopulation;
          const populationMilestones = [10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9]; // 10M to 1B
          for (const milestone of populationMilestones) {
            if (oldPopulation < milestone && newPopulation >= milestone) {
              await ActivityGenerator.createPopulationMilestone(c.id, milestone, userId);

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
                  category: "achievement",
                  priority: "high",
                });
              } catch (error) {
                console.error(
                  "[Countries] Failed to send population milestone notification:",
                  error
                );
              }

              break; // Only trigger one milestone per update
            }
          }

          // Check for high economic growth
          const growthRate = res.newStats.adjustedGdpGrowth || 0;
          if (growthRate >= 0.04) {
            // 4%+ growth rate
            await ActivityGenerator.createHighGrowthActivity(c.id, growthRate, userId);
          }
        } catch (activityError) {
          console.warn("Failed to generate activities for country", c.id, ":", activityError);
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
            populationDensity: res.newStats.populationDensity
              ? validateNumber(res.newStats.populationDensity, 1e7)
              : null,
            gdpDensity: res.newStats.gdpDensity
              ? validateNumber(res.newStats.gdpDensity, 1e12)
              : null,
          },
        });
        return updated;
      }

      const all = await ctx.db.country.findMany({
        where: { isDemo: false },
        take: 250,
        include: {
          storytellerEffects: {
            where: { isActive: true },
            orderBy: { ixTimeTimestamp: "desc" },
            take: 50,
          },
        },
      });

      const start = Date.now();
      const historicalPointsToCreate: any[] = [];
      let activitiesCreated = 0;

      // Pre-fetch all users in one query instead of per-country lookups
      const allUsers = await ctx.db.user.findMany({
        where: { countryId: { in: all.map((c: any) => c.id) } },
        select: { countryId: true, clerkUserId: true },
      });
      const userByCountryId = new Map(allUsers.map((u: any) => [u.countryId, u.clerkUserId]));

      // Calculate all updates in memory first, then batch write
      const updateOperations: any[] = [];
      const activityPromises: Promise<void>[] = [];

      for (const c of all) {
        const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
        const base = prepareBaseCountryData(c);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (c.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const res = calc.calculateTimeProgression(baselineStats, now, effects);

        // Store old values for comparison
        const oldEconomicTier = c.economicTier;
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
          populationDensity: res.newStats.populationDensity
            ? validateNumber(res.newStats.populationDensity, 1e7)
            : null,
          gdpDensity: res.newStats.gdpDensity
            ? validateNumber(res.newStats.gdpDensity, 1e12)
            : null,
          adjustedGdpGrowth: updatedCountryData.adjustedGdpGrowth,
          actualGdpGrowth: updatedCountryData.actualGdpGrowth,
          populationGrowthRate: updatedCountryData.populationGrowthRate,
          economicVitality: vitalityScores.economicVitality,
          populationWellbeing: vitalityScores.populationWellbeing,
          diplomaticStanding: vitalityScores.diplomaticStanding,
          governmentalEfficiency: vitalityScores.governmentalEfficiency,
          overallNationalHealth: vitalityScores.overallNationalHealth,
          lastCalculated: new Date(now),
        };

        updateOperations.push(
          ctx.db.country.update({ where: { id: c.id }, data: updateData })
        );

        // Collect activity generation promises (run in parallel after batch update)
        const userId = userByCountryId.get(c.id);
        const countryId = c.id;
        const newTier = res.newStats.economicTier.toString();
        const newGdp = res.newStats.currentTotalGdp;
        const newPopulation = res.newStats.currentPopulation;

        activityPromises.push(
          (async () => {
            try {
              if (oldEconomicTier !== newTier) {
                await ActivityGenerator.createTierChange(countryId, "economic", oldEconomicTier, newTier, userId);
                activitiesCreated++;
              }
              const majorGdpMilestones = [500e9, 1e12, 5e12, 10e12];
              for (const milestone of majorGdpMilestones) {
                if (oldGdp < milestone && newGdp >= milestone) {
                  await ActivityGenerator.createEconomicMilestone(countryId, "Total GDP", milestone, userId);
                  activitiesCreated++;
                  break;
                }
              }
              const majorPopulationMilestones = [50e6, 100e6, 500e6];
              for (const milestone of majorPopulationMilestones) {
                if (oldPopulation < milestone && newPopulation >= milestone) {
                  await ActivityGenerator.createPopulationMilestone(countryId, milestone, userId);
                  activitiesCreated++;
                  break;
                }
              }
            } catch (activityError) {
              // Don't interrupt the batch process
            }
          })()
        );

        historicalPointsToCreate.push({
          countryId: c.id,
          ixTimeTimestamp: new Date(now),
          population: validateNumber(res.newStats.currentPopulation, 1e11),
          gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
          totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
          populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
          gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
          landArea: c.landArea,
          populationDensity: res.newStats.populationDensity
            ? validateNumber(res.newStats.populationDensity, 1e7)
            : null,
          gdpDensity: res.newStats.gdpDensity
            ? validateNumber(res.newStats.gdpDensity, 1e12)
            : null,
        });
      }

      // Execute all country updates in a single transaction
      const results = await ctx.db.$transaction(updateOperations);

      // Run activity generation in parallel (non-blocking)
      await Promise.allSettled(activityPromises);

      // Persist historical data points and calculation log
      if (historicalPointsToCreate.length > 0) {
        try {
          await ctx.db.$transaction([
            ctx.db.historicalDataPoint.createMany({
              data: historicalPointsToCreate,
              skipDuplicates: true,
            }),
            ctx.db.calculationLog.create({
              data: {
                timestamp: new Date(),
                ixTimeTimestamp: new Date(now),
                countriesUpdated: results.length,
                executionTimeMs: Date.now() - start,
                globalGrowthFactor: econCfg.globalGrowthFactor,
                notes: "Bulk update triggered manually or by schedule",
              },
            }),
          ]);
        } catch (error) {
          console.warn("Failed to persist historical data:", error);
        }
      }

      return {
        count: results.length,
        message: `Updated ${results.length} countries`,
        executionTimeMs: Date.now() - start,
      };
    }),

  getStorytellerEffects: publicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const whereClause = input.countryId
          ? { countryId: input.countryId, isActive: true }
          : { isActive: true };

        const effects = await ctx.db.storytellerEffect.findMany({
          where: whereClause,
          orderBy: { ixTimeTimestamp: "desc" },
          include: {
            country: {
              select: { name: true },
            },
          },
        });

        return effects;
      } catch (error) {
        console.error("Failed to get storyteller effects:", error);
        throw new Error("Failed to retrieve storyteller effects");
      }
    }),

  addStorytellerEffect: executiveProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        inputType: z.string(),
        value: z.number(),
        description: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const effect = await ctx.db.storytellerEffect.create({
          data: {
            countryId: input.countryId || null,
            ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
            inputType: input.inputType,
            value: input.value,
            description: input.description,
            duration: input.duration || null,
            isActive: true,
            createdBy: ctx.user?.id ?? "system",
          },
        });

        return effect;
      } catch (error) {
        console.error("Failed to add storyteller effect:", error);
        throw new Error("Failed to add storyteller effect");
      }
    }),

  updateStorytellerEffect: executiveProcedure
    .input(
      z.object({
        id: z.string(),
        inputType: z.string(),
        value: z.number(),
        description: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const effect = await ctx.db.storytellerEffect.update({
          where: { id: input.id },
          data: {
            inputType: input.inputType,
            value: input.value,
            description: input.description,
            duration: input.duration || null,
            updatedAt: new Date(),
          },
        });

        return effect;
      } catch (error) {
        console.error("Failed to update storyteller effect:", error);
        throw new Error("Failed to update storyteller effect");
      }
    }),

  deleteStorytellerEffect: executiveProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const effect = await ctx.db.storytellerEffect.update({
          where: { id: input.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        return effect;
      } catch (error) {
        console.error("Failed to delete storyteller effect:", error);
        throw new Error("Failed to delete storyteller effect");
      }
    }),

  updateCountryName: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error("You do not have permission to update this country.");
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
    .input(
      z.object({
        countryId: z.string(),
        hideDiplomaticOps: z.boolean().optional(),
        hideStratcommIntel: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error("You do not have permission to update this country.");
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
    .input(
      z.object({
        countryId: z.string(),
        flag: z.string().min(1), // Data URL or external URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error("You do not have permission to update this country.");
        }

        // Validate that it's either a data URL or a valid URL
        if (!input.flag.startsWith("data:") && !input.flag.startsWith("http")) {
          throw new Error("Invalid flag URL format");
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            flag: input.flag,
            updatedAt: new Date(),
          },
        });

        console.log(
          `[CountryUpdate] Updated flag for country ${updatedCountry.name} (${updatedCountry.id})`
        );

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update country flag:", error);
        throw new Error("Failed to update country flag");
      }
    }),

  updateCountryCoatOfArms: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        coatOfArms: z.string().min(1), // Data URL or external URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error("You do not have permission to update this country.");
        }

        // Validate that it's either a data URL or a valid URL
        if (!input.coatOfArms.startsWith("data:") && !input.coatOfArms.startsWith("http")) {
          throw new Error("Invalid coat of arms URL format");
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            coatOfArms: input.coatOfArms,
            updatedAt: new Date(),
          },
        });

        console.log(
          `[CountryUpdate] Updated coat of arms for country ${updatedCountry.name} (${updatedCountry.id})`
        );

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update coat of arms:", error);
        throw new Error("Failed to update coat of arms");
      }
    }),

  updateCountrySymbols: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        flag: z.string().optional(),
        coatOfArms: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new Error("You do not have permission to update this country.");
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        // Validate and add flag if provided
        if (input.flag !== undefined) {
          if (!input.flag.startsWith("data:") && !input.flag.startsWith("http")) {
            throw new Error("Invalid flag URL format");
          }
          updateData.flag = input.flag;
        }

        // Validate and add coat of arms if provided
        if (input.coatOfArms !== undefined) {
          if (!input.coatOfArms.startsWith("data:") && !input.coatOfArms.startsWith("http")) {
            throw new Error("Invalid coat of arms URL format");
          }
          updateData.coatOfArms = input.coatOfArms;
        }

        const updatedCountry = await ctx.db.country.update({
          where: { id: input.countryId },
          data: updateData,
        });

        console.log(
          `[CountryUpdate] Updated symbols for country ${updatedCountry.name} (${updatedCountry.id})`
        );

        return updatedCountry;
      } catch (error) {
        console.error("Failed to update country symbols:", error);
        throw new Error("Failed to update country symbols");
      }
    }),

  getHistoricalData: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(30),
      })
    )
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
            populationDensity: point.populationDensity
              ? validateNumber(point.populationDensity, 1e7)
              : null,
            gdpDensity: point.gdpDensity ? validateNumber(point.gdpDensity, 1e12) : null,
          }));
        }

        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);

        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const dataPoints = [];
        const intervalMs = SIX_MONTHS_MS / input.limit;

        for (let i = 0; i < input.limit; i++) {
          const timePoint = now - SIX_MONTHS_MS + i * intervalMs;
          const res = calc.calculateTimeProgression(baselineStats, timePoint, effects);

          dataPoints.push({
            ixTimeTimestamp: timePoint,
            population: validateNumber(res.newStats.currentPopulation, 1e11),
            gdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
            totalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
            populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
            gdpGrowthRate: validateGrowthRate(res.newStats.adjustedGdpGrowth),
            landArea: res.newStats.landArea,
            populationDensity: res.newStats.populationDensity
              ? validateNumber(res.newStats.populationDensity, 1e7)
              : null,
            gdpDensity: res.newStats.gdpDensity
              ? validateNumber(res.newStats.gdpDensity, 1e12)
              : null,
          });
        }

        return dataPoints;
      } catch (error) {
        console.error("Failed to get historical data:", error);
        throw new Error("Failed to retrieve historical data");
      }
    }),

  getTopCountriesByGdpPerCapita: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("topCountriesByGdpPerCapita", { limit: input.limit });
        const cached = await getCachedData(cacheKey);
        if (cached) return cached;

        const countries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            currentGdpPerCapita: { gt: 0 },
            currentPopulation: { gt: 0 },
          },
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

        await setCachedData(cacheKey, result, 5 * 60 * 1000);
        return result;
      } catch (error) {
        console.error("Failed to get top countries by GDP per capita:", error);
        throw new Error("Failed to retrieve top countries data");
      }
    }),

  getTopCountriesByPopulation: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(15),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("topCountriesByPopulation", { limit: input.limit });
        const cached = await getCachedData(cacheKey);
        if (cached) return cached;

        const countries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            currentPopulation: { gt: 0 },
            currentGdpPerCapita: { gt: 0 },
          },
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

        await setCachedData(cacheKey, result, 5 * 60 * 1000);
        return result;
      } catch (error) {
        console.error("Failed to get top countries by population:", error);
        throw new Error("Failed to retrieve top countries population data");
      }
    }),

  getTopCountriesByImportance: rateLimitedPublicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("topCountriesByImportance", { limit: input.limit });
        const cached = await getCachedData(cacheKey);
        if (cached) return cached as string[];

        // Countries that must always appear on the map label layer
        const ALWAYS_SHOW = ["Tierrador", "Castadilla", "Burgundie", "Daxia", "Nasastan", "Argyea", "Slaconia"];
        // NPC / placeholder countries that should never appear in the default label set
        const NEVER_SHOW = ["Ugarit", "Orenstia", "Trade Island 5"];

        const countries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            currentPopulation: { gt: 0 },
            currentTotalGdp: { gt: 0 },
            // Exclude NPC countries (those with an NPC personality assignment)
            personalityAssignment: { is: null },
            // Explicit exclusion list
            name: { notIn: NEVER_SHOW },
          },
          select: {
            name: true,
            currentPopulation: true,
            currentTotalGdp: true,
            currentGdpPerCapita: true,
          },
        });

        if (countries.length === 0) return ALWAYS_SHOW;

        // Normalize each metric to [0, 1] range for composite scoring
        const maxPop = Math.max(...countries.map((c) => c.currentPopulation ?? 0));
        const maxGdp = Math.max(...countries.map((c) => c.currentTotalGdp ?? 0));
        const maxGdpPc = Math.max(...countries.map((c) => c.currentGdpPerCapita ?? 0));

        const scored = countries.map((c) => ({
          name: c.name,
          score:
            ((c.currentPopulation ?? 0) / (maxPop || 1)) * 0.4 +
            ((c.currentTotalGdp ?? 0) / (maxGdp || 1)) * 0.4 +
            ((c.currentGdpPerCapita ?? 0) / (maxGdpPc || 1)) * 0.2,
        }));

        scored.sort((a, b) => b.score - a.score);
        const topNames = scored.slice(0, input.limit).map((c) => c.name);

        // Merge always-show countries (deduplicated)
        const resultSet = new Set(topNames);
        for (const name of ALWAYS_SHOW) resultSet.add(name);
        const result = Array.from(resultSet);

        await setCachedData(cacheKey, result, 5 * 60 * 1000);
        return result;
      } catch (error) {
        console.error("Failed to get top countries by importance:", error);
        return [] as string[];
      }
    }),

  getEconomicData: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cacheKey = getCacheKey("economicData", { countryId: input.countryId });
        const cached = await getCachedData(cacheKey);
        if (cached) return cached;

        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const currentTime = IxTime.getCurrentIxTime();

        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));

        const result = calc.calculateTimeProgression(baselineStats, currentTime, effects);

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

        await setCachedData(cacheKey, economicData, 60000);
        return economicData;
      } catch (error) {
        console.error("Failed to get economic data:", error);
        throw new Error("Failed to retrieve economic data");
      }
    }),

  searchWiki: rateLimitedPublicProcedure
    .input(
      z.object({
        query: z.string(),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
        categoryFilter: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const wiki = (input.site === "iiwiki" ? "iiwiki" : "ixwiki") as "ixwiki" | "iiwiki";
        const results = await wikiBridgeSearch(input.query, 20, wiki);
        return results.map((r) => ({
          title: r.title,
          pageid: r.pageId,
          size: r.length,
          snippet: "",
        }));
      } catch (error) {
        throw new Error(
          `Failed to search wiki: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  parseInfobox: publicProcedure
    .input(
      z.object({
        pageName: z.string(),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
      })
    )
    .mutation(async ({ input }) => {
      const wiki = (input.site === "iiwiki" ? "iiwiki" : "ixwiki") as "ixwiki" | "iiwiki";
      const infobox = await wikiBridgeInfobox(input.pageName, wiki);
      if (!infobox) return null;
      const result: Record<string, string> = {};
      for (const field of infobox.fields) {
        result[field.key] = field.value;
      }
      return result;
    }),

  getWikiInfobox: publicProcedure
    .input(
      z.object({
        name: z.string(),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const wiki = (input.site === "iiwiki" ? "iiwiki" : "ixwiki") as "ixwiki" | "iiwiki";
      const infobox = await wikiBridgeInfobox(input.name, wiki);
      if (!infobox) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No wiki infobox found for ${input.name}`,
        });
      }
      const result: Record<string, string> = {};
      for (const field of infobox.fields) {
        result[field.key] = field.value;
      }
      return result;
    }),

  getIntelligenceBriefings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        timeframe: z.enum(["week", "month", "quarter"]).optional().default("week"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
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
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
          quarter: 90 * 24 * 60 * 60 * 1000,
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

        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, effects);

        const briefings: any[] = [];

        let gdpChange = 0;
        if (recentData.length >= 2) {
          const latestGdp =
            recentData[0]?.gdpPerCapita || currentStats.newStats.currentGdpPerCapita;
          const previousGdp =
            recentData[recentData.length - 1]?.gdpPerCapita || country.baselineGdpPerCapita;
          if (previousGdp && previousGdp !== 0) {
            gdpChange = ((latestGdp - previousGdp) / previousGdp) * 100;
          } else {
            gdpChange = 0;
          }

          briefings.push({
            id: "economic-performance",
            category: "Economic Intelligence",
            title: "Economic Performance Analysis",
            priority: gdpChange < -5 ? "critical" : gdpChange < 0 ? "high" : "medium",
            confidenceScore: 85,
            summary: `GDP per capita ${gdpChange >= 0 ? "increased" : "decreased"} by ${Math.abs(gdpChange).toFixed(1)}% over the ${input.timeframe}`,
            details: [
              `Current GDP per capita: $${latestGdp.toLocaleString()}`,
              `Growth rate: ${(currentStats.newStats.adjustedGdpGrowth * 100).toFixed(2)}%`,
              `Economic tier: ${currentStats.newStats.economicTier}`,
            ],
            timestamp: currentTime,
            source: "Economic Analytics Engine",
          });
        } else {
          gdpChange = currentStats.newStats.adjustedGdpGrowth * 100;

          briefings.push({
            id: "economic-performance",
            category: "Economic Intelligence",
            title: "Economic Performance Analysis",
            priority: gdpChange < -5 ? "critical" : gdpChange < 0 ? "high" : "medium",
            confidenceScore: 75,
            summary: `Current GDP growth rate at ${gdpChange.toFixed(1)}% annually`,
            details: [
              `Current GDP per capita: $${currentStats.newStats.currentGdpPerCapita.toLocaleString()}`,
              `Growth rate: ${gdpChange.toFixed(2)}%`,
              `Economic tier: ${currentStats.newStats.economicTier}`,
            ],
            timestamp: currentTime,
            source: "Economic Analytics Engine",
          });
        }

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        briefings.push({
          id: "population-dynamics",
          category: "Demographic Intelligence",
          title: "Population Dynamics Assessment",
          priority: popGrowthRate < 0 ? "high" : "medium",
          confidenceScore: 90,
          summary: `Population growth rate at ${(popGrowthRate * 100).toFixed(2)}% annually`,
          details: [
            `Current population: ${Math.round(currentStats.newStats.currentPopulation).toLocaleString()}`,
            `Population tier: ${currentStats.newStats.populationTier}`,
            `Growth trend: ${popGrowthRate >= 0 ? "Positive" : "Negative"}`,
          ],
          timestamp: currentTime,
          source: "Demographic Analysis Unit",
        });

        const riskFactors = [];
        if (gdpChange < -3) riskFactors.push("Economic decline detected");
        if (popGrowthRate < 0.005) riskFactors.push("Low population growth");
        if (country.storytellerEffects.length > 5) riskFactors.push("High external influence activity");

        if (riskFactors.length > 0) {
          briefings.push({
            id: "risk-assessment",
            category: "Risk Intelligence",
            title: "Strategic Risk Assessment",
            priority: riskFactors.length >= 3 ? "critical" : "high",
            confidenceScore: 75,
            summary: `${riskFactors.length} risk factor${riskFactors.length > 1 ? "s" : ""} identified`,
            details: riskFactors,
            timestamp: currentTime,
            source: "Risk Assessment Division",
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
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, effects);

        const economicHealthScore = Math.min(
          100,
          Math.max(0, (currentStats.newStats.currentGdpPerCapita / 50000) * 100)
        );

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;
        const populationHealthScore = Math.min(
          100,
          Math.max(
            0,
            50 + popGrowthRate * 1000 // Convert to 0-100 scale
          )
        );

        const diplomaticHealthScore = Math.min(
          100,
          Math.max(
            20,
            ((country as any).globalDiplomaticInfluence || 50) +
              ((country as any).tradeRelationshipStrength || 10) +
              ((country as any).allianceStrength || 15) -
              ((country as any).diplomaticTensions || 5)
          )
        );

        const govEfficiency = Math.min(
          100,
          Math.max(30, 70 + currentStats.newStats.adjustedGdpGrowth * 500)
        );

        const alerts = [];
        if (economicHealthScore < 40) {
          alerts.push({
            id: "economic-concern",
            type: "warning",
            title: "Economic Performance Below Target",
            message: "GDP per capita growth has slowed significantly",
            urgent: economicHealthScore < 25,
          });
        }

        if (popGrowthRate < 0) {
          alerts.push({
            id: "population-decline",
            type: "error",
            title: "Population Decline Detected",
            message: "Negative population growth may impact long-term sustainability",
            urgent: true,
          });
        }

        return {
          economic: {
            healthScore: Math.round(economicHealthScore),
            gdpPerCapita: currentStats.newStats.currentGdpPerCapita,
            growthRate: currentStats.newStats.adjustedGdpGrowth * 100,
            economicTier: currentStats.newStats.economicTier,
            alerts: alerts.filter((a) => a.id.includes("economic")),
          },
          population: {
            healthScore: Math.round(populationHealthScore),
            population: currentStats.newStats.currentPopulation,
            growthRate: popGrowthRate * 100,
            populationTier: currentStats.newStats.populationTier,
            alerts: alerts.filter((a) => a.id.includes("population")),
          },
          diplomatic: {
            healthScore: Math.round(diplomaticHealthScore),
            allies: Math.floor(((country as any).globalDiplomaticInfluence || 50) / 10) + 3,
            reputation:
              diplomaticHealthScore > 75
                ? "Strong"
                : diplomaticHealthScore > 50
                  ? "Stable"
                  : "Improving",
            treaties: Math.floor(((country as any).tradeRelationshipStrength || 25) / 2) + 5,
            alerts: [],
          },
          government: {
            healthScore: Math.round(govEfficiency),
            approval: Math.round(
              Math.min(
                95,
                Math.max(
                  25,
                  50 +
                    currentStats.newStats.adjustedGdpGrowth * 1500 +
                    (economicHealthScore - 50) / 2
                )
              )
            ),
            efficiency:
              govEfficiency > 80 ? "Excellent" : govEfficiency > 60 ? "Good" : "Improving",
            stability: diplomaticHealthScore > 70 && govEfficiency > 60 ? "Stable" : "Monitored",
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
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        });

        if (!country) {
          throw new Error(`Country with ID ${input.countryId} not found`);
        }

        const currentTime = IxTime.getCurrentIxTime();
        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, effects);

        // Use stored vitality scores from database, with live calculation fallback
        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;

        // Calculate live vitality scores if database values are not set
        const calculateEconomicVitality = () => {
          const gdpScore = Math.min(100, (currentStats.newStats.currentGdpPerCapita / 50000) * 100);
          const growthBonus = Math.min(
            20,
            Math.max(-20, currentStats.newStats.adjustedGdpGrowth * 400)
          );
          return Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));
        };

        const calculatePopulationWellbeing = () => {
          const growthHealth = popGrowthRate > 0 ? 70 : 40;
          const densityFactor = country.populationDensity
            ? Math.max(50, 100 - country.populationDensity / 500)
            : 60;
          return (growthHealth + densityFactor) / 2;
        };

        const calculateDiplomaticStanding = () => {
          return Math.min(
            100,
            Math.max(
              40,
              ((country as any).globalDiplomaticInfluence || 50) +
                ((country as any).tradeRelationshipStrength || 10) +
                ((country as any).allianceStrength || 15) -
                ((country as any).diplomaticTensions || 5)
            )
          );
        };

        const calculateGovernmentalEfficiency = () => {
          const economicTierScore =
            {
              Extravagant: 95,
              "Very Strong": 85,
              Strong: 75,
              Healthy: 65,
              Developed: 50,
              Developing: 35,
              Impoverished: 25,
            }[currentStats.newStats.economicTier] || 25;
          return economicTierScore * 0.8;
        };

        // Always calculate live - use database values only if they exist and are reasonable
        const economicVitality =
          country.economicVitality && country.economicVitality > 5
            ? country.economicVitality
            : calculateEconomicVitality();

        const populationWellbeing =
          country.populationWellbeing && country.populationWellbeing > 5
            ? country.populationWellbeing
            : calculatePopulationWellbeing();

        const diplomaticStanding =
          country.diplomaticStanding && country.diplomaticStanding > 5
            ? country.diplomaticStanding
            : calculateDiplomaticStanding();

        const governmentalEfficiency =
          country.governmentalEfficiency && country.governmentalEfficiency > 5
            ? country.governmentalEfficiency
            : calculateGovernmentalEfficiency();

        console.log(
          `[getFocusCardsData] Country: ${country.name}, GDP: ${currentStats.newStats.currentGdpPerCapita}, Economic: ${Math.round(economicVitality)}, Pop: ${Math.round(populationWellbeing)}, Diplo: ${Math.round(diplomaticStanding)}, Gov: ${Math.round(governmentalEfficiency)}`
        );

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
            population: `${Math.round(currentStats.newStats.currentPopulation / 1000000)}M`,
            growthRate: `${(popGrowthRate * 100).toFixed(2)}%`,
            tier: currentStats.newStats.populationTier,
          },
          diplomaticMetrics: {
            allies: `${Math.floor(((country as any).globalDiplomaticInfluence || 50) / 10) + 3}`,
            reputation:
              diplomaticStanding > 75
                ? "Strong"
                : diplomaticStanding > 50
                  ? "Stable"
                  : "Developing",
            treaties: `${Math.floor(((country as any).tradeRelationshipStrength || 25) / 2) + 5}`,
          },
          governmentMetrics: {
            approval: `${Math.round(Math.min(95, Math.max(25, 50 + currentStats.newStats.adjustedGdpGrowth * 1500)))}%`,
            efficiency:
              governmentalEfficiency > 80
                ? "Excellent"
                : governmentalEfficiency > 60
                  ? "Good"
                  : "Improving",
            stability:
              diplomaticStanding > 70 && governmentalEfficiency > 60 ? "Stable" : "Monitored",
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate activity rings data:", error);
        throw new Error("Failed to generate activity rings data");
      }
    }),

  getNotifications: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(20),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            storytellerEffects: {
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

        const econCfg = await getEconomicConfigFromDB(ctx.db);
        const baselineDate = country.baselineDate.getTime();
        const calc = new IxStatsCalculator(econCfg, baselineDate);
        const base = prepareBaseCountryData(country);
        const baselineStats = calc.initializeCountryStats(base);
        const effects = (country.storytellerEffects as any[]).map((i: any) => ({
          ...i,
          ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
        }));
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, effects);

        let notificationId = 1;

        const gdpGrowth = currentStats.newStats.adjustedGdpGrowth * 100;
        if (gdpGrowth < 0) {
          notifications.push({
            id: `notif-${notificationId++}`,
            type: "economic",
            priority: gdpGrowth < -3 ? "critical" : "high",
            title: "Economic Growth Concern",
            message: `GDP growth has turned negative at ${gdpGrowth.toFixed(1)}%`,
            timestamp: currentTime,
            category: "Economic Intelligence",
            actionRequired: true,
            relatedData: {
              currentGdpPerCapita: currentStats.newStats.currentGdpPerCapita,
              growthRate: gdpGrowth,
            },
          });
        } else if (gdpGrowth > 5) {
          notifications.push({
            id: `notif-${notificationId++}`,
            type: "economic",
            priority: "medium",
            title: "Strong Economic Performance",
            message: `GDP growth accelerated to ${gdpGrowth.toFixed(1)}%`,
            timestamp: currentTime,
            category: "Economic Intelligence",
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
            type: "demographic",
            priority: "high",
            title: "Population Decline Alert",
            message: `Population declining at ${Math.abs(popGrowth).toFixed(2)}% annually`,
            timestamp: currentTime,
            category: "Demographic Intelligence",
            actionRequired: true,
            relatedData: {
              currentPopulation: currentStats.newStats.currentPopulation,
              growthRate: popGrowth,
            },
          });
        }

        if (country.storytellerEffects.length > 0) {
          const recentInput = country.storytellerEffects[0];
          if (recentInput) {
            const inputAge = currentTime - recentInput.ixTimeTimestamp.getTime();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;

            if (inputAge < oneWeek) {
              notifications.push({
                id: `notif-${notificationId++}`,
                type: "external",
                priority: Math.abs(recentInput.value) > 0.1 ? "high" : "medium",
                title: "External Influence Detected",
                message: `${recentInput.inputType}: ${recentInput.description}`,
                timestamp: recentInput.ixTimeTimestamp.getTime(),
                category: "External Intelligence",
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

        const tierEntries = Object.entries(tierThresholds).sort(([, a], [, b]) => a - b);
        const currentTierIndex = tierEntries.findIndex(
          ([tier]) =>
            tier.toLowerCase().replace(" ", "") ===
            (currentTier as string).toLowerCase().replace(" ", "")
        );

        if (currentTierIndex !== -1 && currentTierIndex < tierEntries.length - 1) {
          const nextTierThreshold = tierEntries[currentTierIndex + 1]![1];
          const progressToNext = (currentGdpPc / nextTierThreshold) * 100;

          if (progressToNext > 90) {
            notifications.push({
              id: `notif-${notificationId++}`,
              type: "milestone",
              priority: "medium",
              title: "Economic Tier Advancement Imminent",
              message: `${progressToNext.toFixed(1)}% progress toward ${tierEntries[currentTierIndex + 1]![0]} tier`,
              timestamp: currentTime,
              category: "Economic Intelligence",
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
          filteredNotifications = notifications.filter((n) => n.priority === input.priority);
        }

        const priorityOrder: { [key: string]: number } = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        };
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

  // SECURITY: Admin-only endpoint for triggering system-wide economic narratives
  triggerEconomicNarrative: adminProcedure.mutation(async ({ ctx }) => {
    console.log(
      `[AUDIT] Economic narrative triggered by admin userId=${ctx.auth?.userId}`
    );
    const { detectEconomicMilestoneAndTriggerNarrative } = await import(
      "~/lib/auto-post-service"
    );
    await detectEconomicMilestoneAndTriggerNarrative();
    return { success: true, message: "Economic narrative triggered" };
  }),

  getDiplomaticRelations: publicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereClause = input.countryId
        ? {
            OR: [{ country1: input.countryId }, { country2: input.countryId }],
          }
        : {};

      const relations = await ctx.db.diplomaticRelation.findMany({
        where: whereClause,
        orderBy: { lastContact: "desc" },
        take: 200,
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
        diplomaticChannels: relation.diplomaticChannels
          ? JSON.parse(relation.diplomaticChannels)
          : [],
        tradeVolume: undefined,
        culturalExchange: undefined,
      }));
    }),

  // Get economic milestones for a country
  getEconomicMilestones: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // For now, return mock milestones based on country's economic performance
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
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
          achievedAt: new Date(
            Date.now() - (country.adjustedGdpGrowth > 0.05 ? 3 : 7) * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }

      if (country.currentPopulation > country.baselinePopulation * 1.05) {
        milestones.push({
          id: `milestone_${country.id}_population`,
          title: "Population Growth",
          description: "Significant population increase recorded",
          value:
            (country.currentPopulation - country.baselinePopulation) / country.baselinePopulation,
          category: "population",
          achievedAt: new Date(
            Date.now() - (country.populationGrowthRate > 0.02 ? 15 : 30) * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }

      return milestones.slice(0, input.limit);
    }),

  // Get crisis events for a country
  getCrisisEvents: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const crises = await ctx.db.crisisEvent.findMany({
        where: {
          affectedCountries: {
            contains: input.countryId,
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return crises;
    }),

  getLiveEventsFeed: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().optional().default(20),
        hours: z.number().optional().default(72),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const sinceWindow = new Date(now.getTime() - input.hours * 60 * 60 * 1000);

      const [
        country,
        crisisEvents,
        diplomaticEvents,
        embassyMissions,
        cabinetMeetings,
        securityThreats,
      ] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
        }),
        ctx.db.crisisEvent.findMany({
          where: {
            affectedCountries: {
              contains: input.countryId,
            },
            createdAt: {
              gte: sinceWindow,
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.diplomaticEvent.findMany({
          where: {
            OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            createdAt: {
              gte: sinceWindow,
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
        ctx.db.embassyMission.findMany({
          where: {
            embassy: {
              OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }],
            },
            OR: [{ updatedAt: { gte: sinceWindow } }, { completesAt: { gte: sinceWindow } }],
          },
          include: {
            embassy: {
              include: {
                hostCountry: { select: { name: true, id: true } },
                guestCountry: { select: { name: true, id: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
        ctx.db.cabinetMeeting.findMany({
          where: {
            countryId: input.countryId,
            OR: [
              { status: { in: ["scheduled", "in_progress"] } },
              {
                status: "completed",
                completedAt: { gte: sinceWindow },
              },
            ],
          },
          orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
          take: input.limit,
        }),
        ctx.db.securityThreat.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            OR: [{ updatedAt: { gte: sinceWindow } }, { createdAt: { gte: sinceWindow } }],
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
      ]);

      type LiveEvent = {
        id: string;
        type: string;
        title: string;
        description: string;
        timestamp: string;
        severity?: string | null;
        tags?: string[];
        metadata?: Record<string, unknown>;
      };

      const events: LiveEvent[] = [];

      if (country) {
        if (country.adjustedGdpGrowth > 0.03) {
          events.push({
            id: `economic_growth_${country.id}`,
            type: "economic_growth",
            title: "Strong Economic Growth",
            description: `GDP growth reached ${(country.adjustedGdpGrowth * 100).toFixed(1)}%`,
            timestamp: country.updatedAt.toISOString(),
            severity: "positive",
            tags: ["Economy", `${(country.adjustedGdpGrowth * 100).toFixed(1)}% growth`],
            metadata: {
              value: country.adjustedGdpGrowth,
              economicTier: country.economicTier,
            },
          });
        }

        if (country.adjustedGdpGrowth < -0.01) {
          events.push({
            id: `economic_decline_${country.id}`,
            type: "economic_decline",
            title: "Economic Contraction Detected",
            description: `GDP declined ${(country.adjustedGdpGrowth * 100).toFixed(1)}%`,
            timestamp: country.updatedAt.toISOString(),
            severity: "warning",
            tags: ["Economy", "Decline"],
            metadata: {
              value: country.adjustedGdpGrowth,
            },
          });
        }

        if (country.populationGrowthRate > 0.02) {
          events.push({
            id: `population_growth_${country.id}`,
            type: "economic_growth",
            title: "Population Surge",
            description: "Population growth exceeded 2% this cycle",
            timestamp: country.updatedAt.toISOString(),
            severity: "info",
            tags: ["Demographics", `${(country.populationGrowthRate * 100).toFixed(1)}% growth`],
            metadata: {
              value: country.populationGrowthRate,
              currentPopulation: country.currentPopulation,
            },
          });
        }
      }

      crisisEvents.forEach((crisis) => {
        events.push({
          id: `crisis_${crisis.id}`,
          type: "crisis",
          title: crisis.title,
          description: crisis.description ?? "Crisis event detected",
          timestamp: crisis.createdAt.toISOString(),
          severity: crisis.severity ?? null,
          tags: ["Crisis", crisis.severity ?? ""],
          metadata: {
            economicImpact: crisis.economicImpact,
            affectedCountries: crisis.affectedCountries,
          },
        });
      });

      diplomaticEvents.forEach((event) => {
        const otherCountryId =
          event.country1Id === input.countryId ? event.country2Id : event.country1Id;
        const tags = ["Diplomacy"];
        if (event.eventType) tags.push(event.eventType.replace(/_/g, " "));
        if (event.severity) tags.push(event.severity);

        events.push({
          id: `diplomatic_${event.id}`,
          type: "diplomatic",
          title: event.title,
          description: event.description,
          timestamp: event.createdAt.toISOString(),
          severity: event.severity ?? "info",
          tags,
          metadata: {
            tradeValue: event.tradeValue,
            status: event.status,
            relatedCountries: [otherCountryId].filter(Boolean),
            embassyId: event.embassyId,
            missionId: event.missionId,
          },
        });
      });

      embassyMissions.forEach((mission) => {
        const embassy = mission.embassy;
        const otherCountryName = embassy
          ? embassy.hostCountryId === input.countryId
            ? embassy.guestCountry?.name
            : embassy.hostCountry?.name
          : undefined;

        events.push({
          id: `embassy_mission_${mission.id}`,
          type: "embassy_mission",
          title: `${mission.name} (${mission.status})`,
          description: mission.description,
          timestamp: mission.updatedAt.toISOString(),
          severity:
            mission.status === "failed"
              ? "critical"
              : mission.status === "completed"
                ? "positive"
                : "info",
          tags: ["Embassy Mission", mission.type.replace(/_/g, " "), mission.status],
          metadata: {
            completesAt: mission.completesAt.toISOString(),
            embassyName: embassy?.name,
            relatedCountry: otherCountryName,
          },
        });
      });

      cabinetMeetings.forEach((meeting) => {
        const timestamp = meeting.scheduledDate ?? meeting.createdAt;
        events.push({
          id: `cabinet_meeting_${meeting.id}`,
          type: "cabinet_meeting",
          title: meeting.title,
          description: meeting.description ?? "Cabinet meeting scheduled",
          timestamp: timestamp.toISOString(),
          severity: meeting.status === "cancelled" ? "warning" : meeting.status,
          tags: ["Cabinet", meeting.status],
          metadata: {
            scheduledDate: meeting.scheduledDate?.toISOString(),
            durationMinutes: meeting.duration,
            status: meeting.status,
          },
        });
      });

      securityThreats.forEach((threat) => {
        events.push({
          id: `security_${threat.id}`,
          type: "security",
          title: `Security Alert: ${threat.threatName}`,
          description: threat.description ?? "Security threat detected",
          timestamp: threat.updatedAt.toISOString(),
          severity: threat.severity,
          tags: ["Security", threat.threatType, threat.severity],
          metadata: {
            status: threat.status,
            urgency: threat.urgency,
            likelihood: threat.likelihood,
            impact: threat.impact,
          },
        });
      });

      const sortedEvents = events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, input.limit);

      return {
        countryId: input.countryId,
        generatedAt: now.toISOString(),
        events: sortedEvents,
      };
    }),

  // Get trade data for a country
  getTradeData: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
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
          { country: "Economic Ally", volume: totalVolume * 0.12 },
        ],
      };
    }),

  // Lightweight summary for map info panel (no calculator overhead)
  getMapSummary: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          continent: true,
          region: true,
          economicTier: true,
          populationTier: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          adjustedGdpGrowth: true,
          landArea: true,
          leader: true,
          governmentType: true,
        },
      });
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        flagUrl: normalizeFlagUrl(c.flag),
        continent: c.continent,
        region: c.region,
        economicTier: c.economicTier,
        populationTier: c.populationTier,
        population: c.currentPopulation,
        gdpPerCapita: c.currentGdpPerCapita,
        totalGdp: c.currentTotalGdp,
        gdpGrowth: c.adjustedGdpGrowth,
        landArea: c.landArea,
        leader: c.leader,
        governmentType: c.governmentType,
      };
    }),

  // Wiki intro extract for the map info panel (1hr server cache — wiki text rarely changes)
  getWikiIntro: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiIntro(name);
    }),

  /**
   * Bulk wiki intro fetch — single request fetches intros for up to 50 countries.
   * Uses MediaWiki's multi-title extracts API (titles=A|B|C) for efficiency.
   * Cached for 1hr server-side. Used by MapPrefetcher for upfront warming.
   */
  getBulkWikiIntros: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) return {};

      const results: Record<string, { extract: string; wikiSource: string; wikiUrl: string } | null> = {};

      // Track which names still need resolution
      const remaining = new Set(names);

      // Fetch each intro via WikiBridge (parallel, direct MySQL ~8ms each)
      await Promise.all([...remaining].map(async (n) => {
        const intro = await fetchWikiIntro(n);
        if (intro) {
          results[n] = intro;
          remaining.delete(n);
        }
      }));

      // Fill remaining with null
      for (const name of remaining) {
        results[name] = null;
      }

      return results;
    }),

  /**
   * Bulk map summaries — single DB query for all country stats.
   * Used by MapPrefetcher for upfront warming instead of staggered individual calls.
   */
  getBulkMapSummaries: cachedStaticProcedure
    .input(z.object({ countryIds: z.array(z.string()).max(200) }))
    .query(async ({ ctx, input }) => {
      const ids = input.countryIds.filter(Boolean);
      if (ids.length === 0) return {};
      const countries = await ctx.db.country.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          continent: true,
          region: true,
          economicTier: true,
          populationTier: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          adjustedGdpGrowth: true,
          landArea: true,
          leader: true,
          governmentType: true,
        },
      });
      const result: Record<string, {
        id: string; name: string; slug: string; flagUrl: string | null;
        continent: string | null; region: string | null;
        economicTier: string | null; populationTier: string | null;
        population: number | null; gdpPerCapita: number | null;
        totalGdp: number | null; gdpGrowth: number | null;
        landArea: number | null; leader: string | null; governmentType: string | null;
      }> = {};
      for (const c of countries) {
        result[c.id] = {
          id: c.id, name: c.name, slug: c.slug, flagUrl: normalizeFlagUrl(c.flag),
          continent: c.continent, region: c.region,
          economicTier: c.economicTier, populationTier: c.populationTier,
          population: c.currentPopulation, gdpPerCapita: c.currentGdpPerCapita,
          totalGdp: c.currentTotalGdp, gdpGrowth: c.adjustedGdpGrowth,
          landArea: c.landArea, leader: c.leader, governmentType: c.governmentType,
        };
      }
      return result;
    }),

  /**
   * Wiki sections (table of contents) for a single country page.
   * Uses MediaWiki action=parse&prop=sections API. 1hr server cache.
   */
  getWikiSections: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSections(name);
    }),

  /**
   * Bulk wiki sections — fetches TOC for up to 50 countries.
   * MediaWiki parse API is single-page, so loops server-side.
   * Same-server wiki → ~5ms per country.
   */
  getBulkWikiSections: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiSections>>> = {};
      for (const name of names) {
        try {
          results[name] = await fetchWikiSections(name);
        } catch {
          results[name] = null;
        }
      }
      return results;
    }),

  /**
   * Wiki page images for a single country.
   * Fetches all File: references on the page, resolves to thumbnail URLs.
   */
  getWikiPageImages: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiPageImages(name);
    }),

  /**
   * Bulk wiki page images — fetches images for up to 30 countries.
   */
  getBulkWikiPageImages: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiPageImages>>> = {};
      for (const name of names) {
        try {
          results[name] = await fetchWikiPageImages(name);
        } catch {
          results[name] = null;
        }
      }
      return results;
    }),

  /**
   * Rich wiki intro — fetches raw wikitext, cleans it, converts wiki markup to HTML.
   * Returns ready-to-render HTML paragraphs (moved from client-side useCountryPageState).
   * 1hr server cache via cachedStaticProcedure.
   */
  getWikiRichIntro: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiRichIntro(name);
    }),

  /**
   * Bulk rich wiki intros — up to 50 countries.
   * Sequential server-side fetches (~5ms each on same server).
   */
  getBulkWikiRichIntros: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiRichIntro>>> = {};
      for (const name of names) {
        try {
          results[name] = await fetchWikiRichIntro(name);
        } catch {
          results[name] = null;
        }
      }
      return results;
    }),

  /**
   * Cached wiki infobox — wraps IxnayWikiService.getCountryInfobox() server-side.
   * Returns structured infobox data (government, capital, flag, etc.).
   * 1hr server cache.
   */
  getWikiInfoboxCached: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiInfoboxCached(name);
    }),

  /**
   * Bulk wiki infoboxes — up to 30 countries.
   */
  getBulkWikiInfoboxes: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiInfoboxCached>>> = {};
      for (const name of names) {
        try {
          results[name] = await fetchWikiInfoboxCached(name);
        } catch {
          results[name] = null;
        }
      }
      return results;
    }),

  /**
   * Wiki section previews — TOC sections with plain-text preview for level-2 headers.
   * Used by the map info panel for richer wiki sections display.
   * 1hr server cache.
   */
  getWikiSectionPreviews: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSectionPreviews(name);
    }),

  /**
   * Bulk wiki section previews — up to 30 countries.
   */
  getBulkWikiSectionPreviews: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiSectionPreviews>>> = {};
      for (const name of names) {
        try {
          results[name] = await fetchWikiSectionPreviews(name);
        } catch {
          results[name] = null;
        }
      }
      return results;
    }),

  // ============ ATOMIC COMPONENTS INTEGRATION ENDPOINTS ============

  // Get country with atomic enhancement
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = (await ctx.db.country.findUnique({
        where: { name: input.name },
        include: {
          governmentComponents: {
            where: { isActive: true },
          },
          componentSynergies: {
            include: {
              primaryComponent: true,
              secondaryComponent: true,
            },
          },
          atomicEffectiveness: true,
        },
      })) as CountryWithAtomicComponents | null;

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
        atomicModifiers: enhancedData.atomicModifiers,
      };
    }),

  // Get countries filtered by atomic components
  getByAtomicComponents: publicProcedure
    .input(
      z.object({
        componentTypes: z.array(z.nativeEnum(ComponentType)),
        requireAll: z.boolean().default(false), // true = AND, false = OR
      })
    )
    .query(async ({ ctx, input }) => {
      let countries;

      if (input.requireAll) {
        // For AND logic, we need to check that all components exist
        countries = await ctx.db.country.findMany({
          where: { isDemo: false },
          include: {
            governmentComponents: {
              where: { isActive: true },
            },
          },
        });

        // Filter for countries that have ALL required components
        countries = countries.filter((country) =>
          input.componentTypes.every((componentType) =>
            country.governmentComponents.some(
              (comp) => comp.componentType === componentType && comp.isActive
            )
          )
        );
      } else {
        // For OR logic, use Prisma's some query
        countries = await ctx.db.country.findMany({
          where: {
            isDemo: false,
            governmentComponents: {
              some: {
                componentType: { in: input.componentTypes },
                isActive: true,
              },
            },
          },
          include: {
            governmentComponents: {
              where: { isActive: true },
            },
          },
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
          governmentComponents: { where: { isActive: true } },
        },
      });

      if (!country) return null;

      const atomicService = getAtomicEffectivenessService(ctx.db);
      const componentTypes = country.governmentComponents.map((c) => c.componentType);
      const breakdown = atomicService.getComponentBreakdown(componentTypes);

      const synergies = atomicService.detectPotentialSynergies(componentTypes);
      const conflicts = atomicService.detectConflicts(componentTypes);

      return {
        components: breakdown,
        synergies,
        conflicts,
        totalComponents: componentTypes.length,
        synergyCount: synergies.length,
        conflictCount: conflicts.length,
      };
    }),

  // Toggle atomic government mode for a country
  toggleAtomicGovernment: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        useAtomic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.country.update({
        where: { id: input.countryId },
        data: { usesAtomicGovernment: input.useAtomic },
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
  // Using cachedStaticProcedure - geography data rarely changes (1hr TTL)
  getCustomGeography: cachedStaticProcedure.query(async ({ ctx }) => {
    // For now, return empty custom geography
    // In the future, this could fetch from a CustomGeography table
    return {
      continents: [] as string[],
      regions: {} as Record<string, string[]>,
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
    .input(
      z.object({
        continent: z.string(),
        region: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // For now, just return success
      // In the future, this could store in a CustomGeography table
      return { success: true, continent: input.continent, region: input.region };
    }),

  // Create a new country from builder
  createCountry: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        foundationCountry: z.string().nullable(),
        economicInputs: z
          .object({
            coreIndicators: z
              .object({
                totalPopulation: z.number().min(0),
                gdpPerCapita: z.number().min(0),
                nominalGDP: z.number().min(0),
              })
              .optional(),
            laborEmployment: z
              .object({
                laborForceParticipationRate: z.number().min(0).max(100),
                unemploymentRate: z.number().min(0).max(100),
              })
              .optional(),
            fiscalSystem: z
              .object({
                taxRevenueGDPPercent: z.number().optional(),
                governmentSpendingGDPPercent: z.number().optional(),
              })
              .optional(),
            demographics: z
              .object({
                urbanPopulationPercent: z.number().min(0).max(100).optional(),
                lifeExpectancy: z.number().optional(),
                literacyRate: z.number().min(0).max(100).optional(),
              })
              .optional(),
            incomeWealth: z
              .object({
                giniIndex: z.number().min(0).max(100).optional(),
              })
              .optional(),
            governmentSpending: z.record(z.string(), z.number()).optional(),
            nationalIdentity: z
              .object({
                // Basic Identity
                countryName: z.string().optional(),
                officialName: z.string().optional(),
                governmentType: z.string().optional(),
                motto: z.string().optional(),
                mottoNative: z.string().optional(),

                // Geography & Administration
                capitalCity: z.string().optional(),
                largestCity: z.string().optional(),
                coordinatesLatitude: z.string().optional(),
                coordinatesLongitude: z.string().optional(),

                // Population & Culture
                demonym: z.string().optional(),
                nationalReligion: z.string().optional(),

                // Currency
                currency: z.string().optional(),
                currencySymbol: z.string().optional(),

                // Languages
                officialLanguages: z.string().optional(),
                nationalLanguage: z.string().optional(),

                // National Symbols & Culture
                nationalAnthem: z.string().optional(),
                nationalDay: z.string().optional(),
                nationalSport: z.string().optional(),

                // Technical & Administrative
                callingCode: z.string().optional(),
                internetTLD: z.string().optional(),
                drivingSide: z.string().optional(),
                timeZone: z.string().optional(),
                isoCode: z.string().optional(),
                emergencyNumber: z.string().optional(),
                postalCodeFormat: z.string().optional(),
                weekStartDay: z.string().optional(),

                // Legacy field (kept for backward compatibility)
                leader: z.string().optional(),
              })
              .optional(),
            geography: z
              .object({
                continent: z.string().optional(),
                region: z.string().optional(),
              })
              .optional(),
            flagUrl: z.string().optional(),
            coatOfArmsUrl: z.string().optional(),
          })
          .optional(),
        governmentComponents: z
          .array(
            z.object({
              componentType: z.string(),
              effectivenessScore: z.number().min(0).max(100).optional(),
              implementationCost: z.number().optional(),
              maintenanceCost: z.number().optional(),
              requiredCapacity: z.number().min(0).max(100).optional(),
              isActive: z.boolean().optional(),
              notes: z.string().optional(),
            })
          )
          .optional(),
        taxSystemData: z
          .object({
            // Core tax system fields
            taxSystemName: z.string().optional(),
            taxAuthority: z.string().optional(),
            fiscalYear: z.string().optional(),
            taxCode: z.string().optional(),
            baseRate: z.number().min(0).max(100).optional(),
            progressiveTax: z.boolean().optional(),
            flatTaxRate: z.number().min(0).max(100).optional(),
            alternativeMinTax: z.boolean().optional(),
            alternativeMinRate: z.number().min(0).max(100).optional(),
            taxHolidays: z.string().optional(), // JSON array
            complianceRate: z.number().min(0).max(100).optional(),
            collectionEfficiency: z.number().min(0).max(100).optional(),
            lastReform: z.date().optional(),

            // Tax categories (Income, Corporate, Sales, Property, etc.)
            categories: z
              .array(
                z.object({
                  categoryName: z.string(),
                  categoryType: z.string(), // Direct, Indirect
                  description: z.string().optional(),
                  isActive: z.boolean().optional(),
                  baseRate: z.number().optional(),
                  calculationMethod: z.string().optional(), // percentage, fixed, tiered
                  minimumAmount: z.number().optional(),
                  maximumAmount: z.number().optional(),
                  exemptionAmount: z.number().optional(),
                  deductionAllowed: z.boolean().optional(),
                  standardDeduction: z.number().optional(),
                  priority: z.number().optional(),
                  color: z.string().optional(),
                  icon: z.string().optional(),

                  // Brackets for this category (for progressive taxation)
                  brackets: z
                    .array(
                      z.object({
                        bracketName: z.string().optional(),
                        minIncome: z.number(),
                        maxIncome: z.number().optional(), // null for highest bracket
                        rate: z.number(),
                        flatAmount: z.number().optional(),
                        marginalRate: z.boolean().optional(),
                        isActive: z.boolean().optional(),
                        priority: z.number().optional(),
                      })
                    )
                    .optional(),

                  // Exemptions specific to this category
                  exemptions: z
                    .array(
                      z.object({
                        exemptionName: z.string(),
                        exemptionType: z.string(), // Individual, Corporate, Sector, Geographic
                        description: z.string().optional(),
                        exemptionAmount: z.number().optional(),
                        exemptionRate: z.number().optional(),
                        qualifications: z.string().optional(), // JSON criteria
                        isActive: z.boolean().optional(),
                        startDate: z.date().optional(),
                        endDate: z.date().optional(),
                      })
                    )
                    .optional(),

                  // Deductions specific to this category
                  deductions: z
                    .array(
                      z.object({
                        deductionName: z.string(),
                        deductionType: z.string(), // Standard, Itemized
                        description: z.string().optional(),
                        maximumAmount: z.number().optional(),
                        percentage: z.number().optional(),
                        qualifications: z.string().optional(), // JSON criteria
                        isActive: z.boolean().optional(),
                        priority: z.number().optional(),
                      })
                    )
                    .optional(),
                })
              )
              .optional(),

            // System-wide exemptions (not tied to a specific category)
            systemWideExemptions: z
              .array(
                z.object({
                  exemptionName: z.string(),
                  exemptionType: z.string(),
                  description: z.string().optional(),
                  exemptionAmount: z.number().optional(),
                  exemptionRate: z.number().optional(),
                  qualifications: z.string().optional(),
                  isActive: z.boolean().optional(),
                  startDate: z.date().optional(),
                  endDate: z.date().optional(),
                })
              )
              .optional(),

            // Tax policies
            policies: z
              .array(
                z.object({
                  policyName: z.string(),
                  policyType: z.string(), // Rate Change, Exemption, Deduction
                  description: z.string().optional(),
                  targetCategory: z.string().optional(),
                  impactType: z.string(), // Increase, Decrease, Neutral
                  rateChange: z.number().optional(),
                  effectiveDate: z.date(),
                  expiryDate: z.date().optional(),
                  isActive: z.boolean().optional(),
                  estimatedRevenue: z.number().optional(),
                  affectedPopulation: z.number().optional(),
                })
              )
              .optional(),
          })
          .optional(),
        governmentStructure: z
          .object({
            governmentType: z.string().optional(),
            governmentName: z.string().optional(),
            headOfState: z.string().optional(),
            headOfGovernment: z.string().optional(),
            legislatureName: z.string().optional(),
            executiveName: z.string().optional(),
            judicialName: z.string().optional(),
            totalBudget: z.number().optional(),
            fiscalYear: z.string().optional(),
            budgetCurrency: z.string().optional(),
            // Additional fields for complete persistence
            departments: z
              .array(
                z.object({
                  id: z.string().optional(), // Temporary ID for hierarchy mapping
                  name: z.string(),
                  shortName: z.string().optional(),
                  category: z.string(),
                  description: z.string().optional(),
                  minister: z.string().optional(),
                  ministerTitle: z.string().default("Minister"),
                  headquarters: z.string().optional(),
                  established: z.string().optional(),
                  employeeCount: z.number().optional(),
                  icon: z.string().optional(),
                  color: z.string().default("#6366f1"),
                  priority: z.number().default(50),
                  isActive: z.boolean().default(true),
                  parentDepartmentId: z.string().optional(), // References temporary ID
                  organizationalLevel: z.string().default("Ministry"),
                  functions: z.array(z.string()).optional(),
                  kpis: z.string().optional(), // JSON string
                })
              )
              .optional(),
            budgetAllocations: z
              .array(
                z.object({
                  departmentId: z.string(), // References temporary department ID
                  budgetYear: z.number(),
                  allocatedAmount: z.number(),
                  allocatedPercent: z.number(),
                  spentAmount: z.number().default(0),
                  encumberedAmount: z.number().default(0),
                  availableAmount: z.number().default(0),
                  budgetStatus: z.string().default("Allocated"),
                  notes: z.string().optional(),
                })
              )
              .optional(),
            revenueSources: z
              .array(
                z.object({
                  name: z.string(),
                  category: z.string(),
                  description: z.string().optional(),
                  rate: z.number().optional(),
                  revenueAmount: z.number().default(0),
                  revenuePercent: z.number().default(0),
                  isActive: z.boolean().default(true),
                  collectionMethod: z.string().optional(),
                  administeredBy: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
        economyBuilderState: z
          .object({
            // Economic structure
            structure: z
              .object({
                economicModel: z.string(),
                primarySectors: z.array(z.string()),
                secondarySectors: z.array(z.string()),
                tertiarySectors: z.array(z.string()),
                totalGDP: z.number(),
                gdpCurrency: z.string(),
                economicTier: z.enum(["Developing", "Emerging", "Developed", "Advanced"]),
                growthStrategy: z.enum([
                  "Export-Led",
                  "Import-Substitution",
                  "Balanced",
                  "Innovation-Driven",
                ]),
              })
              .optional(),

            // Sector configurations
            sectors: z
              .array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  category: z.enum(["Primary", "Secondary", "Tertiary"]),
                  gdpContribution: z.number(),
                  employmentShare: z.number(),
                  productivity: z.number(),
                  growthRate: z.number(),
                  exports: z.number(),
                  imports: z.number(),
                  technologyLevel: z.enum(["Traditional", "Modern", "Advanced", "Cutting-Edge"]),
                  automation: z.number(),
                  regulation: z.enum(["Light", "Moderate", "Heavy", "Comprehensive"]),
                  subsidy: z.number(),
                  innovation: z.number(),
                  sustainability: z.number(),
                  competitiveness: z.number(),
                })
              )
              .optional(),

            // Labor market configuration
            laborMarket: z
              .object({
                totalWorkforce: z.number(),
                laborForceParticipationRate: z.number(),
                employmentRate: z.number(),
                unemploymentRate: z.number(),
                underemploymentRate: z.number(),
                youthUnemploymentRate: z.number(),
                seniorEmploymentRate: z.number(),
                femaleParticipationRate: z.number(),
                maleParticipationRate: z.number(),
                sectorDistribution: z.record(z.string(), z.number()).optional(),
                employmentType: z
                  .object({
                    fullTime: z.number(),
                    partTime: z.number(),
                    temporary: z.number(),
                    seasonal: z.number(),
                    selfEmployed: z.number(),
                    gig: z.number(),
                    informal: z.number(),
                  })
                  .optional(),
                averageAnnualIncome: z.number(),
                averageWorkweekHours: z.number(),
                averageOvertimeHours: z.number().optional(),
                paidVacationDays: z.number().optional(),
                paidSickLeaveDays: z.number().optional(),
                parentalLeaveWeeks: z.number().optional(),
                unionizationRate: z.number().optional(),
                collectiveBargainingCoverage: z.number().optional(),
                minimumWageHourly: z.number(),
                livingWageHourly: z.number().optional(),
                workplaceSafetyIndex: z.number().optional(),
                laborRightsScore: z.number().optional(),
                workerProtections: z
                  .object({
                    jobSecurity: z.number(),
                    wageProtection: z.number(),
                    healthSafety: z.number(),
                    discriminationProtection: z.number(),
                    collectiveRights: z.number(),
                  })
                  .optional(),
              })
              .optional(),

            // Demographics configuration
            demographics: z
              .object({
                totalPopulation: z.number(),
                populationGrowthRate: z.number(),
                ageDistribution: z
                  .object({
                    under15: z.number(),
                    age15to64: z.number(),
                    over65: z.number(),
                  })
                  .optional(),
                urbanRuralSplit: z
                  .object({
                    urban: z.number(),
                    rural: z.number(),
                  })
                  .optional(),
                regions: z
                  .array(
                    z.object({
                      name: z.string(),
                      population: z.number(),
                      populationPercent: z.number(),
                      urbanPercent: z.number(),
                      economicActivity: z.number(),
                      developmentLevel: z.enum([
                        "Underdeveloped",
                        "Developing",
                        "Developed",
                        "Advanced",
                      ]),
                    })
                  )
                  .optional(),
                lifeExpectancy: z.number().optional(),
                literacyRate: z.number().optional(),
                educationLevels: z
                  .object({
                    noEducation: z.number(),
                    primary: z.number(),
                    secondary: z.number(),
                    tertiary: z.number(),
                  })
                  .optional(),
                netMigrationRate: z.number().optional(),
                immigrationRate: z.number().optional(),
                emigrationRate: z.number().optional(),
                infantMortalityRate: z.number().optional(),
                maternalMortalityRate: z.number().optional(),
                healthExpenditureGDP: z.number().optional(),
                youthDependencyRatio: z.number().optional(),
                elderlyDependencyRatio: z.number().optional(),
                totalDependencyRatio: z.number().optional(),
              })
              .optional(),

            // Selected atomic economic components
            selectedAtomicComponents: z.array(z.string()),

            // Validation state
            isValid: z.boolean().optional(),
            lastUpdated: z.date().optional(),
            version: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get Clerk user ID from context
      const userId = ctx.auth.userId;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Check if user already has a country (via User.countryId relation)
      const userWithCountry = await ctx.db.user.findUnique({
        where: { clerkUserId: userId },
        include: { country: true, role: true },
      });

      if (userWithCountry?.country) {
        // Return the existing country instead of throwing an error
        console.log(`[createCountry] User ${userId} already has country: ${userWithCountry.country.name}`);
        return userWithCountry.country;
      }

      // Check if user has a role assigned (handle legacy users)
      if (userWithCountry && !userWithCountry.roleId) {
        console.warn(`[createCountry] User ${userId} has no assigned role, auto-assigning 'user' role`);

        // Find default 'user' role
        const defaultRole = await ctx.db.role.findFirst({
          where: { name: 'user' }
        });

        if (defaultRole) {
          // Auto-assign default role to legacy user
          await ctx.db.user.update({
            where: { clerkUserId: userId },
            data: { roleId: defaultRole.id }
          });

          console.log(`[createCountry] Auto-assigned role '${defaultRole.name}' to user ${userId}`);
        } else {
          throw new Error("FORBIDDEN: Your account has no assigned role. This usually means your account was created before the role system was implemented. Please contact support to have your account configured.");
        }
      }

      // Get foundation country data if provided
      let foundationData: any = null;
      if (input.foundationCountry) {
        const foundationCountry = await ctx.db.country.findFirst({
          where: {
            OR: [{ slug: input.foundationCountry }, { name: input.foundationCountry }],
          },
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
      const coreIndicators = (econ.coreIndicators || {}) as Partial<CoreEconomicIndicators>;
      const laborEmployment = (econ.laborEmployment || {}) as Partial<LaborEmploymentData>;
      const fiscalSystem = (econ.fiscalSystem || {}) as Partial<FiscalSystemData>;
      const demographics = (econ.demographics || {}) as Partial<DemographicData>;
      const incomeWealth = (econ.incomeWealth || {}) as Partial<IncomeWealthData>;
      const governmentSpending = (econ.governmentSpending || {}) as Partial<GovernmentSpendingData>;
      const nationalIdentity = (econ.nationalIdentity || {}) as Partial<NationalIdentityData>;
      const geography = (econ.geography || {}) as Partial<GeographyData>;

      // Calculate derived values
      const population =
        coreIndicators.totalPopulation || foundationData?.baselinePopulation || 10000000;
      const gdpPerCapita =
        coreIndicators.gdpPerCapita || foundationData?.baselineGdpPerCapita || 25000;
      const nominalGDP = coreIndicators.nominalGDP || population * gdpPerCapita;
      const totalGdp = population * gdpPerCapita;

      // Create unique slug for the country
      const slug = input.name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Use transaction to create country and related records atomically
      try {
        const result = await ctx.db.$transaction(async (tx) => {
        // Create the country with ALL fields from builder
        const country = await tx.country.create({
          data: {
            name: input.name,
            slug: slug,
            continent: geography.continent || foundationData?.continent || "Unknown",
            region: geography.region || foundationData?.region || "Unknown",
            governmentType:
              nationalIdentity.governmentType ||
              input.governmentStructure?.governmentType ||
              "Republic",
            religion: nationalIdentity.nationalReligion || "Secular",
            leader: (nationalIdentity as any).leader || "Unknown",
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
            averageAnnualIncome:
              laborEmployment.averageAnnualIncome || Math.round(gdpPerCapita * 0.8),

            // Fiscal System
            taxRevenueGDPPercent:
              fiscalSystem.taxRevenueGDPPercent || (input.taxSystemData as any)?.totalTaxRate || 20,
            governmentRevenueTotal: fiscalSystem.governmentRevenueTotal || nominalGDP * 0.2,
            taxRevenuePerCapita:
              fiscalSystem.taxRevenuePerCapita || (nominalGDP * 0.2) / population,
            governmentBudgetGDPPercent: fiscalSystem.governmentBudgetGDPPercent || 22,
            budgetDeficitSurplus: fiscalSystem.budgetDeficitSurplus || 0,
            internalDebtGDPPercent: fiscalSystem.internalDebtGDPPercent || 45,
            externalDebtGDPPercent: fiscalSystem.externalDebtGDPPercent || 25,
            totalDebtGDPRatio: fiscalSystem.totalDebtGDPRatio || 70,
            debtPerCapita: fiscalSystem.debtPerCapita || (nominalGDP * 0.7) / population,
            interestRates: fiscalSystem.interestRates || 3.5,
            debtServiceCosts: fiscalSystem.debtServiceCosts || nominalGDP * 0.7 * 0.035,

            // Income & Wealth
            povertyRate: incomeWealth.povertyRate || 15,
            incomeInequalityGini: incomeWealth.incomeInequalityGini || 0.38,
            socialMobilityIndex: incomeWealth.socialMobilityIndex || 60,

            // Government Spending
            totalGovernmentSpending: governmentSpending.totalSpending || nominalGDP * 0.22,
            spendingGDPPercent: governmentSpending.spendingGDPPercent || 22,
            spendingPerCapita:
              governmentSpending.spendingPerCapita || (nominalGDP * 0.22) / population,

            // Demographics
            lifeExpectancy: demographics.lifeExpectancy || 78.5,
            urbanPopulationPercent: demographics.urbanRuralSplit?.urban || 65,
            ruralPopulationPercent: demographics.urbanRuralSplit?.rural || 35,
            literacyRate: demographics.literacyRate || 95,

            // Calculate density if we have land area
            populationDensity: foundationData?.landArea
              ? population / foundationData.landArea
              : undefined,
            gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,

            lastCalculated: new Date(),
          },
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
              nationalReligion: nationalIdentity.nationalReligion,
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
            },
          });
        }

        // Create Demographics record
        if (demographics && Object.keys(demographics).length > 0) {
          await tx.demographics.create({
            data: {
              countryId: country.id,
              ageDistribution: JSON.stringify(demographics.ageDistribution || []),
              educationLevels: JSON.stringify(demographics.educationLevels || []),
              birthRate: (demographics as any).birthRate,
              deathRate: (demographics as any).deathRate,
              migrationRate: (demographics as any).migrationRate,
              dependencyRatio: (demographics as any).dependencyRatio,
              medianAge: (demographics as any).medianAge,
              populationGrowthProjection: demographics.populationGrowthRate,
            },
          });
        }

        // Create Fiscal System record (separate from Country table fields)
        if (fiscalSystem && Object.keys(fiscalSystem).length > 0) {
          await tx.fiscalSystem.create({
            data: {
              countryId: country.id,
              personalIncomeTaxRates: (fiscalSystem as any).personalIncomeTaxRates,
              corporateTaxRates: (fiscalSystem as any).corporateTaxRates,
              salesTaxRate: fiscalSystem.salesTaxRate,
              propertyTaxRate: (fiscalSystem as any).propertyTaxRate,
              payrollTaxRate: (fiscalSystem as any).payrollTaxRate,
              exciseTaxRates: (fiscalSystem as any).exciseTaxRates,
              wealthTaxRate: (fiscalSystem as any).wealthTaxRate,
              spendingByCategory: (fiscalSystem as any).spendingByCategory,
              fiscalBalanceGDPPercent: (fiscalSystem as any).fiscalBalanceGDPPercent,
              primaryBalanceGDPPercent: (fiscalSystem as any).primaryBalanceGDPPercent,
              taxEfficiency: (fiscalSystem as any).taxEfficiency,
            },
          });
        }

        // Create comprehensive Tax System with all related records
        if (input.taxSystemData) {
          const taxSystemData = input.taxSystemData;

          // Create main TaxSystem record
          const taxSystem = await tx.taxSystem.create({
            data: {
              countryId: country.id,
              taxSystemName: taxSystemData.taxSystemName || "National Tax System",
              taxAuthority: taxSystemData.taxAuthority,
              fiscalYear: taxSystemData.fiscalYear || "calendar",
              taxCode: taxSystemData.taxCode,
              baseRate: taxSystemData.baseRate,
              progressiveTax: taxSystemData.progressiveTax ?? true,
              flatTaxRate: taxSystemData.flatTaxRate,
              alternativeMinTax: taxSystemData.alternativeMinTax ?? false,
              alternativeMinRate: taxSystemData.alternativeMinRate,
              taxHolidays: taxSystemData.taxHolidays,
              complianceRate: taxSystemData.complianceRate,
              collectionEfficiency: taxSystemData.collectionEfficiency,
              lastReform: taxSystemData.lastReform,
            },
          });

          console.log(`✅ Created TaxSystem: ${taxSystem.id} for country ${country.id}`);

          // Create tax categories with their brackets, exemptions, and deductions
          if (taxSystemData.categories && taxSystemData.categories.length > 0) {
            for (const categoryData of taxSystemData.categories) {
              const taxCategory = await tx.taxCategory.create({
                data: {
                  taxSystemId: taxSystem.id,
                  categoryName: categoryData.categoryName,
                  categoryType: categoryData.categoryType,
                  description: categoryData.description,
                  isActive: categoryData.isActive ?? true,
                  baseRate: categoryData.baseRate,
                  calculationMethod: categoryData.calculationMethod || "percentage",
                  minimumAmount: categoryData.minimumAmount,
                  maximumAmount: categoryData.maximumAmount,
                  exemptionAmount: categoryData.exemptionAmount,
                  deductionAllowed: categoryData.deductionAllowed ?? true,
                  standardDeduction: categoryData.standardDeduction,
                  priority: categoryData.priority || 50,
                  color: categoryData.color,
                  icon: categoryData.icon,
                },
              });

              console.log(
                `  ✅ Created TaxCategory: ${categoryData.categoryName} (${taxCategory.id})`
              );

              // Create tax brackets for this category
              if (categoryData.brackets && categoryData.brackets.length > 0) {
                for (const bracketData of categoryData.brackets) {
                  await tx.taxBracket.create({
                    data: {
                      taxSystemId: taxSystem.id,
                      categoryId: taxCategory.id,
                      bracketName: bracketData.bracketName,
                      minIncome: bracketData.minIncome,
                      maxIncome: bracketData.maxIncome,
                      rate: bracketData.rate,
                      flatAmount: bracketData.flatAmount,
                      marginalRate: bracketData.marginalRate ?? true,
                      isActive: bracketData.isActive ?? true,
                      priority: bracketData.priority || 50,
                    },
                  });
                }
                console.log(
                  `    ✅ Created ${categoryData.brackets.length} tax brackets for ${categoryData.categoryName}`
                );
              }

              // Create category-specific exemptions
              if (categoryData.exemptions && categoryData.exemptions.length > 0) {
                for (const exemptionData of categoryData.exemptions) {
                  await tx.taxExemption.create({
                    data: {
                      taxSystemId: taxSystem.id,
                      categoryId: taxCategory.id,
                      exemptionName: exemptionData.exemptionName,
                      exemptionType: exemptionData.exemptionType,
                      description: exemptionData.description,
                      exemptionAmount: exemptionData.exemptionAmount,
                      exemptionRate: exemptionData.exemptionRate,
                      qualifications: exemptionData.qualifications,
                      isActive: exemptionData.isActive ?? true,
                      startDate: exemptionData.startDate,
                      endDate: exemptionData.endDate,
                    },
                  });
                }
                console.log(
                  `    ✅ Created ${categoryData.exemptions.length} exemptions for ${categoryData.categoryName}`
                );
              }

              // Create category-specific deductions
              if (categoryData.deductions && categoryData.deductions.length > 0) {
                for (const deductionData of categoryData.deductions) {
                  await tx.taxDeduction.create({
                    data: {
                      categoryId: taxCategory.id,
                      deductionName: deductionData.deductionName,
                      deductionType: deductionData.deductionType,
                      description: deductionData.description,
                      maximumAmount: deductionData.maximumAmount,
                      percentage: deductionData.percentage,
                      qualifications: deductionData.qualifications,
                      isActive: deductionData.isActive ?? true,
                      priority: deductionData.priority || 50,
                    },
                  });
                }
                console.log(
                  `    ✅ Created ${categoryData.deductions.length} deductions for ${categoryData.categoryName}`
                );
              }
            }
          }

          // Create system-wide exemptions (not tied to specific category)
          if (taxSystemData.systemWideExemptions && taxSystemData.systemWideExemptions.length > 0) {
            for (const exemptionData of taxSystemData.systemWideExemptions) {
              await tx.taxExemption.create({
                data: {
                  taxSystemId: taxSystem.id,
                  categoryId: null, // System-wide exemption
                  exemptionName: exemptionData.exemptionName,
                  exemptionType: exemptionData.exemptionType,
                  description: exemptionData.description,
                  exemptionAmount: exemptionData.exemptionAmount,
                  exemptionRate: exemptionData.exemptionRate,
                  qualifications: exemptionData.qualifications,
                  isActive: exemptionData.isActive ?? true,
                  startDate: exemptionData.startDate,
                  endDate: exemptionData.endDate,
                },
              });
            }
            console.log(
              `  ✅ Created ${taxSystemData.systemWideExemptions.length} system-wide exemptions`
            );
          }

          // Create tax policies
          if (taxSystemData.policies && taxSystemData.policies.length > 0) {
            for (const policyData of taxSystemData.policies) {
              await tx.taxPolicy.create({
                data: {
                  taxSystemId: taxSystem.id,
                  policyName: policyData.policyName,
                  policyType: policyData.policyType,
                  description: policyData.description,
                  targetCategory: policyData.targetCategory,
                  impactType: policyData.impactType,
                  rateChange: policyData.rateChange,
                  effectiveDate: policyData.effectiveDate,
                  expiryDate: policyData.expiryDate,
                  isActive: policyData.isActive ?? true,
                  estimatedRevenue: policyData.estimatedRevenue,
                  affectedPopulation: policyData.affectedPopulation,
                },
              });
            }
            console.log(`  ✅ Created ${taxSystemData.policies.length} tax policies`);
          }

          console.log(`✅ Complete tax system created for country ${country.id}`);
        }

        // Create Labor Market record
        if (laborEmployment && Object.keys(laborEmployment).length > 0) {
          await tx.laborMarket.create({
            data: {
              countryId: country.id,
              employmentBySector: (laborEmployment as any).employmentBySector,
              youthUnemploymentRate: (laborEmployment as any).youthUnemploymentRate,
              femaleParticipationRate: (laborEmployment as any).femaleParticipationRate,
              informalEmploymentRate: (laborEmployment as any).informalEmploymentRate,
              medianWage: (laborEmployment as any).medianWage,
              wageGrowthRate: (laborEmployment as any).wageGrowthRate,
              wageBySector: (laborEmployment as any).wageBySector,
            },
          });
        }

        // Create Income Distribution record
        if (incomeWealth && Object.keys(incomeWealth).length > 0) {
          await tx.incomeDistribution.create({
            data: {
              countryId: country.id,
              economicClasses: JSON.stringify(incomeWealth.economicClasses || []),
              top10PercentWealth: (incomeWealth as any).top10PercentWealth,
              bottom50PercentWealth: (incomeWealth as any).bottom50PercentWealth,
              middleClassPercent: (incomeWealth as any).middleClassPercent,
              intergenerationalMobility: (incomeWealth as any).intergenerationalMobility,
              educationMobility: (incomeWealth as any).educationMobility,
            },
          });
        }

        // Create Government Budget record
        if (governmentSpending && Object.keys(governmentSpending).length > 0) {
          await tx.governmentBudget.create({
            data: {
              countryId: country.id,
              spendingCategories: JSON.stringify(governmentSpending.spendingCategories || []),
              spendingEfficiency: (governmentSpending as any).spendingEfficiency,
              publicInvestmentRate: (governmentSpending as any).publicInvestmentRate,
              socialSpendingPercent: (governmentSpending as any).socialSpendingPercent,
            },
          });
        }

        // Create complete Government Structure with departments, budget allocations, and revenue sources
        if (input.governmentStructure) {
          const govInput = input.governmentStructure;

          // Create main GovernmentStructure record
          const govStructure = await tx.governmentStructure.create({
            data: {
              countryId: country.id,
              governmentName: govInput.governmentName || `Government of ${input.name}`,
              governmentType: govInput.governmentType || "Federal Republic",
              headOfState: govInput.headOfState,
              headOfGovernment: govInput.headOfGovernment,
              legislatureName: govInput.legislatureName,
              executiveName: govInput.executiveName,
              judicialName: govInput.judicialName,
              totalBudget: govInput.totalBudget || 0,
              fiscalYear: govInput.fiscalYear || "Calendar Year",
              budgetCurrency: govInput.budgetCurrency || "USD",
            },
          });

          console.log(
            `✅ Created GovernmentStructure: ${govStructure.id} for country ${country.id}`
          );

          // Create departments with hierarchy support (two-pass approach)
          if (govInput.departments && govInput.departments.length > 0) {
            // Map temporary IDs to actual database IDs
            const deptIdMap = new Map<string, string>();

            // First pass: Create all departments without parent links
            for (const deptInput of govInput.departments) {
              const tempId = deptInput.id || deptInput.name; // Use ID or name as temp identifier

              const department = await tx.governmentDepartment.create({
                data: {
                  governmentStructureId: govStructure.id,
                  name: deptInput.name,
                  shortName: deptInput.shortName,
                  category: deptInput.category,
                  description: deptInput.description,
                  minister: deptInput.minister,
                  ministerTitle: deptInput.ministerTitle || "Minister",
                  headquarters: deptInput.headquarters,
                  established: deptInput.established,
                  employeeCount: deptInput.employeeCount,
                  icon: deptInput.icon,
                  color: deptInput.color || "#6366f1",
                  priority: deptInput.priority || 50,
                  isActive: deptInput.isActive ?? true,
                  organizationalLevel: deptInput.organizationalLevel || "Ministry",
                  functions: deptInput.functions ? JSON.stringify(deptInput.functions) : null,
                  kpis: deptInput.kpis,
                  // parentDepartmentId will be set in second pass
                },
              });

              // Store mapping of temporary ID to actual database ID
              deptIdMap.set(tempId, department.id);
            }

            console.log(`  ✅ Created ${govInput.departments.length} departments (first pass)`);

            // Second pass: Link parent departments
            for (const deptInput of govInput.departments) {
              if (deptInput.parentDepartmentId) {
                const tempId = deptInput.id || deptInput.name;
                const actualDeptId = deptIdMap.get(tempId);
                const actualParentId = deptIdMap.get(deptInput.parentDepartmentId);

                if (actualDeptId && actualParentId) {
                  await tx.governmentDepartment.update({
                    where: { id: actualDeptId },
                    data: { parentDepartmentId: actualParentId },
                  });
                }
              }
            }

            console.log(`  ✅ Linked department hierarchy (second pass)`);

            // Create budget allocations for departments
            if (govInput.budgetAllocations && govInput.budgetAllocations.length > 0) {
              for (const allocInput of govInput.budgetAllocations) {
                const actualDeptId = deptIdMap.get(allocInput.departmentId);

                if (actualDeptId) {
                  await tx.budgetAllocation.create({
                    data: {
                      governmentStructureId: govStructure.id,
                      departmentId: actualDeptId,
                      budgetYear: allocInput.budgetYear,
                      allocatedAmount: allocInput.allocatedAmount,
                      allocatedPercent: allocInput.allocatedPercent,
                      spentAmount: allocInput.spentAmount || 0,
                      encumberedAmount: allocInput.encumberedAmount || 0,
                      availableAmount: allocInput.availableAmount || allocInput.allocatedAmount,
                      budgetStatus: allocInput.budgetStatus || "Allocated",
                      notes: allocInput.notes,
                    },
                  });
                }
              }

              console.log(`  ✅ Created ${govInput.budgetAllocations.length} budget allocations`);
            }
          }

          // Create revenue sources
          if (govInput.revenueSources && govInput.revenueSources.length > 0) {
            for (const revenueInput of govInput.revenueSources) {
              await tx.revenueSource.create({
                data: {
                  governmentStructureId: govStructure.id,
                  name: revenueInput.name,
                  category: revenueInput.category,
                  description: revenueInput.description,
                  rate: revenueInput.rate,
                  revenueAmount: revenueInput.revenueAmount,
                  revenuePercent: revenueInput.revenuePercent || 0,
                  isActive: revenueInput.isActive ?? true,
                  collectionMethod: revenueInput.collectionMethod,
                  administeredBy: revenueInput.administeredBy,
                },
              });
            }

            console.log(`  ✅ Created ${govInput.revenueSources.length} revenue sources`);
          }
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
            populationDensity: foundationData?.landArea
              ? population / foundationData.landArea
              : undefined,
            gdpDensity: foundationData?.landArea ? totalGdp / foundationData.landArea : undefined,
          },
        });

        // Create Government Components and calculate synergies
        if (input.governmentComponents && input.governmentComponents.length > 0) {
          const componentRecords = [];

          // Create each government component
          for (const componentInput of input.governmentComponents) {
            const component = await tx.governmentComponent.create({
              data: {
                countryId: country.id,
                componentType: componentInput.componentType as any,
                effectivenessScore: componentInput.effectivenessScore ?? 50,
                implementationDate: new Date(),
                implementationCost: componentInput.implementationCost ?? 0,
                maintenanceCost: componentInput.maintenanceCost ?? 0,
                requiredCapacity: componentInput.requiredCapacity ?? 50,
                isActive: componentInput.isActive ?? true,
                notes: componentInput.notes,
              },
            });
            componentRecords.push(component);
          }

          console.log(`  ✅ Created ${componentRecords.length} government components`);

          // Calculate synergies between components
          const synergies = [];
          for (let i = 0; i < componentRecords.length; i++) {
            for (let j = i + 1; j < componentRecords.length; j++) {
              const comp1 = componentRecords[i]!;
              const comp2 = componentRecords[j]!;

              // Check for synergies and conflicts using comprehensive mapping
              const synergyData = checkComponentSynergy(comp1.componentType, comp2.componentType);

              if (synergyData) {
                const synergy = await tx.componentSynergy.create({
                  data: {
                    countryId: country.id,
                    primaryComponentId: comp1.id,
                    secondaryComponentId: comp2.id,
                    synergyType: synergyData.type,
                    effectMultiplier: synergyData.multiplier,
                    description: synergyData.description,
                  },
                });
                synergies.push(synergy);
              }
            }
          }

          console.log(`  ✅ Detected ${synergies.length} component synergies/conflicts`);

          // Calculate total effectiveness based on synergies and conflicts
          let totalSynergyBonus = 0;
          let conflictPenalty = 0;

          for (const synergy of synergies) {
            if (synergy.synergyType === "CONFLICTING") {
              conflictPenalty += 15; // Standard conflict penalty
            } else if (synergy.synergyType === "ADDITIVE") {
              totalSynergyBonus += 10; // Standard synergy bonus
            } else if (synergy.synergyType === "MULTIPLICATIVE") {
              totalSynergyBonus += synergy.effectMultiplier * 10;
            }
          }

          // Calculate base effectiveness from components
          const baseEffectiveness =
            componentRecords.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
            (componentRecords.length || 1);

          // Calculate final government effectiveness (0-100 range)
          const governmentEffectiveness = Math.max(
            0,
            Math.min(100, baseEffectiveness + totalSynergyBonus - conflictPenalty)
          );

          // Update government structure with effectiveness score (if it exists)
          const existingGovStructure = await tx.governmentStructure.findUnique({
            where: { countryId: country.id },
          });

          if (existingGovStructure) {
            await tx.governmentStructure.update({
              where: { id: existingGovStructure.id },
              data: {
                governmentEffectiveness: governmentEffectiveness,
              },
            });
          }

          console.log(
            `  ✅ Government effectiveness: ${governmentEffectiveness.toFixed(1)}% (base: ${baseEffectiveness.toFixed(1)}%, synergy: +${totalSynergyBonus}, conflicts: -${conflictPenalty})`
          );
        }

        // Create Economy Builder Configuration
        if (input.economyBuilderState) {
          const economyState = input.economyBuilderState;

          // Create Economic Components (atomic economic components)
          if (
            economyState.selectedAtomicComponents &&
            economyState.selectedAtomicComponents.length > 0
          ) {
            const economicComponentRecords = [];

            for (const componentType of economyState.selectedAtomicComponents) {
              const economicComponent = await tx.economicComponent.create({
                data: {
                  countryId: country.id,
                  componentType: componentType as any,
                  effectivenessScore: 50, // Default effectiveness
                  implementationDate: new Date(),
                  implementationCost: 0,
                  maintenanceCost: 0,
                  requiredCapacity: 50,
                  isActive: true,
                  notes: `Added during country creation via Economy Builder`,
                },
              });
              economicComponentRecords.push(economicComponent);
            }

            console.log(
              `  ✅ Created ${economicComponentRecords.length} economic atomic components`
            );
          }

          // Store economy builder structure as JSON in EconomicProfile
          // This preserves the complete economy builder configuration
          const existingProfile = await tx.economicProfile.findUnique({
            where: { countryId: country.id },
          });

          if (existingProfile) {
            // Update existing profile with economy builder data
            await tx.economicProfile.update({
              where: { countryId: country.id },
              data: {
                sectorBreakdown: economyState.structure
                  ? JSON.stringify({
                      economicModel: economyState.structure.economicModel,
                      primarySectors: economyState.structure.primarySectors,
                      secondarySectors: economyState.structure.secondarySectors,
                      tertiarySectors: economyState.structure.tertiarySectors,
                      economicTier: economyState.structure.economicTier,
                      growthStrategy: economyState.structure.growthStrategy,
                      sectors: economyState.sectors || [],
                    })
                  : undefined,
              },
            });
          } else {
            // Create new profile with economy builder data
            await tx.economicProfile.create({
              data: {
                countryId: country.id,
                sectorBreakdown: economyState.structure
                  ? JSON.stringify({
                      economicModel: economyState.structure.economicModel,
                      primarySectors: economyState.structure.primarySectors,
                      secondarySectors: economyState.structure.secondarySectors,
                      tertiarySectors: economyState.structure.tertiarySectors,
                      economicTier: economyState.structure.economicTier,
                      growthStrategy: economyState.structure.growthStrategy,
                      sectors: economyState.sectors || [],
                    })
                  : undefined,
              },
            });
          }

          console.log(`  ✅ Stored economy builder structure in EconomicProfile`);

          // Create or update Labor Market record with economy builder data
          if (economyState.laborMarket) {
            const laborData = economyState.laborMarket;

            const existingLabor = await tx.laborMarket.findUnique({
              where: { countryId: country.id },
            });

            const laborMarketData = {
              countryId: country.id,
              employmentBySector: laborData.sectorDistribution
                ? JSON.stringify(laborData.sectorDistribution)
                : undefined,
              youthUnemploymentRate: laborData.youthUnemploymentRate,
              femaleParticipationRate: laborData.femaleParticipationRate,
              informalEmploymentRate: laborData.employmentType?.informal,
              medianWage: laborData.averageAnnualIncome / 2080, // Convert annual to hourly estimate
              wageGrowthRate: 0, // Default
              wageBySector: laborData.sectorDistribution
                ? JSON.stringify(
                    Object.fromEntries(
                      Object.entries(laborData.sectorDistribution).map(([sector, _]) => [
                        sector,
                        laborData.averageAnnualIncome,
                      ])
                    )
                  )
                : undefined,
            };

            if (existingLabor) {
              await tx.laborMarket.update({
                where: { countryId: country.id },
                data: laborMarketData,
              });
            } else {
              await tx.laborMarket.create({
                data: laborMarketData,
              });
            }

            // Update Country table with labor market summary data
            await tx.country.update({
              where: { id: country.id },
              data: {
                totalWorkforce: laborData.totalWorkforce,
                laborForceParticipationRate: laborData.laborForceParticipationRate,
                employmentRate: laborData.employmentRate,
                unemploymentRate: laborData.unemploymentRate,
                averageWorkweekHours: laborData.averageWorkweekHours,
                minimumWage: laborData.minimumWageHourly * 2080, // Convert hourly to annual
                averageAnnualIncome: laborData.averageAnnualIncome,
              },
            });

            console.log(`  ✅ Created/updated labor market from economy builder`);
          }

          // Create or update Demographics record with economy builder data
          if (economyState.demographics) {
            const demoData = economyState.demographics;

            const existingDemo = await tx.demographics.findUnique({
              where: { countryId: country.id },
            });

            const demographicsData = {
              countryId: country.id,
              ageDistribution: demoData.ageDistribution
                ? JSON.stringify(demoData.ageDistribution)
                : undefined,
              educationLevels: demoData.educationLevels
                ? JSON.stringify(demoData.educationLevels)
                : undefined,
              birthRate: undefined, // Not in economy builder
              deathRate: undefined, // Not in economy builder
              migrationRate: demoData.netMigrationRate,
              dependencyRatio: demoData.totalDependencyRatio,
              medianAge: undefined, // Not in economy builder
              populationGrowthProjection: demoData.populationGrowthRate,
            };

            if (existingDemo) {
              await tx.demographics.update({
                where: { countryId: country.id },
                data: demographicsData,
              });
            } else {
              await tx.demographics.create({
                data: demographicsData,
              });
            }

            // Update Country table with demographics summary
            await tx.country.update({
              where: { id: country.id },
              data: {
                currentPopulation: demoData.totalPopulation,
                populationGrowthRate: demoData.populationGrowthRate,
                lifeExpectancy: demoData.lifeExpectancy,
                urbanPopulationPercent: demoData.urbanRuralSplit?.urban,
                ruralPopulationPercent: demoData.urbanRuralSplit?.rural,
                literacyRate: demoData.literacyRate,
              },
            });

            console.log(`  ✅ Created/updated demographics from economy builder`);
          }

          // Create SectoralOutput records for each sector configuration
          if (economyState.sectors && economyState.sectors.length > 0) {
            // First, ensure we have an EconomicModel to link to
            let economicModel = await tx.economicModel.findUnique({
              where: { countryId: country.id },
            });

            if (!economicModel) {
              // Create basic economic model
              economicModel = await tx.economicModel.create({
                data: {
                  countryId: country.id,
                  baseYear: new Date().getFullYear(),
                  projectionYears: 20,
                  gdpGrowthRate: coreIndicators.realGDPGrowthRate || 3.0,
                  inflationRate: coreIndicators.inflationRate || 2.0,
                  unemploymentRate: economyState.laborMarket?.unemploymentRate || 5,
                  interestRate: 3.5,
                  exchangeRate: coreIndicators.currencyExchangeRate || 1.0,
                  populationGrowthRate: economyState.demographics?.populationGrowthRate || 1.0,
                  investmentRate: 0.25,
                  fiscalBalance: 0,
                  tradeBalance: 0,
                },
              });
            }

            // Calculate total GDP from sectors
            if (economyState.structure?.totalGDP) {
              const structureTotalGDP = economyState.structure.totalGDP;
              const totalSectorGDP = economyState.sectors.reduce((sum, sector) => {
                return sum + (structureTotalGDP * sector.gdpContribution) / 100;
              }, 0);

              // Create sectoral output for current year
              const currentYear = new Date().getFullYear();

              // Group sectors by category
              const agricultureGDP = economyState.sectors
                .filter((s) => s.category === "Primary")
                .reduce((sum, s) => sum + (structureTotalGDP * s.gdpContribution) / 100, 0);

              const industryGDP = economyState.sectors
                .filter((s) => s.category === "Secondary")
                .reduce((sum, s) => sum + (structureTotalGDP * s.gdpContribution) / 100, 0);

              const servicesGDP = economyState.sectors
                .filter((s) => s.category === "Tertiary")
                .reduce((sum, s) => sum + (structureTotalGDP * s.gdpContribution) / 100, 0);

              await tx.sectoralOutput.create({
                data: {
                  economicModelId: economicModel.id,
                  year: currentYear,
                  agriculture: agricultureGDP,
                  industry: industryGDP,
                  services: servicesGDP,
                  government: structureTotalGDP * 0.15, // Default 15% government
                  totalGDP: structureTotalGDP,
                },
              });
            }

            console.log(
              `  ✅ Created sectoral output records for ${economyState.sectors.length} sectors`
            );
          }

          console.log(`✅ Complete economy builder state persisted for country ${country.id}`);
        }

        // Link user to country
        await tx.user.update({
          where: { clerkUserId: userId },
          data: { countryId: country.id },
        });

        return country;
        });

        console.log(`✅ Country created successfully: ${result.name} (ID: ${result.id})`);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Unique constraint')) {
            throw new Error(`A country with the name "${input.name}" already exists`);
          }
          console.error('[createCountry] Transaction failed:', error);
          throw new Error(`Failed to create country: ${error.message}`);
        }
        throw error;
      }
    }),

  // Get global analytics for dashboard
  // Using cachedPublicProcedure for analytics (60s TTL)
  getGlobalAnalytics: cachedPublicProcedure.query(async ({ ctx }) => {
    // Get all countries
    const countries = await ctx.db.country.findMany({
      where: { isDemo: false },
      take: 500,
      select: {
        id: true,
        currentTotalGdp: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        economicTier: true,
        adjustedGdpGrowth: true,
        populationGrowthRate: true,
      },
    });

    const totalCountries = countries.length;
    const totalGdp = countries.reduce((sum, c) => sum + (c.currentTotalGdp || 0), 0);
    const totalPopulation = countries.reduce((sum, c) => sum + (c.currentPopulation || 0), 0);
    const avgGdpPerCapita = totalPopulation > 0 ? totalGdp / totalPopulation : 0;

    // Calculate average growth rate
    const totalGrowth = countries.reduce((sum, c) => sum + (c.adjustedGdpGrowth || 0), 0);
    const avgGrowthRate = totalCountries > 0 ? totalGrowth / totalCountries : 0;

    // Calculate tier distribution
    const tierDistribution: Record<string, number> = {};
    countries.forEach((c) => {
      const tier = c.economicTier || "Unknown";
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    });

    return {
      totalCountries,
      totalGdp,
      totalPopulation,
      avgGdpPerCapita,
      avgGrowthRate,
      tierDistribution,
      timestamp: new Date(),
    };
  }),

  /** Lore Score — measures worldbuilding depth from wiki + maps + engagement. */
  getLoreScore: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { name: true, wikiPageTitle: true },
      });
      if (!country) return null;

      // Fetch wiki metrics if country has a wiki page
      let wikiData: { articleLength?: number; sectionCount?: number; satelliteCount?: number } = {};
      if (country.wikiPageTitle) {
        try {
          const { getArticleWikitext, searchPages, getPageSections } = await import("~/lib/wiki-bridge");
          const [article, satellites, sections] = await Promise.allSettled([
            getArticleWikitext(country.wikiPageTitle),
            searchPages(country.name, 30),
            getPageSections(country.wikiPageTitle),
          ]);

          if (article.status === "fulfilled" && article.value) {
            wikiData.articleLength = article.value.length ?? 0;
          }
          if (satellites.status === "fulfilled" && satellites.value) {
            // Count articles that mention this country but aren't the main article
            wikiData.satelliteCount = satellites.value.filter(
              (s: { title: string }) => s.title !== country.wikiPageTitle
            ).length;
          }
          if (sections.status === "fulfilled" && sections.value) {
            wikiData.sectionCount = Array.isArray(sections.value) ? sections.value.length : 0;
          }
        } catch {
          // Wiki access is best-effort
        }
      }

      const { calculateLoreScore } = await import("~/lib/lore-score-calculator");
      return calculateLoreScore(ctx.db, input.countryId, wikiData);
    }),
});

export { countriesRouter };
