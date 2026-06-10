/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import {
  getArticleHtml,
  getArticleHtmlViaParsoid,
  htmlToWikitext,
  wikitextToHtml,
  invalidateCache,
} from "~/lib/wikios/parsoid-client";
import {
  searchPages,
  getArticleWikitext,
  getRecentChanges,
  getPageSections,
  getPageHistory,
  getUserContribs,
  getUserInfo,
  getBacklinks,
  getCategoryMembers,
  getSiteStats,
  getRandomPage,
  resolveRedirect as resolveRedirectMySQL,
  getRevisionWikitext as getRevisionWikitextMySQL,
  getCurrentRevMeta,
  getNamespacedWikitext,
  searchTemplates as searchTemplatesDB,
  fullTextSearch,
  getParentCategories as getParentCategoriesMySQL,
  getCategoryInfo,
  getPageProps,
  getPageProtection,
  getPageLog,
  type WikiSource,
} from "~/lib/wiki-bridge";
import { transformWikiLinks } from "~/lib/wikios/url-compat";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wikios/html-transformer";
import { extractTemplateKeys, resolveTemplates, applyResolvedTemplates } from "~/lib/wikios/template-resolver";
import { computeWikitextDiff } from "~/lib/wikios/wikitext-diff";
import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wikios/csrf-cache";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
} from "~/lib/wikios/template-registry";
import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "./wiki";

