/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { searchTemplates as searchTemplatesDB } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
} from "~/lib/wiki-os/templates/template-registry";
import { db } from "~/server/db";
import type { Prisma } from "@prisma/client";

const CANONICAL_BUILTIN_TEMPLATES = [
  {
    name: "Infobox country",
    description: "Primary nation-state infobox with flag, coat of arms, map, capital, GDP, and demographics.",
    category: "infobox",
    paramCount: 24,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "CountryData",
    description: "Live real-time economic and geopolitical data connector powered by the IxStates Engine.",
    category: "infobox",
    paramCount: 6,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "BusinessData",
    description: "Corporate, trade balance, and commercial enterprise financial indicators.",
    category: "infobox",
    paramCount: 8,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox military conflict",
    description: "Historical conflicts, combatants, commanders, casualties, and strategic outcomes.",
    category: "infobox",
    paramCount: 16,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox person",
    description: "Biographical profile with birth, citizenship, offices held, and historical records.",
    category: "infobox",
    paramCount: 18,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Infobox settlement",
    description: "Cities, provinces, municipalities, and administrative divisions with population and geography.",
    category: "infobox",
    paramCount: 20,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Navbox",
    description: "Horizontal footer navigation matrix for thematic topics and categories.",
    category: "navigation",
    paramCount: 12,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Cite web",
    description: "Structured citation format for web sources, publications, and treaties.",
    category: "citation",
    paramCount: 8,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Flag",
    description: "Render national and provincial flag icons with standardized aspect ratios.",
    category: "icon",
    paramCount: 3,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
  {
    name: "Coord",
    description: "Geographic coordinate badge with map alignment and spatial projection.",
    category: "geographic",
    paramCount: 4,
    isCanonical: true,
    canonicalTarget: null,
    hasTemplateData: true,
  },
];

const BUILTIN_TEMPLATE_SCHEMAS: Record<
  string,
  {
    description: string;
    category: string;
    params: Record<string, { label: string; description: string; type: string; required?: boolean }>;
  }
> = {
  "infobox country": {
    description: "Primary nation-state infobox with flag, coat of arms, map, capital, GDP, and demographics.",
    category: "infobox",
    params: {
      common_name: { label: "Common Name", description: "Standard short English name of the country", type: "string", required: true },
      official_name: { label: "Official Name", description: "Full formal official state name", type: "string" },
      native_name: { label: "Native Name", description: "Name in indigenous / national language", type: "string" },
      image_flag: { label: "Flag Image", description: "Filename of the national flag (e.g. Flag_of_Caphiria.svg)", type: "wiki-file-name" },
      image_coat: { label: "Coat of Arms", description: "Filename of the national emblem or seal", type: "wiki-file-name" },
      image_map: { label: "Map Image", description: "Cartographic map or realm locator map", type: "wiki-file-name" },
      capital: { label: "Capital City", description: "Seat of national government and primary capital", type: "wiki-page-name", required: true },
      largest_city: { label: "Largest City", description: "Most populous city if different from capital", type: "wiki-page-name" },
      government_type: { label: "Government Type", description: "Constitutional structure (e.g. Unitary Constitutional Republic)", type: "string" },
      leader_title1: { label: "Head of State Title", description: "Title (e.g. President, Emperor, Prime Minister)", type: "string" },
      leader_name1: { label: "Head of State Name", description: "Current officeholder name", type: "string" },
      area_km2: { label: "Land Area (km²)", description: "Total sovereign geographic surface area", type: "number" },
      population_estimate: { label: "Population", description: "Estimated total citizen population", type: "number" },
      gdp_nominal: { label: "Nominal GDP ($)", description: "Gross Domestic Product total in USD", type: "string" },
      currency: { label: "Currency", description: "Official national legal tender", type: "string" },
    },
  },
  countrydata: {
    description: "Live real-time economic and geopolitical data connector powered by the IxStates Engine.",
    category: "infobox",
    params: {
      id: { label: "Country Identifier", description: "Country slug or ISO identifier in IxStates", type: "string", required: true },
      metric: { label: "Metric Name", description: "gdp, population, debt, hdi, vitality, or stability", type: "string", required: true },
      format: { label: "Display Format", description: "currency, compact, percentage, or number", type: "string" },
      fallback: { label: "Fallback Value", description: "Fallback text if live sync is offline", type: "string" },
    },
  },
  businessdata: {
    description: "Corporate, trade balance, and commercial enterprise financial indicators.",
    category: "infobox",
    params: {
      company: { label: "Company Name", description: "Corporate entity identifier", type: "string", required: true },
      industry: { label: "Industry Sector", description: "Economic sector (Aerospace, Energy, Telecom)", type: "string" },
      metric: { label: "Metric", description: "revenue, valuation, employees, or headquarters", type: "string" },
    },
  },
  "infobox person": {
    description: "Biographical profile with birth, citizenship, offices held, and historical records.",
    category: "infobox",
    params: {
      name: { label: "Name", description: "Full legal or historical person name", type: "string", required: true },
      image: { label: "Portrait", description: "Portrait photograph or historical illustration", type: "wiki-file-name" },
      birth_date: { label: "Birth Date", description: "Date of birth (YYYY-MM-DD)", type: "date" },
      birth_place: { label: "Birth Place", description: "City or region of birth", type: "string" },
      nationality: { label: "Nationality", description: "Sovereign state citizenship", type: "string" },
      office: { label: "Offices Held", description: "Political, diplomatic, or military titles", type: "string" },
    },
  },
  "infobox military conflict": {
    description: "Historical conflicts, combatants, commanders, casualties, and strategic outcomes.",
    category: "infobox",
    params: {
      conflict: { label: "Conflict Name", description: "Name of the battle or war", type: "string", required: true },
      date: { label: "Date Range", description: "Start and end dates of hostilities", type: "string" },
      place: { label: "Theater / Location", description: "Geographic theater of operations", type: "string" },
      result: { label: "Outcome", description: "Decisive treaty, armistice, or outcome", type: "string" },
      combatant1: { label: "Belligerents (Side 1)", description: "First alliance or state forces", type: "string" },
      combatant2: { label: "Belligerents (Side 2)", description: "Opposing alliance or state forces", type: "string" },
    },
  },
  "cite web": {
    description: "Structured citation format for web sources, publications, and treaties.",
    category: "citation",
    params: {
      url: { label: "Source URL", description: "Direct web hyperlink", type: "string", required: true },
      title: { label: "Article Title", description: "Title of cited publication or document", type: "string", required: true },
      author: { label: "Author", description: "Author or publishing agency", type: "string" },
      publisher: { label: "Publisher", description: "Organization or publishing house", type: "string" },
      date: { label: "Publication Date", description: "Release date of source", type: "date" },
      accessdate: { label: "Access Date", description: "Date source was accessed", type: "date" },
    },
  },
};

export const wikiosTemplatesRouter = createTRPCRouter({
  /**
   * Search templates with metadata and categorization.
   */
  searchTemplates: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).default(""),
        category: z.string().optional(),
        canonicalOnly: z.boolean().default(false),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      // 1. Try local WikiTemplate registry first
      const where: {
        isCanonical?: boolean;
        category?: string;
        OR?: Array<{ name: { contains: string; mode: "insensitive" } }>;
      } = {};

      if (input.canonicalOnly) {
        where.isCanonical = true;
      }
      if (input.category && input.category !== "all") {
        where.category = input.category;
      }
      if (input.query) {
        where.OR = [{ name: { contains: input.query, mode: "insensitive" } }];
      }

      const localTemplates = await db.wikiTemplate.findMany({
        where,
        take: input.limit,
        orderBy: [{ isCanonical: "desc" }, { paramCount: "desc" }],
      });

      const templateMap = new Map<string, {
        name: string;
        description: string | null;
        category: string;
        paramCount: number;
        isCanonical: boolean;
        canonicalTarget: string | null;
        hasTemplateData: boolean;
      }>();

      for (const t of localTemplates) {
        templateMap.set(t.name.toLowerCase(), {
          name: t.name,
          description: t.description,
          category: t.category ?? "other",
          paramCount: t.paramCount,
          isCanonical: t.isCanonical,
          canonicalTarget: t.canonicalTarget,
          hasTemplateData: !!t.templateData,
        });
      }

      // 2. Check PostgreSQL WikiArticle table for namespace 10 (Templates)
      if (templateMap.size < input.limit) {
        const articleTemplates = await db.wikiArticle.findMany({
          where: {
            namespace: 10,
            ...(input.query ? { title: { contains: input.query, mode: "insensitive" } } : {}),
          },
          take: input.limit,
          select: { title: true, summary: true },
        });

        for (const art of articleTemplates) {
          const cleanName = art.title.replace(/^Template:/i, "").trim();
          const key = cleanName.toLowerCase();
          if (!templateMap.has(key)) {
            const cat = categorizeTemplate(cleanName, art.summary ?? undefined);
            if (!input.category || input.category === "all" || input.category === cat) {
              templateMap.set(key, {
                name: cleanName,
                description: art.summary,
                category: cat,
                paramCount: 0,
                isCanonical: false,
                canonicalTarget: null,
                hasTemplateData: false,
              });
            }
          }
        }
      }

      // 3. Merge canonical built-ins
      for (const canonical of CANONICAL_BUILTIN_TEMPLATES) {
        const key = canonical.name.toLowerCase();
        const matchesQuery = !input.query || canonical.name.toLowerCase().includes(input.query.toLowerCase()) || canonical.description.toLowerCase().includes(input.query.toLowerCase());
        const matchesCat = !input.category || input.category === "all" || input.category === canonical.category;

        if (matchesQuery && matchesCat) {
          if (!templateMap.has(key)) {
            templateMap.set(key, canonical);
          } else {
            // Upgrade with canonical rich metadata
            const existing = templateMap.get(key)!;
            templateMap.set(key, {
              ...existing,
              description: canonical.description,
              category: canonical.category,
              paramCount: canonical.paramCount,
              isCanonical: true,
              hasTemplateData: true,
            });
          }
        }
      }

      // 4. Fall back to MediaWiki search via direct MySQL if still below limit
      if (templateMap.size < input.limit) {
        try {
          const wikiResults = await searchTemplatesDB(input.query, input.limit);
          for (const name of wikiResults) {
            const key = name.toLowerCase();
            if (!templateMap.has(key)) {
              const cat = categorizeTemplate(name);
              if (!input.category || input.category === "all" || input.category === cat) {
                templateMap.set(key, {
                  name,
                  description: null,
                  category: cat,
                  paramCount: 0,
                  isCanonical: false,
                  canonicalTarget: null,
                  hasTemplateData: false,
                });
              }
            }
          }
        } catch {
          // Silent fallback
        }
      }

      const templates = Array.from(templateMap.values()).slice(0, input.limit);

      return {
        templates,
      };
    }),

  /**
   * Get TemplateData schema for a specific template.
   */
  getTemplateData: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      let templateName = input.title.replace(/^Template:/i, "");

      // 1. Check local DB cache (and resolve canonical target if alias)
      let cached = await db.wikiTemplate.findUnique({
        where: { name: templateName },
      });

      if (cached?.canonicalTarget) {
        const target = await db.wikiTemplate.findUnique({
          where: { name: cached.canonicalTarget },
        });
        if (target) cached = target;
      }

      if (cached?.templateData) {
        return {
          name: cached.name,
          description: cached.description,
          category: cached.category,
          isCanonical: cached.isCanonical,
          templateData: cached.templateData as Record<string, unknown>,
          cached: true,
        };
      }

      // 2. Fetch from MediaWiki API
      const tdMap = await fetchTemplateData([templateName]);
      const data = tdMap.get(templateName);
      if (!data) {
        const builtinKey = templateName.toLowerCase().trim();
        const builtin = BUILTIN_TEMPLATE_SCHEMAS[builtinKey];
        if (builtin) {
          return {
            name: templateName,
            description: builtin.description,
            category: builtin.category,
            isCanonical: true,
            templateData: {
              description: builtin.description,
              params: builtin.params,
            } as unknown as Record<string, unknown>,
            cached: true,
          };
        }

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

  /**
   * Save, create, or update a custom user-defined template / infobox.
   */
  saveCustomTemplate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        category: z.string().default("infobox"),
        params: z.array(
          z.object({
            name: z.string().min(1),
            label: z.string().min(1),
            description: z.string().optional(),
            type: z.string().default("string"),
            required: z.boolean().default(false),
            example: z.string().optional(),
            default: z.string().optional(),
          })
        ),
        wikitextTemplate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const cleanName = input.name.replace(/^Template:/i, "").trim();
      const paramMap: Record<string, any> = {};
      for (const p of input.params) {
        paramMap[p.name] = {
          label: p.label,
          description: p.description,
          type: p.type,
          required: p.required,
          example: p.example,
          default: p.default,
        };
      }

      const templateData = {
        title: cleanName,
        description: input.description ?? "",
        params: paramMap,
        format: "block",
      };

      // 1. Upsert in WikiTemplate registry
      const template = await db.wikiTemplate.upsert({
        where: { name: cleanName },
        create: {
          name: cleanName,
          description: input.description ?? null,
          category: input.category,
          templateData: templateData as unknown as Prisma.InputJsonValue,
          paramCount: input.params.length,
          isCanonical: false,
        },
        update: {
          description: input.description ?? null,
          category: input.category,
          templateData: templateData as unknown as Prisma.InputJsonValue,
          paramCount: input.params.length,
          lastSynced: new Date(),
        },
      });

      // 2. Also register in wiki_articles (namespace 10)
      const rawWikitext =
        input.wikitextTemplate ||
        `<includeonly><div className="wikios-infobox wikios-custom-infobox">\n` +
          `  <div className="wikios-infobox-header">{{{name|${cleanName}}}}}</div>\n` +
          input.params
            .map(
              (p) =>
                `  {{#if:{{{${p.name}|}}}|<div className="wikios-infobox-row"><span className="wikios-infobox-label">${p.label}:</span> <span className="wikios-infobox-value">{{{${p.name}}}}}</span></div>}}`
            )
            .join("\n") +
          `\n</div></includeonly><noinclude>\n== Template Documentation ==\n${input.description || "Custom user-created template"}\n</noinclude>`;

      await db.wikiArticle.upsert({
        where: {
          source_title: {
            source: "ixwiki",
            title: `Template:${cleanName}`,
          },
        },
        create: {
          slug: `template-${cleanName.toLowerCase().replace(/[\s_]+/g, "-")}`,
          title: `Template:${cleanName}`,
          source: "ixwiki",
          namespace: 10,
          namespacePrefix: "Template",
          status: "PUBLISHED",
          wikitext: rawWikitext,
          summary: input.description || `Custom template for ${cleanName}`,
        },
        update: {
          wikitext: rawWikitext,
          summary: input.description || `Custom template for ${cleanName}`,
        },
      });

      return { success: true, template };
    }),

  /**
   * Delete a custom user-defined template.
   */
  deleteCustomTemplate: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const cleanName = input.name.replace(/^Template:/i, "").trim();
      const existing = await db.wikiTemplate.findUnique({ where: { name: cleanName } });
      if (!existing) throw new Error("Template not found");
      if (existing.isCanonical) throw new Error("Canonical templates cannot be deleted");

      await db.wikiTemplate.delete({ where: { name: cleanName } });
      return { success: true };
    }),
});
