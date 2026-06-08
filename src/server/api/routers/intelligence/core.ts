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
import { evaluateThresholds } from "./alerts";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import type { CrisisEvent, EconomicIndicator } from "~/types/sdi";
import {
  classificationSchema,
  prioritySchema,
  actionTypeSchema,
  cabinetMeetingSchema,
  quickActionSchema,
  diplomaticMessageSchema,
  securityThreatSchema,
  strategicPlanSchema,
  economicPolicySchema,
} from "../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelCoreRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  /**
   * Get comprehensive executive dashboard overview
   * Includes vitality metrics, active alerts, and quick actions
   */
  getOverview: protectedProcedure
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
          await ctx.db.storytellerEffect.create({
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
          await ctx.db.storytellerEffect.create({
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
          await ctx.db.storytellerEffect.create({
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
          await ctx.db.storytellerEffect.create({
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
  sendSecureMessage: premiumProcedure
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

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

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
  createCabinetMeeting: premiumProcedure
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
  // ===== CRISIS MANAGEMENT (from SDI) =====

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

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

  // ===== KEY FINDINGS =====

  /**
   * Auto-generate intelligence key findings from live data sources.
   * Queries economic, diplomatic, security, and network data to produce
   * 5-7 findings with severity and trend information.
   */
  getKeyFindings: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const findings: Array<{
        id: string;
        category: "economic" | "diplomatic" | "security" | "policy" | "network";
        severity: "info" | "warning" | "critical";
        title: string;
        description: string;
        metric?: { value: number; change: number; unit: string };
        timestamp: string;
      }> = [];

      const now = new Date();

      // --- Economic findings ---
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          currentTotalGdp: true,
          adjustedGdpGrowth: true,
          currentPopulation: true,
          name: true,
        },
      });

      if (country) {
        const gdpGrowth = country.adjustedGdpGrowth ?? 0;
        const severity = gdpGrowth < -2 ? "critical" : gdpGrowth < 0 ? "warning" : "info";
        findings.push({
          id: "econ-gdp-growth",
          category: "economic",
          severity,
          title: gdpGrowth >= 0 ? "GDP Growth Positive" : "GDP Growth Declining",
          description:
            gdpGrowth >= 0
              ? `The economy is growing at ${gdpGrowth.toFixed(2)}% annually. Current GDP stands at $${((country.currentTotalGdp ?? 0) / 1e9).toFixed(1)}B.`
              : `The economy is contracting at ${gdpGrowth.toFixed(2)}%. Fiscal intervention may be required.`,
          metric: { value: gdpGrowth, change: gdpGrowth, unit: "% growth" },
          timestamp: now.toISOString(),
        });
      }

      // --- Alert findings ---
      const alerts = await ctx.db.intelligenceAlert.findMany({
        where: { countryId: input.countryId, isActive: true, isResolved: false },
        select: { severity: true },
      });

      const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
      const highCount = alerts.filter((a) => a.severity === "HIGH").length;
      const totalAlerts = alerts.length;

      if (totalAlerts > 0) {
        findings.push({
          id: "security-alerts",
          category: "security",
          severity: criticalCount > 0 ? "critical" : highCount > 0 ? "warning" : "info",
          title:
            criticalCount > 0
              ? `${criticalCount} Critical Alert${criticalCount > 1 ? "s" : ""} Active`
              : `${totalAlerts} Active Alert${totalAlerts > 1 ? "s" : ""}`,
          description:
            criticalCount > 0
              ? `There are ${criticalCount} critical and ${highCount} high-severity alerts requiring immediate attention.`
              : `${totalAlerts} intelligence alert${totalAlerts > 1 ? "s" : ""} currently being monitored, ${highCount} at high severity.`,
          metric: { value: totalAlerts, change: 0, unit: "alerts" },
          timestamp: now.toISOString(),
        });
      }

      // --- Diplomatic findings ---
      const embassies = await ctx.db.embassy.findMany({
        where: { OR: [{ hostCountryId: input.countryId }, { guestCountryId: input.countryId }] },
        select: { status: true, createdAt: true },
      });

      const activeEmbassies = embassies.filter(
        (e) => e.status === "ACTIVE" || e.status === "active"
      ).length;
      const recentEmbassies = embassies.filter(
        (e) => e.createdAt > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      ).length;

      findings.push({
        id: "network-embassies",
        category: "network",
        severity: activeEmbassies === 0 ? "warning" : "info",
        title:
          activeEmbassies === 0
            ? "No Active Embassies"
            : `Embassy Network: ${activeEmbassies} Active`,
        description:
          activeEmbassies === 0
            ? "Your nation has no active embassies. Establishing diplomatic presence abroad improves trade and relations."
            : `Your diplomatic network spans ${activeEmbassies} active embassies.${recentEmbassies > 0 ? ` ${recentEmbassies} established in the past week.` : ""}`,
        metric: { value: activeEmbassies, change: recentEmbassies, unit: "embassies" },
        timestamp: now.toISOString(),
      });

      // --- Relationship findings ---
      const relations = await ctx.db.diplomaticRelation.findMany({
        where: { OR: [{ country1: input.countryId }, { country2: input.countryId }] },
        select: { strength: true },
      });

      if (relations.length > 0) {
        const avgStrength =
          relations.reduce((s, r) => s + (r.strength ?? 50), 0) / relations.length;
        findings.push({
          id: "diplomatic-relations",
          category: "diplomatic",
          severity: avgStrength < 30 ? "warning" : "info",
          title:
            avgStrength < 30 ? "Diplomatic Relations Under Strain" : "Diplomatic Relations Stable",
          description: `Average relationship strength is ${avgStrength.toFixed(0)}% across ${relations.length} bilateral relations.${avgStrength < 30 ? " Consider diplomatic outreach to improve ties." : ""}`,
          metric: { value: Math.round(avgStrength), change: 0, unit: "% avg" },
          timestamp: now.toISOString(),
        });
      }

      // --- Policy findings ---
      const policies = await ctx.db.policy.findMany({
        where: { countryId: input.countryId, status: { in: ["approved", "implemented"] } },
        select: { status: true, category: true },
      });

      if (policies.length > 0) {
        const implemented = policies.filter((p) => p.status === "implemented").length;
        findings.push({
          id: "policy-status",
          category: "policy",
          severity: "info",
          title: `${implemented} Policies Implemented`,
          description: `${implemented} of ${policies.length} approved economic policies are currently implemented across ${new Set(policies.map((p) => p.category)).size} categories.`,
          metric: { value: implemented, change: 0, unit: "policies" },
          timestamp: now.toISOString(),
        });
      }

      // --- Security score finding ---
      const threats = await ctx.db.systemConfig.findMany({
        where: {
          key: { startsWith: `eci_security_threat_${input.countryId}_` },
        },
        select: { value: true },
      });

      const activeThreats = threats.filter((t) => {
        try {
          const data = JSON.parse(t.value);
          return data.status === "active";
        } catch {
          return false;
        }
      }).length;

      if (activeThreats > 0) {
        findings.push({
          id: "security-threats",
          category: "security",
          severity: activeThreats > 3 ? "critical" : activeThreats > 1 ? "warning" : "info",
          title: `${activeThreats} Active Security Threat${activeThreats > 1 ? "s" : ""}`,
          description: `${activeThreats} security threat${activeThreats > 1 ? "s" : ""} currently tracked. Review the Defense tab for mitigation strategies.`,
          metric: { value: activeThreats, change: 0, unit: "threats" },
          timestamp: now.toISOString(),
        });
      }

      // Sort: critical first, then warning, then info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return {
        findings,
        generatedAt: now.toISOString(),
      };
    }),
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

  const scenarios = (Array.isArray(input.scenarios) ? input.scenarios : []).map(
    (scenario: string) => {
      const multiplier = scenario === "optimistic" ? 1.5 : scenario === "pessimistic" ? 0.5 : 1.0;

      const projectedGdp =
        (country.currentTotalGdp as number) *
        Math.pow(1 + baseGrowthRate * multiplier, periods / 12);
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
    }
  );

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
