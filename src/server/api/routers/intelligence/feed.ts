import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { unifyIntelligenceItem } from "~/lib/intelligence";
import { notificationAPI } from "~/lib/notifications/api";

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const intelFeedRouter = createTRPCRouter({
  getFeed: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    return items.map(unifyIntelligenceItem);
  }),

  getLatestIntelligence: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: "desc" },
      take: 20,
    });
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

      try {
        const priorityMap: Record<string, "high" | "medium" | "low"> = {
          critical: "high",
          high: "high",
          medium: "medium",
          low: "low",
        };

        if (input.affectedCountries) {
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
      const messages = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `secure_message_${input.userId}` },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return messages.map((msg) => {
        const data = safeJsonParse<Record<string, any>>(msg.value, {});
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

  initializeSampleData: adminProcedure.mutation(async ({ ctx }) => {
    if (process.env.NODE_ENV !== "development") {
      return { message: "Sample data initialization only allowed in development", count: 0 };
    }

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
});
