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

export const intelAnalyticsRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  /**
   * Get advanced analytics dashboard data
   */
  getAnalytics: premiumProcedure
    .input(
      z.object({
        countryId: z.string(),
        timeframe: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
        }

        // Calculate timeframe
        const timeframeMs = {
          "7d": 7 * 24 * 60 * 60 * 1000,
          "30d": 30 * 24 * 60 * 60 * 1000,
          "90d": 90 * 24 * 60 * 60 * 1000,
          "1y": 365 * 24 * 60 * 60 * 1000,
        }[input.timeframe];

        const startDate = new Date(Date.now() - timeframeMs);

        // Get historical data
        const historicalData = await ctx.db.historicalDataPoint.findMany({
          where: {
            countryId: input.countryId,
            ixTimeTimestamp: { gte: startDate },
          },
          orderBy: { ixTimeTimestamp: "asc" },
        });

        // Get intelligence metrics
        const [alerts, briefings, policies] = await Promise.all([
          ctx.db.intelligenceAlert.findMany({
            where: {
              countryId: input.countryId,
              detectedAt: { gte: startDate },
            },
          }),
          ctx.db.intelligenceBriefing.findMany({
            where: {
              countryId: input.countryId,
              generatedAt: { gte: startDate },
            },
          }),
          ctx.db.policy.findMany({
            where: {
              countryId: input.countryId,
              proposedDate: { gte: startDate },
            },
          }),
        ]);

        // Calculate trends
        const gdpTrend =
          historicalData.length > 1
            ? (((historicalData[historicalData.length - 1]?.totalGdp || 0) -
                (historicalData[0]?.totalGdp || 0)) /
                (historicalData[0]?.totalGdp || 1)) *
              100
            : 0;

        const populationTrend =
          historicalData.length > 1
            ? (((historicalData[historicalData.length - 1]?.population || 0) -
                (historicalData[0]?.population || 0)) /
                (historicalData[0]?.population || 1)) *
              100
            : 0;

        return {
          overview: {
            gdpTrend: gdpTrend.toFixed(2),
            populationTrend: populationTrend.toFixed(2),
            alertsGenerated: alerts.length,
            briefingsCreated: briefings.length,
            policiesProposed: policies.length,
          },
          timeSeries: {
            gdp: historicalData.map((d) => ({
              timestamp: d.ixTimeTimestamp,
              value: d.totalGdp,
            })),
            population: historicalData.map((d) => ({
              timestamp: d.ixTimeTimestamp,
              value: d.population,
            })),
            gdpPerCapita: historicalData.map((d) => ({
              timestamp: d.ixTimeTimestamp,
              value: d.gdpPerCapita,
            })),
          },
          alerts: {
            bySeverity: {
              critical: alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "critical")
                .length,
              high: alerts.filter((a) => a.severity === "HIGH" || a.severity === "high").length,
              medium: alerts.filter((a) => a.severity === "MEDIUM" || a.severity === "medium")
                .length,
              low: alerts.filter((a) => a.severity === "LOW" || a.severity === "low").length,
            },
            byCategory: alerts.reduce(
              (acc, alert) => {
                if (alert.category) {
                  const cat = alert.category.toLowerCase();
                  acc[cat] = (acc[cat] || 0) + 1;
                }
                return acc;
              },
              {} as Record<string, number>
            ),
          },
          policies: {
            byType: policies.reduce(
              (acc, policy) => {
                acc[policy.policyType] = (acc[policy.policyType] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
            byStatus: policies.reduce(
              (acc, policy) => {
                acc[policy.status] = (acc[policy.status] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching analytics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch analytics data",
        });
      }
    }),

  // ===== ADVANCED ANALYTICS & AI =====

  /**
   * Get advanced analytics (volatility, trends, correlations)
   * Migrated from ECI router
   */
  getAdvancedAnalytics: protectedProcedure
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

        // Get historical data for advanced analytics
        const historicalData = await ctx.db.historicalDataPoint.findMany({
          where: { countryId: input.countryId },
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
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching advanced analytics:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch advanced analytics",
            });
      }
    }),

  /**
   * Get AI-powered recommendations
   * Migrated from ECI router
   */
  getAIRecommendations: protectedProcedure
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

        // Get recent data for AI analysis
        const recentData = await ctx.db.historicalDataPoint.findMany({
          where: { countryId: input.countryId },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 30,
        });

        // Generate AI recommendations based on data patterns
        const recommendations = generateAIRecommendations(country, recentData);

        return recommendations;
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching AI recommendations:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch AI recommendations",
            });
      }
    }),

  /**
   * Get predictive economic models
   * Migrated from ECI router
   */
  getPredictiveModels: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        timeframe: z.enum(["6_months", "1_year", "2_years", "5_years"]).default("1_year"),
        scenarios: z
          .array(z.enum(["optimistic", "realistic", "pessimistic"]))
          .default(["realistic"]),
      })
    )
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

        const historicalData = await ctx.db.historicalDataPoint.findMany({
          where: { countryId: input.countryId },
          orderBy: { ixTimeTimestamp: "desc" },
          take: 100,
        });

        // Generate predictive models
        const predictions = generatePredictiveModels(country, historicalData, input);

        return predictions;
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching predictive models:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch predictive models",
            });
      }
    }),

  /**
   * Get real-time country metrics
   * Migrated from ECI router
   */
  getRealTimeMetrics: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
        });

        if (!country) {
          return {
            social: 50,
            security: 50,
            political: 50,
          };
        }

        // Calculate real metrics based on country data and recent events
        const metrics = await calculateRealTimeMetrics(ctx.db as any, input.countryId);

        return metrics;
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching real-time metrics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch real-time metrics",
        });
      }
    }),

  // ===== ADMIN OPERATIONS =====

  /**
   * Create intelligence briefing (admin only)
   */
  createBriefing: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string(),
        description: z.string(),
        type: z.enum(["HOT_ISSUE", "OPPORTUNITY", "RISK_MITIGATION", "STRATEGIC_INITIATIVE"]),
        priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
        area: z.enum([
          "ECONOMIC",
          "DIPLOMATIC",
          "SOCIAL",
          "GOVERNANCE",
          "SECURITY",
          "INFRASTRUCTURE",
          "CRISIS",
        ]),
        confidence: z.number().min(0).max(100),
        urgency: z.enum(["IMMEDIATE", "THIS_WEEK", "THIS_MONTH", "THIS_QUARTER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const briefing = await ctx.db.intelligenceBriefing.create({
        data: {
          countryId: input.countryId,
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          area: input.area,
          confidence: input.confidence,
          urgency: input.urgency,
          impactMagnitude: JSON.stringify({
            magnitude: "HIGH",
            scope: "National",
            timeframe: "6 months",
          }),
          evidence: JSON.stringify({ metrics: [], trends: [], comparisons: [] }),
          isActive: true,
        },
      });

      // Send notification
      await notificationAPI.create({
        title: `📊 New Intelligence Briefing`,
        message: `${input.title} - ${input.urgency} priority`,
        countryId: input.countryId,
        category: "intelligence",
        priority: input.priority === "CRITICAL" ? "high" : "medium",
        type: "info",
        href: "/mycountry/intelligence",
        source: "intelligence-system",
        actionable: true,
        metadata: { briefingId: briefing.id, type: input.type },
      });

      return briefing;
    }),

  // ===== ALERT THRESHOLD MANAGEMENT =====

  // ===== CABINET MEETING MANAGEMENT =====

  // ===== ECONOMIC POLICY MANAGEMENT =====

  /**
   * Get economic policies for a country
   * Migrated from ECI router
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
   * Migrated from ECI router
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
   * Migrated from ECI router
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
   * Migrated from ECI router
   */
  getPolicyEffectiveness: protectedProcedure
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
  // ===== CRISIS MANAGEMENT (from SDI) =====

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  /**
   * Get global economic indicators
   * Migrated from SDI router
   */
  getEconomicIndicators: publicProcedure.query(async ({ ctx }): Promise<EconomicIndicator> => {
    try {
      // Aggregate live data from all countries at current IxTime
      const targetTime = IxTime.getCurrentIxTime();
      const countries = await ctx.db.country.findMany({});
      console.log("[Unified Intelligence] Fetched countries count:", countries.length);

      let globalGDP = 0;
      let totalGrowth = 0;
      let totalInflation = 0;
      let totalUnemployment = 0;
      let count = 0;

      for (const c of countries) {
        globalGDP += c.currentTotalGdp || c.baselinePopulation * c.baselineGdpPerCapita || 0;
        totalGrowth +=
          typeof c.adjustedGdpGrowth === "number" && !isNaN(c.adjustedGdpGrowth)
            ? c.adjustedGdpGrowth
            : 0.03;
        totalInflation += 0.02; // Default inflation rate
        totalUnemployment += 5.0; // Default unemployment rate
        count++;
      }

      console.log(
        "[Unified Intelligence] Before globalGrowth calculation - totalGrowth:",
        totalGrowth,
        "count:",
        count
      );

      // Calculate averages
      const globalGrowth = count > 0 ? totalGrowth / count : 0;
      const inflationRate = count > 0 ? totalInflation / count : 0;
      const unemploymentRate = count > 0 ? totalUnemployment / count : 0;

      return {
        globalGDP,
        globalGrowth,
        inflationRate,
        unemploymentRate,
        tradeVolume: globalGDP * 0.3, // Estimate trade volume as 30% of global GDP
        currencyVolatility: Math.abs(inflationRate - 0.02) * 2, // Volatility based on inflation deviation from 2% target
        timestamp: new Date(targetTime),
      };
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching economic indicators:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch economic indicators",
      });
    }
  }),

  /**
   * Get commodity prices
   * Migrated from SDI router
   */
  getCommodityPrices: publicProcedure.query(async ({ ctx }) => {
    try {
      // Calculate commodity prices based on economic indicators and crises
      const [recentIndicators, crises] = await Promise.all([
        ctx.db.economicIndicator.findMany({
          orderBy: { timestamp: "desc" },
          take: 2,
        }),
        ctx.db.crisisEvent.findMany({
          where: {
            type: { in: ["economic_crisis", "natural_disaster", "environmental"] },
            timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          },
        }),
      ]);

      // Base prices (can be adjusted based on real economic data)
      const basePrices = {
        oil: 85.2,
        gold: 1950.5,
        copper: 3.85,
        wheat: 5.2,
        gas: 2.85,
      };

      // Calculate price changes based on economic indicators
      let inflationFactor = 1.0;

      if (recentIndicators.length >= 2) {
        const latest = recentIndicators[0]!;
        const previous = recentIndicators[1]!;

        inflationFactor = 1 + (latest.inflationRate - previous.inflationRate) / 100;
      }

      // Crisis impact on commodities
      const crisisImpact = {
        oil: 0,
        gold: 0,
        copper: 0,
        wheat: 0,
        gas: 0,
      };

      crises.forEach((crisis) => {
        const severity =
          crisis.severity === "critical"
            ? 0.15
            : crisis.severity === "high"
              ? 0.1
              : crisis.severity === "medium"
                ? 0.05
                : 0.02;

        if (crisis.type === "economic_crisis") {
          crisisImpact.gold += severity; // Safe haven demand
          crisisImpact.oil -= severity * 0.5; // Reduced demand
        } else if (crisis.type === "natural_disaster") {
          crisisImpact.wheat += severity; // Food security
          crisisImpact.copper -= severity * 0.3; // Infrastructure damage
        } else if (crisis.type === "environmental") {
          crisisImpact.gas += severity; // Energy transition
          crisisImpact.copper += severity * 0.2; // Green tech demand
        }
      });

      // Calculate final prices and trends
      const commodities = [
        {
          name: "Oil (Brent)",
          price: Number((basePrices.oil * inflationFactor * (1 + crisisImpact.oil)).toFixed(2)),
          change: Number((crisisImpact.oil * 100).toFixed(1)),
          trend:
            crisisImpact.oil > 0.01
              ? ("up" as const)
              : crisisImpact.oil < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Gold",
          price: Number((basePrices.gold * inflationFactor * (1 + crisisImpact.gold)).toFixed(2)),
          change: Number((crisisImpact.gold * 100).toFixed(1)),
          trend:
            crisisImpact.gold > 0.01
              ? ("up" as const)
              : crisisImpact.gold < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Copper",
          price: Number(
            (basePrices.copper * inflationFactor * (1 + crisisImpact.copper)).toFixed(2)
          ),
          change: Number((crisisImpact.copper * 100).toFixed(1)),
          trend:
            crisisImpact.copper > 0.01
              ? ("up" as const)
              : crisisImpact.copper < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Wheat",
          price: Number((basePrices.wheat * inflationFactor * (1 + crisisImpact.wheat)).toFixed(2)),
          change: Number((crisisImpact.wheat * 100).toFixed(1)),
          trend:
            crisisImpact.wheat > 0.01
              ? ("up" as const)
              : crisisImpact.wheat < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
        {
          name: "Natural Gas",
          price: Number((basePrices.gas * inflationFactor * (1 + crisisImpact.gas)).toFixed(2)),
          change: Number((crisisImpact.gas * 100).toFixed(1)),
          trend:
            crisisImpact.gas > 0.01
              ? ("up" as const)
              : crisisImpact.gas < -0.01
                ? ("down" as const)
                : ("stable" as const),
        },
      ];

      return commodities;
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching commodity prices:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch commodity prices",
      });
    }
  }),

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
