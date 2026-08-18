/**
 * Intent router (design-bible v2, migration plan §1).
 *
 * The player-initiated twin of National Issues: state a goal → the government
 * proposes Measured/Moderate/Extreme packages → commit one → applied through the
 * CountryEventSpine (bounded stat change + ledger + news). Packages are assembled
 * server-side and can never touch core stats (Editor-only). Weekly cooldown + cap.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { CountryEventSpine } from "~/lib/country-event-spine";
import {
  assemblePackages,
  weightAcceptance,
  CATEGORY_TO_BROKER,
  TIER_RISK,
  type Tier,
  type Category,
} from "~/lib/intent/assemble";
import { spawnIntentResistance } from "~/lib/intent/resistance";
import { deriveBrokers, type ActiveBroker } from "~/lib/statecraft/power-brokers";
import { assertCountryAccess } from "~/server/api/routers/economics/_ownership";
import { generateIntentSummationDraft } from "~/lib/intent/intent-summation";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const COOLDOWN_MS = WEEK_MS; // decided: weekly cooldown between intents
const WEEKLY_CAP = 3; // safety ceiling on intents resolved per IxTime-week
const BUDGET_PCT_MAX = 60; // clamp a single department's allocatedPercent

/** Load active Power Brokers for a country (mirrors elections.getPowerBrokers). */
async function loadBrokers(db: any, countryId: string): Promise<ActiveBroker[]> {
  const [components, allocations] = await Promise.all([
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true },
    }),
    db.budgetAllocation.findMany({
      where: { governmentStructure: { countryId }, budgetYear: new Date().getFullYear() },
      include: { department: { select: { category: true } } },
    }),
  ]);
  const spendByCategory: Record<string, number> = {};
  for (const a of allocations)
    spendByCategory[a.department.category] =
      (spendByCategory[a.department.category] || 0) + a.allocatedPercent;
  return deriveBrokers(
    components.map((c: any) => c.componentType),
    spendByCategory
  );
}

/** Re-weight package acceptance by the aligned broker's disposition. */
function alignedBroker(brokers: ActiveBroker[], category: Category): ActiveBroker | undefined {
  const id = CATEGORY_TO_BROKER[category];
  return id ? brokers.find((b) => b.id === id) : undefined;
}

async function cooldownStatus(db: any, countryId: string) {
  const now = IxTime.getCurrentIxTime();
  const weekAgo = now - WEEK_MS;
  const recent = await db.intent.findMany({
    where: {
      countryId,
      status: { in: ["active", "completed"] },
      createdIxTime: { gte: weekAgo },
    },
    orderBy: { createdIxTime: "asc" },
    select: { createdIxTime: true },
  });
  const usedThisWeek = recent.length;
  const onCooldown = usedThisWeek >= WEEKLY_CAP;

  let cooldownUntil: number | null = null;
  if (onCooldown && recent.length > 0 && recent[0]?.createdIxTime != null) {
    cooldownUntil = recent[0].createdIxTime + WEEK_MS;
  }

  return {
    onCooldown,
    cooldownUntil,
    usedThisWeek,
    cap: WEEKLY_CAP,
    canCommit: !onCooldown,
  };
}

