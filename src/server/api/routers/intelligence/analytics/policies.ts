/**
 * Unified Intelligence Router — Policy Analytics
 *
 * Comprehensive intelligence router powering national security, crisis response,
 * executive dashboard operations, diplomatic channels, and unified intelligence feeds.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { economicPolicySchema } from "../../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelAnalyticsPoliciesRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

  // ===== CABINET MEETING MANAGEMENT =====

  // ===== ECONOMIC POLICY MANAGEMENT =====

  /**
   * Get economic policies for a country
   */
  getEconomicPolicies: protectedProcedure
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

        // Retrieve policies from SystemConfig with economic_policy prefix
        const policies = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_economic_policy_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        return policies.map((policy) => ({
          id: policy.id,
          ...JSON.parse(policy.value),
        }));
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching economic policies:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch economic policies",
            });
      }
    }),

  /**
   * Create a new economic policy
   */
  createEconomicPolicy: premiumProcedure
    .input(economicPolicySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { economicModel: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create policies for your own country",
          });
        }

        // Create or find economic model for the country
        let economicModel = country.economicModel;
        if (!economicModel) {
          economicModel = await ctx.db.economicModel.create({
            data: {
              countryId: country.id,
              baseYear: new Date().getFullYear(),
              projectionYears: 10,
              gdpGrowthRate: country.adjustedGdpGrowth,
              inflationRate: 0.02, // Default 2%
              unemploymentRate: 0.05, // Default 5%
              interestRate: 0.03, // Default 3%
              exchangeRate: 1.0,
              populationGrowthRate: country.populationGrowthRate,
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
            key: `eci_economic_policy_${country.id}_${Date.now()}`,
            value: JSON.stringify({
              ...input,
              countryId: country.id,
              createdBy: ctx.user.id,
              createdAt: new Date(),
              economicModelId: economicModel?.id,
            }),
            description: `Economic policy: ${input.title}`,
          },
        });

        // Send notification
        await notificationAPI.create({
          title: "💼 New Economic Policy Proposed",
          message: `A new economic policy titled '${input.title}' has been proposed.`,
          countryId: country.id,
          category: "economic",
          priority: "medium",
          type: "info",
          href: "/mycountry",
          source: "unified-intelligence",
          actionable: true,
          metadata: {
            policyId: result.id,
            category: input.category,
            status: input.status,
          },
        });

        return result;
      } catch (error) {
        console.error("[Unified Intelligence] Error creating economic policy:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create economic policy",
            });
      }
    }),

  /**
   * Implement an economic policy
   */
  implementEconomicPolicy: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        policyId: z.string(),
        implementationNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only implement policies for your own country",
          });
        }

        // Get the policy from SystemConfig
        const policy = await ctx.db.systemConfig.findUnique({
          where: { id: input.policyId },
        });

        if (!policy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Policy not found",
          });
        }

        const policyData = JSON.parse(policy.value);

        // Verify policy belongs to the country
        if (policyData.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This policy does not belong to your country",
          });
        }

        // Update policy status to implemented
        const updatedPolicyData = {
          ...policyData,
          status: "implemented",
          implementedAt: new Date(),
          implementationNotes: input.implementationNotes,
        };

        await ctx.db.systemConfig.update({
          where: { id: input.policyId },
          data: {
            value: JSON.stringify(updatedPolicyData),
            updatedAt: new Date(),
          },
        });

        // Send notification
        await notificationAPI.create({
          title: "✅ Economic Policy Implemented",
          message: `Economic policy '${policyData.title}' has been successfully implemented.`,
          countryId: input.countryId,
          category: "economic",
          priority: "high",
          type: "success",
          href: "/mycountry",
          source: "unified-intelligence",
          actionable: false,
          metadata: {
            policyId: input.policyId,
            category: policyData.category,
            implementationNotes: input.implementationNotes,
          },
        });

        return {
          success: true,
          message: "Economic policy implemented successfully",
          policy: updatedPolicyData,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error implementing economic policy:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to implement economic policy",
            });
      }
    }),

  /**
   * Get policy effectiveness analysis
   */
  getPolicyEffectiveness: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        category: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: { economicModel: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Get all policies for this country and category
        const policies = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_economic_policy_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        const categoryPolicies = policies
          .map((p) => ({ id: p.id, ...JSON.parse(p.value) }))
          .filter(
            (p: Record<string, unknown>) =>
              p.category === input.category && p.status === "implemented"
          );

        // Get policy effects for this country's economic model
        let policyEffects: any[] = [];
        if (country.economicModel) {
          policyEffects = await ctx.db.policyEffect.findMany({
            where: {
              economicModelId: country.economicModel.id,
            },
          });
        }

        // Calculate effectiveness metrics
        const totalPolicies = categoryPolicies.length;
        const activePolicies = categoryPolicies.filter(
          (p: Record<string, unknown>) => p.status === "implemented"
        ).length;

        // Calculate aggregate impact
        const aggregateImpact = categoryPolicies.reduce(
          (acc: any, policy: any) => {
            if (policy.impact) {
              acc.gdpGrowthProjection += policy.impact.gdpGrowthProjection || 0;
              acc.unemploymentImpact += policy.impact.unemploymentImpact || 0;
              acc.inflationImpact += policy.impact.inflationImpact || 0;
              acc.budgetImpact += policy.impact.budgetImpact || 0;
            }
            return acc;
          },
          {
            gdpGrowthProjection: 0,
            unemploymentImpact: 0,
            inflationImpact: 0,
            budgetImpact: 0,
          }
        );

        // Get related policy effects
        const relatedEffects = policyEffects.filter((effect: any) =>
          categoryPolicies.some((p: Record<string, unknown>) => p.title === effect.name)
        );

        const effectivenessScore =
          relatedEffects.length > 0
            ? relatedEffects.reduce(
                (sum: number, effect: any) => sum + (effect.gdpEffectPercentage || 0) * 10,
                0
              ) / relatedEffects.length
            : 50; // Default neutral score

        return {
          category: input.category,
          totalPolicies,
          activePolicies,
          aggregateImpact,
          relatedEffects: relatedEffects.map((effect: any) => ({
            name: effect.name,
            description: effect.description,
            gdpEffect: effect.gdpEffectPercentage,
            inflationEffect: effect.inflationEffectPercentage,
            employmentEffect: effect.employmentEffectPercentage,
            yearImplemented: effect.yearImplemented,
            durationYears: effect.durationYears,
          })),
          effectivenessScore: Math.min(100, Math.max(0, effectivenessScore)),
          trend:
            effectivenessScore > 60
              ? "improving"
              : effectivenessScore < 40
                ? "declining"
                : "stable",
          policies: categoryPolicies,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching policy effectiveness:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch policy effectiveness",
            });
      }
    }),
});

// ===== HELPER FUNCTIONS =====

/**
 * Calculate volatility metrics from historical data
 */
// oxlint-disable-next-line typescript/no-unused-vars
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
// oxlint-disable-next-line typescript/no-unused-vars
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
// oxlint-disable-next-line typescript/no-unused-vars
function calculateCorrelations(_data: Record<string, unknown>[]) {
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
// oxlint-disable-next-line typescript/no-unused-vars
function generateAIRecommendations(
  country: Record<string, unknown>,
  _recentData: Record<string, unknown>[]
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
 * Calculate real-time country metrics (social, security, political)
 */
// oxlint-disable-next-line typescript/no-unused-vars
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
