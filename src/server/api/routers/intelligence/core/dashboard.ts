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
  protectedProcedure,
  cachedProtectedProcedure,
  premiumProcedure,
} from "~/server/api/trpc";
import { evaluateThresholds } from "../alerts";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notification-api";
import { cabinetMeetingSchema } from "../../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelCoreDashboardRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  /**
   * Get comprehensive executive dashboard overview
   * Includes vitality metrics, active alerts, and quick actions
   */
  getOverview: cachedProtectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Evaluate thresholds on-the-fly
        try {
          if (ctx.user?.id) {
            await evaluateThresholds(ctx.db, input.countryId, ctx.user.id);
          }
        } catch (e) {
          console.error("Error evaluating thresholds in getOverview:", e);
        }

        // Parallelize all independent queries for 3-6x performance improvement
        const [country, vitalitySnapshots, alerts, briefings, recentMeetings, activePolicies] =
          await Promise.all([
            // Get country data
            ctx.db.country.findUnique({
              where: { id: input.countryId },
              include: {
                governmentStructure: true,
                economicModel: true,
                taxSystem: true,
              },
            }),
            // Get latest vitality snapshots
            ctx.db.vitalitySnapshot.findMany({
              where: { countryId: input.countryId },
              orderBy: { calculatedAt: "desc" },
              take: 4, // One for each major area
            }),
            // Get active intelligence alerts
            ctx.db.intelligenceAlert.findMany({
              where: {
                countryId: input.countryId,
                isActive: true,
                isResolved: false,
              },
              orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
              take: 10,
            }),
            // Get active intelligence briefings
            ctx.db.intelligenceBriefing.findMany({
              where: {
                countryId: input.countryId,
                isActive: true,
              },
              include: {
                recommendations: {
                  where: { isActive: true, isImplemented: false },
                  take: 5,
                },
              },
              orderBy: [{ priority: "desc" }, { generatedAt: "desc" }],
              take: 5,
            }),
            // Get recent cabinet meetings
            ctx.db.cabinetMeeting.findMany({
              where: { countryId: input.countryId },
              orderBy: { scheduledDate: "desc" },
              take: 5,
              include: {
                decisions: {
                  where: { implementationStatus: { in: ["pending", "in_progress"] } },
                },
              },
            }),
            // Get active policies
            ctx.db.policy.findMany({
              where: {
                countryId: input.countryId,
                status: "active",
              },
              orderBy: { effectiveDate: "desc" },
              take: 10,
            }),
          ]);

        if (!country) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
        }

        // Calculate summary metrics
        const criticalAlerts = alerts.filter(
          (a) => a.severity === "CRITICAL" || a.severity === "critical"
        ).length;
        const highPriorityBriefings = briefings.filter(
          (b) =>
            b.priority === "HIGH" ||
            b.priority === "high" ||
            b.priority === "CRITICAL" ||
            b.priority === "critical"
        ).length;
        const pendingDecisions = recentMeetings.reduce((sum, m) => sum + m.decisions.length, 0);

        return {
          country: {
            id: country.id,
            name: country.name,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            overallNationalHealth: country.overallNationalHealth,
          },
          vitality: {
            economic:
              vitalitySnapshots.find((v) => v.area === "economic" || v.area === "ECONOMIC")
                ?.score || country.economicVitality,
            social:
              vitalitySnapshots.find((v) => v.area === "social" || v.area === "SOCIAL")?.score ||
              country.populationWellbeing,
            diplomatic:
              vitalitySnapshots.find((v) => v.area === "diplomatic" || v.area === "DIPLOMATIC")
                ?.score || country.diplomaticStanding,
            governance:
              vitalitySnapshots.find((v) => v.area === "governance" || v.area === "GOVERNANCE")
                ?.score || country.governmentalEfficiency,
            snapshots: vitalitySnapshots,
          },
          alerts: {
            total: alerts.length,
            critical: criticalAlerts,
            items: alerts.map((alert) => ({
              id: alert.id,
              title: alert.title,
              description: alert.description,
              severity: alert.severity,
              category: alert.category,
              alertType: alert.alertType,
              currentValue: alert.currentValue,
              expectedValue: alert.expectedValue,
              deviation: alert.deviation,
              detectedAt: alert.detectedAt,
              isActive: alert.isActive,
              isResolved: alert.isResolved,
              resolvedAt: alert.resolvedAt,
            })),
          },
          briefings: {
            total: briefings.length,
            highPriority: highPriorityBriefings,
            items: briefings.map((b) => ({
              id: b.id,
              title: b.title,
              description: b.description,
              type: b.type,
              priority: b.priority,
              area: b.area,
              confidence: b.confidence,
              urgency: b.urgency,
              recommendations: b.recommendations.length,
              generatedAt: b.generatedAt,
            })),
          },
          activity: {
            recentMeetings: recentMeetings.length,
            pendingDecisions,
            activePolicies: activePolicies.length,
          },
          lastUpdated: new Date(),
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching overview:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch executive overview",
        });
      }
    }),

  /**
   * Get enhanced quick actions with builder context
   */
  getQuickActions: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            economicModel: true,
            governmentStructure: true,
          },
        });

        if (!country) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
        }

        // Get recent security threats
        const recentThreats = await ctx.db.intelligenceAlert.findMany({
          where: {
            countryId: input.countryId,
            category: { in: ["security", "SECURITY", "crisis", "CRISIS"] },
            isActive: true,
            detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
          },
        });

        // Get active recommendations
        const recommendations = await ctx.db.intelligenceRecommendation.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            isImplemented: false,
          },
          orderBy: { successProbability: "desc" },
          take: 3,
        });

        const quickActions = [];

        // Economic Quick Actions
        if (country.currentGdpPerCapita < 25000) {
          quickActions.push({
            id: "infrastructure_boost",
            title: "Infrastructure Investment",
            description: "Boost GDP through targeted infrastructure spending",
            actionType: "infrastructure_boost",
            category: "economic",
            urgency: "important",
            estimatedDuration: "6 months",
            successProbability: 85,
            estimatedBenefit: "+2.5% GDP growth",
            requirements: ["Budget allocation", "Planning approval"],
            risks: ["Budget overruns", "Implementation delays"],
          });
        }

        // Security Quick Actions
        if (recentThreats.length > 0) {
          quickActions.push({
            id: "security_review",
            title: "Security Assessment",
            description: "Conduct comprehensive security review",
            actionType: "security_review",
            category: "security",
            urgency: "urgent",
            estimatedDuration: "2 weeks",
            successProbability: 95,
            estimatedBenefit: "Enhanced security",
            requirements: ["Security clearance", "Department coordination"],
            risks: ["Resource intensive"],
          });
        }

        // Population Growth Actions
        if (country.populationGrowthRate > 0.03) {
          quickActions.push({
            id: "education_expansion",
            title: "Education Capacity",
            description: "Expand educational infrastructure for growing population",
            actionType: "education_expansion",
            category: "social",
            urgency: "important",
            estimatedDuration: "1 year",
            successProbability: 90,
            estimatedBenefit: "Long-term productivity",
            requirements: ["Budget allocation", "Teacher recruitment"],
            risks: ["Long implementation timeline"],
          });
        }

        // Trade Opportunities
        quickActions.push({
          id: "trade_mission",
          title: "Trade Mission",
          description: "Organize diplomatic trade mission",
          actionType: "trade_mission",
          category: "diplomatic",
          urgency: "routine",
          estimatedDuration: "3 months",
          successProbability: 75,
          estimatedBenefit: "New trade partnerships",
          requirements: ["Diplomatic coordination"],
          risks: ["Travel costs", "Uncertain outcomes"],
        });

        // Governance Quick Actions - Meeting & Policy Integration
        const recentMeetings = await ctx.db.cabinetMeeting.count({
          where: {
            countryId: input.countryId,
            scheduledDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          },
        });

        if (recentMeetings < 2) {
          quickActions.push({
            id: "schedule_meeting",
            title: "Schedule Cabinet Meeting",
            description: "Convene strategic planning session with government officials",
            actionType: "schedule_meeting",
            category: "governance",
            urgency: "important",
            estimatedDuration: "2 hours",
            successProbability: 95,
            estimatedBenefit: "Improved coordination and decision-making",
            requirements: ["Cabinet availability"],
            risks: ["Scheduling conflicts"],
          });
        }

        const activePolicies = await ctx.db.policy.count({
          where: {
            countryId: input.countryId,
            status: { in: ["active", "proposed"] },
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
          },
        });

        if (activePolicies < 3) {
          quickActions.push({
            id: "create_policy",
            title: "Develop New Policy",
            description: "Create strategic policy initiative to address national priorities",
            actionType: "create_policy",
            category: "governance",
            urgency: "routine",
            estimatedDuration: "2-4 weeks",
            successProbability: 85,
            estimatedBenefit: "Long-term strategic direction",
            requirements: ["Policy research", "Stakeholder consultation"],
            risks: ["Implementation challenges"],
          });
        }

        // Add recommendation-based actions
        recommendations.forEach((rec) => {
          quickActions.push({
            id: `recommendation_${rec.id}`,
            title: rec.title,
            description: rec.description,
            actionType: "policy_implementation",
            category: rec.category.toLowerCase(),
            urgency: rec.urgency.toLowerCase(),
            estimatedDuration: rec.estimatedDuration,
            successProbability: rec.successProbability,
            estimatedBenefit: rec.estimatedBenefit,
            requirements: JSON.parse(rec.prerequisites),
            risks: JSON.parse(rec.risks),
            recommendationId: rec.id,
          });
        });

        return {
          actions: quickActions,
          context: {
            countryTier: country.economicTier,
            recentThreats: recentThreats.length,
            activeRecommendations: recommendations.length,
          },
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching quick actions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch quick actions",
        });
      }
    }),

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

  // ===== CABINET MEETING MANAGEMENT =====

  /**
   * Get cabinet meetings for a country
   * Uses the cabinetMeeting table (same schema as meetings router).
   */
  getCabinetMeetings: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only access meetings for your own country",
          });
        }

        const meetings = await ctx.db.cabinetMeeting.findMany({
          where: { countryId: input.countryId },
          orderBy: { scheduledDate: "desc" },
          include: {
            decisions: {
              where: { implementationStatus: { in: ["pending", "in_progress"] } },
            },
            actionItems: true,
            attendances: true,
          },
        });

        return meetings;
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching cabinet meetings:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch cabinet meetings",
            });
      }
    }),

  /**
   * Create a new cabinet meeting
   * Uses the cabinetMeeting table (same schema as meetings router).
   */
  createCabinetMeeting: premiumProcedure
    .input(cabinetMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create meetings for your own country",
          });
        }

        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.user.id },
          select: { id: true, country: true },
        });

        if (!user?.country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User must be associated with a country",
          });
        }

        const result = await ctx.db.cabinetMeeting.create({
          data: {
            countryId: input.countryId,
            userId: user.id,
            title: input.title,
            scheduledDate: input.scheduledDate,
            description: input.description ?? null,
          },
        });

        await notificationAPI.create({
          title: "📅 Cabinet Meeting Scheduled",
          message: `A new cabinet meeting titled '${input.title}' has been scheduled.`,
          countryId: input.countryId,
          category: "governance",
          priority: "medium",
          type: "info",
          href: "/mycountry/intelligence",
          source: "intelligence-system",
          actionable: true,
          metadata: {
            meetingId: result.id,
            title: input.title,
            scheduledDate: input.scheduledDate,
          },
        });

        return result;
      } catch (error) {
        console.error("[Unified Intelligence] Error creating cabinet meeting:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create cabinet meeting",
            });
      }
    }),

  // ===== ECONOMIC POLICY MANAGEMENT =====
  // ===== CRISIS MANAGEMENT (from SDI) =====

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  // ===== DIPLOMATIC INTELLIGENCE (from SDI) =====

  // ===== STRATEGIC PLANS & SECURITY =====

  /**
   * Get strategic plans for a country
   * Migrated from ECI router
   */
  getStrategicPlans: protectedProcedure
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

        // Retrieve strategic plans from SystemConfig
        const plans = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_strategic_plan_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        return plans.map((plan) => ({
          id: plan.id,
          ...JSON.parse(plan.value),
        }));
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching strategic plans:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch strategic plans",
            });
      }
    }),

  // ===== KEY FINDINGS =====
});

// ===== HELPER FUNCTIONS =====
// Migrated from ECI router for advanced analytics and AI recommendations
