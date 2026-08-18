/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */ import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { getArticleHtml, getArticleHtmlViaParsoid } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  getPageSections,
  getPageHistory,
  resolveRedirect as resolveRedirectMySQL,
  getCurrentRevMeta,
  getPageProps,
  getPageProtection,
  getPageLog,
} from "~/lib/wiki/bridge";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/html-transformer";
import {
  extractTemplateKeys,
  resolveTemplates,
  applyResolvedTemplates,
} from "~/lib/wiki-os/template-resolver";
import { computeWikitextDiff } from "~/lib/wiki-os/wikitext-diff";
import {
  getArticleWikitextShadow,
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
} from "~/lib/wiki-os/article-store";

import { db } from "~/server/db";

export const wikiosPageContentRouter = createTRPCRouter({
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
        const myCountryId = await resolveActiveCountryId(ctx);
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
      // Read-through the Postgres shadow store (resilient to MediaWiki downtime).
      const result = await getArticleWikitextShadow(input.title, "ixwiki");
      return {
        wikitext: result?.wikitext ?? "",
        revid: result?.revid ?? null,
        timestamp: result?.timestamp ?? null,
      };
    }),

  /**
   * Check if a page exists in local DB or MediaWiki.
   */
  checkPageExists: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const resolvedTitle = await resolveRedirectMySQL(input.title);
      const article = await getArticleWikitext(resolvedTitle, "ixwiki");
      return { exists: !!article, resolvedTitle };
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
      try {
        const [article, revMeta] = await Promise.all([
          getArticleHtmlViaParsoid(input.title),
          getCurrentRevMeta(input.title),
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
      } catch (err: any) {
        if (err.message?.includes("returned 404") || err.message?.includes("404")) {
          return {
            html: "",
            title: input.title,
            revid: null,
            timestamp: null,
          };
        }
        throw err;
      }
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
      // Read-through: serve local revisions from Postgres (resilient to MediaWiki
      // downtime), falling back to direct MySQL. Paginated requests (offset) go
      // straight to MySQL — local history is first-page/recent only.
      const result = input.offset
        ? await getPageHistory(input.title, input.limit, parseInt(input.offset, 10))
        : await getArticleHistoryShadow(input.title, input.limit, "ixwiki");
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
        getRevisionWikitextShadow(input.fromrev, "ixwiki"),
        getRevisionWikitextShadow(input.torev, "ixwiki"),
      ]);

      if (!fromData || !toData) throw new Error("One or both revisions not found");

      // Compute diff using Node.js engine
      const diffHtml = computeWikitextDiff(fromData.wikitext, toData.wikitext);

      // Get revision metadata (user, comment) from page history
      const pageTitle = toData.title;
      const history = await getArticleHistoryShadow(pageTitle, 100, "ixwiki");
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

  // ---------------------------------------------------------------------------
  // Editor endpoints (Phase 2)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Template Registry (Phase 1)
  // ---------------------------------------------------------------------------

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

  /**
   * Get the wikitext of a specific revision (for undo preview).
   */
  getRevisionContent: publicProcedure
    .input(z.object({ revid: z.number() }))
    .query(async ({ input }) => {
      const result = await getRevisionWikitextShadow(input.revid, "ixwiki");
      if (!result) throw new Error("Revision not found");
      return result;
    }),

  // ---------------------------------------------------------------------------
  // Talk / Discussion Pages
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Category Tree (Phase 1)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Watchlist endpoints (backed by the LoreStash "Watchlist" stash)
  // ---------------------------------------------------------------------------
});

/**
 * Resolve a page title through redirects via direct MySQL.
 */
async function resolveRedirect(title: string): Promise<string> {
  return resolveRedirectMySQL(title);
}
