/**
 * MyCountry API Router - Dedicated endpoints for MyCountry system
 *
 * This router provides specialized endpoints for the MyCountry interface including:
 * - Intelligence feed aggregation from multiple sources
 * - Achievement system with real-time calculations
 * - Executive dashboard data compilation
 * - National vitality metrics computation
 * - Historical timeline and milestone tracking
 * - Real-time notification generation
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { globalCache } from "~/lib/cache";
import {
  calculateVitalityScores,
  generateRankings,
  getMyCountryCache,
  loadVitalityExtras,
  setMyCountryCache,
} from "~/server/shared/mycountry-helpers";

import type { NationalSummary } from "~/types/mycountry";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  isBudgetLedgerRow,
  isPublicDirective,
  redactEconomicBudget,
} from "~/lib/country/public-record";

/** `StorytellerEffect.createdBy` of a directive's GDP effect: `intent:<id>`. */
const INTENT_EFFECT_PREFIX = "intent:";

export const myCountryDashboardRouter = createTRPCRouter({
  /**
   * Country data with vitality scores for the MyCountry dashboard. The budget relations
   * (`governmentBudget`, `fiscalSystem.spendingByCategory`) go to the nation's owner and
   * privileged roles only; the cache holds the full record and visitors get it redacted.
   */
  getCountryDashboard: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeHistory: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `dashboard_${input.countryId}_hist_${input.includeHistory}`;
      const forViewer = async <T extends Record<string, any>>(record: T): Promise<T> =>
        (await hasCountryWriteAccess(ctx, input.countryId)) ? record : redactEconomicBudget(record);
      try {
        const cached = await globalCache.get<any>(cacheKey);
        if (cached) return await forViewer(cached);

        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            historicalData: input.includeHistory
              ? {
                  orderBy: { ixTimeTimestamp: "desc" },
                  take: 30,
                }
              : false,
            demographics: true,
            economicProfile: true,
            laborMarket: true,
            fiscalSystem: true,
            incomeDistribution: true,
            governmentBudget: true,
          },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        // Calculate vitality scores (diplomacy + government read from their own tables)
        const extras = await loadVitalityExtras(country.id, ctx.db);
        const vitalityScores = calculateVitalityScores(country as any, extras);

        const result = {
          ...country,
          ...vitalityScores,
          lastCalculated: country.lastCalculated.getTime(),
          baselineDate: country.baselineDate.getTime(),
        };

        await globalCache.set(cacheKey, result, { ttl: 15 });
        return await forViewer(result);
      } catch (error) {
        console.error("[MyCountry Dashboard] Error:", error);
        throw new Error("Failed to get country dashboard data", { cause: error });
      }
    }),

  /**
   * Get international rankings for the country
   */
  getRankings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return generateRankings(input.countryId);
    }),

  /**
   * Get summary statistics for national overview
   */
  getNationalSummary: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const cacheKey = `summary_${input.countryId}`;
      const cached = await getMyCountryCache<NationalSummary>(cacheKey);
      if (cached) return cached;

      try {
        const country = await db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        const extras = await loadVitalityExtras(country.id);
        const vitalityScores = calculateVitalityScores(country as any, extras);

        const summary: NationalSummary = {
          countryId: country.id,
          countryName: country.name,
          overallHealth: vitalityScores.overallScore,
          keyMetrics: {
            population: country.currentPopulation,
            gdpPerCapita: country.currentGdpPerCapita,
            totalGdp: country.currentTotalGdp,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
          },
          growthRates: {
            population: country.populationGrowthRate,
            economic: country.adjustedGdpGrowth,
          },
          vitalityScores,
          lastUpdated: country.lastCalculated.getTime(),
        };

        await setMyCountryCache(cacheKey, summary, 180000); // Cache for 3 minutes
        return summary;
      } catch (error) {
        console.error("[MyCountry Summary] Error:", error);
        throw new Error("Failed to get national summary", { cause: error });
      }
    }),

  /**
   * Get unified canon feed for a country.
   * Merges storyteller effects, diplomatic events, and resolved national issues into a
   * single chronological story. Excludes ThinkPages posts to avoid double-counting.
   *
   * Public, filtered for visitors: anyone but the nation's owner and privileged roles gets no
   * effect or ledger entry tied to a directive that is not public (drafts, abandoned:
   * `isPublicDirective`), and no ledger entry that moves a budget (`isBudgetLedgerRow`).
   */
  getCanonFeed: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(60).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [rawEffects, events, decisions, rawLogs, isOwner] = await Promise.all([
          ctx.db.storytellerEffect.findMany({
            where: { countryId: input.countryId, ixTimeTimestamp: { gte: since } },
            orderBy: { ixTimeTimestamp: "desc" },
            take: input.limit,
            select: {
              id: true,
              description: true,
              inputType: true,
              ixTimeTimestamp: true,
              createdBy: true,
            },
          }),
          ctx.db.diplomaticEvent.findMany({
            where: {
              OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: { id: true, title: true, eventType: true, severity: true, createdAt: true },
          }),
          ctx.db.nationalIssue.findMany({
            where: {
              countryId: input.countryId,
              status: { in: ["responded", "auto_resolved"] },
            },
            orderBy: { respondedAt: "desc" },
            take: input.limit,
            select: { id: true, title: true, domain: true, respondedAt: true, updatedAt: true },
          }),
          ctx.db.countryChangeLog.findMany({
            where: { countryId: input.countryId },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: {
              id: true,
              description: true,
              deltaValue: true,
              targetModel: true,
              targetField: true,
              sourceType: true,
              sourceId: true,
              createdAt: true,
            },
          }),
          hasCountryWriteAccess(ctx, input.countryId),
        ]);

        let effects = rawEffects;
        let logs = rawLogs;
        if (!isOwner) {
          // Directives behind the feed's entries: a directive's ledger rows carry
          // sourceType "decision" + its id, its GDP effect createdBy "intent:<id>".
          const effectIntentId = (e: { createdBy?: string | null }) =>
            e.createdBy?.startsWith(INTENT_EFFECT_PREFIX)
              ? e.createdBy.slice(INTENT_EFFECT_PREFIX.length)
              : null;
          const logIntentId = (l: { sourceType?: string | null; sourceId?: string | null }) =>
            l.sourceType === "decision" && l.sourceId ? l.sourceId : null;
          const intentIds = [
            ...new Set(
              [...rawEffects.map(effectIntentId), ...rawLogs.map(logIntentId)].filter(
                (id): id is string => !!id
              )
            ),
          ];
          const intents =
            intentIds.length > 0
              ? await ctx.db.intent.findMany({
                  where: { id: { in: intentIds }, countryId: input.countryId },
                  select: { id: true, status: true, tier: true },
                })
              : [];
          const publicIntents = new Set(intents.filter(isPublicDirective).map((i) => i.id));
          // A missing directive (deleted, or another country's) counts as private.
          const isPublicSource = (intentId: string | null) =>
            intentId === null || publicIntents.has(intentId);
          effects = rawEffects.filter((e) => isPublicSource(effectIntentId(e)));
          logs = rawLogs.filter((l) => isPublicSource(logIntentId(l)) && !isBudgetLedgerRow(l));
        }

        type CanonFeedItem = {
          id: string;
          kind: "effect" | "diplomacy" | "decision" | "ledger";
          title: string;
          category: string;
          timestamp: number;
          deltaValue?: number | null;
          targetField?: string | null;
          sourceType?: string | null;
        };
        const items: CanonFeedItem[] = [
          ...effects.map((e) => ({
            id: `eff_${e.id}`,
            kind: "effect" as const,
            title: e.description ?? e.inputType,
            category: e.inputType.toLowerCase().includes("popula") ? "social" : "economic",
            timestamp: e.ixTimeTimestamp.getTime(),
          })),
          ...events.map((d) => ({
            id: `dip_${d.id}`,
            kind: "diplomacy" as const,
            title: d.title,
            category: d.severity && d.severity !== "info" ? "emergency" : "diplomatic",
            timestamp: d.createdAt.getTime(),
          })),
          ...decisions.map((n) => ({
            id: `dec_${n.id}`,
            kind: "decision" as const,
            title: n.title,
            category: "governance",
            timestamp: (n.respondedAt ?? n.updatedAt).getTime(),
          })),
          ...logs.map((l) => ({
            id: `log_${l.id}`,
            kind: "ledger" as const,
            title: l.description,
            category: "ledger",
            timestamp: l.createdAt.getTime(),
            deltaValue: l.deltaValue,
            targetField: l.targetField,
            sourceType: l.sourceType,
          })),
        ];

        items.sort((a, b) => b.timestamp - a.timestamp);
        return items.slice(0, input.limit);
      } catch (error) {
        console.error("[MyCountry CanonFeed] Error:", error);
        return [];
      }
    }),
});
