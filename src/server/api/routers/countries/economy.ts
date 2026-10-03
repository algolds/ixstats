import { z } from "zod";
import type { Prisma, PrismaClient, StorytellerEffect } from "@prisma/client";
import {
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  cachedStaticProcedure,
} from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import type { EconomicConfig } from "~/types/ixstats";
import { IxStatsCalculator } from "~/lib/economy/calculations";
import { tradeFigures } from "~/lib/economy/trade-figures";
import { getEconomicTierFromGdpPerCapita } from "~/types/ixstats";
import { loadVitalityExtras, scoreGovernmentalEfficiency } from "~/server/shared/mycountry-helpers";
import {
  prepareBaseCountryData,
  getGrowthRates,
  mean,
  stddev,
  getCountryComponentsStatsData,
  resolveCountryRefId,
} from "./utils";
import {
  assertCountryWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { redactEconomicBudget } from "~/lib/country/public-record";

const HEAVY_COUNTRY_GEO_OMIT = { geometry: true, centroid: true, boundingBox: true } as const;

const SOVEREIGN_OWNER_SELECT = {
  id: true,
  clerkUserId: true,
  forumUsername: true,
  wikiUsername: true,
  membershipTier: true,
  role: { select: { displayName: true, name: true } },
} satisfies Prisma.UserSelect;
type SovereignOwner = Prisma.UserGetPayload<{ select: typeof SOVEREIGN_OWNER_SELECT }>;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const LEAN_INCLUDE = {
  storytellerEffects: { where: { isActive: true }, orderBy: { ixTimeTimestamp: "desc" } },
  owner: { select: SOVEREIGN_OWNER_SELECT },
  realm: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.CountryInclude;

const ECONOMIC_INCLUDE = {
  ...LEAN_INCLUDE,
  // Read by the MyCountry Standing band (issues and directives move these).
  stabilityMetrics: {
    select: { stabilityScore: true, trustInGovernment: true, socialCohesion: true },
  },
  economicProfile: true,
  laborMarket: true,
  fiscalSystem: true,
  incomeDistribution: true,
  governmentBudget: true,
  demographics: true,
  nationalIdentity: true,
} satisfies Prisma.CountryInclude;

/** Country columns surfaced as `undefined` (not `null`) so the client's optional props stay unset. */
const STORED_FIELDS = [
  "totalWorkforce",
  "averageWorkweekHours",
  "minimumWage",
  "averageAnnualIncome",
  "taxRevenuePerCapita",
  "governmentRevenueTotal",
  "governmentBudgetGDPPercent",
  "budgetDeficitSurplus",
  "internalDebtGDPPercent",
  "externalDebtGDPPercent",
  "totalDebtGDPRatio",
  "debtPerCapita",
  "interestRates",
  "debtServiceCosts",
  "povertyRate",
  "incomeInequalityGini",
  "socialMobilityIndex",
  "spendingGDPPercent",
  "spendingPerCapita",
  "lifeExpectancy",
  "literacyRate",
  "urbanPopulationPercent",
  "ruralPopulationPercent",
] as const;

/** Projected stats that override the stored column, again `undefined` when absent. */
const STATS_FIELDS = [
  "populationDensity",
  "gdpDensity",
  "unemploymentRate",
  "taxRevenueGDPPercent",
  "totalGovernmentSpending",
  "inflationRate",
] as const;

type HistoryPoint = Pick<
  Prisma.HistoricalDataPointGetPayload<object>,
  "ixTimeTimestamp" | "population" | "gdpPerCapita" | "totalGdp"
>;

function undefinedIfNull<T, K extends keyof T>(source: T, keys: readonly K[]) {
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? undefined])) as {
    [P in K]: NonNullable<T[P]> | undefined;
  };
}

function flagsWhere(checks: Record<string, boolean>): string[] {
  return Object.keys(checks).filter((flag) => checks[flag]);
}

/** The first projected year whose GDP per capita crosses the next economic-tier threshold. */
function projectTierChange(thresholds: number[], currentGdpPc: number, projectedGdpPc: number[]) {
  const nextTier = [...thresholds]
    .sort((a, b) => a - b)
    .find((threshold) => threshold > currentGdpPc);
  const crossing = nextTier ? projectedGdpPc.findIndex((gdpPc) => gdpPc >= nextTier) : -1;
  if (crossing < 0) return null;
  return {
    year: new Date().getFullYear() + crossing + 1,
    newTier: getEconomicTierFromGdpPerCapita(projectedGdpPc[crossing]!),
  };
}

