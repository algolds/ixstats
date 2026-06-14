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
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { NationalIssuesEngine } from "~/lib/national-issues-engine";

const SPLASH_SHOWCASE_TAG = "Splash showcase seed";

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

export const nationalIssuesEngineRouter = createTRPCRouter({
  // ==================== PLAYER ENDPOINTS ====================

  // ==================== ADMIN ENDPOINTS ====================

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
        ctx.db as any
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
            create: { ...template, authorId: ctx.auth!.userId },
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

      const totalIssuesGenerated = logs.reduce((sum, l) => sum + l.issuesGenerated, 0);
      const totalEvaluations = logs.length;
      const avgExecutionTime =
        logs.length > 0
          ? Math.round(logs.reduce((sum, l) => sum + l.executionTimeMs, 0) / logs.length)
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
   * Splash / discovery: one randomized issue per nation when possible.
   * Pools countries from recent issue activity (not only currently open issues),
   * otherwise a single busy nation dominates the splash when only it has pending mail.
   */
  getRecentWorldIssues: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(36).default(18) }))
    .query(async ({ ctx, input }) => {
      await seedSplashShowcaseIssues(ctx.db as PrismaClient);

      const issueSelect = {
        id: true,
        title: true,
        description: true,
        severity: true,
        urgency: true,
        domain: true,
        country: {
          select: { id: true, name: true, flag: true },
        },
      } as const;

      const openWhere = {
        status: { in: ["pending", "viewed"] },
      };

      const since = new Date();
      since.setDate(since.getDate() - 365);

      const countriesRecent = await ctx.db.nationalIssue.groupBy({
        by: ["countryId"],
        where: { createdAt: { gte: since } },
      });

      if (countriesRecent.length === 0) {
        return { issues: [] };
      }

      const countryIds = countriesRecent.map((g) => g.countryId);
      for (let i = countryIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [countryIds[i], countryIds[j]] = [countryIds[j]!, countryIds[i]!];
      }

      const pickCountries = countryIds.slice(0, Math.min(input.limit, countryIds.length));

      const pickRandomIssueForCountry = async (countryId: string) => {
        const openCandidates = await ctx.db.nationalIssue.findMany({
          where: { countryId, ...openWhere },
          orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
          take: 24,
          select: issueSelect,
        });
        if (openCandidates.length > 0) {
          return openCandidates[Math.floor(Math.random() * openCandidates.length)]!;
        }
        const anyRecent = await ctx.db.nationalIssue.findMany({
          where: { countryId, createdAt: { gte: since } },
          orderBy: [{ createdAt: "desc" }],
          take: 32,
          select: issueSelect,
        });
        if (anyRecent.length === 0) return null;
        return anyRecent[Math.floor(Math.random() * anyRecent.length)]!;
      };

      const picked = (
        await Promise.all(pickCountries.map((cid) => pickRandomIssueForCountry(cid)))
      ).filter((x): x is NonNullable<typeof x> => x != null);

      const issues = picked;

      if (issues.length < input.limit) {
        const excludeIds = new Set(issues.map((x) => x.id));
        const moreCountries = countryIds
          .filter((id) => !pickCountries.includes(id))
          .slice(0, input.limit - issues.length);

        const extra = (
          await Promise.all(moreCountries.map((cid) => pickRandomIssueForCountry(cid)))
        ).filter((x): x is NonNullable<typeof x> => x != null);

        for (const row of extra) {
          if (issues.length >= input.limit) break;
          if (excludeIds.has(row.id)) continue;
          issues.push(row);
          excludeIds.add(row.id);
        }
      }

      if (issues.length < input.limit) {
        const excludeIds = new Set(issues.map((x) => x.id));
        const fillPool = await ctx.db.nationalIssue.findMany({
          where: {
            createdAt: { gte: since },
            id: { notIn: [...excludeIds] },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
          select: issueSelect,
        });
        const byCountry = new Map<string, typeof fillPool>();
        for (const row of fillPool) {
          const cid = row.country.id;
          const arr = byCountry.get(cid) ?? [];
          arr.push(row);
          byCountry.set(cid, arr);
        }
        const seenCountries = new Set(issues.map((i) => i.country.id));
        const countryOrder = [...byCountry.keys()].sort(() => Math.random() - 0.5);
        for (const cid of countryOrder) {
          if (issues.length >= input.limit) break;
          if (seenCountries.has(cid)) continue;
          const pool = byCountry.get(cid);
          if (!pool?.length) continue;
          const row = pool[Math.floor(Math.random() * pool.length)]!;
          issues.push(row);
          seenCountries.add(cid);
          excludeIds.add(row.id);
        }
      }

      for (let i = issues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [issues[i], issues[j]] = [issues[j]!, issues[i]!];
      }

      return { issues: issues.slice(0, input.limit) };
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
      return NationalIssuesEngine.evaluateCountry(input.countryId, ctx.db as any, {
        maxIssues: input.maxIssues,
        forceDomain: input.domain,
      });
    }),
});
