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
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import type { CrisisEvent, EconomicIndicator } from "~/types/sdi";
import { classificationSchema, prioritySchema, actionTypeSchema, cabinetMeetingSchema, quickActionSchema, diplomaticMessageSchema, securityThreatSchema, strategicPlanSchema, economicPolicySchema } from "../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelAlertsRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  acknowledgeAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.db.intelligenceAlert.findUnique({
          where: { id: input.alertId },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        if (ctx.user?.countryId && alert.countryId !== ctx.user.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot acknowledge alerts for other countries",
          });
        }

        const updated = await ctx.db.intelligenceAlert.update({
          where: { id: input.alertId },
          data: {
            isResolved: true,
            isActive: false,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return {
          id: updated.id,
          isResolved: updated.isResolved,
          resolvedAt: updated.resolvedAt,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Failed to acknowledge alert:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to acknowledge alert",
            });
      }
    }),

  archiveAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const alert = await ctx.db.intelligenceAlert.findUnique({
          where: { id: input.alertId },
        });

        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
        }

        if (ctx.user?.countryId && alert.countryId !== ctx.user.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot archive alerts for other countries",
          });
        }

        const updated = await ctx.db.intelligenceAlert.update({
          where: { id: input.alertId },
          data: {
            isActive: false,
            resolvedAt: alert.resolvedAt ?? new Date(),
            updatedAt: new Date(),
          },
        });

        return {
          id: updated.id,
          isResolved: updated.isResolved,
          resolvedAt: updated.resolvedAt,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Failed to archive alert:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to archive alert" });
      }
    }),

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
        criticalMin: z.number().optional(),
        criticalMax: z.number().optional(),
        highMin: z.number().optional(),
        highMax: z.number().optional(),
        mediumMin: z.number().optional(),
        mediumMax: z.number().optional(),
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

  /**
   * Get active crisis events
   * Migrated from SDI router
   */
  getActiveCrises: publicProcedure.query(async ({ ctx }) => {
    try {
      const crises = await ctx.db.crisisEvent.findMany({
        orderBy: { timestamp: "desc" },
      });

      return crises.map(
        (crisis): CrisisEvent => ({
          id: crisis.id,
          type: crisis.type as CrisisEvent["type"],
          title: crisis.title,
          severity: crisis.severity as CrisisEvent["severity"],
          affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
          casualties: crisis.casualties || 0,
          economicImpact: crisis.economicImpact || 0,
          status: (crisis.responseStatus as CrisisEvent["status"]) || "monitoring",
          responseStatus: (crisis.responseStatus as CrisisEvent["responseStatus"]) || "monitoring",
          timestamp: crisis.timestamp,
          description: crisis.description || "",
          location: crisis.location || undefined,
          coordinates: undefined,
        })
      );
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching active crises:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch active crises",
      });
    }
  }),

  /**
   * Get all crisis events
   * Migrated from SDI router
   */
  getCrisisEvents: publicProcedure.query(async ({ ctx }) => {
    try {
      const crises = await ctx.db.crisisEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 50,
      });

      return crises.map(
        (crisis): CrisisEvent => ({
          id: crisis.id,
          type: crisis.type as CrisisEvent["type"],
          title: crisis.title,
          severity: crisis.severity as CrisisEvent["severity"],
          affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
          casualties: crisis.casualties || 0,
          economicImpact: crisis.economicImpact || 0,
          status: (crisis.responseStatus as CrisisEvent["status"]) || "monitoring",
          responseStatus: (crisis.responseStatus as CrisisEvent["responseStatus"]) || "monitoring",
          timestamp: crisis.timestamp,
          description: crisis.description || "",
          location: crisis.location || undefined,
          coordinates: undefined,
        })
      );
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching crisis events:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch crisis events",
      });
    }
  }),

  /**
   * Get crisis response teams
   * Migrated from SDI router
   */
  getResponseTeams: publicProcedure.query(async ({ ctx }) => {
    try {
      // Generate response teams based on active crises
      const activeCrises = await ctx.db.crisisEvent.findMany({
        where: { responseStatus: { not: "resolved" } },
        orderBy: { timestamp: "desc" },
      });

      const responseTeams = [];

      // Generate teams based on crisis types
      const crisisTypes = new Set(activeCrises.map((c) => c.type));

      if (crisisTypes.has("economic_crisis")) {
        responseTeams.push({
          id: "economic-team",
          name: "Economic Stabilization Unit",
          status: "deployed",
          location: "Global",
          assignedCrises: activeCrises.filter((c) => c.type === "economic_crisis").length,
        });
      }

      if (crisisTypes.has("natural_disaster")) {
        const disasters = activeCrises.filter((c) => c.type === "natural_disaster");
        responseTeams.push({
          id: "disaster-team",
          name: "International Aid Coordination",
          status: disasters.length > 0 ? "deployed" : "standby",
          location:
            disasters.length > 0
              ? JSON.parse(disasters[0]?.affectedCountries || "[]")[0] || "Multiple"
              : "Standby",
          assignedCrises: disasters.length,
        });
      }

      if (crisisTypes.has("political_crisis")) {
        responseTeams.push({
          id: "diplomatic-team",
          name: "Diplomatic Crisis Team",
          status: "monitoring",
          location: "Multiple",
          assignedCrises: activeCrises.filter((c) => c.type === "political_crisis").length,
        });
      }

      // Always have a general monitoring team
      responseTeams.push({
        id: "general-team",
        name: "Global Monitoring Center",
        status: activeCrises.length > 0 ? "active" : "standby",
        location: "Global",
        assignedCrises: activeCrises.length,
      });

      return responseTeams;
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching response teams:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch response teams",
      });
    }
  }),

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  // ===== DIPLOMATIC INTELLIGENCE (from SDI) =====

  // ===== STRATEGIC PLANS & SECURITY =====

  /**
   * Get security threats for a country
   * Migrated from ECI router
   */
  getSecurityThreats: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Retrieve security threats from SystemConfig
        const threats = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_security_threat_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        return threats.map((threat) => ({
          id: threat.id,
          ...JSON.parse(threat.value),
        }));
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching security threats:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch security threats",
            });
      }
    }),

  /**
   * Get comprehensive security dashboard data
   */
  getSecurityDashboard: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Retrieve security threats
        const threats = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_security_threat_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        const parsedThreats = threats.map((threat) => ({
          id: threat.id,
          ...JSON.parse(threat.value),
        }));

        // Get active intelligence alerts
        const alerts = await ctx.db.intelligenceAlert.findMany({
          where: {
            countryId: input.countryId,
            category: "SECURITY",
            isActive: true,
            isResolved: false,
          },
          orderBy: { severity: "desc" },
          take: 10,
        });

        // Calculate threat level
        const threatLevel =
          parsedThreats.filter(
            (t: any) =>
              t.status === "active" && (t.severity === "high" || t.severity === "critical")
          ).length > 0
            ? "high"
            : parsedThreats.filter((t: any) => t.status === "active").length > 2
              ? "medium"
              : "low";

        return {
          threats: parsedThreats,
          alerts: alerts.map((alert) => ({
            id: alert.id,
            title: alert.title,
            severity: alert.severity,
            category: alert.category,
            detectedAt: alert.detectedAt,
            isActive: alert.isActive,
          })),
          threatLevel,
          activeThreatsCount: parsedThreats.filter((t: any) => t.status === "active").length,
          criticalThreatsCount: parsedThreats.filter(
            (t: any) => t.status === "active" && t.severity === "critical"
          ).length,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching security dashboard:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch security dashboard",
            });
      }
    }),

  /**
   * Create a new security threat
   */
  createSecurityThreat: protectedProcedure
    .input(securityThreatSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // SECURITY: Verify user owns this country
        if (ctx.user?.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot create threats for other countries",
          });
        }

        // Create threat in SystemConfig
        const threatData = {
          title: input.title,
          description: input.description,
          severity: input.severity,
          category: input.category,
          status: input.status,
          detectedDate: input.detectedDate,
          source: input.source || "user_input",
          countryId: input.countryId,
        };

        const threat = await ctx.db.systemConfig.create({
          data: {
            key: `eci_security_threat_${input.countryId}_${Date.now()}`,
            value: JSON.stringify(threatData),
            description: `Security threat: ${input.title}`,
          },
        });

        // Create corresponding intelligence alert
        await ctx.db.intelligenceAlert.create({
          data: {
            countryId: input.countryId,
            title: input.title,
            description: input.description,
            severity: input.severity.toUpperCase() as any,
            category: "SECURITY",
            alertType: "security_threat",
            isActive: true,
            isResolved: false,
            detectedAt: input.detectedDate,
            currentValue: 0,
            expectedValue: 0,
            deviation: 0,
            zScore: 0,
            factors: JSON.stringify([]),
            confidence: 100,
          },
        });

        // Send notification
        await notificationAPI.create({
          userId: ctx.user?.id || "",
          countryId: input.countryId,
          type: "alert",
          title: `New Security Threat: ${input.title}`,
          message: input.description,
          priority:
            input.severity === "critical"
              ? "critical"
              : input.severity === "high"
                ? "high"
                : "medium",
          category: "security",
          href: `/mycountry/intelligence?tab=security`,
        });

        return {
          success: true,
          threatId: threat.id,
          message: "Security threat created successfully",
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error creating security threat:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create security threat",
            });
      }
    }),

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
  const populationValues = data.map((d) => d.population).filter((v): v is number => typeof v === "number");

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

  const recentAvgGdp = recent.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) / recent.length;
  const olderAvgGdp = older.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) / older.length;

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

