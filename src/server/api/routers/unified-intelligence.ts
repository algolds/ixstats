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
  executiveProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import type { CrisisEvent, EconomicIndicator } from "~/types/sdi";

// ===== SCHEMAS =====

const classificationSchema = z.enum([
  "PUBLIC",
  "RESTRICTED",
  "CONFIDENTIAL",
  "SECRET",
  "TOP_SECRET",
]);
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]);
const actionTypeSchema = z.enum([
  "infrastructure_boost",
  "security_review",
  "education_expansion",
  "trade_mission",
  "diplomatic_outreach",
  "economic_stimulus",
  "policy_implementation",
  "emergency_response",
  "schedule_meeting",
  "create_policy",
  "strategic_planning",
]);

const cabinetMeetingSchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  scheduledDate: z
    .union([z.date(), z.string().datetime(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  attendees: z.array(z.string()).optional(),
  agenda: z.array(z.string()).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
});

const quickActionSchema = z.object({
  countryId: z.string(),
  actionType: actionTypeSchema,
  parameters: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
    )
    .optional(),
  priority: prioritySchema.optional().default("NORMAL"),
  notes: z.string().optional(),
});

const diplomaticMessageSchema = z.object({
  channelId: z.string(),
  fromCountryId: z.string(),
  fromCountryName: z.string(),
  toCountryId: z.string().optional(),
  toCountryName: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1),
  classification: classificationSchema.default("PUBLIC"),
  priority: prioritySchema.default("NORMAL"),
  encrypted: z.boolean().default(false),
});

const securityThreatSchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["cyber", "terrorism", "military", "economic", "infrastructure", "political"]),
  status: z.enum(["active", "monitoring", "resolved", "dismissed"]).default("active"),
  detectedDate: z.date().default(() => new Date()),
  source: z.string().optional(),
});

