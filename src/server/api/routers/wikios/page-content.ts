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
  resolveRedirect,
  getCurrentRevMeta,
  getPageProps,
  getPageProtection,
  getPageLog,
} from "~/lib/wiki-os/bridge";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/html-transformer";
import {
  extractTemplateKeys,
  resolveTemplates,
  applyResolvedTemplates,
  registerTemplateProvider,
  type ResolvedTemplate,
} from "~/lib/wiki-os/template-resolver";
import { ixstatsTemplateProvider } from "~/server/shared/ixstats-template-provider";
import { computeWikitextDiff } from "~/lib/wiki-os/wikitext-diff";
import {
  getArticleWikitextShadow,
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
  saveArticleHtmlShadow,
  getArticleHtmlShadow,
} from "~/lib/wiki-os/article-store";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/search-service";
import { resolveWikiPlaceholdersInternal } from "~/server/shared/wiki-placeholders";

import { db } from "~/server/db";

// Register host-app template data provider
registerTemplateProvider(ixstatsTemplateProvider);

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
      let resolvedMap: Map<string, ResolvedTemplate> | undefined;
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

      // Phase 8: Backfill HTML shadow cache in background
      void saveArticleHtmlShadow(resolvedTitle, contentHtml, "ixwiki");

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
      const resolvedTitle = await resolveRedirect(input.title);
      const article = await getArticleWikitextShadow(resolvedTitle, "ixwiki");
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
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("404")) {
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
   * Get fast article intro/summary (plain text) for preview cards and tooltips.
   * Serves from PostgreSQL shadow store in <3ms.
   */
  getArticleSummary: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        source: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const summary = await getArticleSummaryFromShadow(input.title, input.source);
      return {
        title: summary.title,
        intro: summary.intro,
        text: summary.intro,
        source: input.source,
      };
    }),

  /**
   * Resolve dynamic stat placeholders (e.g. {{CountryData:...}}) in arbitrary text.
   */
  resolvePlaceholders: publicProcedure
    .input(
      z.object({
        placeholders: z.array(z.string()).optional(),
        text: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const keys = input.placeholders ?? [];
      const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, input.countryId);
      return resolved;
    }),

  /**
   * Alias for resolvePlaceholders.
   */
  resolveWikiPlaceholders: publicProcedure
    .input(
      z.object({
        placeholders: z.array(z.string()).optional(),
        text: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const keys = input.placeholders ?? [];
      const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, input.countryId);
      return resolved;
    }),

  /**
   * Get intro with backward compatible input signature { title, wiki }.
   */
  getIntro: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const summary = await getArticleSummaryFromShadow(input.title, input.wiki);
      return {
        title: summary.title,
        intro: summary.intro,
        text: summary.intro,
        source: input.wiki,
      };
    }),

  /**
   * Get content of a specific section from a wiki article.
   */
  getSectionContent: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        section: z.string().min(1),
        source: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const src = input.source ?? input.wiki ?? "ixwiki";
      const article = await getArticleWikitextShadow(input.title, src);
      if (!article) return null;

      const lines = article.wikitext.split("\n");
      let capturing = false;
      let sectionLevel = 0;
      const content: string[] = [];
      const sectionLower = input.section.toLowerCase();

      for (const line of lines) {
        const headingMatch = line.match(/^(={2,})\s*(.+?)\s*={2,}$/);
        if (headingMatch) {
          const level = headingMatch[1]!.length;
          const title = headingMatch[2]!.trim().toLowerCase();

          if (capturing) {
            if (level <= sectionLevel) break;
          }

          if (title.includes(sectionLower)) {
            capturing = true;
            sectionLevel = level;
            continue;
          }
        }

        if (capturing) {
          content.push(line);
        }
      }

      if (content.length === 0) return null;

      const fileRefs: string[] = [];
      const filePattern = /\[\[(?:File|Image):([^\]|]+)/gi;
      const fullContent = content.join("\n");
      let match;
      while ((match = filePattern.exec(fullContent)) !== null) {
        fileRefs.push(match[1]!.trim());
      }

      return {
        content: fullContent.trim(),
        fileReferences: fileRefs,
        lineCount: content.length,
      };
    }),

  /**
   * Get page images from an article.
   */
  getPageImages: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const { getPageImages } = await import("~/lib/wiki/bridge");
      return getPageImages(input.title);
    }),

  /**
   * Get forum thread preview by threadId.
   */
  getForumThreadPreview: publicProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { getXfApiKey, getXfApiUrl } = await import("~/server/modules/forum");
      const apiKey = getXfApiKey();
      if (!apiKey) return null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${getXfApiUrl()}/threads/${input.threadId}/`, {
          headers: { "XF-Api-Key": apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) return null;
        const data = (await res.json()) as {
          thread?: {
            thread_id: number;
            title: string;
            username: string;
            post_date: number;
            reply_count: number;
            view_count: number;
            Forum?: { title: string };
            first_post?: { message: string };
          };
        };

        const t = data.thread;
        if (!t) return null;

        const rawMsg = t.first_post?.message ?? "";
        const excerpt = rawMsg
          .replace(/\[ATTACH[^\]]*\]\d+\[\/ATTACH\]/gi, "")
          .replace(/\[\/?(?:b|i|u|url|quote|code|img|media)[^\]]*\]/gi, "")
          .replace(/\n+/g, " ")
          .trim()
          .slice(0, 200);

        return {
          threadId: t.thread_id,
          title: t.title,
          author: t.username,
          postDate: t.post_date,
          replyCount: t.reply_count,
          viewCount: t.view_count,
          forumTitle: t.Forum?.title ?? null,
          forumName: t.Forum?.title ?? null,
          excerpt: excerpt || null,
        };
      } catch {
        return null;
      }
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

  /**
   * Sync recent changes from MediaWiki into local shadow store.
   */
  syncRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .mutation(async ({ input }) => {
      return syncWikiRecentChanges(input?.limit ?? 50);
    }),
});

