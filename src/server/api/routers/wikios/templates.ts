/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  resolveRedirect as resolveRedirectMySQL,
  getRevisionWikitext as getRevisionWikitextMySQL,
  getCurrentRevMeta,
  searchTemplates as searchTemplatesDB,
} from "~/lib/wiki-bridge";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";
import {
  fetchTemplateData,
  getTemplatePreview as renderTemplatePreview,
  categorizeTemplate,
} from "~/lib/wiki-os/template-registry";
import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "../wiki";

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
    ? `/wiki/diff?from=${revisionId - 1}&to=${revisionId}`
    : `/wiki/${pageSlug}`;

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