const strategicPlanSchema = z.object({
  countryId: z.string(),
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

const economicPolicySchema = z.object({
  countryId: z.string(),
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

// ===== UNIFIED INTELLIGENCE ROUTER =====

export const unifiedIntelligenceRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  /**
   * Get comprehensive executive dashboard overview
   * Includes vitality metrics, active alerts, and quick actions
   */
  getOverview: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Get country data
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            governmentStructure: true,
            economicModel: true,
            taxSystem: true,
          },
        });

        if (!country) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
        }

        // Get latest vitality snapshots
        const vitalitySnapshots = await ctx.db.vitalitySnapshot.findMany({
          where: { countryId: input.countryId },
          orderBy: { calculatedAt: "desc" },
          take: 4, // One for each major area
        });

        // Get active intelligence alerts
        const alerts = await ctx.db.intelligenceAlert.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            isResolved: false,
          },
          orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
          take: 10,
        });

        // Get active intelligence briefings
        const briefings = await ctx.db.intelligenceBriefing.findMany({
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
        });

        // Get recent cabinet meetings
        const recentMeetings = await ctx.db.cabinetMeeting.findMany({
          where: { countryId: input.countryId },
          orderBy: { scheduledDate: "desc" },
          take: 5,
          include: {
            decisions: {
              where: { implementationStatus: { in: ["pending", "in_progress"] } },
            },
          },
        });

        // Get active policies
        const activePolicies = await ctx.db.policy.findMany({
          where: {
            countryId: input.countryId,
            status: "active",
          },
          orderBy: { effectiveDate: "desc" },
          take: 10,
        });

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

  /**
   * Execute quick action with real database effects
   */
  executeAction: premiumProcedure.input(quickActionSchema).mutation(async ({ ctx, input }) => {
    try {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Verify user owns the country
      if (ctx.user.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only execute actions for your own country",
        });
      }

      let result;
      const ixTime = IxTime.getCurrentIxTime();

      switch (input.actionType) {
        case "infrastructure_boost":
          // Apply temporary GDP growth boost
          await ctx.db.dmInputs.create({
            data: {
              countryId: input.countryId,
              ixTimeTimestamp: new Date(),
              inputType: "economic_policy",
              value: 2.5, // 2.5% GDP boost
              description: "Infrastructure investment quick action",
              duration: 180, // 180 days
              isActive: true,
              createdBy: ctx.user.id,
            },
          });
          result = {
            success: true,
            message: "Infrastructure boost applied",
            effect: "+2.5% GDP growth for 6 months",
          };
          break;

        case "security_review":
          // Mark all active threats as under review
          const threats = await ctx.db.intelligenceAlert.findMany({
            where: {
              countryId: input.countryId,
              isActive: true,
              isResolved: false,
            },
          });

          await ctx.db.intelligenceAlert.updateMany({
            where: {
              countryId: input.countryId,
              isActive: true,
              isResolved: false,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          result = {
            success: true,
            message: "Security review initiated",
            effect: `${threats.length} threats under monitoring`,
          };
          break;

        case "education_expansion":
          // Apply long-term productivity boost
          await ctx.db.dmInputs.create({
            data: {
              countryId: input.countryId,
              ixTimeTimestamp: new Date(),
              inputType: "special_event",
              value: 1.5, // 1.5% productivity boost
              description: "Education expansion program",
              duration: 365, // 1 year
              isActive: true,
              createdBy: ctx.user.id,
            },
          });
          result = {
            success: true,
            message: "Education expansion started",
            effect: "+1.5% productivity for 1 year",
          };
          break;

        case "trade_mission":
          // Create diplomatic event
          await ctx.db.diplomaticEvent.create({
            data: {
              country1Id: input.countryId,
              eventType: "trade_mission",
              title: "Trade Mission Initiative",
              description: "Organized trade mission to develop new partnerships",
              status: "active",
              economicImpact: 5000000, // $5M economic impact
              ixTimeTimestamp: ixTime,
            },
          });
          result = {
            success: true,
            message: "Trade mission organized",
            effect: "New diplomatic opportunities",
          };
          break;

        case "diplomatic_outreach":
          // Improve diplomatic standing
          await ctx.db.country.update({
            where: { id: input.countryId },
            data: {
              diplomaticStanding: Math.min(100, country.diplomaticStanding + 5),
            },
          });
          result = {
            success: true,
            message: "Diplomatic outreach successful",
            effect: "+5 diplomatic standing",
          };
          break;

        case "economic_stimulus":
          // Apply economic stimulus
          await ctx.db.dmInputs.create({
            data: {
              countryId: input.countryId,
              ixTimeTimestamp: new Date(),
              inputType: "economic_policy",
              value: 3.0, // 3% economic boost
              description: "Emergency economic stimulus package",
              duration: 90, // 90 days
              isActive: true,
              createdBy: ctx.user.id,
            },
          });
          result = {
            success: true,
            message: "Economic stimulus activated",
            effect: "+3% GDP growth for 3 months",
          };
          break;

        case "policy_implementation":
          // Implement a policy from recommendations
          const recommendationId = input.parameters?.recommendationId as string;
          if (recommendationId) {
            await ctx.db.intelligenceRecommendation.update({
              where: { id: recommendationId },
              data: {
                isImplemented: true,
                implementedAt: new Date(),
              },
            });
          }
          result = {
            success: true,
            message: "Policy implementation initiated",
            effect: "Long-term strategic benefit",
          };
          break;

        case "emergency_response":
          // Emergency response action
          await ctx.db.dmInputs.create({
            data: {
              countryId: input.countryId,
              ixTimeTimestamp: new Date(),
              inputType: "special_event",
              value: 0.5,
              description: "Emergency response deployment",
              duration: 30,
              isActive: true,
              createdBy: ctx.user.id,
            },
          });
          result = {
            success: true,
            message: "Emergency response deployed",
            effect: "Crisis mitigation active",
          };
          break;

        case "schedule_meeting":
          // Create a cabinet meeting from quick action
          const meetingTitle = (input.parameters?.title as string) || "Strategic Cabinet Meeting";
          const scheduledDate = input.parameters?.scheduledDate
            ? new Date(input.parameters.scheduledDate as string)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 1 week from now

          const meeting = await ctx.db.cabinetMeeting.create({
            data: {
              countryId: input.countryId,
              userId: ctx.user.id,
              title: meetingTitle,
              description:
                (input.parameters?.description as string) ||
                input.notes ||
                "Strategic planning session",
              scheduledDate,
              duration: (input.parameters?.duration as number) || 60,
              status: "scheduled",
            },
          });

          // Send notification for meeting
          await notificationAPI.create({
            title: "📅 Cabinet Meeting Scheduled",
            message: `${meetingTitle} scheduled for ${scheduledDate.toLocaleDateString()}`,
            countryId: input.countryId,
            category: "governance",
            priority: "high",
            type: "info",
            href: "/mycountry/intelligence?tab=meetings",
            source: "unified-intelligence",
            actionable: true,
            metadata: { meetingId: meeting.id },
          });

          result = {
            success: true,
            message: "Cabinet meeting scheduled",
            effect: `Meeting scheduled for ${scheduledDate.toLocaleDateString()}`,
          };
          break;

        case "create_policy":
          // Create a policy from quick action
          const policyTitle = (input.parameters?.title as string) || "Strategic Policy Initiative";
          const policyType = (input.parameters?.policyType as string) || "governance";

          const policy = await ctx.db.policy.create({
            data: {
              countryId: input.countryId,
              name: policyTitle,
              description:
                (input.parameters?.description as string) ||
                input.notes ||
                "Strategic policy implementation",
              policyType: policyType as any,
              category: policyType,
              status: "draft",
              priority: (input.priority?.toLowerCase() as any) || "medium",
              implementationCost: (input.parameters?.cost as number) || 0,
              effectiveDate: new Date(),
              userId: ctx.user.id,
            },
          });

          // Send notification for policy
          await notificationAPI.create({
            title: "📋 Policy Draft Created",
            message: `${policyTitle} has been drafted and is ready for review`,
            countryId: input.countryId,
            category: "governance",
            priority: "medium",
            type: "info",
            href: "/mycountry/intelligence?tab=policies",
            source: "unified-intelligence",
            actionable: true,
            metadata: { policyId: policy.id },
          });

          result = {
            success: true,
            message: "Policy draft created",
            effect: `${policyTitle} ready for review and activation`,
          };
          break;

        case "strategic_planning":
          // Create strategic planning session
          const planTitle = (input.parameters?.title as string) || "Strategic Planning Initiative";

          // Create both a meeting and a policy outline
          const strategicMeeting = await ctx.db.cabinetMeeting.create({
            data: {
              countryId: input.countryId,
              userId: ctx.user.id,
              title: `Planning Session: ${planTitle}`,
              description: "Strategic planning and policy development session",
              scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
              duration: 120,
              status: "scheduled",
            },
          });

          result = {
            success: true,
            message: "Strategic planning session created",
            effect: "Planning meeting scheduled with policy development framework",
          };
          break;

        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unknown action type",
          });
      }

      // Send notification
      await notificationAPI.create({
        title: "⚡ Quick Action Executed",
        message: `${result.message} - ${result.effect}`,
        countryId: input.countryId,
        category: "governance",
        priority: input.priority === "URGENT" || input.priority === "CRITICAL" ? "high" : "medium",
        type: "success",
        href: "/mycountry",
        source: "unified-intelligence",
        actionable: false,
        metadata: {
          actionType: input.actionType,
          effect: result.effect,
          parameters: input.parameters,
        },
      });

      return result;
    } catch (error) {
      console.error("[Unified Intelligence] Error executing action:", error);
      throw error instanceof TRPCError
        ? error
        : new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to execute action",
          });
    }
  }),

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

  /**
   * Get secure diplomatic channels with classification filtering
   */
  getDiplomaticChannels: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        clearanceLevel: classificationSchema.optional().default("PUBLIC"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const channels = await ctx.db.diplomaticChannel.findMany({
          where: {
            participants: {
              some: { countryId: input.countryId },
            },
            // Filter by classification
            classification:
              input.clearanceLevel === "TOP_SECRET"
                ? undefined
                : input.clearanceLevel === "SECRET"
                  ? { in: ["PUBLIC", "RESTRICTED", "CONFIDENTIAL", "SECRET"] }
                  : input.clearanceLevel === "CONFIDENTIAL"
                    ? { in: ["PUBLIC", "RESTRICTED", "CONFIDENTIAL"] }
                    : input.clearanceLevel === "RESTRICTED"
                      ? { in: ["PUBLIC", "RESTRICTED"] }
                      : "PUBLIC",
          },
          include: {
            participants: true,
            _count: {
              select: {
                messages: {
                  where: {
                    status: { notIn: ["READ"] },
                    fromCountryId: { not: input.countryId },
                  },
                },
              },
            },
          },
          orderBy: { lastActivity: "desc" },
        });

        return channels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          classification: channel.classification,
          encrypted: channel.encrypted,
          lastActivity: channel.lastActivity,
          unreadCount: channel._count.messages,
          participants: channel.participants.map((p) => ({
            countryId: p.countryId,
            countryName: p.countryName,
            flagUrl: p.flagUrl,
            role: p.role,
          })),
        }));
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching diplomatic channels:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch diplomatic channels",
        });
      }
    }),

  /**
   * Send encrypted diplomatic message
   */
  sendSecureMessage: protectedProcedure
    .input(diplomaticMessageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the sending country
        if (ctx.user.countryId !== input.fromCountryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only send messages from your own country",
          });
        }

        // Verify channel access
        const channel = await ctx.db.diplomaticChannel.findFirst({
          where: {
            id: input.channelId,
            participants: {
              some: { countryId: input.fromCountryId },
            },
          },
        });

        if (!channel) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this diplomatic channel",
          });
        }

        // Create message
        const message = await ctx.db.diplomaticMessage.create({
          data: {
            channelId: input.channelId,
            fromCountryId: input.fromCountryId,
            fromCountryName: input.fromCountryName,
            toCountryId: input.toCountryId,
            toCountryName: input.toCountryName,
            subject: input.subject,
            content: input.content,
            classification: input.classification,
            priority: input.priority,
            encrypted: input.encrypted,
            ixTimeTimestamp: IxTime.getCurrentIxTime(),
          },
        });

        // Update channel last activity
        await ctx.db.diplomaticChannel.update({
          where: { id: input.channelId },
          data: { lastActivity: new Date() },
        });

        // Send notification to recipient(s)
        const recipients = input.toCountryId
          ? [input.toCountryId]
          : (
              await ctx.db.diplomaticChannelParticipant.findMany({
                where: {
                  channelId: input.channelId,
                  countryId: { not: input.fromCountryId },
                },
              })
            ).map((p) => p.countryId);

        for (const recipientId of recipients) {
          await notificationAPI.create({
            title: `📨 ${input.classification} Diplomatic Message`,
            message: `From ${input.fromCountryName}: ${input.subject || "New message"}`,
            countryId: recipientId,
            category: "diplomatic",
            priority:
              input.priority === "URGENT" || input.priority === "CRITICAL" ? "high" : "medium",
            type: "info",
            href: "/diplomatic/messages",
            source: "diplomatic-system",
            actionable: true,
            metadata: {
              messageId: message.id,
              channelId: input.channelId,
              classification: input.classification,
              encrypted: input.encrypted,
            },
          });
        }

        return {
          success: true,
          message: message,
          recipientCount: recipients.length,
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error sending message:", error);
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to send diplomatic message",
            });
      }
    }),

  // ===== INTELLIGENCE FEED =====

  /**
   * Get real-time intelligence feed with filtering
   */
  getIntelligenceFeed: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        category: z
          .enum([
            "all",
            "economic",
            "ECONOMIC",
            "crisis",
            "CRISIS",
            "diplomatic",
            "DIPLOMATIC",
            "security",
            "SECURITY",
            "technology",
            "environment",
          ])
          .optional(),
        priority: z
          .enum(["all", "low", "LOW", "medium", "MEDIUM", "high", "HIGH", "critical", "CRITICAL"])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { isActive: true };

        if (input.category && input.category !== "all") {
          where.category = input.category.toUpperCase();
        }
        if (input.priority && input.priority !== "all") {
          where.priority = input.priority.toUpperCase();
        }

        const [items, total] = await Promise.all([
          ctx.db.intelligenceItem.findMany({
            where,
            orderBy: { timestamp: "desc" },
            skip: input.offset,
            take: input.limit,
          }),
          ctx.db.intelligenceItem.count({ where }),
        ]);

        return {
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
            priority: item.priority,
            severity: item.severity,
            source: item.source,
            timestamp: item.timestamp,
            region: item.region,
            affectedCountries: item.affectedCountries ? item.affectedCountries.split(",") : [],
            actionable: item.actionable,
            confidence: item.confidence,
          })),
          pagination: {
            total,
            offset: input.offset,
            limit: input.limit,
            hasMore: input.offset + input.limit < total,
          },
        };
      } catch (error) {
        console.error("[Unified Intelligence] Error fetching intelligence feed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch intelligence feed",
        });
      }
    }),

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
        const metrics = await calculateRealTimeMetrics(ctx.db, input.countryId);

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

  /**
   * Get cabinet meetings for a country
   * Migrated from ECI router
   */
  getCabinetMeetings: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only access meetings for your own country",
          });
        }

        const meetings = await ctx.db.systemConfig.findMany({
          where: {
            key: { contains: `eci_cabinet_meeting_${input.countryId}` },
          },
          orderBy: { updatedAt: "desc" },
        });

        return meetings.map((meeting) => ({
          id: meeting.id,
          ...JSON.parse(meeting.value),
        }));
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
   * Migrated from ECI router
   */
  createCabinetMeeting: protectedProcedure
    .input(cabinetMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create meetings for your own country",
          });
        }

        // Get the user's full record for backward compatibility
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.user.id },
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
            key: `eci_cabinet_meeting_${input.countryId}_${Date.now()}`,
            value: JSON.stringify({
              ...input,
              countryId: input.countryId,
              createdBy: user.id,
              createdAt: new Date(),
            }),
            description: `Cabinet meeting: ${input.title}`,
          },
        });

        // Trigger notification for the country
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
          .filter((p: any) => p.category === input.category && p.status === "implemented");

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
          (p: any) => p.status === "implemented"
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
          categoryPolicies.some((p: any) => p.title === effect.name)
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

  /**
   * Get enhanced diplomatic intelligence
   * Migrated from SDI router - extends existing diplomatic functionality
   */
  getEnhancedDiplomaticIntelligence: publicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get diplomatic intelligence for a specific country or global
        const whereClause = input.countryId
          ? {
              affectedCountries: {
                contains: input.countryId,
              },
            }
          : {};

        const [relations, treaties, crises, intelligence] = await Promise.all([
          ctx.db.diplomaticRelation.findMany({
            where: input.countryId
              ? {
                  OR: [{ country1: input.countryId }, { country2: input.countryId }],
                }
              : {},
            orderBy: { lastContact: "desc" },
            take: 10,
          }),
          ctx.db.treaty.findMany({
            where: input.countryId
              ? {
                  parties: {
                    contains: input.countryId,
                  },
                }
              : {},
            orderBy: { signedDate: "desc" },
            take: 10,
          }),
          ctx.db.crisisEvent.findMany({
            where: {
              ...whereClause,
              type: "political_crisis",
            },
            orderBy: { timestamp: "desc" },
            take: 5,
          }),
          ctx.db.intelligenceItem.findMany({
            where: {
              ...whereClause,
              category: "diplomatic",
            },
            orderBy: { timestamp: "desc" },
            take: 10,
          }),
        ]);

        return {
          relations: relations.map((relation) => ({
            id: relation.id,
            country1: relation.country1,
            country2: relation.country2,
            relationship: relation.relationship,
            strength: relation.strength,
            status: relation.status,
            lastContact: relation.lastContact,
          })),
          treaties: treaties.map((treaty) => ({
            id: treaty.id,
            name: treaty.name,
            type: treaty.type,
            status: treaty.status,
            signedDate: treaty.signedDate,
            parties: treaty.parties ? JSON.parse(treaty.parties) : [],
          })),
          recentCrises: crises.map((crisis) => ({
            id: crisis.id,
            title: crisis.title,
            severity: crisis.severity,
            timestamp: crisis.timestamp,
            affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
          })),
          intelligenceItems: intelligence.map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            priority: item.priority,
            timestamp: item.timestamp.getTime(),
            source: item.source,
          })),
        };
      } catch (error) {
        console.error(
          "[Unified Intelligence] Error fetching enhanced diplomatic intelligence:",
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch enhanced diplomatic intelligence",
        });
      }
    }),

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
});

// ===== HELPER FUNCTIONS =====
// Migrated from ECI router for advanced analytics and AI recommendations

/**
 * Calculate volatility metrics from historical data
 */
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

/**
 * Calculate trend analysis from historical data
 */
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

/**
 * Calculate correlation analysis (simplified)
 */
function calculateCorrelations(data: any[]) {
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

/**
 * Generate predictive economic models
 */
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
    (p: any) => p.policyType === "social" || p.policyType === "SOCIAL"
  );
  const socialScore = Math.min(100, baseSocialScore + socialPolicies.length * 3);

  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore),
  };
}
