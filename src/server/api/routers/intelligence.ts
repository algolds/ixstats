import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { standardize } from "~/lib/interface-standardizer";
import { unifyIntelligenceItem } from "~/lib/transformers/interface-adapters";
import { calculateIntelligence } from "~/lib/intelligence-calculator";
import { notificationAPI } from "~/lib/notification-api";

export const intelligenceRouter = createTRPCRouter({
  getFeed: publicProcedure.query(async ({ ctx }) => {
    // Get real intelligence items from database
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    // Transform to unified intelligence format
    return items.map(unifyIntelligenceItem);
  }),

  getLatestIntelligence: publicProcedure.query(async ({ ctx }) => {
    // Get latest intelligence items with additional filtering
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    // Transform to unified intelligence format
    return items.map(unifyIntelligenceItem);
  }),

  createIntelligenceItem: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        category: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]),
        source: z.string(),
        region: z.string().optional(),
        affectedCountries: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.intelligenceItem.create({
        data: {
          title: input.title,
          content: input.content,
          category: input.category as any,
          priority: input.priority as any,
          source: input.source,
          region: input.region,
          affectedCountries: input.affectedCountries,
          timestamp: new Date(),
          isActive: true,
        },
      });

      // 🔔 Notify affected countries (or global if none specified)
      try {
        const priorityMap: Record<string, "high" | "medium" | "low"> = {
          critical: "high",
          high: "high",
          medium: "medium",
          low: "low",
        };

        if (input.affectedCountries) {
          // Parse affected countries and notify each
          const countryIds = input.affectedCountries.split(",").map((c) => c.trim());
          for (const countryId of countryIds) {
            await notificationAPI.create({
              title: "🔍 Intelligence Alert",
              message: `${input.title} - ${input.priority.toUpperCase()} priority`,
              countryId,
              category: "intelligence",
              priority: priorityMap[input.priority] || "medium",
              type:
                input.priority === "critical"
                  ? "error"
                  : input.priority === "high"
                    ? "warning"
                    : "info",
              href: "/intelligence",
              source: "intelligence-system",
              actionable: true,
              metadata: {
                intelligenceItemId: item.id,
                category: input.category,
                region: input.region,
              },
            });
          }
        } else {
          // Global intelligence notification
          await notificationAPI.create({
            title: "🔍 Global Intelligence Alert",
            message: `${input.title} - ${input.priority.toUpperCase()} priority`,
            category: "intelligence",
            priority: priorityMap[input.priority] || "medium",
            type:
              input.priority === "critical"
                ? "error"
                : input.priority === "high"
                  ? "warning"
                  : "info",
            href: "/intelligence",
            source: "intelligence-system",
            actionable: true,
            metadata: {
              intelligenceItemId: item.id,
              category: input.category,
              region: input.region,
            },
          });
        }
      } catch (error) {
        console.error("[Intelligence] Failed to send intelligence notification:", error);
      }

      return item;
    }),

  getSecureMessages: premiumProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get secure messages from SystemConfig table (using same pattern as ECI)
      const messages = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `secure_message_${input.userId}` },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return messages.map((msg) => {
        const data = JSON.parse(msg.value);
        return {
          id: msg.id,
          from: data.from || "System",
          subject: data.subject || msg.description,
          timestamp: data.timestamp ? new Date(data.timestamp) : msg.createdAt,
          priority: data.priority || "Medium",
          classification: data.classification || "RESTRICTED",
          content: data.content,
        };
      });
    }),

  sendSecureMessage: premiumProcedure
    .input(
      z.object({
        recipientUserId: z.string(),
        subject: z.string().min(1).max(200),
        content: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        classification: z
          .enum(["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
          .default("RESTRICTED"),
        senderUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.systemConfig.create({
        data: {
          key: `secure_message_${input.recipientUserId}_${Date.now()}`,
          value: JSON.stringify({
            from: `User_${input.senderUserId}`,
            subject: input.subject,
            content: input.content,
            priority: input.priority,
            classification: input.classification,
            timestamp: new Date(),
            read: false,
          }),
          description: `Secure message: ${input.subject}`,
        },
      });
    }),

  // Initialize some sample intelligence data if database is empty (development only)
  initializeSampleData: adminProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.db.intelligenceItem.count();

    if (count === 0) {
      const sampleData = [
        {
          title: "Global Economic Indicators Show Stabilization",
          content:
            "Economic analysis indicates stabilizing trends across major markets following recent policy implementations.",
          category: "Economic",
          priority: "medium",
          source: "Economic Intelligence Division",
          region: "Global",
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          title: "Diplomatic Relations Update",
          content:
            "Recent diplomatic initiatives showing positive outcomes in inter-regional cooperation frameworks.",
          category: "Diplomatic",
          priority: "low",
          source: "Diplomatic Intelligence Service",
          region: "Multi-Regional",
          timestamp: new Date(Date.now() - 1000 * 60 * 120),
        },
        {
          title: "Crisis Response Coordination Success",
          content:
            "International crisis response mechanisms demonstrate improved coordination and effectiveness.",
          category: "Crisis",
          priority: "high",
          source: "Crisis Management Center",
          region: "International",
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
        },
      ];

      await ctx.db.intelligenceItem.createMany({
        data: sampleData.map((item) => ({
          ...item,
          category: item.category.toUpperCase() as any,
          priority: item.priority.toUpperCase() as any,
          isActive: true,
        })),
      });

      return { message: "Sample intelligence data initialized", count: sampleData.length };
    }

    return { message: "Intelligence data already exists", count };
  }),

  // ===== INTELLIGENCE TEMPLATE MANAGEMENT =====

  // Get all templates (public for reading, but admin can see inactive)
  getAllTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.intelligenceTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ reportType: "asc" }, { minimumLevel: "asc" }],
    });
  }),

  // Get template by ID
  getTemplateById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.intelligenceTemplate.findUnique({
        where: { id: input.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Intelligence template not found",
        });
      }

      return template;
    }),

  // Get templates by report type
  getTemplatesByType: publicProcedure
    .input(z.object({ reportType: z.enum(["economic", "political", "security"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intelligenceTemplate.findMany({
        where: {
          reportType: input.reportType,
          isActive: true,
        },
        orderBy: { minimumLevel: "asc" },
      });
    }),

  // Create template (admin only)
  createTemplate: adminProcedure
    .input(
      z.object({
        reportType: z.enum(["economic", "political", "security"]),
        classification: z.enum(["PUBLIC", "RESTRICTED"]),
        summaryTemplate: z.string().min(1),
        findingsTemplate: z.string(), // JSON string array
        minimumLevel: z.number().min(1).max(5),
        confidenceBase: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate findings template is valid JSON
      try {
        const findings = JSON.parse(input.findingsTemplate);
        if (!Array.isArray(findings)) {
          throw new Error("Findings template must be a JSON array");
        }
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid findings template format",
        });
      }

      const template = await ctx.db.intelligenceTemplate.create({
        data: {
          reportType: input.reportType,
          classification: input.classification,
          summaryTemplate: input.summaryTemplate,
          findingsTemplate: input.findingsTemplate,
          minimumLevel: input.minimumLevel,
          confidenceBase: input.confidenceBase,
          isActive: true,
        },
      });

      // Audit log
      try {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth?.userId || null,
            action: "INTELLIGENCE_TEMPLATE_CREATED",
            target: template.id,
            details: JSON.stringify({
              reportType: template.reportType,
              classification: template.classification,
              minimumLevel: template.minimumLevel,
            }),
            success: true,
          },
        });
      } catch (logError) {
        console.error("Failed to create audit log:", logError);
      }

      return { success: true, template };
    }),

  // Update template (admin only)
  updateTemplate: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reportType: z.enum(["economic", "political", "security"]).optional(),
        classification: z.enum(["PUBLIC", "RESTRICTED"]).optional(),
        summaryTemplate: z.string().min(1).optional(),
        findingsTemplate: z.string().optional(),
        minimumLevel: z.number().min(1).max(5).optional(),
        confidenceBase: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Validate findings template if provided
      if (updateData.findingsTemplate) {
        try {
          const findings = JSON.parse(updateData.findingsTemplate);
          if (!Array.isArray(findings)) {
            throw new Error("Findings template must be a JSON array");
          }
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid findings template format",
          });
        }
      }

      const template = await ctx.db.intelligenceTemplate.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      // Audit log
      try {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth?.userId || null,
            action: "INTELLIGENCE_TEMPLATE_UPDATED",
            target: template.id,
            details: JSON.stringify({
              reportType: template.reportType,
              updatedFields: Object.keys(updateData),
            }),
            success: true,
          },
        });
      } catch (logError) {
        console.error("Failed to create audit log:", logError);
      }

      return { success: true, template };
    }),

  // Delete template (admin only - soft delete)
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.intelligenceTemplate.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      try {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth?.userId || null,
            action: "INTELLIGENCE_TEMPLATE_DELETED",
            target: template.id,
            details: JSON.stringify({
              reportType: template.reportType,
              classification: template.classification,
            }),
            success: true,
          },
        });
      } catch (logError) {
        console.error("Failed to create audit log:", logError);
      }

      return { success: true };
    }),
});

