/**
 * National Issues API Router
 *
 * Manages the National Issues Engine - dynamic decision/event generation system.
 * Provides endpoints for:
 * - Player issue inbox, response, and history
 * - Admin template CRUD, preview, and diagnostics
 */

import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { NationalIssuesEngine } from "~/lib/national-issues-engine";
import { NationalIssuesConsequences } from "~/lib/national-issues-consequences";
import { notificationAPI } from "~/lib/notification-api";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";

const SPLASH_SHOWCASE_TAG = "Splash showcase seed";

/** Ensures ~18 nations each have one force-generated showcase issue for the guest splash (idempotent per country). */
// eslint-disable-next-line unused-imports/no-unused-vars
async function seedSplashShowcaseIssues(db: PrismaClient): Promise<void> {
  try {
    const seededCountries = await db.nationalIssue.groupBy({
      by: ["countryId"],
      where: { triggerReason: { contains: SPLASH_SHOWCASE_TAG } },
    });

    if (seededCountries.length >= 18) return;

    const templates = await db.nationalIssueTemplate.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (templates.length === 0) return;

    const seededIds = new Set(seededCountries.map((g) => g.countryId));
    const allCountries = await db.country.findMany({ select: { id: true } });
    const candidates = allCountries.map((c) => c.id).filter((id) => !seededIds.has(id));

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }

    const need = Math.min(18 - seededCountries.length, candidates.length);

    for (let i = 0; i < need; i++) {
      const countryId = candidates[i]!;
      const template = templates[Math.floor(Math.random() * templates.length)]!;
      const issueId = await NationalIssuesEngine.forceGenerate(template.id, countryId, db);
      if (issueId) {
        await db.nationalIssue.update({
          where: { id: issueId },
          data: { triggerReason: SPLASH_SHOWCASE_TAG },
        });
      }
    }
  } catch (err) {
    console.error("[Splash showcase seed]", err);
  }
}

// ==================== ZOD SCHEMAS ====================

const ConsequenceDefinitionSchema = z.object({
  targetModel: z.string(),
  targetField: z.string(),
  operation: z.enum(["add", "subtract", "multiply", "set"]),
  value: z.number(),
  effectType: z.enum(["immediate", "gradual"]).optional(),
  durationDays: z.number().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
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

// eslint-disable-next-line unused-imports/no-unused-vars
const TemplateUpdateSchema = TemplateCreateSchema.partial().extend({
  id: z.string(),
});

export const nationalIssuesPlayerRouter = createTRPCRouter({
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
      // Auto-generation is opt-in (narrative mode is the default). When off, issues
      // only appear via DM injection (plan 034) or prior generation.
      if (GAMEPLAY_FLAGS.issuesAutoGenerate) {
        const shouldEval = await NationalIssuesEngine.shouldEvaluate(input.countryId, ctx.db as any);
        if (shouldEval) {
          // Run evaluation in background - don't block the query
          NationalIssuesEngine.evaluateCountry(
            input.countryId,
            ctx.db as any,
            input.domain ? { forceDomain: input.domain } : undefined
          ).catch((err) => {
            console.error("[NationalIssues] Background evaluation failed:", err);
          });
        }
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
  getIssue: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
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
        ctx.db as any
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
      } catch (e) {
        console.warn("[Notifications] nationalIssues.respond:", e);
      }

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

      if (GAMEPLAY_FLAGS.issuesEnforceDeadlines && issue.deadlineIxTime) {
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
});
