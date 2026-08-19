/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { searchTemplates as searchTemplatesDB } from "~/lib/wiki/bridge";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
} from "~/lib/wiki-os/template-registry";
import { db } from "~/server/db";
import type { Prisma } from "@prisma/client";

export const wikiosTemplatesRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Template Registry (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Search templates with metadata and categorization.
   */
  searchTemplates: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).default(""),
        category: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      // 1. Try local WikiTemplate registry first
      const where: {
        category?: string;
        OR?: Array<{ name: { contains: string; mode: "insensitive" } }>;
      } = {};

      if (input.category && input.category !== "all") {
        where.category = input.category;
      }
      if (input.query) {
        where.OR = [{ name: { contains: input.query, mode: "insensitive" } }];
      }

      const localTemplates = await db.wikiTemplate.findMany({
        where,
        take: input.limit,
        orderBy: { paramCount: "desc" },
      });

      if (localTemplates.length > 0) {
        return {
          templates: localTemplates.map((t) => ({
            name: t.name,
            description: t.description,
            category: t.category ?? "other",
            paramCount: t.paramCount,
            hasTemplateData: !!t.templateData,
          })),
        };
      }

      // 2. Fall back to MediaWiki search via direct MySQL
      const wikiResults = await searchTemplatesDB(input.query, input.limit);
      return {
        templates: wikiResults.map((name) => ({
          name,
          description: null,
          category: categorizeTemplate(name),
          paramCount: 0,
          hasTemplateData: false,
        })),
      };
    }),

  /**
   * Get TemplateData schema for a specific template.
   */
  getTemplateData: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const templateName = input.title.replace(/^Template:/i, "");

      // 1. Check local DB cache
      const cached = await db.wikiTemplate.findUnique({
        where: { name: templateName },
      });
      if (cached?.templateData) {
        return {
          name: cached.name,
          description: cached.description,
          category: cached.category,
          templateData: cached.templateData as Record<string, unknown>,
          cached: true,
        };
      }

      // 2. Fetch from MediaWiki API
      const tdMap = await fetchTemplateData([templateName]);
      const data = tdMap.get(templateName);
      if (!data) {
        return {
          name: templateName,
          description: null,
          category: categorizeTemplate(templateName),
          templateData: null,
          cached: false,
        };
      }

      // 3. Cache in DB for future requests
      const category = categorizeTemplate(templateName, data.description);
      const paramCount = data.params ? Object.keys(data.params).length : 0;

      await db.wikiTemplate.upsert({
        where: { name: templateName },
        create: {
          name: templateName,
          description: data.description ?? null,
          category,
          templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
          paramCount,
        },
        update: {
          description: data.description ?? null,
          category,
          templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
          paramCount,
        },
      });

      return {
        name: templateName,
        description: data.description ?? null,
        category,
        templateData: data as unknown as Record<string, unknown>,
        cached: false,
      };
    }),

  /**
   * Get rendered preview of a template with given parameters.
   */
  getTemplatePreview: publicProcedure
    .input(
      z.object({
        template: z.string().min(1).max(500),
        params: z.record(z.string(), z.string()),
      })
    )
    .query(async ({ input }) => {
      return renderTemplatePreview(input.template, input.params);
    }),

  /**
   * Sync/backfill all Template: pages into the WikiTemplate registry.
   */
  syncTemplates: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .mutation(async ({ input }) => {
      // Find all Template: pages from direct MySQL
      const templates = await searchTemplatesDB("", input.limit);
      const cleanNames = templates.map((t) => t.replace(/^Template:/i, ""));
      const tdMap = await fetchTemplateData(cleanNames);
      let synced = 0;

      for (const name of cleanNames) {
        const data = tdMap.get(name);
        const category = categorizeTemplate(name, data?.description);
        const paramCount = data?.params ? Object.keys(data.params).length : 0;

        await db.wikiTemplate.upsert({
          where: { name },
          create: {
            name,
            description: data?.description ?? null,
            category,
            templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
            paramCount,
          },
          update: {
            description: data?.description ?? null,
            category,
            templateData: (data ?? null) as unknown as Prisma.InputJsonValue,
            paramCount,
          },
        });
        synced++;
      }

      return { synced, total: templates.length };
    }),

  // ---------------------------------------------------------------------------
  // Lore Stash — save-for-later with color-coded collections
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // User Info (for WikiOS profiles)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Rollback / Undo endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Page Properties & Protection (direct MySQL)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Advanced Search (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Category Tree (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Watchlist endpoints (backed by the LoreStash "Watchlist" stash)
  // ---------------------------------------------------------------------------
});
