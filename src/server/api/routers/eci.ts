/**
 * @deprecated This router is deprecated. Use unifiedIntelligence router instead.
 * Maintained for backward compatibility only.
 * Will be removed in v2.0.0
 *
 * Migration Guide:
 * - Replace api.eci.* calls with api.unifiedIntelligence.*
 * - The unified intelligence router provides all ECI functionality with improved performance
 * - See /docs/API_REFERENCE.md for updated endpoint documentation
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { triggerNotification } from "./sdi";
import { PolicyEffectService } from "~/services/PolicyEffectService";

const cabinetMeetingSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  scheduledDate: z
    .union([z.date(), z.string().datetime(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  attendees: z.array(z.string()).optional(),
  agenda: z.array(z.string()).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
});

const economicPolicySchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  category: z.enum(["fiscal", "monetary", "trade", "investment", "labor", "infrastructure"]),
  impact: z
    .object({
      gdpGrowthProjection: z.number().optional(),
      unemploymentImpact: z.number().optional(),
      inflationImpact: z.number().optional(),
      budgetImpact: z.number().optional(),
    })
    .optional(),
  status: z
    .enum(["draft", "proposed", "under_review", "approved", "rejected", "implemented"])
    .default("draft"),
  proposedBy: z.string(),
  proposedDate: z.date().default(() => new Date()),
});

const securityThreatSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["cyber", "terrorism", "military", "economic", "infrastructure", "political"]),
  status: z.enum(["active", "monitoring", "resolved", "dismissed"]).default("active"),
  detectedDate: z.date().default(() => new Date()),
  source: z.string().optional(),
});

const strategicPlanSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  objectives: z.array(z.string()),
  timeframe: z.enum(["short_term", "medium_term", "long_term"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["planning", "active", "completed", "paused", "cancelled"]).default("planning"),
  targetMetrics: z
    .array(
      z.object({
        metric: z.string(),
        currentValue: z.number(),
        targetValue: z.number(),
        deadline: z.date(),
      })
    )
    .optional(),
});

export const eciRouter = createTRPCRouter({
  // Cabinet Meeting Management
  createCabinetMeeting: protectedProcedure
    .input(cabinetMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      // Store in SystemConfig with a descriptive key
      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_cabinet_meeting_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date(),
          }),
          description: `Cabinet meeting: ${input.title}`,
        },
      });
      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Cabinet Meeting Scheduled`,
        description: `A new cabinet meeting titled '${input.title}' has been scheduled.`,
        href: "/eci/mycountry",
        type: "cabinet_meeting",
      });
      return result;
    }),

  getCabinetMeetings: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      const meetings = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_cabinet_meeting_${user.country.id}` },
        },
        orderBy: { updatedAt: "desc" },
      });

      return meetings.map((meeting) => ({
        id: meeting.id,
        ...JSON.parse(meeting.value),
      }));
    }),

  // Economic Policy Management
  createEconomicPolicy: premiumProcedure
    .input(economicPolicySchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: { include: { economicModel: true } } },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      // Create or find economic model for the country
      let economicModel = user.country.economicModel;
      if (!economicModel) {
        economicModel = await ctx.db.economicModel.create({
          data: {
            countryId: user.country.id,
            baseYear: new Date().getFullYear(),
            projectionYears: 10,
            gdpGrowthRate: user.country.adjustedGdpGrowth,
            inflationRate: 0.02, // Default 2%
            unemploymentRate: 0.05, // Default 5%
            interestRate: 0.03, // Default 3%
            exchangeRate: 1.0,
            populationGrowthRate: user.country.populationGrowthRate,
            investmentRate: 0.2,
            fiscalBalance: 0.0,
            tradeBalance: 0.0,
          },
        });
      }

      // Create policy effect if impact data provided
      if (input.impact && economicModel) {
        await ctx.db.policyEffect.create({
          data: {
            economicModelId: economicModel.id,
            name: input.title,
            description: input.description,
            gdpEffectPercentage: input.impact.gdpGrowthProjection || 0,
            inflationEffectPercentage: input.impact.inflationImpact || 0,
            employmentEffectPercentage: -(input.impact.unemploymentImpact || 0), // Negative because unemployment impact is inverse
            yearImplemented: new Date().getFullYear(),
            durationYears: 5, // Default duration
          },
        });
      }

      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_economic_policy_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date(),
            economicModelId: economicModel?.id,
          }),
          description: `Economic policy: ${input.title}`,
        },
      });

      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Economic Policy Proposed`,
        description: `A new economic policy titled '${input.title}' has been proposed.`,
        href: "/mycountry",
        type: "economic_policy",
      });

      return result;
    }),

  getEconomicPolicies: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      const policies = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_economic_policy_${user.country.id}` },
        },
        orderBy: { updatedAt: "desc" },
      });

      return policies.map((policy) => ({
        id: policy.id,
        ...JSON.parse(policy.value),
      }));
    }),

  // National Security Management
  createSecurityThreat: premiumProcedure
    .input(securityThreatSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_security_threat_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date(),
          }),
          description: `Security threat: ${input.title}`,
        },
      });
      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Security Threat Reported`,
        description: `A new security threat titled '${input.title}' has been reported.`,
        href: "/eci/mycountry",
        type: "security_threat",
      });
      return result;
    }),

  getSecurityThreats: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      const threats = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_security_threat_${user.country.id}` },
        },
        orderBy: { updatedAt: "desc" },
      });

      return threats.map((threat) => ({
        id: threat.id,
        ...JSON.parse(threat.value),
      }));
    }),

  getSecurityDashboard: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return {
          overallThreatLevel: "low",
          activeThreats: 0,
          criticalThreats: 0,
          recentThreats: [],
        };
      }

      const threats = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_security_threat_${user.country.id}` },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      const parsedThreats = threats.map((threat) => JSON.parse(threat.value));
      const activeThreats = parsedThreats.filter((t: any) => t.status === "active");
      const criticalThreats = activeThreats.filter((t: any) => t.severity === "critical");

      let overallThreatLevel = "low";
      if (criticalThreats.length > 0) overallThreatLevel = "critical";
      else if (activeThreats.filter((t: any) => t.severity === "high").length > 0)
        overallThreatLevel = "high";
      else if (activeThreats.filter((t: any) => t.severity === "medium").length > 0)
        overallThreatLevel = "medium";

      return {
        overallThreatLevel,
        activeThreats: activeThreats.length,
        criticalThreats: criticalThreats.length,
        recentThreats: parsedThreats.slice(0, 5),
      };
    }),

  // Strategic Planning Management
  createStrategicPlan: premiumProcedure
    .input(strategicPlanSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      return ctx.db.systemConfig.create({
        data: {
          key: `eci_strategic_plan_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date(),
          }),
          description: `Strategic plan: ${input.title}`,
        },
      });
    }),

  getStrategicPlans: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      const plans = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_strategic_plan_${user.country.id}` },
        },
        orderBy: { updatedAt: "desc" },
      });

      return plans.map((plan) => ({
        id: plan.id,
        ...JSON.parse(plan.value),
      }));
    }),

  // Advanced Analytics
  getAdvancedAnalytics: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      // Get historical data for advanced analytics
      const historicalData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: "desc" },
        take: 100,
      });

      // Calculate advanced metrics
      const volatilityMetrics = calculateVolatility(historicalData);
      const trendAnalysis = calculateTrends(historicalData);
      const correlationAnalysis = calculateCorrelations(historicalData);

      return {
        volatility: volatilityMetrics,
        trends: trendAnalysis,
        correlations: correlationAnalysis,
        dataPoints: historicalData.length,
        lastUpdated: new Date(),
      };
    }),

  // AI Advisor
  getAIRecommendations: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      // Get recent data for AI analysis
      const recentData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: "desc" },
        take: 30,
      });

      const country = await ctx.db.country.findUnique({
        where: { id: user.country.id },
      });

      // Generate AI recommendations based on data patterns
      const recommendations = generateAIRecommendations(country, recentData);

      return recommendations;
    }),

  // Predictive Models
  getPredictiveModels: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        timeframe: z.enum(["6_months", "1_year", "2_years", "5_years"]).default("1_year"),
        scenarios: z
          .array(z.enum(["optimistic", "realistic", "pessimistic"]))
          .default(["realistic"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      const country = await ctx.db.country.findUnique({
        where: { id: user.country.id },
      });

      const historicalData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: "desc" },
        take: 100,
      });

      // Generate predictive models
      const predictions = generatePredictiveModels(country!, historicalData, input);

      return predictions;
    }),

  // Real-time Metrics (to replace hardcoded values)
  getRealTimeMetrics: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return {
          social: 50,
          security: 50,
          political: 50,
        };
      }

      // Calculate real metrics based on country data and recent events
      const metrics = await calculateRealTimeMetrics(ctx.db, user.country.id);

      return metrics;
    }),

  // Policy Implementation - Apply real economic effects
  implementEconomicPolicy: premiumProcedure
    .input(
      z.object({
        userId: z.string(),
        policyId: z.string(),
        implementationNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: { include: { economicModel: true } } },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      // Get the policy
      const policyConfig = await ctx.db.systemConfig.findUnique({
        where: { id: input.policyId },
      });

      if (!policyConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      const policyData = JSON.parse(policyConfig.value);

      // Update policy status to implemented
      await ctx.db.systemConfig.update({
        where: { id: input.policyId },
        data: {
          value: JSON.stringify({
            ...policyData,
            status: "implemented",
            implementedAt: new Date(),
            implementationNotes: input.implementationNotes,
          }),
        },
      });

      // Apply economic effects if policy has impact data
      if (policyData.impact && user.country.economicModel) {
        const currentGrowth = user.country.adjustedGdpGrowth;
        const policyImpact = policyData.impact.gdpGrowthProjection || 0;
        const newGrowthRate = Math.max(0, currentGrowth + policyImpact / 100);

        // Update country's growth rate
        await ctx.db.country.update({
          where: { id: user.country.id },
          data: {
            adjustedGdpGrowth: newGrowthRate,
            lastCalculated: new Date(),
          },
        });

        // Create a DM input to track the policy effect
        await ctx.db.dmInputs.create({
          data: {
            countryId: user.country.id,
            ixTimeTimestamp: new Date(),
            inputType: "economic_policy",
            value: policyImpact,
            description: `Policy implemented: ${policyData.title}`,
            duration: 60, // 60 days duration
            createdBy: user.id,
          },
        });
      }

      // Trigger notification
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `Economic Policy Implemented`,
        description: `Policy '${policyData.title}' has been successfully implemented.`,
        href: "/mycountry",
        type: "policy_implementation",
      });

      return { success: true, message: "Policy implemented successfully" };
    }),

  // Quick Actions for Executive Command Center
  getQuickActions: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return [];
      }

      const quickActions = await generateQuickActions(ctx.db, user.country);
      return quickActions;
    }),

  // Execute Quick Action
  executeQuickAction: premiumProcedure
    .input(
      z.object({
        userId: z.string(),
        actionType: z.string(),
        parameters: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      const result = await executeQuickActionHandler(
        ctx.db,
        user.country,
        input.actionType,
        input.parameters || {}
      );

      // Trigger notification
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `Quick Action Executed`,
        description: `Action '${input.actionType}' has been executed.`,
        href: "/mycountry",
        type: "quick_action",
      });

      return result;
    }),

  // Apply policy effects to country economics
  applyPolicyEffects: premiumProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country",
        });
      }

      const policyService = new PolicyEffectService(ctx.db);
      await policyService.applyPolicyEffects(user.country.id);

      // Trigger notification
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `Policy Effects Applied`,
        description: `All active policies have been recalculated and applied to your country's economics.`,
        href: "/mycountry",
        type: "policy_effects",
      });

      return { success: true, message: "Policy effects successfully applied" };
    }),

  // Get policy effectiveness analysis
  getPolicyEffectiveness: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        category: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true },
      });

      if (!user?.country) {
        return { effectiveness: 0.5, recommendations: [] };
      }

      const policyService = new PolicyEffectService(ctx.db);
      const effectiveness = await policyService.calculatePolicyEffectiveness(
        user.country.id,
        input.category
      );
      const recommendations = await policyService.getPolicyRecommendations(user.country.id);

      return { effectiveness, recommendations };
    }),

  // Get ECI Overview for dashboard
  getOverview: publicProcedure.query(async ({ ctx }) => {
    // Aggregate ECI data across all countries
    const countries = await ctx.db.country.findMany({
      select: {
        id: true,
        currentTotalGdp: true,
        currentGdpPerCapita: true,
        currentPopulation: true,
        economicTier: true,
      },
    });

    // Calculate aggregate metrics
    const totalCountries = countries.length;
    const avgGdpPerCapita =
      countries.reduce((sum, c) => sum + (c.currentGdpPerCapita || 0), 0) / (totalCountries || 1);

    // Calculate economic tier distribution
    const tierCounts: Record<string, number> = {};
    countries.forEach((c) => {
      const tier = c.economicTier || "Unknown";
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Get social stability based on economic performance
    const socialStability = Math.min(
      100,
      Math.max(
        0,
        50 + avgGdpPerCapita / 1000 // Base calculation
      )
    );

    // Get recent security threats
    const recentThreats = await ctx.db.systemConfig.count({
      where: {
        key: { contains: "eci_security_threat" },
      },
    });

    const securityIndex = Math.max(0, 100 - recentThreats * 5);

    // Get active policies
    const activePolicies = await ctx.db.systemConfig.count({
      where: {
        key: { contains: "eci_economic_policy" },
      },
    });

    const politicalStability = Math.min(100, 60 + activePolicies * 2);

    return {
      eciScore: Math.round((socialStability + securityIndex + politicalStability) / 3),
      socialStability: Math.round(socialStability),
      securityIndex: Math.round(securityIndex),
      politicalStability: Math.round(politicalStability),
      totalCountries,
      avgGdpPerCapita: Math.round(avgGdpPerCapita),
      tierDistribution: tierCounts,
      activePolicies,
      activeThreats: recentThreats,
      timestamp: new Date(),
    };
  }),
});

// Helper functions for calculations
function calculateVolatility(data: any[]) {
  if (data.length < 2) return { gdp: 0, population: 0, overall: 0 };

  const gdpValues = data.map((d) => d.totalGdp).filter(Boolean);
  const populationValues = data.map((d) => d.population).filter(Boolean);

  return {
    gdp: calculateStandardDeviation(gdpValues),
    population: calculateStandardDeviation(populationValues),
    overall:
      (calculateStandardDeviation(gdpValues) + calculateStandardDeviation(populationValues)) / 2,
  };
}

function calculateTrends(data: any[]) {
  if (data.length < 3) return { gdp: "stable", population: "stable", overall: "stable" };

  const recent = data.slice(0, 10);
  const older = data.slice(10, 20);

  const recentAvgGdp = recent.reduce((sum, d) => sum + (d.totalGdp || 0), 0) / recent.length;
  const olderAvgGdp = older.reduce((sum, d) => sum + (d.totalGdp || 0), 0) / older.length;

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

function calculateCorrelations(data: any[]) {
  // Simplified correlation analysis
  return {
    gdpPopulation: 0.85,
    gdpGrowthStability: 0.72,
    overallHealth: 0.78,
  };
}

function calculateStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function generateAIRecommendations(country: any, recentData: any[]) {
  const recommendations = [];

  if (country.currentGdpPerCapita && country.currentGdpPerCapita < 25000) {
    recommendations.push({
      id: "infrastructure_investment",
      title: "Infrastructure Investment",
      description: "Consider increasing infrastructure spending to boost economic development",
      priority: "high",
      category: "economic",
      impact: "Potential 2-3% GDP growth boost over 2 years",
    });
  }

  if (country.populationGrowthRate && country.populationGrowthRate > 0.05) {
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

function generatePredictiveModels(country: any, historicalData: any[], input: any) {
  const timeframePeriods = {
    "6_months": 6,
    "1_year": 12,
    "2_years": 24,
    "5_years": 60,
  };

  const periods = timeframePeriods[input.timeframe as keyof typeof timeframePeriods];
  const baseGrowthRate = country.adjustedGdpGrowth || 0.03;

  const scenarios = input.scenarios.map((scenario: string) => {
    const multiplier = scenario === "optimistic" ? 1.5 : scenario === "pessimistic" ? 0.5 : 1.0;

    const projectedGdp =
      country.currentTotalGdp * Math.pow(1 + baseGrowthRate * multiplier, periods / 12);
    const projectedPopulation =
      country.currentPopulation *
      Math.pow(1 + (country.populationGrowthRate || 0.01), periods / 12);
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

async function calculateRealTimeMetrics(db: any, countryId: string) {
  // Get recent security threats
  const securityThreats = await db.systemConfig.findMany({
    where: {
      key: { contains: `eci_security_threat_${countryId}` },
    },
  });

  const activeThreats = securityThreats.filter((threat: any) => {
    const data = JSON.parse(threat.value);
    return data.status === "active";
  });

  const criticalThreats = activeThreats.filter((threat: any) => {
    const data = JSON.parse(threat.value);
    return data.severity === "critical";
  });

  // Calculate security metric (higher threats = lower score)
  const securityScore = Math.max(20, 100 - activeThreats.length * 10 - criticalThreats.length * 20);

  // Get recent policies
  const policies = await db.systemConfig.findMany({
    where: {
      key: { contains: `eci_economic_policy_${countryId}` },
    },
  });

  const activePolicies = policies.filter((policy: any) => {
    const data = JSON.parse(policy.value);
    return data.status === "implemented";
  });

  // Calculate political stability (more active policies = higher stability)
  const politicalScore = Math.min(100, 60 + activePolicies.length * 5);

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
  const socialPolicies = activePolicies.filter((p: any) => {
    const data = JSON.parse(p.value);
    return data.category === "labor" || data.category === "infrastructure";
  });
  const socialScore = Math.min(100, baseSocialScore + socialPolicies.length * 3);

  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore),
  };
}

// Generate quick actions based on country state
async function generateQuickActions(db: any, country: any) {
  const quickActions = [];

  // Economic Quick Actions
  if (country.currentGdpPerCapita < 25000) {
    quickActions.push({
      id: "infrastructure_boost",
      title: "Infrastructure Investment",
      description: "Boost GDP through targeted infrastructure spending",
      urgency: "important",
      estimatedDuration: "6 months",
      successProbability: 85,
      estimatedBenefit: "+2.5% GDP growth",
      actionType: "infrastructure_boost",
      category: "economic",
    });
  }

  // Check for recent threats
  const recentThreats = await db.systemConfig.findMany({
    where: {
      key: { contains: `eci_security_threat_${country.id}` },
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
    take: 5,
  });

  if (recentThreats.length > 0) {
    quickActions.push({
      id: "security_review",
      title: "Security Assessment",
      description: "Conduct comprehensive security review",
      urgency: "urgent",
      estimatedDuration: "2 weeks",
      successProbability: 95,
      estimatedBenefit: "Enhanced security",
      actionType: "security_review",
      category: "security",
    });
  }

  // Population growth actions
  if (country.populationGrowthRate > 0.03) {
    quickActions.push({
      id: "education_expansion",
      title: "Education Capacity",
      description: "Expand educational infrastructure for growing population",
      urgency: "important",
      estimatedDuration: "1 year",
      successProbability: 90,
      estimatedBenefit: "Long-term productivity",
      actionType: "education_expansion",
      category: "social",
    });
  }

  // Trade opportunities
  quickActions.push({
    id: "trade_mission",
    title: "Trade Mission",
    description: "Organize diplomatic trade mission",
    urgency: "routine",
    estimatedDuration: "3 months",
    successProbability: 75,
    estimatedBenefit: "New trade partnerships",
    actionType: "trade_mission",
    category: "diplomatic",
  });

  return quickActions;
}

// Execute quick actions with real effects
async function executeQuickActionHandler(
  db: any,
  country: any,
  actionType: string,
  parameters: any
) {
  switch (actionType) {
    case "infrastructure_boost":
      // Apply temporary GDP growth boost
      await db.dmInputs.create({
        data: {
          countryId: country.id,
          ixTimeTimestamp: new Date(),
          inputType: "economic_policy",
          value: 2.5, // 2.5% GDP boost
          description: "Infrastructure investment quick action",
          duration: 180, // 180 days
          isActive: true,
        },
      });
      return {
        success: true,
        message: "Infrastructure boost applied",
        effect: "+2.5% GDP growth for 6 months",
      };

    case "security_review":
      // Mark all active threats as under review
      const threats = await db.systemConfig.findMany({
        where: { key: { contains: `eci_security_threat_${country.id}` } },
      });

      for (const threat of threats) {
        const threatData = JSON.parse(threat.value);
        if (threatData.status === "active") {
          await db.systemConfig.update({
            where: { id: threat.id },
            data: {
              value: JSON.stringify({
                ...threatData,
                status: "monitoring",
                reviewedAt: new Date(),
              }),
            },
          });
        }
      }
      return {
        success: true,
        message: "Security review initiated",
        effect: "All threats under monitoring",
      };

    case "education_expansion":
      // Apply long-term productivity boost
      await db.dmInputs.create({
        data: {
          countryId: country.id,
          ixTimeTimestamp: new Date(),
          inputType: "special_event",
          value: 1.5, // 1.5% productivity boost
          description: "Education expansion program",
          duration: 365, // 1 year
          isActive: true,
        },
      });
      return {
        success: true,
        message: "Education expansion started",
        effect: "+1.5% productivity for 1 year",
      };

    case "trade_mission":
      // Create diplomatic event
      await db.diplomaticEvent.create({
        data: {
          country1Id: country.id,
          eventType: "trade_mission",
          title: "Trade Mission Initiative",
          description: "Organized trade mission to develop new partnerships",
          status: "active",
          economicImpact: 5000000, // $5M economic impact
          ixTimeTimestamp: Date.now() / 1000,
        },
      });
      return {
        success: true,
        message: "Trade mission organized",
        effect: "New diplomatic opportunities",
      };

    default:
      return { success: false, message: "Unknown action type" };
  }
}