/**
 * Generate predictive economic models
 */
function generatePredictiveModels(
  country: Record<string, unknown>,
  historicalData: Record<string, unknown>[],
  input: Record<string, unknown>
) {
  const timeframePeriods = {
    "6_months": 6,
    "1_year": 12,
    "2_years": 24,
    "5_years": 60,
  };

  const periods = timeframePeriods[input.timeframe as keyof typeof timeframePeriods] || 12;
  const baseGrowthRate = (country.adjustedGdpGrowth as number) || 0.03;

  const scenarios = (Array.isArray(input.scenarios) ? input.scenarios : []).map((scenario: string) => {
    const multiplier = scenario === "optimistic" ? 1.5 : scenario === "pessimistic" ? 0.5 : 1.0;

    const projectedGdp =
      (country.currentTotalGdp as number) * Math.pow(1 + baseGrowthRate * multiplier, periods / 12);
    const projectedPopulation =
      (country.currentPopulation as number) *
      Math.pow(1 + ((country.populationGrowthRate as number) || 0.01), periods / 12);
    const projectedGdpPerCapita = projectedGdp / projectedPopulation;

    return {
      scenario,
      projectedGdp,
      projectedPopulation,
      projectedGdpPerCapita,
      confidence: scenario === "realistic" ? 85 : scenario === "optimistic" ? 65 : 70,
    };
  });

  return {
    timeframe: input.timeframe,
    scenarios,
    methodology: "Compound growth model with historical variance analysis",
    lastUpdated: new Date(),
  };
}

