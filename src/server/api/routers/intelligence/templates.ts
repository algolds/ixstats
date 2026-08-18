import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";

export const intelTemplatesRouter = createTRPCRouter({
  getAllTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.intelligenceTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ reportType: "asc" }, { minimumLevel: "asc" }],
    });
  }),

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

  createTemplate: adminProcedure
    .input(
      z.object({
        reportType: z.enum(["economic", "political", "security"]),
        classification: z.enum(["PUBLIC", "RESTRICTED"]),
        summaryTemplate: z.string().min(1),
        findingsTemplate: z.string(),
        minimumLevel: z.number().min(1).max(5),
        confidenceBase: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const findings = JSON.parse(input.findingsTemplate);
        if (!Array.isArray(findings)) {
          throw new Error("Findings template must be a JSON array");
        }
      } catch {
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

      if (updateData.findingsTemplate) {
        try {
          const findings = JSON.parse(updateData.findingsTemplate);
          if (!Array.isArray(findings)) {
            throw new Error("Findings template must be a JSON array");
          }
        } catch {
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

  deleteTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.intelligenceTemplate.update({
        where: { id: input.id },
        data: { isActive: false },
      });

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
