/**
 * National Issues API Router
 *
 * Manages the National Issues Engine - dynamic decision/event generation system.
 * Provides endpoints for:
 * - Player issue inbox, response, and history
 * - Admin template CRUD, preview, and diagnostics
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { NationalIssuesEngine } from "~/lib/national-issues-engine";
import { NationalIssuesConsequences } from "~/lib/national-issues-consequences";
import { notificationAPI } from "~/lib/notification-api";

// ==================== ZOD SCHEMAS ====================

const ConsequenceDefinitionSchema = z.object({
  targetModel: z.string(),
  targetField: z.string(),
  operation: z.enum(["add", "subtract", "multiply", "set"]),
  value: z.number(),
  effectType: z.enum(["immediate", "gradual"]).optional(),
  durationDays: z.number().optional(),
});

const ResponseOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  consequences: z.array(ConsequenceDefinitionSchema),
  previewEffects: z.object({
    publicApproval: z.number().optional(),
    economicImpact: z.string().optional(),
    stabilityImpact: z.string().optional(),
    diplomaticImpact: z.string().optional(),
  }),
  outcomeText: z.string(),
  isAutoResolveDefault: z.boolean().optional(),
  triggersFollowUp: z.array(z.string()).optional(),
});

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
    .enum([
      "economic",
      "diplomatic",
      "social",
      "governance",
      "security",
      "infrastructure",
    ])
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

export const nationalIssuesRouter = createTRPCRouter({
  // ==================== PLAYER ENDPOINTS ====================

  /**
   * Get issues for a country. Triggers lazy evaluation if stale.
   */
  getMyIssues: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        status: z
          .enum([
            "pending",
            "viewed",
            "responded",
            "auto_resolved",
            "expired",
            "dismissed",
            "active",
            "all",
          ])
          .default("active"),
        domain: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Trigger evaluation if stale
      const shouldEval = await NationalIssuesEngine.shouldEvaluate(
        input.countryId,
        ctx.db
      );
      if (shouldEval) {
        // Run evaluation in background - don't block the query
        NationalIssuesEngine.evaluateCountry(
          input.countryId,
          ctx.db,
          input.domain ? { forceDomain: input.domain } : undefined
        ).catch((err) => {
          console.error("[NationalIssues] Background evaluation failed:", err);
        });
      }

      // Build where clause
      const where: any = { countryId: input.countryId };

      if (input.status === "active") {
        where.status = { in: ["pending", "viewed"] };
      } else if (input.status !== "all") {
        where.status = input.status;
      }

      if (input.domain) {
        where.domain = input.domain;
      }

      if (input.cursor) {
        where.id = { lt: input.cursor };
      }

      const issues = await ctx.db.nationalIssue.findMany({
        where,
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        take: input.limit + 1,
        include: {
          template: {
            select: { slug: true, tags: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (issues.length > input.limit) {
        const nextItem = issues.pop();
        nextCursor = nextItem?.id;
      }

      return {
        issues,
        nextCursor,
      };
    }),

  /**
   * Get a single issue with full detail.
   */
  getIssue: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.id },
        include: {
          template: {
            select: { slug: true, tags: true, domain: true },
          },
          consequences: {
            orderBy: { appliedAt: "asc" },
          },
        },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      return issue;
    }),

  /**
   * Mark an issue as viewed.
   */
  markViewed: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.id },
        select: { status: true },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      if (issue.status === "pending") {
        await ctx.db.nationalIssue.update({
          where: { id: input.id },
          data: { status: "viewed" },
        });
      }

      return { success: true };
    }),

  /**
   * Respond to an issue - the core player action.
   */
  respond: protectedProcedure
    .input(
      z.object({
        issueId: z.string(),
        optionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await NationalIssuesConsequences.resolveIssue(
        input.issueId,
        input.optionId,
        ctx.db
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to resolve issue",
        });
      }

      // Notify: national issue decision made
      try {
        const issue = await ctx.db.nationalIssue.findUnique({
          where: { id: input.issueId },
          select: { title: true, countryId: true, domain: true },
        });
        if (issue) {
          await notificationAPI.create({
            title: "National Issue Resolved",
            message: `Decision made on "${issue.title}"`,
            countryId: issue.countryId,
            category: "governance",
            priority: "high",
            type: "success",
            source: "national-issues",
            href: "/mycountry/executive",
            metadata: { issueId: input.issueId, domain: issue.domain },
          });
        }
      } catch (e) { console.warn("[Notifications] nationalIssues.respond:", e); }

      return result;
    }),

  /**
   * Dismiss a non-urgent issue (only issues without deadlines).
   */
  dismiss: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.id },
        select: { status: true, deadlineIxTime: true },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      if (issue.deadlineIxTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot dismiss issues with deadlines",
        });
      }

      if (issue.status !== "pending" && issue.status !== "viewed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Issue is not active",
        });
      }

      await ctx.db.nationalIssue.update({
        where: { id: input.id },
        data: { status: "dismissed" },
      });

      return { success: true };
    }),

  /**
   * Get pending issue count for badge display.
   */
  getPendingCount: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.nationalIssue.count({
        where: {
          countryId: input.countryId,
          status: { in: ["pending", "viewed"] },
        },
      });

      // Count urgent issues separately for badge styling
      const urgentCount = await ctx.db.nationalIssue.count({
        where: {
          countryId: input.countryId,
          status: { in: ["pending", "viewed"] },
          deadlineIxTime: { not: null },
        },
      });

      return { total: count, urgent: urgentCount };
    }),

  /**
   * Get issue history with consequences.
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        countryId: input.countryId,
        status: {
          in: ["responded", "auto_resolved", "expired", "dismissed"],
        },
      };

      if (input.cursor) {
        where.id = { lt: input.cursor };
      }

      const issues = await ctx.db.nationalIssue.findMany({
        where,
        orderBy: { respondedAt: "desc" },
        take: input.limit + 1,
        include: {
          consequences: true,
        },
      });

      let nextCursor: string | undefined;
      if (issues.length > input.limit) {
        const nextItem = issues.pop();
        nextCursor = nextItem?.id;
      }

      return { issues, nextCursor };
    }),

  /**
   * Get consequences for a specific issue.
   */
  getConsequences: protectedProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.nationalIssueConsequence.findMany({
        where: { issueId: input.issueId },
        orderBy: { appliedAt: "asc" },
      });
    }),

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
  getTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
  createTemplate: adminProcedure
    .input(TemplateCreateSchema)
    .mutation(async ({ ctx, input }) => {
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
          authorId: ctx.userId,
        },
      });
    }),

  /**
   * Update a template.
   */
  updateTemplate: adminProcedure
    .input(TemplateUpdateSchema)
    .mutation(async ({ ctx, input }) => {
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

  /**
   * Preview a template against a country without creating an issue.
   */
  previewTemplate: adminProcedure
    .input(
      z.object({
        templateId: z.string(),
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.nationalIssueTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const snapshot = await NationalIssuesEngine.buildCountrySnapshot(
        input.countryId,
        ctx.db
      );
      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Country not found",
        });
      }

      // Evaluate triggers
      let triggersPassed = false;
      try {
        const conditions = JSON.parse(template.triggerConditions);
        triggersPassed = NationalIssuesEngine.evaluateCondition(
          conditions,
          snapshot
        );
      } catch {
        triggersPassed = false;
      }

      // Render with substitution
      const renderedTitle = NationalIssuesEngine.substituteVariables(
        template.title,
        snapshot
      );
      const renderedDescription = NationalIssuesEngine.substituteVariables(
        template.description,
        snapshot
      );
      const renderedLongDescription = template.longDescription
        ? NationalIssuesEngine.substituteVariables(
            template.longDescription,
            snapshot
          )
        : null;

      let renderedOptions: any[] = [];
      try {
        const options = JSON.parse(template.responseOptions);
        renderedOptions = options.map((opt: any) => ({
          ...opt,
          label: NationalIssuesEngine.substituteVariables(opt.label, snapshot),
          description: NationalIssuesEngine.substituteVariables(
            opt.description,
            snapshot
          ),
          outcomeText: NationalIssuesEngine.substituteVariables(
            opt.outcomeText,
            snapshot
          ),
        }));
      } catch {
        // Skip rendering on parse error
      }

      return {
        triggersPassed,
        snapshot: {
          name: snapshot.name,
          gdp: snapshot.currentTotalGdp,
          population: snapshot.currentPopulation,
          unemployment: snapshot.unemploymentRate,
          inflation: snapshot.inflationRate,
          approval: snapshot.publicApproval,
          stability: snapshot.stabilityScore,
        },
        rendered: {
          title: renderedTitle,
          description: renderedDescription,
          longDescription: renderedLongDescription,
          responseOptions: renderedOptions,
        },
      };
    }),

  /**
   * Force generate an issue from a template for testing.
   */
  forceGenerate: adminProcedure
    .input(
      z.object({
        templateId: z.string(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const issueId = await NationalIssuesEngine.forceGenerate(
        input.templateId,
        input.countryId,
        ctx.db
      );

      if (!issueId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate issue",
        });
      }

      return { issueId };
    }),

  /**
   * Batch create templates (for seeding).
   */
  batchCreateTemplates: adminProcedure
    .input(z.object({ templates: z.array(TemplateCreateSchema) }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const template of input.templates) {
        // Validate JSON fields
        try {
          JSON.parse(template.triggerConditions);
          JSON.parse(template.responseOptions);
        } catch {
          results.push({ slug: template.slug, error: "Invalid JSON" });
          continue;
        }

        try {
          const created = await ctx.db.nationalIssueTemplate.upsert({
            where: { slug: template.slug },
            create: { ...template, authorId: ctx.userId },
            update: { ...template, version: { increment: 1 } },
          });
          results.push({ slug: created.slug, id: created.id });
        } catch (err) {
          results.push({
            slug: template.slug,
            error: (err as Error).message,
          });
        }
      }
      return { results, total: results.length };
    }),

  /**
   * Get generation statistics.
   */
  getGenerationStats: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(7) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const logs = await ctx.db.issueGenerationLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const totalIssuesGenerated = logs.reduce(
        (sum, l) => sum + l.issuesGenerated,
        0
      );
      const totalEvaluations = logs.length;
      const avgExecutionTime =
        logs.length > 0
          ? Math.round(
              logs.reduce((sum, l) => sum + l.executionTimeMs, 0) / logs.length
            )
          : 0;

      // Template usage stats
      const templateStats = await ctx.db.nationalIssue.groupBy({
        by: ["templateId"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { id: "desc" } },
        take: 20,
      });

      // Domain distribution
      const domainStats = await ctx.db.nationalIssue.groupBy({
        by: ["domain"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      });

      // Status distribution
      const statusStats = await ctx.db.nationalIssue.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      });

      return {
        period: `${input.days} days`,
        totalEvaluations,
        totalIssuesGenerated,
        avgExecutionTime,
        templateStats,
        domainStats,
        statusStats,
        recentLogs: logs.slice(0, 20),
      };
    }),

  /**
   * Manually trigger evaluation for a country.
   */
  triggerEvaluation: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        maxIssues: z.number().int().min(1).max(10).optional(),
        domain: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return NationalIssuesEngine.evaluateCountry(input.countryId, ctx.db, {
        maxIssues: input.maxIssues,
        forceDomain: input.domain,
      });
    }),
});
