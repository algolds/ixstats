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
import { createTRPCRouter, protectedProcedure, countryOwnerProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";

import { notificationAPI } from "~/lib/notifications/api";
import { notificationHooks } from "~/lib/notifications/hooks";
import {
  generateIntelligenceFeed,
  calculateVitalityScores,
} from "~/server/shared/mycountry-helpers";

export const myCountryIntelligenceRouter = createTRPCRouter({
  /**
   * Update and track vitality scores with notifications.
   * Computes vitality server-side from authoritative country data — the client
   * never submits scores (prevents fabricated values).
   */
  updateVitalityTracking: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.countryId !== input.countryId) {
        throw new Error("FORBIDDEN: Cannot access other countries' vitality data");
      }

      try {
        // Fetch country data server-side and compute vitality authoritatively
        const country = await db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new Error("Country not found");
        }

        const vitalityScores = calculateVitalityScores(country as any);

        // Persist current vitality snapshot
        const now = new Date();
        const ixTime = IxTime.getCurrentIxTime();
        await ctx.db.vitalitySnapshot.createMany({
          data: [
            {
              countryId: input.countryId,
              area: "ECONOMIC",
              score: vitalityScores.economicVitality,
              trend: "stable",
              changeValue: 0,
              changePeriod: "current",
              keyMetrics: "{}",
              peerAverage: 0,
              regionalAverage: 0,
              historicalBest: 0,
              rank: 0,
              totalCountries: 0,
              ixTime,
              calculatedAt: now,
            },
            {
              countryId: input.countryId,
              area: "SOCIAL",
              score: vitalityScores.populationWellbeing,
              trend: "stable",
              changeValue: 0,
              changePeriod: "current",
              keyMetrics: "{}",
              peerAverage: 0,
              regionalAverage: 0,
              historicalBest: 0,
              rank: 0,
              totalCountries: 0,
              ixTime,
              calculatedAt: now,
            },
            {
              countryId: input.countryId,
              area: "DIPLOMATIC",
              score: vitalityScores.diplomaticStanding,
              trend: "stable",
              changeValue: 0,
              changePeriod: "current",
              keyMetrics: "{}",
              peerAverage: 0,
              regionalAverage: 0,
              historicalBest: 0,
              rank: 0,
              totalCountries: 0,
              ixTime,
              calculatedAt: now,
            },
            {
              countryId: input.countryId,
              area: "GOVERNANCE",
              score: vitalityScores.governmentalEfficiency,
              trend: "stable",
              changeValue: 0,
              changePeriod: "current",
              keyMetrics: "{}",
              peerAverage: 0,
              regionalAverage: 0,
              historicalBest: 0,
              rank: 0,
              totalCountries: 0,
              ixTime,
              calculatedAt: now,
            },
          ],
        });

        // Get previous vitality scores from most recent snapshots (before our insert)
        const previousSnapshots = await ctx.db.vitalitySnapshot.findMany({
          where: { countryId: input.countryId },
          orderBy: { calculatedAt: "desc" },
          take: 8, // Get 2 full sets (4 areas × 2) to find the previous set
          select: { area: true, score: true },
        });

        // Skip the 4 we just inserted to get the previous batch
        const prevSet = previousSnapshots.slice(4);

        const previousData =
          prevSet.length > 0
            ? {
                economicVitality:
                  prevSet.find((s) => s.area === "ECONOMIC" || s.area === "economic")?.score ??
                  null,
                populationWellbeing:
                  prevSet.find((s) => s.area === "SOCIAL" || s.area === "social")?.score ?? null,
                diplomaticStanding:
                  prevSet.find((s) => s.area === "DIPLOMATIC" || s.area === "diplomatic")?.score ??
                  null,
                governmentalEfficiency:
                  prevSet.find((s) => s.area === "GOVERNANCE" || s.area === "governance")?.score ??
                  null,
              }
            : null;

        // Send notifications for significant changes (non-blocking)
        if (previousData) {
          const overallPrevious =
            ((previousData.economicVitality ?? 0) +
              (previousData.populationWellbeing ?? 0) +
              (previousData.diplomaticStanding ?? 0) +
              (previousData.governmentalEfficiency ?? 0)) /
            4;

          const dimensions = [
            {
              key: "economic" as const,
              current: vitalityScores.economicVitality,
              previous: previousData.economicVitality,
            },
            {
              key: "population" as const,
              current: vitalityScores.populationWellbeing,
              previous: previousData.populationWellbeing,
            },
            {
              key: "diplomatic" as const,
              current: vitalityScores.diplomaticStanding,
              previous: previousData.diplomaticStanding,
            },
            {
              key: "governmental" as const,
              current: vitalityScores.governmentalEfficiency,
              previous: previousData.governmentalEfficiency,
            },
            {
              key: "overall" as const,
              current: vitalityScores.overallScore,
              previous: overallPrevious,
            },
          ];

          for (const dimension of dimensions) {
            if (dimension.previous !== null && dimension.current !== null) {
              try {
                await notificationHooks.onVitalityScoreChange({
                  countryId: input.countryId,
                  userId: ctx.user?.id,
                  dimension: dimension.key,
                  currentScore: dimension.current,
                  previousScore: dimension.previous,
                  threshold: 10,
                });
              } catch (error) {
                console.error(
                  `[MyCountry] Failed to send notification for ${dimension.key}:`,
                  error
                );
              }
            }
          }

          // Critical alert if overall score drops below 40
          if (vitalityScores.overallScore < 40 && (previousData.economicVitality ?? 0) >= 40) {
            try {
              await notificationAPI.create({
                title: "Critical National Health Alert",
                message: `Overall national health has fallen to ${vitalityScores.overallScore.toFixed(1)}. Immediate action recommended.`,
                userId: ctx.user?.id || null,
                countryId: input.countryId,
                category: "crisis",
                type: "error",
                priority: "critical",
                severity: "urgent",
                href: "/mycountry/new?tab=vitality",
                actionable: true,
                deliveryMethod: "modal",
              });
            } catch (error) {
              console.error("[MyCountry] Failed to send critical alert:", error);
            }
          }
        }

        return {
          success: true,
          message: "Vitality tracking updated",
          vitalityScores,
          notificationsSent: previousData ? true : false,
        };
      } catch (error) {
        console.error("[MyCountry] Vitality tracking error:", error);
        throw new Error("Failed to update vitality tracking");
      }
    }),

  /**
   * Get intelligence feed for executive dashboard - Requires country ownership
   */
  getIntelligenceFeed: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      // Additional security: Verify the requested country matches user's country
      if (input.countryId !== ctx.user.countryId) {
        throw new Error("FORBIDDEN: Can only access intelligence for owned country");
      }

      return generateIntelligenceFeed(input.countryId);
    }),
});