/**
 * Calculate real-time country metrics (social, security, political)
 */
async function calculateRealTimeMetrics(db: any, countryId: string) {
  // Get recent security threats
  const securityThreats = await db.intelligenceAlert.findMany({
    where: {
      countryId,
      category: { in: ["security", "SECURITY", "crisis", "CRISIS"] },
      isActive: true,
    },
  });

  const criticalThreats = securityThreats.filter(
    (threat: any) => threat.severity === "critical" || threat.severity === "CRITICAL"
  );

  // Calculate security metric (higher threats = lower score)
  const securityScore = Math.max(
    20,
    100 - securityThreats.length * 10 - criticalThreats.length * 20
  );

  // Get recent policies
  const policies = await db.policy.findMany({
    where: {
      countryId,
      status: "active",
    },
  });

  // Calculate political stability (more active policies = higher stability)
  const politicalScore = Math.min(100, 60 + policies.length * 5);

  // Social metric based on economic tier and policies
  const country = await db.country.findUnique({ where: { id: countryId } });
  const economicTierScores: Record<string, number> = {
    Impoverished: 30,
    Developing: 50,
    Developed: 70,
    Healthy: 80,
    Strong: 90,
    "Very Strong": 95,
    Extravagant: 100,
  };

  const baseSocialScore = economicTierScores[country?.economicTier as string] ?? 50;
  const socialPolicies = policies.filter(
    (p: Record<string, unknown>) => p.policyType === "social" || p.policyType === "SOCIAL"
  );
  const socialScore = Math.min(100, baseSocialScore + socialPolicies.length * 3);

  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore),
  };
}