export const intentRouter = createTRPCRouter({
  /** Propose Measured/Moderate/Extreme packages for a plain-language goal. */
  suggest: publicProcedure
    .input(z.object({ countryId: z.string(), goal: z.string().min(2).max(200) }))
    .query(async ({ ctx, input }) => {
      const { category, target, packages } = assemblePackages(input.goal);
      const status = await cooldownStatus(ctx.db, input.countryId);

      // broker-weighted acceptance (falls back to tier-based if brokers unavailable)
      let broker: ActiveBroker | undefined;
      try {
        const brokers = await loadBrokers(ctx.db, input.countryId);
        broker = alignedBroker(brokers, category);
      } catch {
        /* ignore — acceptance stays tier-based */
      }
      const weighted = packages.map((p) => ({
        ...p,
        acceptance: broker
          ? weightAcceptance(p.acceptance, {
              brokerUnlocked: broker.unlocked,
              brokerSatisfied: broker.satisfied,
            })
          : p.acceptance,
      }));

      return {
        goal: input.goal,
        category,
        target: target ?? null,
        foreignNeedsTarget: category === "foreign" && !target,
        packages: weighted,
        broker: broker
          ? { name: broker.name, unlocked: broker.unlocked, satisfied: broker.satisfied }
          : null,
        status,
      };
    }),

  /** Cooldown / cap status for the country (for UI gating). */
  getStatus: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => cooldownStatus(ctx.db, input.countryId)),

  /** Get a single intent by ID. */
  getIntent: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return await ctx.db.intent.findUnique({
      where: { id: input.id },
    });
  }),

  /** Update status of an intent (e.g. mark completed, abandoned). */
  updateStatus: protectedProcedure
    .input(
      z.object({ id: z.string(), status: z.enum(["proposed", "active", "completed", "abandoned"]) })
    )
    .mutation(async ({ ctx, input }) => {
      const intent = await ctx.db.intent.findUnique({ where: { id: input.id } });
      if (!intent) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCountryAccess(ctx, intent.countryId);

      // Phase 3 gate: an intent with open (pending/viewed) linked resistance
      // issues cannot be completed — the player must resolve them first.
      if (input.status === "completed") {
        const openResistance = await ctx.db.nationalIssue.findFirst({
          where: {
            countryId: intent.countryId,
            intentId: intent.id,
            status: { in: ["pending", "viewed"] },
          },
          select: { id: true },
        });
        if (openResistance) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "This intent still faces unresolved resistance (an open national issue). Resolve it before completing the intent.",
          });
        }
      }

      const updated = await ctx.db.intent.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      if (input.status === "completed") {
        try {
          await generateIntentSummationDraft({
            db: ctx.db,
            intentId: input.id,
            countryId: intent.countryId,
          });
        } catch (e) {
          console.warn("[Intent] Failed to auto-generate ThinkPages summation draft:", e);
        }
      }

      return updated;
    }),

  /** Explicitly generate/publish a ThinkPages summation post for an intent. */
  generateSummationDraft: protectedProcedure
    .input(
      z.object({
        intentId: z.string(),
        countryId: z.string(),
        visibility: z.enum(["draft", "public"]).optional(),
        customContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryAccess(ctx, input.countryId);
      return await generateIntentSummationDraft({
        db: ctx.db,
        intentId: input.intentId,
        countryId: input.countryId,
        visibility: input.visibility ?? "draft",
        customContent: input.customContent,
      });
    }),

  /** Commit a chosen package: applies it and records the Intent. */
  commit: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        goal: z.string().min(2).max(200),
        tier: z.enum([
          "proposed",
          "measured",
          "moderate",
          "extreme",
          "broker_unlocked",
          "structural_unlocked",
        ]),
        parentId: z.string().optional(),
        intentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryAccess(ctx, input.countryId);

      const { category, target, packages } = assemblePackages(input.goal);
      const now = IxTime.getCurrentIxTime();

      // Foreign policy is gated at classification time (assemble.classifyGoal throws
      // on foreign keywords), so no runtime gate is needed here.

      // Handle "proposed" status creation
      if (input.tier === "proposed") {
        const intent = await ctx.db.intent.create({
          data: {
            countryId: input.countryId,
            goal: input.goal,
            tier: "proposed",
            category,
            target: target ?? null,
            status: "proposed",
            changesJson: "[]",
            summary: `Proposed Goal: ${input.goal}`,
            parentId: input.parentId ?? null,
            cooldownUntil: null,
            createdIxTime: now,
          },
        });
        return { intent, changes: [], summary: intent.summary };
      }

      const pkg = packages.find((p) => p.tier === (input.tier as Tier));
      if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown tier." });

      // Weekly cooldown + cap.
      const status = await cooldownStatus(ctx.db, input.countryId);
      if (!status.canCommit) {
        const until = status.cooldownUntil
          ? ` Next available around ${IxTime.formatIxTime?.(status.cooldownUntil) ?? new Date(status.cooldownUntil).toISOString()}.`
          : "";
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Your government is still executing this week's agenda (${status.usedThisWeek}/${status.cap}).${until}`,
        });
      }

      // Apply the package through the spine (bounded + audited + narrated).
      const applied = await CountryEventSpine.recordCountryEvent({
        db: ctx.db,
        countryId: input.countryId,
        sourceType: "decision",
        description: `Intent (${input.tier}): ${input.goal}`,
        consequences: pkg.consequences.map((c) => ({
          targetModel: c.targetModel,
          targetField: c.targetField,
          operation: c.operation,
          value: c.value,
        })),
      });

      // Apply structured budget deltas (bounded; never a core stat). Best-effort.
      const budgetChanges = pkg.changes.filter(
        (c) => c.kind === "budget" && c.deptCategory && c.deltaPercent
      );
      for (const bc of budgetChanges) {
        try {
          const alloc = await ctx.db.budgetAllocation.findFirst({
            where: {
              governmentStructure: { countryId: input.countryId },
              department: { category: bc.deptCategory! },
            },
            // most-recent budget year, then the largest line in that category
            orderBy: [{ budgetYear: "desc" }, { allocatedPercent: "desc" }],
          });
          if (alloc) {
            const next = Math.max(
              0,
              Math.min(BUDGET_PCT_MAX, alloc.allocatedPercent + bc.deltaPercent!)
            );
            await ctx.db.budgetAllocation.update({
              where: { id: alloc.id },
              data: { allocatedPercent: next },
            });
          }
        } catch {
          /* budget row missing / structure absent — line stays descriptive only */
        }
      }

      // Auto-summation prose — ThinkPages draft-ready (push deferred to phase 6).
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { name: true },
      });
      const nm = country?.name ?? "The government";
      const summary =
        `${nm} pursued "${input.goal}" via a ${input.tier} course: ` +
        pkg.changes.map((c) => c.label).join("; ") +
        ".";

      let intent;
      if (input.intentId) {
        // Upgrade existing proposed intent to active
        intent = await ctx.db.intent.update({
          where: { id: input.intentId },
          data: {
            tier: input.tier,
            status: "active",
            changesJson: JSON.stringify(pkg.changes),
            summary,
            cooldownUntil: now + COOLDOWN_MS,
            createdIxTime: now,
            riskRating: TIER_RISK[input.tier as Tier],
          },
        });
      } else {
        // Create new active intent directly
        intent = await ctx.db.intent.create({
          data: {
            countryId: input.countryId,
            goal: input.goal,
            tier: input.tier,
            category,
            target: target ?? null,
            status: "active",
            changesJson: JSON.stringify(pkg.changes),
            summary,
            parentId: input.parentId ?? null,
            cooldownUntil: now + COOLDOWN_MS,
            createdIxTime: now,
            riskRating: TIER_RISK[input.tier as Tier],
          },
        });
      }

      // Deterministic resistance spawn: never fails the commit (try/catch inside).
      if (input.tier === "moderate" || input.tier === "extreme") {
        await spawnIntentResistance({
          db: ctx.db,
          countryId: input.countryId,
          intent: { id: intent.id, category, tier: input.tier },
        });
      }

      return { intent, changes: pkg.changes, applied, summary };
    }),

  /** Return all intents for a country structured as a branching decision tree. */
  getTree: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const intents = await ctx.db.intent.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "asc" },
      });

      const intentMap = new Map(intents.map((i) => [i.id, { ...i, children: [] as any[] }]));
      const roots: any[] = [];

      for (const intent of intentMap.values()) {
        if (intent.parentId && intentMap.has(intent.parentId)) {
          intentMap.get(intent.parentId)!.children.push(intent);
        } else {
          roots.push(intent);
        }
      }

      return { roots, allIntents: Array.from(intentMap.values()) };
    }),

  /** Return resistance issues linked to an intent (progress traceability for the drill sheet). */
  getLinkedIssues: protectedProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const issues = await ctx.db.nationalIssue.findMany({
        where: { intentId: input.intentId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          severity: true,
          domain: true,
          deadlineIxTime: true,
          respondedAt: true,
          chosenOptionLabel: true,
          createdAt: true,
        },
      });

      const resolved = issues.filter((i) =>
        ["responded", "auto_resolved", "dismissed"].includes(i.status)
      ).length;

      return {
        issues,
        resolvedCount: resolved,
        totalCount: issues.length,
        progress: issues.length === 0 ? 0 : Math.round((resolved / issues.length) * 100),
      };
    }),
});
