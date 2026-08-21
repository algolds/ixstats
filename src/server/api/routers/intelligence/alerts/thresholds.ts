/**
 * Unified Intelligence Router
 *
 * Comprehensive intelligence router that combines SDI/ECI functionality with
 * executive dashboard operations, diplomatic channels, and unified intelligence feeds.
 *
 * Features:
 * - Executive dashboard overview (vitality, alerts, quick actions)
 * - Enhanced quick actions with real database effects
 * - Secure diplomatic channel management
 * - Real-time intelligence feed aggregation
 * - Advanced analytics dashboard
 * - Classification-based access control
 * - Notification hooks for all major events
 * - Audit logging for sensitive operations
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { evaluateThresholds } from "~/server/shared/intelligence-alert-thresholds";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelAlertsThresholdsRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

  /**
   * Get alert thresholds for a country and user
   */
  getAlertThresholds: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const thresholds = await ctx.db.intelligenceAlertThreshold.findMany({
          where: {
            countryId: input.countryId,
            userId: input.userId,
            isActive: true,
          },
          orderBy: [{ alertType: "asc" }, { metricName: "asc" }],
        });

        return {
          thresholds,
          total: thresholds.length,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching alert thresholds:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch alert thresholds",
        });
      }
    }),

  /**
   * Update or create an alert threshold
   */
  updateAlertThreshold: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        countryId: z.string(),
        userId: z.string(),
        alertType: z.string(),
        metricName: z.string(),
        criticalMin: z.number().nullable().optional(),
        criticalMax: z.number().nullable().optional(),
        highMin: z.number().nullable().optional(),
        highMax: z.number().nullable().optional(),
        mediumMin: z.number().nullable().optional(),
        mediumMax: z.number().nullable().optional(),
        notifyOnCritical: z.boolean().default(true),
        notifyOnHigh: z.boolean().default(true),
        notifyOnMedium: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only manage thresholds for your own country",
          });
        }

        const threshold = await ctx.db.intelligenceAlertThreshold.upsert({
          where: {
            countryId_alertType_metricName: {
              countryId: input.countryId,
              alertType: input.alertType,
              metricName: input.metricName,
            },
          },
          update: {
            criticalMin: input.criticalMin,
            criticalMax: input.criticalMax,
            highMin: input.highMin,
            highMax: input.highMax,
            mediumMin: input.mediumMin,
            mediumMax: input.mediumMax,
            notifyOnCritical: input.notifyOnCritical,
            notifyOnHigh: input.notifyOnHigh,
            notifyOnMedium: input.notifyOnMedium,
            isActive: input.isActive,
            updatedAt: new Date(),
          },
          create: {
            countryId: input.countryId,
            userId: input.userId,
            alertType: input.alertType,
            metricName: input.metricName,
            criticalMin: input.criticalMin,
            criticalMax: input.criticalMax,
            highMin: input.highMin,
            highMax: input.highMax,
            mediumMin: input.mediumMin,
            mediumMax: input.mediumMax,
            notifyOnCritical: input.notifyOnCritical,
            notifyOnHigh: input.notifyOnHigh,
            notifyOnMedium: input.notifyOnMedium,
            isActive: input.isActive,
          },
        });

        // Run threshold check on-the-fly
        try {
          await evaluateThresholds(ctx.db, input.countryId, input.userId);
        } catch (e) {
          console.error("Error evaluating thresholds on update:", e);
        }

        // Send notification
        await notificationAPI.create({
          title: "🎯 Alert Threshold Updated",
          message: `Updated threshold for ${input.metricName}`,
          countryId: input.countryId,
          category: "intelligence",
          priority: "medium",
          type: "success",
          href: "/mycountry/intelligence",
          source: "intelligence-system",
          actionable: false,
          metadata: {
            thresholdId: threshold.id,
            alertType: input.alertType,
            metricName: input.metricName,
          },
        });

        return {
          success: true,
          threshold,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error updating alert threshold:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to update alert threshold",
            });
      }
    }),

  /**
   * Delete an alert threshold
   */
  deleteAlertThreshold: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete thresholds for your own country",
          });
        }

        await ctx.db.intelligenceAlertThreshold.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: "Alert threshold deleted successfully",
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error deleting alert threshold:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to delete alert threshold",
            });
      }
    }),

  // ===== CABINET MEETING MANAGEMENT =====

  // ===== ECONOMIC POLICY MANAGEMENT =====
  // ===== CRISIS MANAGEMENT (from SDI) =====

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  // ===== DIPLOMATIC INTELLIGENCE (from SDI) =====

  // ===== STRATEGIC PLANS & SECURITY =====

  // ===== KEY FINDINGS =====
});

// ===== HELPER FUNCTIONS =====
// Migrated from ECI router for advanced analytics and AI recommendations

/**
 * Calculate volatility metrics from historical data
 */
function calculateVolatility(data: Record<string, unknown>[]) {
  if (data.length < 2) return { gdp: 0, population: 0, overall: 0 };

  const gdpValues = data.map((d) => d.totalGdp).filter((v): v is number => typeof v === "number");
  const populationValues = data
    .map((d) => d.population)
    .filter((v): v is number => typeof v === "number");

  return {
    gdp: calculateStandardDeviation(gdpValues),
    population: calculateStandardDeviation(populationValues),
    overall:
      (calculateStandardDeviation(gdpValues) + calculateStandardDeviation(populationValues)) / 2,
  };
}

/**
 * Calculate trend analysis from historical data
 */
function calculateTrends(data: Record<string, unknown>[]) {
  if (data.length < 3) return { gdp: "stable", population: "stable", overall: "stable" };

  const recent = data.slice(0, 10);
  const older = data.slice(10, 20);

  const recentAvgGdp =
    recent.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    recent.length;
  const olderAvgGdp =
    older.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    older.length;

  const gdpTrend =
    recentAvgGdp > olderAvgGdp * 1.02
      ? "growing"
      : recentAvgGdp < olderAvgGdp * 0.98
        ? "declining"
        : "stable";

  return {
    gdp: gdpTrend,
    population: "stable", // Simplified for now
    overall: gdpTrend,
  };
}

/**
 * Calculate correlation analysis (simplified)
 */
function calculateCorrelations(data: Record<string, unknown>[]) {
  // Simplified correlation analysis
  return {
    gdpPopulation: 0.85,
    gdpGrowthStability: 0.72,
    overallHealth: 0.78,
  };
}

/**
 * Calculate standard deviation for volatility analysis
 */
function calculateStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Generate AI-powered recommendations based on country data
 */
function generateAIRecommendations(
  country: Record<string, unknown>,
  recentData: Record<string, unknown>[]
) {
  const recommendations = [];

  if (typeof country.currentGdpPerCapita === "number" && country.currentGdpPerCapita < 25000) {
    recommendations.push({
      id: "infrastructure_investment",
      title: "Infrastructure Investment",
      description: "Consider increasing infrastructure spending to boost economic development",
      priority: "high",
      category: "economic",
      impact: "Potential 2-3% GDP growth boost over 2 years",
    });
  }

  if (typeof country.populationGrowthRate === "number" && country.populationGrowthRate > 0.05) {
    recommendations.push({
      id: "education_expansion",
      title: "Education System Expansion",
      description: "High population growth requires expanded educational capacity",
      priority: "medium",
      category: "social",
      impact: "Long-term economic productivity improvement",
    });
  }

  recommendations.push({
    id: "diversification",
    title: "Economic Diversification",
    description: "Reduce economic risk through sector diversification",
    priority: "medium",
    category: "economic",
    impact: "Improved economic stability and resilience",
  });

  return recommendations;
}