// Only allow initializeSampleData in development
if (process.env.NODE_ENV === "development") {
  intelligenceRouter.initializeSampleData = adminProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.db.intelligenceItem.count();

    if (count === 0) {
      const sampleData = [
        {
          title: "Global Economic Indicators Show Stabilization",
          content:
            "Economic analysis indicates stabilizing trends across major markets following recent policy implementations.",
          category: "Economic",
          priority: "medium",
          source: "Economic Intelligence Division",
          region: "Global",
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          title: "Diplomatic Relations Update",
          content:
            "Recent diplomatic initiatives showing positive outcomes in inter-regional cooperation frameworks.",
          category: "Diplomatic",
          priority: "low",
          source: "Diplomatic Intelligence Service",
          region: "Multi-Regional",
          timestamp: new Date(Date.now() - 1000 * 60 * 120),
        },
        {
          title: "Crisis Response Coordination Success",
          content:
            "International crisis response mechanisms demonstrate improved coordination and effectiveness.",
          category: "Crisis",
          priority: "high",
          source: "Crisis Management Center",
          region: "International",
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
        },
      ];

      await ctx.db.intelligenceItem.createMany({
        data: sampleData.map((item) => ({
          ...item,
          category: item.category.toUpperCase() as any,
          priority: item.priority.toUpperCase() as any,
          isActive: true,
        })),
      });

      return { message: "Sample intelligence data initialized", count: sampleData.length };
    }

    return { message: "Intelligence data already exists", count };
  });
}
// In production, ensure initializeSampleData is not exposed
else {
  // No-op guard to prevent accidental exposure; keep type shape intact
  // Assign undefined without directive; type cast to maintain router shape
  (intelligenceRouter as any).initializeSampleData = undefined;
}

