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
import { globalCache } from "~/lib/advanced-cache-system";
import {
  calculateVitalityScores,
  calculateAchievements,
  generateRankings,
  generateMilestones,
  getMyCountryCache,
  setMyCountryCache,
} from "~/server/shared/mycountry-helpers";

import type { NationalSummary } from "~/types/mycountry";

export const myCountryDashboardRouter = createTRPCRouter({
  /**
   * Get comprehensive country data with vitality scores for MyCountry dashboard
   */
  getCountryDashboard: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeHistory: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const cacheKey = `dashboard_${input.countryId}_hist_${input.includeHistory}`;
      try {
        const cached = await globalCache.get<any>(cacheKey);
        if (cached) return cached;

        const country = await db.country.findUnique({
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

        // Calculate vitality scores
        const vitalityScores = calculateVitalityScores(country as any);

        const result = {
          ...country,
          ...vitalityScores,
          lastCalculated: country.lastCalculated.getTime(),
          baselineDate: country.baselineDate.getTime(),
        };

        await globalCache.set(cacheKey, result, { ttl: 15 });
        return result;
      } catch (error) {
        console.error("[MyCountry Dashboard] Error:", error);
        throw new Error("Failed to get country dashboard data");
      }
    }),

  /**
   * Get achievements and recognition for the country
   */
  getAchievements: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return calculateAchievements(input.countryId);
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
   * Get historical milestones for the country
   */
  getMilestones: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return generateMilestones(input.countryId);
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

        const vitalityScores = calculateVitalityScores(country as any);

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
        throw new Error("Failed to get national summary");
      }
    }),

  /**
   * Get auto-generated news feed for a country.
   * Queries storytellerEffect records (generated by executive actions) so players
   * can see the narrative consequences of their diplomacy, economic, and military operations.
   */
  getNewsFeed: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ input }) => {
      try {
        const effects = await db.storytellerEffect.findMany({
          where: {
            countryId: input.countryId,
            OR: [
              { isActive: true },
              { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            ],
          },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 20,
          select: {
            id: true,
            description: true,
            inputType: true,
            value: true,
            ixTimeTimestamp: true,
            createdAt: true,
          },
        });

        return effects;
      } catch (error) {
        console.error("[MyCountry NewsFeed] Error:", error);
        return [];
      }
    }),

  /**
   * Get unified canon feed for a country.
   * Merges storyteller effects, diplomatic events, and resolved national issues into a
   * single chronological story. Excludes ThinkPages posts to avoid double-counting.
   */
  getCanonFeed: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(60).default(30),
      })
    )
    .query(async ({ input }) => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [effects, events, decisions, logs] = await Promise.all([
          db.storytellerEffect.findMany({
            where: { countryId: input.countryId, ixTimeTimestamp: { gte: since } },
            orderBy: { ixTimeTimestamp: "desc" },
            take: input.limit,
            select: { id: true, description: true, inputType: true, ixTimeTimestamp: true },
          }),
          db.diplomaticEvent.findMany({
            where: {
              OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }],
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: { id: true, title: true, eventType: true, severity: true, createdAt: true },
          }),
          db.nationalIssue.findMany({
            where: {
              countryId: input.countryId,
              status: { in: ["responded", "auto_resolved"] },
            },
            orderBy: { respondedAt: "desc" },
            take: input.limit,
            select: { id: true, title: true, domain: true, respondedAt: true, updatedAt: true },
          }),
          db.countryChangeLog.findMany({
            where: { countryId: input.countryId },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: {
              id: true,
              description: true,
              deltaValue: true,
              targetField: true,
              sourceType: true,
              createdAt: true,
            },
          }),
        ]);

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

  /**
   * Get CountryChangeLog ledger entries
   */
  getChangeLog: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      try {
        const logs = await db.countryChangeLog.findMany({
          where: { countryId: input.countryId },
          orderBy: { appliedIxTime: "desc" },
          take: input.limit,
        });
        return logs;
      } catch (error) {
        console.error("[MyCountry ChangeLog] Error:", error);
        return [];
      }
    }),
});
