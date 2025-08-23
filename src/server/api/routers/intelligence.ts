import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { standardize } from "~/lib/interface-standardizer";
import { unifyIntelligenceItem } from "~/lib/transformers/interface-adapters";

export const intelligenceRouter = createTRPCRouter({
  getFeed: publicProcedure.query(async ({ ctx }) => {
    // Get real intelligence items from database
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Transform to unified intelligence format
    return items.map(unifyIntelligenceItem);
  }),

  getLatestIntelligence: publicProcedure.query(async ({ ctx }) => {
    // Get latest intelligence items with additional filtering
    const items = await ctx.db.intelligenceItem.findMany({
      where: { isActive: true },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    // Transform to unified intelligence format
    return items.map(unifyIntelligenceItem);
  }),

  createIntelligenceItem: publicProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1),
      category: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      source: z.string(),
      region: z.string().optional(),
      affectedCountries: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intelligenceItem.create({
        data: {
          title: input.title,
          content: input.content,
          category: input.category,
          priority: input.priority,
          source: input.source,
          region: input.region,
          affectedCountries: input.affectedCountries,
          timestamp: new Date(),
          isActive: true
        }
      });
    }),

  getSecureMessages: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get secure messages from SystemConfig table (using same pattern as ECI)
      const messages = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `secure_message_${input.userId}` }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      });

      return messages.map(msg => {
        const data = JSON.parse(msg.value);
        return {
          id: msg.id,
          from: data.from || "System",
          subject: data.subject || msg.description,
          timestamp: data.timestamp ? new Date(data.timestamp) : msg.createdAt,
          priority: data.priority || "Medium",
          classification: data.classification || "RESTRICTED",
          content: data.content
        };
      });
    }),

  sendSecureMessage: publicProcedure
    .input(z.object({
      recipientUserId: z.string(),
      subject: z.string().min(1).max(200),
      content: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      classification: z.enum(['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET']).default('RESTRICTED'),
      senderUserId: z.string()
    }))
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
            read: false
          }),
          description: `Secure message: ${input.subject}`
        }
      });
    }),

  // Initialize some sample intelligence data if database is empty
  initializeSampleData: publicProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.db.intelligenceItem.count();
    
    if (count === 0) {
      const sampleData = [
        {
          title: "Global Economic Indicators Show Stabilization",
          content: "Economic analysis indicates stabilizing trends across major markets following recent policy implementations.",
          category: "Economic",
          priority: "medium",
          source: "Economic Intelligence Division",
          region: "Global",
          timestamp: new Date(Date.now() - 1000 * 60 * 30)
        },
        {
          title: "Diplomatic Relations Update",
          content: "Recent diplomatic initiatives showing positive outcomes in inter-regional cooperation frameworks.",
          category: "Diplomatic",
          priority: "low",
          source: "Diplomatic Intelligence Service",
          region: "Multi-Regional",
          timestamp: new Date(Date.now() - 1000 * 60 * 120)
        },
        {
          title: "Crisis Response Coordination Success",
          content: "International crisis response mechanisms demonstrate improved coordination and effectiveness.",
          category: "Crisis",
          priority: "high",
          source: "Crisis Management Center",
          region: "International",
          timestamp: new Date(Date.now() - 1000 * 60 * 45)
        }
      ];

      await ctx.db.intelligenceItem.createMany({
        data: sampleData.map(item => ({
          ...item,
          isActive: true
        }))
      });

      return { message: "Sample intelligence data initialized", count: sampleData.length };
    }

    return { message: "Intelligence data already exists", count };
  })
});

// Only allow initializeSampleData in development
if (process.env.NODE_ENV === 'development') {
  intelligenceRouter.initializeSampleData = publicProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.db.intelligenceItem.count();
    
    if (count === 0) {
      const sampleData = [
        {
          title: "Global Economic Indicators Show Stabilization",
          content: "Economic analysis indicates stabilizing trends across major markets following recent policy implementations.",
          category: "Economic",
          priority: "medium",
          source: "Economic Intelligence Division",
          region: "Global",
          timestamp: new Date(Date.now() - 1000 * 60 * 30)
        },
        {
          title: "Diplomatic Relations Update",
          content: "Recent diplomatic initiatives showing positive outcomes in inter-regional cooperation frameworks.",
          category: "Diplomatic",
          priority: "low",
          source: "Diplomatic Intelligence Service",
          region: "Multi-Regional",
          timestamp: new Date(Date.now() - 1000 * 60 * 120)
        },
        {
          title: "Crisis Response Coordination Success",
          content: "International crisis response mechanisms demonstrate improved coordination and effectiveness.",
          category: "Crisis",
          priority: "high",
          source: "Crisis Management Center",
          region: "International",
          timestamp: new Date(Date.now() - 1000 * 60 * 45)
        }
      ];

      await ctx.db.intelligenceItem.createMany({
        data: sampleData.map(item => ({
          ...item,
          isActive: true
        }))
      });

      return { message: "Sample intelligence data initialized", count: sampleData.length };
    }

    return { message: "Intelligence data already exists", count };
  });
}