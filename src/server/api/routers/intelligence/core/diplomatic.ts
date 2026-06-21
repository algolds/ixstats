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
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";
import { classificationSchema, diplomaticMessageSchema } from "../../../schemas/intelligence";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelCoreDiplomaticRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

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
            href: "/messages/diplomatic",
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
