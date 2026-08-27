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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { NationalIssuesEngine } from "~/lib/national-issues";

const SPLASH_SHOWCASE_TAG = "Splash showcase seed";
const DM_EVENT_TAG = "DM event";
const MAX_BROADCAST = 100; // safety cap on a single injection

/** Ensures ~18 nations each have one force-generated showcase issue for the guest splash (idempotent per country). */
// oxlint-disable-next-line typescript/no-unused-vars
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

const _ResponseOptionSchema = z.object({
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
  recommendedDirective: z.string().optional(),
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

export const nationalIssuesTemplatesRouter = createTRPCRouter({
  // ==================== PLAYER ENDPOINTS ====================

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

  /**
   * Inject a narrative event onto a country, region, continent, or all countries.
   * Bypasses trigger conditions; tags created issues for auditability.
   */
  injectEvent: adminProcedure
    .input(
      z.object({
        templateId: z.string(),
        target: z.discriminatedUnion("scope", [
          z.object({ scope: z.literal("country"), countryId: z.string() }),
          z.object({ scope: z.literal("region"), region: z.string() }),
          z.object({ scope: z.literal("continent"), continent: z.string() }),
          z.object({ scope: z.literal("all") }),
        ]),
        label: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.nationalIssueTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true, slug: true },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      let countryIds: string[];
      if (input.target.scope === "country") {
        countryIds = [input.target.countryId];
      } else {
        const where =
          input.target.scope === "region"
            ? { region: input.target.region }
            : input.target.scope === "continent"
              ? { continent: input.target.continent }
              : {};
        const countries = await ctx.db.country.findMany({ where, select: { id: true } });
        countryIds = countries.map((c) => c.id);
      }

      if (countryIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No countries match the target" });
      }
      if (countryIds.length > MAX_BROADCAST) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Target matches ${countryIds.length} countries (max ${MAX_BROADCAST} per injection)`,
        });
      }

      const tag = `${DM_EVENT_TAG}: ${input.label ?? template.slug} [by ${ctx.auth!.userId}]`;
      const issueIds: string[] = [];
      for (const countryId of countryIds) {
        const issueId = await NationalIssuesEngine.forceGenerate(
          input.templateId,
          countryId,
          ctx.db as any
        );
        if (issueId) {
          await ctx.db.nationalIssue.update({
            where: { id: issueId },
            data: { triggerReason: tag },
          });
          issueIds.push(issueId);
        }
      }

      return { created: issueIds.length, requested: countryIds.length, issueIds };
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
        ctx.db as any
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
        triggersPassed = NationalIssuesEngine.evaluateCondition(conditions, snapshot);
      } catch {
        triggersPassed = false;
      }

      // Render with substitution
      const renderedTitle = NationalIssuesEngine.substituteVariables(template.title, snapshot);
      const renderedDescription = NationalIssuesEngine.substituteVariables(
        template.description,
        snapshot
      );
      const renderedLongDescription = template.longDescription
        ? NationalIssuesEngine.substituteVariables(template.longDescription, snapshot)
        : null;

      let renderedOptions: any[] = [];
      try {
        const options = JSON.parse(template.responseOptions);
        renderedOptions = options.map((opt: any) => ({
          ...opt,
          label: NationalIssuesEngine.substituteVariables(opt.label, snapshot),
          description: NationalIssuesEngine.substituteVariables(opt.description, snapshot),
          outcomeText: NationalIssuesEngine.substituteVariables(opt.outcomeText, snapshot),
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
});
