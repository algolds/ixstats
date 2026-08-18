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

import { createTRPCRouter, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";
import { quickActionSchema } from "../../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelCoreActionsRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

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

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

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