async function findCountryWithEconomics(db: PrismaClient, countryId: string) {
  const query = { where: { id: countryId }, omit: HEAVY_COUNTRY_GEO_OMIT };
  try {
    return await db.country.findFirst({ ...query, include: ECONOMIC_INCLUDE });
  } catch {
    return await db.country.findFirst({ ...query, include: LEAN_INCLUDE });
  }
}

/** The calculator, baseline stats and (epoch-ms) active effects every projection starts from. */
async function startProgression(
  db: PrismaClient,
  country: { id: string; baselineDate: Date; storytellerEffects: StorytellerEffect[] },
  econCfg: EconomicConfig
) {
  const calc = new IxStatsCalculator(econCfg, country.baselineDate.getTime());
  const componentsData = await getCountryComponentsStatsData(db, country.id);
  const baselineStats = calc.initializeCountryStats(
    prepareBaseCountryData(country, componentsData)
  );
  const effects = country.storytellerEffects.map((effect) => ({
    ...effect,
    ixTimeTimestamp: effect.ixTimeTimestamp.getTime(),
  }));
  return { calc, baselineStats, effects };
}

export const economyProcedures = {
  /**
   * The country record with its economic relations and projections. Public (profile, factbook,
   * MyCountry); the sector spending split (`governmentBudget`, `fiscalSystem.spendingByCategory`)
   * goes to the nation's owner and privileged roles only (`redactEconomicBudget`).
   */
  getByIdWithEconomicData: rateLimitedPublicProcedure
    .input(
      z.object({
        id: z.string(),
        timestamp: z.number().optional(),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const realmId = await viewerRealmId(ctx, input.realm);
      const countryId = await resolveCountryRefId(ctx.db, input.id, realmId);
      if (!countryId) return null;

      const country = await findCountryWithEconomics(ctx.db, countryId);
      if (!country) return null;

      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const { calc, baselineStats, effects } = await startProgression(ctx.db, country, econCfg);

      const result = calc.calculateTimeProgression(baselineStats, targetTime, effects);
      const projections = Array.from({ length: 5 }, (_, i) => {
        const ixTime = targetTime + (i + 1) * ONE_YEAR_MS;
        return {
          ixTime,
          stats: calc.calculateTimeProgression(baselineStats, ixTime, effects).newStats,
        };
      });

      let historical: HistoryPoint[] = await ctx.db.historicalDataPoint.findMany({
        where: {
          countryId: country.id,
          ixTimeTimestamp: {
            gte: new Date(targetTime - 5 * ONE_YEAR_MS),
            lte: new Date(targetTime),
          },
        },
        select: { ixTimeTimestamp: true, population: true, gdpPerCapita: true, totalGdp: true },
        orderBy: { ixTimeTimestamp: "asc" },
        take: 1000,
      });
      if (historical.length < 5) {
        historical = [5, 4, 3, 2, 1].map((yearsAgo) => {
          const pastTime = targetTime - yearsAgo * ONE_YEAR_MS;
          const { newStats } = calc.calculateTimeProgression(baselineStats, pastTime, effects);
          return {
            ixTimeTimestamp: new Date(pastTime),
            population: newStats.currentPopulation,
            gdpPerCapita: newStats.currentGdpPerCapita,
            totalGdp: newStats.currentTotalGdp,
          };
        });
      }

      const popGrowthRates = getGrowthRates(historical, "population");
      const gdpGrowthRates = getGrowthRates(historical, "gdpPerCapita");
      const avgPopGrowth = mean(popGrowthRates);
      const avgGdpGrowth = mean(gdpGrowthRates);
      const popVolatility = stddev(popGrowthRates);
      const gdpVolatility = stddev(gdpGrowthRates);
      const riskFlags = flagsWhere({
        negative_population_growth: avgPopGrowth < 0,
        negative_gdp_per_capita_growth: avgGdpGrowth < 0,
        high_population_volatility: popVolatility > 0.05,
        high_gdp_per_capita_volatility: gdpVolatility > 0.05,
      });
      const vulnerabilities = flagsWhere({
        low_population_growth: avgPopGrowth < 0.002,
        low_gdp_per_capita_growth: avgGdpGrowth < 0.01,
      });

      const tierChangeProjection = projectTierChange(
        Object.values(econCfg.economicTierThresholds),
        result.newStats.currentGdpPerCapita,
        projections.map((p) => p.stats.currentGdpPerCapita)
      );

      // `country` comes from an `include: any` query, so pin the owner to the shape selected above.
      const rawUser = country.owner as SovereignOwner | null;
      const sovereignUser = rawUser
        ? {
            id: rawUser.id,
            username: rawUser.forumUsername || rawUser.wikiUsername || rawUser.clerkUserId || null,
            roleName: rawUser.role?.displayName || rawUser.role?.name || "Sovereign Regent",
            membershipTier: rawUser.membershipTier || "citizen",
          }
        : null;

      const { newStats } = result;
      const response = {
        ...country,
        sovereignUser,
        currentPopulation: newStats.currentPopulation,
        currentGdpPerCapita: newStats.currentGdpPerCapita,
        currentTotalGdp: newStats.currentTotalGdp,
        nominalGDP: newStats.currentTotalGdp,
        economicTier: newStats.economicTier,
        populationTier: newStats.populationTier,
        ...undefinedIfNull(country, STORED_FIELDS),
        ...undefinedIfNull(newStats, STATS_FIELDS),
        calculatedStats: {
          gdpGrowth: newStats.adjustedGdpGrowth || 0,
          populationGrowth: newStats.populationGrowthRate || 0,
        },
        projections: projections.map((p) => ({
          year: new Date(p.ixTime).getFullYear(),
          gdp: p.stats.currentTotalGdp,
          population: p.stats.currentPopulation,
        })),
        historical: historical.map((h) => ({
          year: new Date(h.ixTimeTimestamp).getFullYear(),
          gdp: h.totalGdp,
          population: h.population,
        })),
        storytellerEffects: effects,
        analytics: {
          growthTrends: { avgPopGrowth, avgGdpGrowth },
          volatility: { popVolatility, gdpVolatility },
          riskFlags,
          tierChangeProjection: tierChangeProjection ?? {
            year: new Date().getFullYear(),
            newTier: country.economicTier,
          },
          vulnerabilities,
        },
        lastCalculated:
          country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : Date.now(),
      };

      const record = { ...response, ownerClerkUserId: rawUser?.clerkUserId ?? null };

      return (
        (await hasCountryWriteAccess(ctx, country.id)) ? record : redactEconomicBudget(record)
      ) as any;
    }),

  getByIdAtTime: publicProcedure
    .input(z.object({ id: z.string(), timestamp: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.id },
        omit: HEAVY_COUNTRY_GEO_OMIT,
        include: {
          storytellerEffects: { where: { isActive: true } },
          nationalIdentity: true,
        },
      });

      if (!country) return null;

      const targetTime = input.timestamp ?? IxTime.getCurrentIxTime();
      const econCfg = await getEconomicConfigFromDB(ctx.db);
      const { calc, baselineStats, effects } = await startProgression(ctx.db, country, econCfg);

      const calculatedStats = calc.calculateTimeProgression(baselineStats, targetTime, effects);

      return {
        ...country,
        calculatedStats: {
          currentPopulation: calculatedStats.newStats.currentPopulation,
          currentGdpPerCapita: calculatedStats.newStats.currentGdpPerCapita,
          currentTotalGdp: calculatedStats.newStats.currentTotalGdp,
        },
        newStats: calculatedStats.newStats,
        oldStats: calculatedStats.oldStats,
        country: country.name,
        timeElapsed: calculatedStats.timeElapsed,
        calculationDate: calculatedStats.calculationDate,
      };
    }),

  // Editor-only loader: the relational subsystems the builder/editor needs to
  // rehydrate state that getByIdAtTime (kept lean for its 14 hot-path callers)
  // does not include. Owner/admin gated like updateCountry.
  getEditorRelations: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const [
        demographics,
        incomeDistribution,
        governmentBudget,
        economicProfile,
        governmentComponents,
        economicComponents,
      ] = await Promise.all([
        ctx.db.demographics.findUnique({ where: { countryId: input.countryId } }),
        ctx.db.incomeDistribution.findUnique({ where: { countryId: input.countryId } }),
        ctx.db.governmentBudget.findUnique({ where: { countryId: input.countryId } }),
        ctx.db.economicProfile.findUnique({ where: { countryId: input.countryId } }),
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      return {
        demographics,
        incomeDistribution,
        governmentBudget,
        economicProfile,
        governmentComponents,
        economicComponents,
      };
    }),

  getGlobalStats: cachedStaticProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false, realmId: await viewerRealmId(ctx, input?.realm) },
        select: {
          currentPopulation: true,
          currentTotalGdp: true,
          landArea: true,
        },
      });

      const totalPop = countries.reduce((acc, c) => acc + (c.currentPopulation || 0), 0);
      const totalGdp = countries.reduce((acc, c) => acc + (c.currentTotalGdp || 0), 0);
      const totalArea = countries.reduce((acc, c) => acc + (c.landArea || 0), 0);

      return {
        totalPopulation: totalPop,
        totalGdp: totalGdp,
        totalLandArea: totalArea,
        avgGdpPerCapita: totalPop > 0 ? totalGdp / totalPop : 0,
        count: countries.length,
      };
    }),

  // Recorded trade figures for a country (percent-of-GDP exports/imports times GDP); null when unrecorded
  getTradeData: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          currentTotalGdp: true,
          economicProfile: { select: { exportsGDPPercent: true, importsGDPPercent: true } },
        },
      });

      if (!country) {
        throw new Error("Country not found");
      }

      const { exports, imports, balance } = tradeFigures({
        nominalGDP: country.currentTotalGdp,
        ...country.economicProfile,
      });
      if (exports === null || imports === null) return null;

      return {
        totalVolume: exports + imports,
        exports,
        imports,
        tradeBalance: balance,
      };
    }),

  getActivityRingsData: rateLimitedPublicProcedure
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
        const { calc, baselineStats, effects } = await startProgression(ctx.db, country, econCfg);
        const currentStats = calc.calculateTimeProgression(baselineStats, currentTime, effects);

        const popGrowthRate = currentStats.newStats.populationGrowthRate || 0;

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

        // Diplomatic Standing and Governmental Efficiency come from the diplomacy tables and
        // the government structure (null = no data, shown as "—"), never from stored fields.
        const vitalityExtras = await loadVitalityExtras(country.id, ctx.db);
        const diplomaticStanding = vitalityExtras.diplomaticStanding ?? null;
        const governmentalEfficiency = scoreGovernmentalEfficiency(
          vitalityExtras.governmentEffectiveness
        );
        const diplomaticInputs = vitalityExtras.diplomaticInputs;

        const economicVitality =
          country.economicVitality && country.economicVitality > 5
            ? country.economicVitality
            : calculateEconomicVitality();

        const populationWellbeing =
          country.populationWellbeing && country.populationWellbeing > 5
            ? country.populationWellbeing
            : calculatePopulationWellbeing();

        return {
          economicVitality: Math.round(economicVitality),
          populationWellbeing: Math.round(populationWellbeing),
          diplomaticStanding,
          governmentalEfficiency,
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
            allies: `${diplomaticInputs.allianceMemberships}`,
            reputation:
              diplomaticStanding === null
                ? "—"
                : diplomaticStanding > 75
                  ? "Strong"
                  : diplomaticStanding > 50
                    ? "Stable"
                    : "Developing",
            treaties: `${diplomaticInputs.activeTreaties}`,
          },
          governmentMetrics: {
            approval: `${Math.round(country.publicApproval)}%`,
            efficiency:
              governmentalEfficiency === null
                ? "—"
                : governmentalEfficiency > 80
                  ? "Excellent"
                  : governmentalEfficiency > 60
                    ? "Good"
                    : "Improving",
            stability:
              (diplomaticStanding ?? 0) > 70 && (governmentalEfficiency ?? 0) > 60
                ? "Stable"
                : "Monitored",
          },
          generatedAt: currentTime,
        };
      } catch (error) {
        console.error("Failed to generate activity rings data:", error);
        throw new Error("Failed to generate activity rings data", { cause: error });
      }
    }),
};
