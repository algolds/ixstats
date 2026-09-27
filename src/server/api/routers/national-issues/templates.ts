/**
 * National Issues API Router
 *
 * Manages the National Issues Engine - dynamic decision/event generation system.
 * Provides endpoints for:
 * - Player issue inbox, response, and history
 * - Admin template CRUD, preview, and diagnostics
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// ==================== ZOD SCHEMAS ====================

const TemplateCreateSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(2000),
  longDescription: z.string().max(5000).optional(),
  domain: z.enum([
    "economic",
    "political",
    "social",
    "military",
    "diplomatic",
    "infrastructure",
    "environmental",
  ]),
  category: z
    .enum(["economic", "diplomatic", "social", "governance", "security", "infrastructure"])
    .default("governance"),
  tags: z.string().optional(),
  baseSeverity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  baseUrgency: z.number().int().min(0).max(100).default(50),
  deadlineDaysBase: z.number().int().min(1).nullable().optional(),
  triggerConditions: z.string(), // JSON expression tree
  cooldownDays: z.number().int().min(1).default(30),
  maxActivePerCountry: z.number().int().min(1).default(1),
  responseOptions: z.string(), // JSON array of ResponseOptionTemplate
  followUpTemplateIds: z.string().optional(),
  followUpConditions: z.string().optional(),
  variableDefinitions: z.string().optional(),
  personalityModifiers: z.string().optional(),
  isActive: z.boolean().default(true),
  isGlobal: z.boolean().default(false),
});

const TemplateUpdateSchema = TemplateCreateSchema.partial().extend({
  id: z.string(),
});

export const nationalIssuesTemplatesRouter = createTRPCRouter({
  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all templates with filtering.
   */
  getTemplates: adminProcedure
    .input(
      z.object({
        domain: z.string().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input.domain) where.domain = input.domain;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.cursor) where.id = { lt: input.cursor };

      const templates = await ctx.db.nationalIssueTemplate.findMany({
        where,
        orderBy: [{ domain: "asc" }, { slug: "asc" }],
        take: input.limit + 1,
        include: {
          _count: { select: { instances: true } },
        },
      });

      let nextCursor: string | undefined;
      if (templates.length > input.limit) {
        const nextItem = templates.pop();
        nextCursor = nextItem?.id;
      }

      return { templates, nextCursor };
    }),

  /**
   * Get a single template.
   */
  getTemplate: adminProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const template = await ctx.db.nationalIssueTemplate.findUnique({
      where: { id: input.id },
      include: {
        _count: { select: { instances: true } },
      },
    });

    if (!template) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Template not found",
      });
    }

    return template;
  }),

  /**
   * Create a new template.
   */
  createTemplate: adminProcedure.input(TemplateCreateSchema).mutation(async ({ ctx, input }) => {
    // Validate JSON fields
    try {
      JSON.parse(input.triggerConditions);
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid triggerConditions JSON",
      });
    }
    try {
      JSON.parse(input.responseOptions);
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid responseOptions JSON",
      });
    }

    return ctx.db.nationalIssueTemplate.create({
      data: {
        ...input,
        authorId: ctx.auth!.userId,
      },
    });
  }),

  /**
   * Update a template.
   */
  updateTemplate: adminProcedure.input(TemplateUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;

    // Validate JSON fields if provided
    if (data.triggerConditions) {
      try {
        JSON.parse(data.triggerConditions);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid triggerConditions JSON",
        });
      }
    }
    if (data.responseOptions) {
      try {
        JSON.parse(data.responseOptions);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid responseOptions JSON",
        });
      }
    }

    return ctx.db.nationalIssueTemplate.update({
      where: { id },
      data,
    });
  }),

  /**
   * Delete a template.
   */
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.nationalIssueTemplate.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Toggle template active state.
   */
  toggleTemplateActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.nationalIssueTemplate.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),
});