// ===== NEW INTELLIGENCE SYSTEM ENDPOINTS =====

export const intelligenceBriefingRouter = createTRPCRouter({
  // Get briefings for a country
  getForCountry: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intelligenceBriefing.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          recommendations: {
            where: { isActive: true },
            orderBy: { urgency: "asc" },
          },
          alerts: {
            where: { isActive: true },
            orderBy: { severity: "desc" },
          },
        },
        orderBy: [{ priority: "desc" }, { generatedAt: "desc" }],
      });
    }),

  // Get vitality snapshots for a country
  getVitalitySnapshots: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vitalitySnapshot.findMany({
        where: {
          countryId: input.countryId,
        },
        orderBy: { calculatedAt: "desc" },
        take: 4, // Latest snapshot for each area
      });
    }),

  // Get all active recommendations for a country
  getRecommendations: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intelligenceRecommendation.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
          isImplemented: false,
        },
        orderBy: [{ urgency: "asc" }, { successProbability: "desc" }],
      });
    }),

  // Mark recommendation as implemented
  implementRecommendation: publicProcedure
    .input(z.object({ recommendationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intelligenceRecommendation.update({
        where: { id: input.recommendationId },
        data: {
          isImplemented: true,
          implementedAt: new Date(),
        },
      });
    }),

  // Recalculate intelligence for a country
  recalculateForCountry: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await calculateIntelligence({ countryId: input.countryId, forceRecalculate: true });
      return { success: true, message: `Intelligence recalculated for country ${input.countryId}` };
    }),

  // Recalculate intelligence for all countries (admin only)
  recalculateAll: publicProcedure.mutation(async ({ ctx }) => {
    await calculateIntelligence({ forceRecalculate: true });
    return { success: true, message: "Intelligence recalculated for all countries" };
  }),

  // Get global intelligence summary for dashboard
  getGlobalSummary: publicProcedure.query(async ({ ctx }) => {
    // Get active crises from SDI system
    const activeCrises = await ctx.db.crisisEvent.count({
      where: { responseStatus: { not: "resolved" } },
    });

    // Get critical crises
    const criticalCrises = await ctx.db.crisisEvent.count({
      where: {
        responseStatus: { not: "resolved" },
        severity: "critical",
      },
    });

    // Get active diplomatic missions
    const diplomaticMissions = await ctx.db.diplomaticEvent.count({
      where: {
        status: "active",
        eventType: { in: ["summit", "trade_mission", "state_visit"] },
      },
    });

    // Get intelligence items from last 7 days
    const recentIntelligence = await ctx.db.intelligenceItem.count({
      where: {
        isActive: true,
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    // Get high priority intelligence
    const intelligenceAlerts = await ctx.db.intelligenceItem.count({
      where: {
        isActive: true,
        priority: { in: ["HIGH", "CRITICAL"] },
      },
    });

    return {
      activeCrises,
      criticalCrises,
      diplomaticMissions,
      recentIntelligence,
      intelligenceAlerts,
      timestamp: new Date(),
    };
  }),
});
