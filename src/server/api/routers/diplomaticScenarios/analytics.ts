// src/server/api/routers/diplomaticScenarios.ts
// Phase 7B: Diplomatic Scenarios Router - Dynamic scenario generation and choice tracking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Diplomatic Scenarios Router
 *
 * Provides API endpoints for dynamic diplomatic scenario generation, player choice tracking,
 * and scenario analytics. Integrates with the CulturalScenario database model and
 * diplomatic-scenario-generator utility for context-aware scenario generation.
 *
 * Public endpoints (11): Query scenarios, generate scenarios, track choices, calculate relevance
 * Admin endpoints (7): CRUD operations with audit logging
 * Analytics endpoints (4): Usage statistics, choice distribution, performance metrics
 *
 * Total: 22 endpoints
 */
export const diplomaticScenariosAnalyticsRouter = createTRPCRouter({
  // ==========================================
  // ANALYTICS ENDPOINTS (4)
  // ==========================================

  /**
   * Get scenario usage statistics
   */
  getScenarioUsageStats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Total scenario counts by status
      const statusCounts = await ctx.db.culturalScenario.groupBy({
        by: ["status"],
        _count: { id: true },
      });

      // Total generations (active + completed)
      const totalGenerations = statusCounts.reduce((sum, stat) => sum + stat._count.id, 0);

      // Completion rate
      const completed = statusCounts.find((s) => s.status === "completed")?._count.id || 0;
      const completionRate = totalGenerations > 0 ? (completed / totalGenerations) * 100 : 0;

      // Top scenarios by completion
      const topScenarios = await ctx.db.culturalScenario.findMany({
        where: { status: "completed" },
        select: {
          id: true,
          type: true,
          title: true,
          culturalImpact: true,
          diplomaticRisk: true,
          _count: {
            select: {
              relatedExchanges: true,
            },
          },
        },
        orderBy: {
          relatedExchanges: {
            _count: "desc",
          },
        },
        take: 10,
      });

      // Usage by type
      const typeStats = await ctx.db.culturalScenario.groupBy({
        by: ["type"],
        _count: { id: true },
        _avg: {
          culturalImpact: true,
          diplomaticRisk: true,
        },
      });

      return {
        totalGenerations,
        completions: completed,
        completionRate: Math.round(completionRate * 10) / 10,
        byStatus: statusCounts,
        byType: typeStats,
        topScenarios,
      };
    } catch (error) {
      console.error("[DIPLOMATIC_SCENARIOS] Failed to get usage stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve usage statistics",
        cause: error,
      });
    }
  }),

  /**
   * Get completion rates and time metrics
   */
  getCompletionRates: publicProcedure
    .input(
      z.object({
        scenarioType: z.string().optional(),
        timeRange: z.enum(["week", "month", "quarter", "year"]).optional().default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time window
        const now = new Date();
        const timeRangeMap = {
          week: 7,
          month: 30,
          quarter: 90,
          year: 365,
        };
        const daysAgo = timeRangeMap[input.timeRange];
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        const where: any = {
          createdAt: { gte: startDate },
        };
        if (input.scenarioType) where.type = input.scenarioType;

        const scenarios = await ctx.db.culturalScenario.findMany({
          where,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
            expiresAt: true,
          },
        });

        // Calculate metrics
        const total = scenarios.length;
        const completed = scenarios.filter((s) => s.status === "completed").length;
        const expired = scenarios.filter((s) => s.status === "expired").length;
        const active = scenarios.filter(
          (s) => s.status === "active" || s.status === "pending"
        ).length;

        // Average time to completion (in hours)
        const completedScenarios = scenarios.filter(
          (s) => s.status === "completed" && s.resolvedAt
        );
        const avgTimeToComplete =
          completedScenarios.length > 0
            ? completedScenarios.reduce((sum, s) => {
                const hours = (s.resolvedAt!.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }, 0) / completedScenarios.length
            : 0;

        // Completion rate by type
        const byType: Record<string, { total: number; completed: number; rate: number }> = {};
        scenarios.forEach((s) => {
          if (!byType[s.type]) {
            byType[s.type] = { total: 0, completed: 0, rate: 0 };
          }
          byType[s.type].total++;
          if (s.status === "completed") byType[s.type].completed++;
        });

        Object.keys(byType).forEach((type) => {
          byType[type].rate =
            byType[type].total > 0
              ? Math.round((byType[type].completed / byType[type].total) * 1000) / 10
              : 0;
        });

        return {
          timeRange: input.timeRange,
          total,
          completed,
          expired,
          active,
          completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
          avgTimeToCompleteHours: Math.round(avgTimeToComplete * 10) / 10,
          byType,
        };
      } catch (error) {
        console.error("[DIPLOMATIC_SCENARIOS] Failed to get completion rates:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve completion rates",
          cause: error,
        });
      }
    }),
});
