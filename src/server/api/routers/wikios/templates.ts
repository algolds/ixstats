/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import {
  getRevisionWikitext as getRevisionWikitextMySQL,
  searchTemplates as searchTemplatesDB,
} from "~/lib/wiki-bridge";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
} from "~/lib/wiki-os/template-registry";
import { db } from "~/server/db";

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
   * Search templates by name prefix. Checks local cache first, falls back to wiki.
   */
  searchTemplates: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      // Search local registry first
      const cached = await db.wikiTemplate.findMany({
        where: { name: { contains: input.query, mode: "insensitive" } },
        take: input.limit,
        orderBy: { usageCount: "desc" },
        select: {
          name: true,
          description: true,
          category: true,
          paramCount: true,
          usageCount: true,
        },
      });

      if (cached.length >= 5) return { templates: cached, source: "cache" as const };

      // Fall back to direct MySQL search (was API, now ~20ms)
      const wikiResults = await searchTemplatesDB(input.query, input.limit);
      return {
        templates: wikiResults.map((name) => ({
          name,
          description: null,
          category: null,
          paramCount: 0,
          usageCount: 0,
        })),
        source: "wiki" as const,
      };
    }),

  /**
   * Get TemplateData schema for a specific template.
   * Fetches from cache or syncs from MediaWiki on miss.
   */
  getTemplateData: publicProcedure
    .input(z.object({ name: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      // Check local cache
      const cached = await db.wikiTemplate.findUnique({
        where: { name: input.name },
      });

      // If cached and synced within last 24 hours, return it
      if (cached?.templateData && cached.lastSynced > new Date(Date.now() - 86400000)) {
        return {
          name: cached.name,
          description: cached.description,
          category: cached.category,
          templateData: cached.templateData as Record<string, unknown>,
          paramCount: cached.paramCount,
        };
      }

      // Fetch from MediaWiki
      const tdMap = await fetchTemplateData([input.name]);
      const td = tdMap.get(input.name);

      if (td) {
        const category = categorizeTemplate(input.name, td.description);
        const paramCount = Object.keys(td.params).length;

        // Upsert into cache
        await db.wikiTemplate.upsert({
          where: { name: input.name },
          create: {
            name: input.name,
            description: td.description ?? null,
            category,
            templateData: td as any,
            paramCount,
            lastSynced: new Date(),
          },
          update: {
            description: td.description ?? null,
            category,
            templateData: td as any,
            paramCount,
            lastSynced: new Date(),
          },
        });

        return {
          name: input.name,
          description: td.description ?? null,
          category,
          templateData: td as any,
          paramCount,
        };
      }

      return {
        name: input.name,
        description: null,
        category: null,
        templateData: null,
        paramCount: 0,
      };
    }),

  /**
   * Get a rendered preview of a template with given parameters.
   */
  getTemplatePreview: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(500),
        params: z.record(z.string(), z.string()),
      })
    )
    .query(async ({ input }) => {
      const html = await renderTemplatePreview(input.name, input.params);
      return { html };
    }),

  /**
   * Sync a batch of templates from MediaWiki into the local registry.
   * Admin-only: used for bulk population.
   */
  syncTemplates: protectedProcedure
    .input(
      z.object({
        names: z.array(z.string().min(1).max(500)).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const tdMap = await fetchTemplateData(input.names);
      let synced = 0;

      for (const [name, td] of tdMap) {
        const category = categorizeTemplate(name, td.description);
        await db.wikiTemplate.upsert({
          where: { name },
          create: {
            name,
            description: td.description ?? null,
            category,
            templateData: td as any,
            paramCount: Object.keys(td.params).length,
            lastSynced: new Date(),
          },
          update: {
            description: td.description ?? null,
            category,
            templateData: td as any,
            paramCount: Object.keys(td.params).length,
            lastSynced: new Date(),
          },
        });
        synced++;
      }

      return { synced, total: input.names.length };
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

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}
