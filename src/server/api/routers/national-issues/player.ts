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
import type { ResponseOptionTemplate } from "~/lib/national-issues-engine";
import { NationalIssuesConsequences } from "~/lib/national-issues-consequences";
import { notificationAPI } from "~/lib/notification-api";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import { IxTime } from "~/lib/ixtime";
import { revealConsequences } from "~/lib/statecraft-recon";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/atomic-government-utils";
import { deriveBrokers } from "~/lib/statecraft-power-brokers";

const SPLASH_SHOWCASE_TAG = "Splash showcase seed";

// Statecraft recon (S1.D). Tunables — see plans/statecraft-stage1.md.
const RECON_CAPACITY_COST = 20; // Capacity reserved per in-progress recon Meeting
const RECON_DELAY_MS = 1.5 * 24 * 60 * 60 * 1000; // ~1.5 IxTime days; CONSTANT across gov quality (penalty = fog, not time)

/**
 * Recon context for a country: its atomic build (for the fog) + Capacity state.
 * `used` includes in-progress recon Meetings, so over-committing recon over-extends
 * the civil service and clouds results (the Capacity lever biting).
 */
async function loadReconContext(db: PrismaClient, countryId: string) {
  const now = IxTime.getCurrentIxTime();
  const [country, structure, components, pendingRecon, allocations] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, governmentalEfficiency: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        governmentEffectiveness: true,
        departments: { where: { isActive: true }, select: { category: true } },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true },
    }),
    db.nationalIssue.count({ where: { countryId, reconReadyIxTime: { gt: now } } }),
    db.budgetAllocation.findMany({
      where: {
        governmentStructure: { countryId },
        budgetYear: new Date().getFullYear(),
      },
      include: { department: { select: { category: true } } }
    })
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isTechnocratsSatisfied = activeBrokers.some((b) => b.id === "technocrats" && b.satisfied);

  const effectiveness = structure?.governmentEffectiveness ?? country?.governmentalEfficiency ?? 50;
  const capacity = calculateCivilServiceCapacity(country?.currentPopulation ?? 0, effectiveness);
  
  const govStaff = calculateTotalConsumedStaff(
    components.map((c) => c.componentType as any),
    [],
    []
  );
  
  // Apply 15% domestic policy upkeep Capacity relief if satisfied
  const effectiveGovStaff = isTechnocratsSatisfied ? Math.round(govStaff * 0.85) : govStaff;
  const used = effectiveGovStaff + pendingRecon * RECON_CAPACITY_COST;

  return {
    componentTypes: components.map((c) => String(c.componentType)),
    departmentCategories: (structure?.departments ?? []).map((d) => d.category),
    capacity,
    used,
    available: Math.max(0, capacity - used),
    overCapacity: used > capacity,
    lowEfficiency: effectiveness < 40,
  };
}

/** Ensures ~18 nations each have one force-generated showcase issue for the guest splash (idempotent per country). */
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
        const shouldEval = await NationalIssuesEngine.shouldEvaluate(
          input.countryId,
          ctx.db as any
        );
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
   * Statecraft SEE step: commission a cabinet research Meeting on an issue. Reserves
   * Capacity and sets a constant delay; findings land at reconReadyIxTime, revealing
   * the hard consequences with fog (getReconReveal). See plans/statecraft-stage1.md.
   */
  commissionRecon: protectedProcedure
    .input(z.object({ issueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!GAMEPLAY_FLAGS.statecraftSpine) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Statecraft recon is not enabled.",
        });
      }
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.issueId },
        select: { countryId: true, reconReadyIxTime: true },
      });
      if (!issue) throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      if (ctx.user?.countryId !== issue.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your country's issue." });
      }
      if (issue.reconReadyIxTime != null) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Research already commissioned for this issue.",
        });
      }
      const cx = await loadReconContext(ctx.db as PrismaClient, issue.countryId);
      if (cx.available < RECON_CAPACITY_COST) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Civil service is over capacity — free up administrative capacity before commissioning more research.",
        });
      }
      const readyIxTime = IxTime.getCurrentIxTime() + RECON_DELAY_MS;
      await ctx.db.nationalIssue.update({
        where: { id: input.issueId },
        data: { reconReadyIxTime: readyIxTime },
      });
      return { readyIxTime };
    }),

  /**
   * Read recon findings for an issue. Never fabricates: each option's consequences come
   * back revealed / greyed (no relevant component-dept) / questioned (over-capacity or
   * low efficiency). Returns a status the UI gates on.
   */
  getReconReveal: protectedProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!GAMEPLAY_FLAGS.statecraftSpine) return { status: "disabled" as const };
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.issueId },
        select: { countryId: true, reconReadyIxTime: true, responseOptions: true },
      });
      if (!issue) throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      if (ctx.user?.countryId !== issue.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your country's issue." });
      }
      const now = IxTime.getCurrentIxTime();
      if (issue.reconReadyIxTime == null) return { status: "none" as const };
      if (issue.reconReadyIxTime > now) {
        return { status: "pending" as const, readyIxTime: issue.reconReadyIxTime };
      }

      const cx = await loadReconContext(ctx.db as PrismaClient, issue.countryId);
      let options: ResponseOptionTemplate[] = [];
      try {
        options = JSON.parse(issue.responseOptions);
      } catch {}

      const reconInput = {
        componentTypes: cx.componentTypes,
        departmentCategories: cx.departmentCategories,
        overCapacity: cx.overCapacity,
        lowEfficiency: cx.lowEfficiency,
      };
      const optionsOut = options.map((o) => {
        const cons = o.consequences ?? [];
        const reveals = revealConsequences(
          cons.map((c) => ({ targetField: c.targetField })),
          reconInput
        ).map((r, idx) => ({
          ...r,
          // Never fabricate: greyed effects carry no value.
          value: r.state === "greyed" ? null : (cons[idx]?.value ?? null),
          operation: cons[idx]?.operation ?? null,
        }));
        return { optionId: o.id, label: o.label, reveals };
      });
      return { status: "ready" as const, readyIxTime: issue.reconReadyIxTime, options: optionsOut };
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
      const issue = await ctx.db.nationalIssue.findUnique({
        where: { id: input.issueId },
        select: { countryId: true, responseOptions: true },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      let options: any[] = [];
      try {
        options = JSON.parse(issue.responseOptions);
      } catch {}

      const option = options.find((o: any) => o.id === input.optionId);
      if (option && option.requiredPolicyKey) {
        const activePolicy = await ctx.db.policy.findFirst({
          where: {
            countryId: issue.countryId,
            status: "active",
            OR: [
              { calculatedEffects: { contains: option.requiredPolicyKey } },
              {
                name: { mode: "insensitive", equals: option.requiredPolicyKey.replace(/-/g, " ") },
              },
            ],
          },
        });

        if (!activePolicy) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `This choice requires the policy "${option.requiredPolicyKey}" to be active.`,
          });
        }
      }

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