export const wikiosRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  /**
   * Get pre-transformed article data for the reader mode.
   * ALL transformation (images, links, infobox extraction, TOC, notices)
   * happens here server-side. Client renders with zero regex work.
   */
  getArticleHtml: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input, ctx }) => {
      const { wikiSource } = input;

      // For external wikis, fetch wikitext then render via ixwiki's action=parse
      if (wikiSource !== "ixwiki") {
        const article = await getArticleWikitext(input.title, wikiSource);
        if (!article) {
          throw new Error(`Article "${input.title}" not found on ${wikiSource}`);
        }

        // Use ixwiki's action=parse as a cross-wiki render proxy.
        // Templates won't resolve but basic wikitext formatting will work.
        const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
        const response = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "parse",
            text: article.wikitext,
            contentmodel: "wikitext",
            prop: "text",
            disablelimitreport: "1",
            disableeditsection: "1",
            wrapoutputclass: "",
            formatversion: "2",
            format: "json",
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          throw new Error(`Cross-wiki render failed (${response.status})`);
        }

        const data = (await response.json()) as {
          parse?: { text: string };
          error?: { info: string };
        };

        if (data.error || !data.parse) {
          throw new Error(`Cross-wiki render error: ${data.error?.info ?? "no parse result"}`);
        }

        const transformed = transformArticleHtml(
          stripConflictingStyles(data.parse.text),
          "",
          wikiSource
        );

        return {
          contentHtml: transformed.contentHtml,
          infoboxHtml: transformed.infoboxHtml,
          noticesHtml: transformed.noticesHtml,
          toc: transformed.toc,
          title: article.title,
          categories: [] as string[],
          lastModified: null,
          isRedirect: false,
          redirectTarget: null,
          resolvedFrom: null,
          wikiSource,
        };
      }

      // Default ixwiki flow — direct Parsoid/MySQL
      const resolvedTitle = await resolveRedirect(input.title);
      const article = await getArticleHtml(resolvedTitle);

      const transformed = transformArticleHtml(stripConflictingStyles(article.html), "", "ixwiki");

      // Pre-resolve custom templates (CountryData, BusinessData) server-side
      // so they render immediately without a client-side second pass.
      const templateKeys = extractTemplateKeys(transformed.contentHtml);
      let resolvedMap: Map<string, any> | undefined;
      try {
        const myCountryId = (ctx as any).auth?.userId
          ? (
              await (ctx as any).db.user.findFirst({
                where: { clerkUserId: (ctx as any).auth.userId },
                select: { countryId: true },
              })
            )?.countryId ?? null
          : null;
        resolvedMap = await resolveTemplates(templateKeys, {
          activeCountryId: myCountryId,
        });
      } catch {
        resolvedMap = undefined;
      }

      const contentHtml = resolvedMap
        ? applyResolvedTemplates(transformed.contentHtml, resolvedMap)
        : transformed.contentHtml;
      const infoboxHtml =
        resolvedMap && transformed.infoboxHtml
          ? applyResolvedTemplates(transformed.infoboxHtml, resolvedMap)
          : transformed.infoboxHtml;
      const noticesHtml =
        resolvedMap && transformed.noticesHtml
          ? applyResolvedTemplates(transformed.noticesHtml, resolvedMap)
          : transformed.noticesHtml;

      return {
        contentHtml,
        infoboxHtml,
        noticesHtml,
        toc: transformed.toc,
        title: article.title,
        categories: article.categories,
        lastModified: article.lastModified,
        isRedirect: false,
        redirectTarget: null,
        resolvedFrom: resolvedTitle !== input.title ? input.title : null,
        wikiSource: "ixwiki" as const,
      };
    }),

  /**
   * Get raw wikitext for the source editor.
   */
  getWikitext: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const [article, revMeta] = await Promise.all([
        getArticleWikitext(input.title, "ixwiki"),
        getCurrentRevisionMeta(input.title),
      ]);
      return {
        wikitext: article?.wikitext ?? "",
        revid: revMeta?.revid ?? null,
        timestamp: revMeta?.timestamp ?? null,
      };
    }),

  /**
   * Get Parsoid HTML for the visual editor.
   * Returns raw Parsoid output with data-mw attributes preserved.
   * This is the HTML that can round-trip back to wikitext via Parsoid.
   * Do NOT use transformArticleHtml on this — it destroys the metadata.
   */
  getEditorHtml: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const [article, revMeta] = await Promise.all([
        getArticleHtmlViaParsoid(input.title),
        getCurrentRevisionMeta(input.title),
      ]);

      // Extract just the <body> content from the full Parsoid HTML document
      const bodyMatch = article.html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1]! : article.html;

      return {
        html: bodyHtml,
        title: article.title,
        revid: revMeta?.revid ?? null,
        timestamp: revMeta?.timestamp ?? null,
      };
    }),

  /**
   * Get article intro with redirect resolution — for link preview tooltips.
   * Resolves redirects server-side so tooltips never show "#REDIRECT".
   */
  getIntroResolved: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const resolvedTitle = await resolveRedirect(input.title);
      const article = await getArticleWikitext(resolvedTitle, "ixwiki");
      if (!article) return { title: resolvedTitle, text: "", redirectedFrom: null };

      // Extract first paragraph (intro)
      const wikitext = article.wikitext;
      const headingIdx = wikitext.search(/^==[^=]/m);
      const introRaw =
        headingIdx > 0 ? wikitext.substring(0, headingIdx) : wikitext.substring(0, 500);

      // Clean wiki markup from the intro
      const intro = introRaw
        .replace(/\{\{[^}]*\}\}/g, "") // templates
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1") // links
        .replace(/'''([^']+)'''/g, "$1") // bold
        .replace(/''([^']+)''/g, "$1") // italic
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "") // refs
        .replace(/<[^>]+>/g, "") // HTML tags
        .replace(/\n{2,}/g, " ")
        .trim();

      return {
        title: resolvedTitle,
        text: intro.substring(0, 400),
        redirectedFrom: resolvedTitle !== input.title ? input.title : null,
      };
    }),

  /**
   * Get article sections (table of contents).
   */
  getSections: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      return getPageSections(input.title, "ixwiki");
    }),

  /**
   * Search articles by title prefix.
   * Supports multi-wiki search: specify a single source or "all" to query
   * ixwiki, iiwiki, and althistory in parallel.
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory", "all"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { query, limit, wikiSource } = input;

      if (wikiSource !== "all") {
        const results = await searchPages(query, limit, wikiSource as WikiSource);
        return results.map((r) => ({
          ...r,
          source: wikiSource as "ixwiki" | "iiwiki" | "althistory",
        }));
      }

      // Query all 3 wikis in parallel
      const sources: WikiSource[] = ["ixwiki", "iiwiki", "althistory"];
      const settled = await Promise.allSettled(
        sources.map((src) => searchPages(query, limit, src))
      );

      const merged: Array<{
        title: string;
        pageId: number;
        length: number;
        source: "ixwiki" | "iiwiki" | "althistory";
      }> = [];
      for (let i = 0; i < sources.length; i++) {
        const result = settled[i]!;
        if (result.status === "fulfilled") {
          for (const r of result.value) {
            merged.push({ ...r, source: sources[i]! });
          }
        }
      }

      return merged;
    }),

  /**
   * Get recent changes for the Recent Changes special page.
   */
  getRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      return getRecentChanges(input.limit);
    }),

  /**
   * Get a random article title.
   */
  getRandomPage: publicProcedure.query(async () => {
    // Direct MySQL — ~10ms vs ~200ms via API
    const title = await getRandomPage();
    return { title };
  }),

  /**
   * Get site statistics (total articles, edits, active users).
   */
  getSiteStats: publicProcedure.query(async () => {
    // Direct MySQL — ~5ms vs ~200ms via API
    return getSiteStats();
  }),

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Get revision history for a page.
   */
  getHistory: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~40ms vs ~400ms via API
      const result = await getPageHistory(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined
      );
      return {
        revisions: result.revisions,
        continueToken:
          result.hasMore && result.revisions.length > 0
            ? String(result.revisions[result.revisions.length - 1]!.revid)
            : null,
      };
    }),

  /**
   * Get a visual diff between two revisions.
   */
  getDiff: publicProcedure
    .input(
      z.object({
        fromrev: z.number(),
        torev: z.number(),
      })
    )
    .query(async ({ input }) => {
      // Node.js diff engine — ~50ms vs ~500ms via API
      // Fetch both revisions' wikitext via direct MySQL
      const [fromData, toData] = await Promise.all([
        getRevisionWikitext(input.fromrev),
        getRevisionWikitext(input.torev),
      ]);

      if (!fromData || !toData) throw new Error("One or both revisions not found");

      // Compute diff using Node.js engine
      const diffHtml = computeWikitextDiff(fromData.wikitext, toData.wikitext);

      // Get revision metadata (user, comment) from page history
      const pageTitle = toData.title;
      const history = await getPageHistory(pageTitle, 100);
      const fromRev = history.revisions.find((r) => r.revid === input.fromrev);
      const toRev = history.revisions.find((r) => r.revid === input.torev);

      return {
        diffHtml,
        from: {
          revid: input.fromrev,
          user: fromRev?.user ?? "",
          timestamp: fromData.timestamp,
          comment: fromRev?.comment ?? "",
        },
        to: {
          revid: input.torev,
          user: toRev?.user ?? "",
          timestamp: toData.timestamp,
          comment: toRev?.comment ?? "",
        },
      };
    }),

  /**
   * Get pages that link to the given page (backlinks / "What Links Here").
   */
  getBacklinks: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~30ms vs ~400ms via API
      const result = await getBacklinks(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined
      );
      return {
        links: result.links,
        continueToken:
          result.hasMore && result.links.length > 0
            ? String(result.links.length) // Use count as offset marker
            : null,
      };
    }),

  /**
   * Get members of a category.
   */
  getCategoryMembers: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
        type: z.enum(["page", "subcat", "file"]).optional(),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~30ms vs ~400ms via API
      const result = await getCategoryMembers(input.category, input.limit, input.type);
      return {
        members: result.members,
        continueToken: result.hasMore ? "more" : null,
      };
    }),

  /**
   * Get user contributions.
   */
  getUserContribs: publicProcedure
    .input(
      z.object({
        user: z.string().min(1).max(200),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~40ms vs ~400ms via API
      const result = await getUserContribs(
        input.user,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined
      );
      return {
        contribs: result.contribs,
        continueToken:
          result.hasMore && result.contribs.length > 0
            ? String(result.contribs[result.contribs.length - 1]!.revid)
            : null,
      };
    }),

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

  /**
   * Preview wikitext by converting it to HTML via Parsoid.
   */
  previewWikitext: publicProcedure
    .input(
      z.object({
        wikitext: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const html = await wikitextToHtml(input.wikitext, input.title);
      return { html: transformWikiLinks(html) };
    }),

  /**
   * Convert wikitext directly to editor-ready Parsoid HTML.
   */
  convertWikitextToHtml: protectedProcedure
    .input(
      z.object({
        wikitext: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const html = await wikitextToHtml(input.wikitext, input.title);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1]! : html;
      return { html: bodyHtml };
    }),

  /**
   * Convert HTML (from PlateJS editor) back to wikitext via Parsoid.
   */
  htmlToWikitext: protectedProcedure
    .input(
      z.object({
        html: z.string(),
        title: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      const result = await htmlToWikitext(input.html, input.title);
      return { wikitext: result.wikitext };
    }),

  /**
   * Save an article edit via MediaWiki Action API.
   * Converts HTML to wikitext first, then saves.
   */
  saveArticle: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        html: z.string(),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cleanedHtml = cleanHtmlForParsoid(input.html);
      const { wikitext } = await htmlToWikitext(cleanedHtml, input.title);
      return saveToMediaWiki(
        input.title,
        wikitext,
        input.summary,
        input.minor,
        ctx,
        input.basetimestamp
      );
    }),

  /**
   * Save wikitext directly (from source editor).
   */
  saveWikitext: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wikitext: z.string(),
        summary: z.string().max(500).default(""),
        minor: z.boolean().default(false),
        basetimestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return saveToMediaWiki(
        input.title,
        input.wikitext,
        input.summary,
        input.minor,
        ctx,
        input.basetimestamp
      );
    }),

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

  /** Get all stashes for the current user with item counts. */
  getStashes: protectedProcedure.query(async ({ ctx }) => {
    const stashes = await db.loreStash.findMany({
      where: { userId: ctx.auth.userId },
      orderBy: { order: "asc" },
      include: { _count: { select: { items: true } } },
    });
    return stashes.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      icon: s.icon,
      isDefault: s.isDefault,
      order: s.order,
      itemCount: (s as unknown as { _count?: { items?: number } })._count?.items ?? 0,
    }));
  }),

  /** Get or auto-create the user's default stash. */
  getDefaultStash: protectedProcedure.query(async ({ ctx }) => {
    let stash = await db.loreStash.findFirst({
      where: { userId: ctx.auth.userId, isDefault: true },
    });
    if (!stash) {
      stash = await db.loreStash.create({
        data: { userId: ctx.auth.userId, name: "My Stash", color: "#3b82f6", isDefault: true },
      });
    }
    return { id: stash.id, name: stash.name, color: stash.color };
  }),

  /** Create a new stash. Max 25 per user. */
  createStash: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().max(20),
        icon: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.loreStash.findMany({
        where: { userId: ctx.auth.userId },
        select: { id: true },
      });
      if (existing.length >= 25) throw new Error("Maximum of 25 stashes allowed");
      return db.loreStash.create({
        data: {
          userId: ctx.auth.userId,
          name: input.name,
          color: input.color,
          icon: input.icon,
          order: existing.length,
        },
      });
    }),

  /** Update a stash's name, color, or icon. */
  updateStash: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().max(20).optional(),
        icon: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.loreStash.update({
        where: { id: input.id, userId: ctx.auth.userId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.color && { color: input.color }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });
    }),

  /** Delete a stash (cannot delete default). */
  deleteStash: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const stash = await db.loreStash.findUnique({ where: { id: input.id } });
      if (!stash || stash.userId !== ctx.auth.userId) throw new Error("Stash not found");
      if (stash.isDefault) throw new Error("Cannot delete default stash");
      await db.loreStash.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Reorder stashes. */
  reorderStashes: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      await Promise.all(
        input.ids.map((id, idx) =>
          db.loreStash.updateMany({ where: { id, userId: ctx.auth.userId }, data: { order: idx } })
        )
      );
      return { success: true };
    }),

  /** One-click stash a page (saves to default stash if no stashId). */
  stashPage: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), stashId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      let stashId = input.stashId;
      if (!stashId) {
        let defaultStash = await db.loreStash.findFirst({
          where: { userId: ctx.auth.userId, isDefault: true },
        });
        if (!defaultStash) {
          defaultStash = await db.loreStash.create({
            data: { userId: ctx.auth.userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        stashId = defaultStash.id;
      }
      const pageSlug = encodeURIComponent(input.pageTitle.replace(/ /g, "_"));
      await db.loreStashItem.upsert({
        where: { stashId_pageTitle: { stashId, pageTitle: input.pageTitle } },
        create: { stashId, pageTitle: input.pageTitle, pageSlug },
        update: {},
      });
      return { success: true, stashId };
    }),

  /** Remove a page from a stash (or all stashes if no stashId). */
  unstashPage: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500), stashId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (input.stashId) {
        await db.loreStashItem.deleteMany({
          where: {
            stashId: input.stashId,
            pageTitle: input.pageTitle,
            stash: { userId: ctx.auth.userId },
          },
        });
      } else {
        // Remove from all user's stashes
        const stashIds = (
          await db.loreStash.findMany({ where: { userId: ctx.auth.userId }, select: { id: true } })
        ).map((s) => s.id);
        if (stashIds.length > 0) {
          await db.loreStashItem.deleteMany({
            where: { stashId: { in: stashIds }, pageTitle: input.pageTitle },
          });
        }
      }
      return { success: true };
    }),

  /** Check if a page is stashed (and in which stashes). Powers the button color. */
  isStashed: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const items = await db.loreStashItem.findMany({
        where: { pageTitle: input.pageTitle, stash: { userId: ctx.auth.userId } },
        include: { stash: { select: { id: true, color: true, name: true } } },
      });
      return {
        stashed: items.length > 0,
        stashes: items.map((i) => ({ id: i.stash.id, color: i.stash.color, name: i.stash.name })),
      };
    }),

  /** Get paginated items in a stash. */
  getStashItems: protectedProcedure
    .input(
      z.object({
        stashId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const items = await db.loreStashItem.findMany({
        where: { stashId: input.stashId, stash: { userId: ctx.auth.userId } },
        orderBy: { savedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: { _count: { select: { annotations: true } } },
      });
      const hasMore = items.length > input.limit;
      const results = hasMore ? items.slice(0, -1) : items;
      return {
        items: results.map((i) => ({
          id: i.id,
          pageTitle: i.pageTitle,
          pageSlug: i.pageSlug,
          note: i.note,
          annotationCount:
            (i as unknown as { _count?: { annotations?: number } })._count?.annotations ?? 0,
          savedAt: i.savedAt.toISOString(),
        })),
        nextCursor: hasMore ? results[results.length - 1]?.id : null,
      };
    }),

  /** Move an item to a different stash. */
  moveItem: protectedProcedure
    .input(z.object({ itemId: z.string(), toStashId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) throw new Error("Item not found");
      return db.loreStashItem.update({
        where: { id: input.itemId },
        data: { stashId: input.toStashId },
      });
    }),

  /** Update a stash item's note (rich text). */
  updateItemNote: protectedProcedure
    .input(z.object({ itemId: z.string(), note: z.string().max(50000) }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) throw new Error("Item not found");
      return db.loreStashItem.update({ where: { id: input.itemId }, data: { note: input.note } });
    }),

  // ---------------------------------------------------------------------------
  // Annotations
  // ---------------------------------------------------------------------------

  /** Add a text-selection annotation to a stashed page. */
  addAnnotation: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        anchorSelector: z.string().max(500),
        anchorOffset: z.number(),
        focusSelector: z.string().max(500),
        focusOffset: z.number(),
        selectedText: z.string().max(2000),
        comment: z.string().max(5000).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.loreStashItem.findUnique({
        where: { id: input.itemId },
        include: { stash: true },
      });
      if (!item || item.stash.userId !== ctx.auth.userId) throw new Error("Item not found");
      return db.loreStashAnnotation.create({ data: input });
    }),

  /** Update an annotation's comment or color. */
  updateAnnotation: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        comment: z.string().max(5000).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ann = await db.loreStashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== ctx.auth.userId)
        throw new Error("Annotation not found");
      return db.loreStashAnnotation.update({
        where: { id: input.id },
        data: {
          ...(input.comment !== undefined && { comment: input.comment }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  /** Delete an annotation. */
  deleteAnnotation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ann = await db.loreStashAnnotation.findUnique({
        where: { id: input.id },
        include: { item: { include: { stash: true } } },
      });
      if (!ann || ann.item.stash.userId !== ctx.auth.userId)
        throw new Error("Annotation not found");
      await db.loreStashAnnotation.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Get all annotations for a page (across all user's stashes). */
  getAnnotations: protectedProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const annotations = await db.loreStashAnnotation.findMany({
        where: { item: { pageTitle: input.pageTitle, stash: { userId: ctx.auth.userId } } },
        orderBy: { createdAt: "asc" },
      });
      return annotations.map((a) => ({
        id: a.id,
        anchorSelector: a.anchorSelector,
        anchorOffset: a.anchorOffset,
        focusSelector: a.focusSelector,
        focusOffset: a.focusOffset,
        selectedText: a.selectedText,
        comment: a.comment,
        color: a.color,
      }));
    }),

  // ---------------------------------------------------------------------------
  // User Info (for WikiOS profiles)
  // ---------------------------------------------------------------------------

  /** Get MediaWiki user info: edit count, registration date, groups. */
  getUserInfo: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      // Direct MySQL — ~20ms vs ~300ms via API
      return getUserInfo(input.username);
    }),

  // ---------------------------------------------------------------------------
  // Rollback / Undo endpoints
  // ---------------------------------------------------------------------------

  /**
   * Get the wikitext of a specific revision (for undo preview).
   */
  getRevisionContent: publicProcedure
    .input(z.object({ revid: z.number() }))
    .query(async ({ input }) => {
      const result = await getRevisionWikitext(input.revid);
      if (!result) throw new Error("Revision not found");
      return result;
    }),

  /**
   * Revert a page to a specific revision.
   * Fetches the old revision's wikitext and saves it as a new edit.
   */
  revertToRevision: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        revid: z.number(),
        summary: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const oldRev = await getRevisionWikitext(input.revid);
      if (!oldRev) throw new Error("Target revision not found");

      const summary = input.summary ?? `Reverted to revision ${input.revid}`;
      return saveToMediaWiki(input.title, oldRev.wikitext, summary, false, ctx);
    }),

  /**
   * Quick rollback: revert all consecutive edits by the last editor.
   * Finds the most recent revision by a different user and reverts to it.
   */
  rollback: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      // Direct MySQL — uses wiki-bridge getPageHistory instead of API
      const history = await getPageHistory(input.title, 50);
      const revisions = history.revisions;
      if (revisions.length < 2) throw new Error("Not enough revisions to rollback");

      const lastEditor = revisions[0]!.user;
      const targetRev = revisions.find((r) => r.user !== lastEditor);
      if (!targetRev) throw new Error("All revisions are by the same user");

      const oldContent = await getRevisionWikitext(targetRev.revid);
      if (!oldContent) throw new Error("Could not fetch target revision content");

      const summary = `Rolled back edits by ${lastEditor} to revision ${targetRev.revid}`;
      return saveToMediaWiki(input.title, oldContent.wikitext, summary, false, ctx);
    }),

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  /**
   * Get the rendered talk page for an article.
   * Talk pages live in namespace 1 (Talk:) in MediaWiki.
   */
  getTalkPage: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;
      try {
        const article = await getArticleHtml(talkTitle);
        const transformed = transformArticleHtml(stripConflictingStyles(article.html), "");
        return {
          exists: true,
          contentHtml: transformed.contentHtml,
          toc: transformed.toc,
          title: talkTitle,
          lastModified: article.lastModified,
        };
      } catch {
        return {
          exists: false,
          contentHtml: "",
          toc: [],
          title: talkTitle,
          lastModified: null,
        };
      }
    }),

  /**
   * Add a new discussion section to a talk page.
   * Uses MediaWiki's section=new API which appends without edit conflicts.
   */
  addTalkSection: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        sectionTitle: z.string().min(1).max(500),
        content: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
      const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;
      // Sign the content with ~~~~ (MediaWiki auto-replaces with username + timestamp)
      const signedContent = `${input.content}\n\n~~~~`;

      const editParams = new URLSearchParams({
        action: "edit",
        title: talkTitle,
        section: "new",
        sectiontitle: input.sectionTitle,
        text: signedContent,
        summary: `/* ${input.sectionTitle} */ new section (via WikiOS)`,
        token: csrfToken,
        format: "json",
      });

      const editRes = await fetch(apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookies.join("; "),
        },
        body: editParams.toString(),
      });

      const editData = (await editRes.json()) as {
        edit?: { result: string; newrevid?: number };
        error?: { code: string; info: string };
      };

      if (editData.error) throw new Error(`Talk page edit failed: ${editData.error.info}`);
      return {
        success: editData.edit?.result === "Success",
        revisionId: editData.edit?.newrevid ?? null,
      };
    }),

  /**
   * Reply to an existing talk page section.
   * Appends content to the specified section number.
   */
  replyToTalkSection: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        sectionIndex: z.number().min(0),
        content: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;

      // Get current section content
      const sectionRes = await fetch(
        `${apiBase}?action=parse&page=${encodeURIComponent(talkTitle)}&prop=wikitext&section=${input.sectionIndex}&formatversion=2&format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      const sectionData = (await sectionRes.json()) as {
        parse?: { wikitext?: string };
        error?: { code: string; info: string };
      };

      if (sectionData.error) throw new Error(`Failed to fetch section: ${sectionData.error.info}`);
      const currentText = sectionData.parse?.wikitext ?? "";

      const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      const signedContent = `${input.content}\n\n~~~~`;
      const newText = `${currentText.trimEnd()}\n\n${signedContent}`;

      const editParams = new URLSearchParams({
        action: "edit",
        title: talkTitle,
        section: String(input.sectionIndex),
        text: newText,
        summary: `Reply (via WikiOS by ${ctx.user?.wikiUsername ?? ctx.auth?.userId ?? "anonymous"})`,
        token: csrfToken,
        format: "json",
      });

      const editRes = await fetch(apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookies.join("; "),
        },
        body: editParams.toString(),
      });

      const editData = (await editRes.json()) as {
        edit?: { result: string; newrevid?: number };
        error?: { code: string; info: string };
      };

      if (editData.error) throw new Error(`Reply failed: ${editData.error.info}`);
      return {
        success: editData.edit?.result === "Success",
        revisionId: editData.edit?.newrevid ?? null,
      };
    }),

  /**
   * Get talk page sections (for reply targeting).
   */
  getTalkSections: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      // Direct MySQL + regex — parses wikitext headings directly
      const talkTitle = input.title.startsWith("Talk:") ? input.title.slice(5) : input.title;
      const article = await getNamespacedWikitext(talkTitle, 1);
      if (!article) return { sections: [] };

      const sections: Array<{ level: number; title: string; index: number; number: string }> = [];
      const headingRegex = /^(={2,6})\s*(.+?)\s*\1$/gm;
      let match;
      let idx = 1;
      while ((match = headingRegex.exec(article.wikitext)) !== null) {
        sections.push({
          level: match[1]!.length,
          title: match[2]!.trim(),
          index: idx,
          number: String(idx),
        });
        idx++;
      }
      return { sections };
    }),

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

  /**
   * Upload a file to MediaWiki.
   * Accepts base64-encoded file data with metadata.
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(500),
        fileBase64: z.string(),
        description: z.string().max(10000).default(""),
        comment: z.string().max(500).default("Uploaded via WikiOS"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

      // Validate file size (10MB max)
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit");
      }

      const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      // Build multipart form data
      const formData = new FormData();
      formData.append("action", "upload");
      formData.append("filename", input.filename);
      formData.append(
        "comment",
        `${input.comment} (via WikiOS by ${ctx.user?.wikiUsername ?? ctx.auth?.userId ?? "anonymous"})`
      );
      formData.append("text", input.description);
      formData.append("token", csrfToken);
      formData.append("format", "json");
      formData.append("ignorewarnings", "1");
      formData.append("file", new Blob([fileBuffer]), input.filename);

      const uploadRes = await fetch(apiBase, {
        method: "POST",
        headers: {
          Cookie: cookies.join("; "),
        },
        body: formData,
      });

      const uploadData = (await uploadRes.json()) as {
        upload?: {
          result: string;
          filename?: string;
          imageinfo?: { url?: string; descriptionurl?: string };
        };
        error?: { code: string; info: string };
      };

      if (uploadData.error) throw new Error(`Upload failed: ${uploadData.error.info}`);

      return {
        success: uploadData.upload?.result === "Success",
        filename: uploadData.upload?.filename ?? input.filename,
        url: uploadData.upload?.imageinfo?.url ?? null,
        descriptionUrl: uploadData.upload?.imageinfo?.descriptionurl ?? null,
      };
    }),

  // ---------------------------------------------------------------------------
  // Page Properties & Protection (direct MySQL)
  // ---------------------------------------------------------------------------

  /** Get page properties (displaytitle, defaultsort, page_image, etc.) */
  getPageProps: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.title, "ixwiki");
      if (!article) return { props: {} };
      return { props: await getPageProps(article.pageId) };
    }),

  /** Get page protection status (edit/move restrictions). */
  getPageProtection: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      return { restrictions: await getPageProtection(input.title) };
    }),

  /** Get page action log (moves, deletes, protections). */
  getPageLog: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      return { entries: await getPageLog(input.title, input.limit) };
    }),

  // ---------------------------------------------------------------------------
  // Advanced Search (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Full-text search with faceted filtering — namespace, snippets, highlights.
   */
  advancedSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
        namespace: z.number().optional(),
        sort: z.enum(["relevance", "timestamp"]).default("relevance"),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL FULLTEXT search — ~100ms vs ~500ms via API
      const result = await fullTextSearch(input.query, input.limit, input.offset, input.namespace);
      return {
        results: result.results.map((r) => ({
          title: r.title,
          namespace: r.namespace,
          snippet: r.snippet,
          titleSnippet: null,
          sectionSnippet: null,
          categorySnippet: null,
          size: r.size,
          wordCount: r.wordCount,
          timestamp: r.timestamp,
        })),
        totalHits: result.totalHits,
        hasMore: result.results.length >= input.limit,
      };
    }),

  // ---------------------------------------------------------------------------
  // Category Tree (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Get parent categories for a page (for breadcrumb navigation).
   */
  getParentCategories: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      // Direct MySQL — ~20ms vs ~400ms via API
      const categories = await getParentCategoriesMySQL(input.title);
      return { categories };
    }),

  /**
   * Get category tree — subcategories and pages with counts.
   * Supports lazy loading via depth parameter.
   */
  getCategoryTree: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        depth: z.number().min(1).max(3).default(1),
      })
    )
    .query(async ({ input }) => {
      // Direct MySQL — ~50ms vs ~1500ms via API (eliminates 2-3 API calls)
      const info = await getCategoryInfo(input.category);

      let children: Array<{
        title: string;
        fullTitle: string;
        subcategories?: Array<{ title: string; fullTitle: string }>;
      }> = info.subcategories;

      // Depth > 1: fetch one more level for each subcategory
      if (input.depth > 1 && info.subcategories.length > 0 && info.subcategories.length <= 20) {
        children = await Promise.all(
          info.subcategories.map(async (sc) => {
            try {
              const childInfo = await getCategoryInfo(sc.fullTitle);
              return { ...sc, subcategories: childInfo.subcategories };
            } catch {
              return sc;
            }
          })
        );
      }

      return {
        title: info.title,
        totalPages: info.totalPages,
        totalSubcats: info.totalSubcats,
        totalFiles: info.totalFiles,
        subcategories: children,
      };
    }),

  // ---------------------------------------------------------------------------
  // Watchlist endpoints (backed by the LoreStash "Watchlist" stash)
  // ---------------------------------------------------------------------------

  /**
   * Add a page to the user's watchlist stash.
   */
  watchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      // Find or create the "Watchlist" stash
      let watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) {
        watchlistStash = await ctx.db.loreStash.create({
          data: { userId, name: "Watchlist", color: "#f59e0b", icon: "eye", isDefault: false },
        });
      }
      // Add page (upsert to avoid duplicates)
      await ctx.db.loreStashItem.upsert({
        where: { stashId_pageTitle: { stashId: watchlistStash.id, pageTitle: input.pageTitle } },
        create: {
          stashId: watchlistStash.id,
          pageTitle: input.pageTitle,
          pageSlug: input.pageTitle.replace(/ /g, "_"),
        },
        update: {},
      });
      return { success: true };
    }),

  /**
   * Remove a page from the user's watchlist stash.
   */
  unwatchPage: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return { success: true };
      await ctx.db.loreStashItem.deleteMany({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return { success: true };
    }),

  /**
   * Get the user's full watchlist (most recently saved first, max 100).
   */
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const watchlistStash = await ctx.db.loreStash.findFirst({
      where: { userId, name: "Watchlist" },
      include: { items: { orderBy: { savedAt: "desc" }, take: 100 } },
    });
    return watchlistStash?.items ?? [];
  }),

  /**
   * Check whether a page is on the user's watchlist.
   */
  isPageWatched: protectedProcedure
    .input(z.object({ pageTitle: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const watchlistStash = await ctx.db.loreStash.findFirst({
        where: { userId, name: "Watchlist" },
      });
      if (!watchlistStash) return false;
      const item = await ctx.db.loreStashItem.findFirst({
        where: { stashId: watchlistStash.id, pageTitle: input.pageTitle },
      });
      return !!item;
    }),
});

// ---------------------------------------------------------------------------
// Shared helper: save wikitext to MediaWiki via Action API
// ---------------------------------------------------------------------------

/**
 * Resolve a page title through redirects via direct MySQL.
 */
async function resolveRedirect(title: string): Promise<string> {
  return resolveRedirectMySQL(title);
}

async function saveToMediaWiki(
  title: string,
  wikitext: string,
  summary: string,
  minor: boolean,
  ctx: any,
  basetimestamp?: string,
  isTemplateSync = false
): Promise<{ success: boolean; revisionId: number | null; editConflict?: boolean }> {
  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";

  // Get session cookies and CSRF token from the user context
  const { cookies, csrfToken } = await getUserSessionAndToken(ctx);

  // Edit
  const editParams = new URLSearchParams({
    action: "edit",
    title,
    text: wikitext,
    summary: `${summary} (via WikiOS by ${ctx.user?.wikiUsername ?? ctx.auth?.userId ?? "anonymous"})`,
    token: csrfToken,
    format: "json",
  });
  if (minor) editParams.set("minor", "1");
  if (basetimestamp) {
    editParams.set("basetimestamp", basetimestamp);
    editParams.set("starttimestamp", new Date().toISOString());
  }

  const editRes = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: editParams.toString(),
  });

  const editData = (await editRes.json()) as {
    edit?: { result: string; newrevid?: number };
    error?: { code: string; info: string };
  };

  if (editData.error) {
    if (editData.error.code === "editconflict") {
      return { success: false, revisionId: null, editConflict: true };
    }
    if (editData.error.code === "badtoken") {
      invalidateCsrfToken();
    }
    throw new Error(`MediaWiki edit failed: ${editData.error.info}`);
  }

  invalidateCache(title);

  // Notify stash owners about the edit (non-blocking)
  notifyStashOwners(title, ctx.auth?.userId, editData.edit?.newrevid ?? null).catch(
    (err: unknown) => {
      console.error("[WikiOS] Background op failed:", (err as Error).message);
    }
  );

  // Trigger template sync if this is a user edit, not a template sync itself
  if (!isTemplateSync && editData.edit?.result === "Success") {
    syncCustomTemplates(wikitext, ctx).catch((err) => {
      console.error("[WikiOS] Background template sync failed:", err);
    });
  }

  return {
    success: editData.edit?.result === "Success",
    revisionId: editData.edit?.newrevid ?? null,
  };
}

/**
 * Get the wikitext content of a specific revision by ID via direct MySQL.
 */
async function getRevisionWikitext(revid: number) {
  return getRevisionWikitextMySQL(revid);
}

/**
 * Get the current revision metadata (revid + timestamp) via direct MySQL.
 */
async function getCurrentRevisionMeta(title: string) {
  return getCurrentRevMeta(title);
}

/**
 * Notify users who have stashed a page that it was edited.
 * Non-blocking — fires and forgets.
 */
async function notifyStashOwners(
  pageTitle: string,
  editorUserId: string | null | undefined,
  revisionId: number | null
): Promise<void> {
  const stashItems = await db.loreStashItem.findMany({
    where: { pageTitle },
    include: { stash: { select: { userId: true } } },
  });

  // Deduplicate user IDs and exclude the editor
  const userIds = [...new Set(stashItems.map((i) => i.stash.userId))].filter(
    (uid) => uid !== editorUserId
  );

  if (userIds.length === 0) return;

  const pageSlug = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  const href = revisionId
    ? `/w/special/diff?from=${revisionId - 1}&to=${revisionId}`
    : `/w/${pageSlug}`;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: `"${pageTitle}" was edited`,
      description: `A page in your stash was updated.`,
      type: "wiki_edit",
      category: "wiki",
      href,
      metadata: JSON.stringify({ pageTitle, revisionId }),
    })),
  });
}

/**
 * Background worker to parse templates in saved wikitext,
 * resolve their current DB values, and update corresponding
 * Template: pages on headless MediaWiki so they render correctly on traditional pages.
 */
async function syncCustomTemplates(wikitext: string, ctx: any): Promise<void> {
  // 1. Extract all MyCountry:, CountryData:, and BusinessData: templates
  const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi;
  const placeholders = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(wikitext)) !== null) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }

  if (placeholders.size === 0) return;

  const keys = Array.from(placeholders);
  console.log(`[WikiOS] Syncing ${keys.length} custom templates:`, keys);

  // 2. Resolve the dynamic database values
  let activeCountryId: string | undefined;
  if (ctx.auth?.userId) {
    const user = await ctx.db.user.findFirst({
      where: { clerkUserId: ctx.auth.userId },
      select: { countryId: true },
    });
    if (user?.countryId) {
      activeCountryId = user.countryId;
    }
  }

  const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, activeCountryId);

  // 3. For each template, save its resolved HTML template tag to MediaWiki
  for (const key of keys) {
    const data = resolved[key];
    const valStr = data ? data.value : "N/A";

    // Normalize template key for page title (MediaWiki converts spaces to underscores)
    const normalizedKey = key.replace(/ /g, "_");
    const templateTitle = `Template:${normalizedKey}`;

    // Template wikitext: static span element that traditional MediaWiki renders.
    const templateWikitext = `<span class="wikios-stat-placeholder" data-key="${normalizedKey}">${valStr}</span>`;

    try {
      // Fetch the current template content if it exists, to avoid redundant writes
      let currentContent = "";
      try {
        const article = await getArticleWikitext(templateTitle, "ixwiki");
        if (article) {
          currentContent = article.wikitext;
        }
      } catch (_err) {
        // template does not exist
      }

      if (currentContent.trim() !== templateWikitext.trim()) {
        console.log(`[WikiOS] Updating template ${templateTitle} -> "${valStr}"`);
        await saveToMediaWiki(
          templateTitle,
          templateWikitext,
          "Update dynamic stat template value",
          true, // minor
          ctx,
          undefined, // no basetimestamp
          true // isTemplateSync = true (prevents recursion!)
        );
      }
    } catch (err: any) {
      console.error(`[WikiOS] Failed to sync template ${templateTitle}:`, err.message);
    }
  }
}

/**
 * Clean up visual editor HTML before passing to Parsoid for wikitext transformation.
 * Strips formatting emoji and temporary visual decoration from custom chips.
 */
function cleanHtmlForParsoid(html: string): string {
  let cleaned = html;

  // Clean Coords anchors: remove emoji and wrapper spans, restore standard link format
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*Coords[^"]*)"[^>]*>(?:<span[^>]*>📍<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/📍/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );

  // Clean MapEmbed anchors: remove emoji and wrapper spans
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*MapEmbed[^"]*)"[^>]*>(?:<span[^>]*>🗺️<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/🗺️/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );

  return cleaned;
}
