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
import { NationalIssuesEngine } from "~/lib/national-issues";
import type { ResponseOptionTemplate } from "~/lib/national-issues";
import { NationalIssuesConsequences } from "~/lib/national-issues";
import { notificationAPI } from "~/lib/notifications/api";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { GAMEPLAY_FLAGS } from "~/lib/gameplay-flags";
import { IxTime } from "~/lib/ixtime";
import { revealConsequences } from "~/lib/statecraft/recon";
import { isAppliedIssueConsequence } from "~/lib/national-issues/projection-effects";
import { loadCivCapState, RECON_CAPACITY_COST } from "~/lib/government/civcap";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

// Statecraft recon (S1.D). Tunables — see plans/statecraft-stage1.md.
const RECON_DELAY_MS = 1.5 * 24 * 60 * 60 * 1000; // ~1.5 IxTime days; CONSTANT across gov quality (penalty = fog, not time)

/**
 * Recon context for a country: its atomic build (for the fog) + Capacity state.
 * `used` includes in-progress recon Meetings, so over-committing recon over-extends
 * the civil service and clouds results (the Capacity lever biting). The CivCap sum
 * itself lives in lib/government/civcap.ts (shared with policies and the MyCountry band).
 */
async function loadReconContext(db: PrismaClient, countryId: string) {
  const civCap = await loadCivCapState(db, countryId);
  return {
    componentTypes: civCap.componentTypes,
    departmentCategories: civCap.departmentCategories,
    capacity: civCap.capacity,
    used: civCap.used,
    available: civCap.available,
    overCapacity: civCap.overCapacity,
    lowEfficiency: civCap.effectiveness < 40,
  };
}

// ==================== ZOD SCHEMAS ====================

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
      } catch (err) {
        console.warn("[NationalIssues] Malformed responseOptions on issue", input.issueId, err);
      }

      const reconInput = {
        componentTypes: cx.componentTypes,
        departmentCategories: cx.departmentCategories,
        overCapacity: cx.overCapacity,
        lowEfficiency: cx.lowEfficiency,
      };
      const optionsOut = options.map((o) => {
        // Only what resolving would actually apply (unmappable projection effects are dropped).
        const cons = (o.consequences ?? []).filter(isAppliedIssueConsequence);
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
      } catch (err) {
        console.warn("[NationalIssues] Malformed responseOptions on issue", input.issueId, err);
      }

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
      queueAchievementCheck(ctx.user?.id);

      // Notify: national issue decision made
      try {
        // oxlint-disable-next-line eslint/no-shadow -- shadowed 'issue' is intentional in this scope
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
        select: {
          status: true,
          deadlineIxTime: true,
          severity: true,
          urgency: true,
          countryId: true,
          intentId: true,
        },
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

      if (
        issue.severity === "critical" ||
        issue.severity === "CRITICAL" ||
        issue.severity === "high" ||
        issue.severity === "HIGH" ||
        issue.urgency > 70
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delegate urgent crises or high-priority issues",
        });
      }

      if (issue.status !== "pending" && issue.status !== "viewed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Issue is not active",
        });
      }

      const cx = await loadReconContext(ctx.db as PrismaClient, issue.countryId);
      if (cx.available < 15) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Insufficient Civil Capacity to delegate this issue. You need at least 15 available CivCap.",
        });
      }

      const currentIxTime = IxTime.getCurrentIxTime();

      await ctx.db.nationalIssue.update({
        where: { id: input.id },
        data: {
          status: "dismissed",
          respondedAt: new Date(),
          respondedIxTime: currentIxTime,
        },
      });

      if (issue.intentId) {
        try {
          await NationalIssuesConsequences.recomputeIntentProgress(issue.intentId, ctx.db as any);
        } catch (e) {
          console.warn(`[NationalIssues] failed to recompute intent progress on dismiss:`, e);
        }
      }

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
   * Get issue history with consequences — the owner's (or a privileged role's) full record,
   * expired and dismissed issues and applied consequences included. FORBIDDEN for anyone else:
   * visitors read resolved outcomes through `countries.getPublicRecord`.
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
      await assertCountryWriteAccess(ctx, input.countryId);

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
});
