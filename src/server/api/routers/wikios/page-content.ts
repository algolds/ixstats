/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */ import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { getArticleHtml, getArticleHtmlViaParsoid } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import {
  getArticleWikitext,
  getPageSections,
  getPageHistory,
  resolveRedirect,
  getCurrentRevMeta,
  getPageProps,
  getPageProtection,
  getPageLog,
  getInfobox,
  getImageMeta,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import {
  extractTemplateKeys,
  resolveTemplates,
  applyResolvedTemplates,
  registerTemplateProvider,
  type ResolvedTemplate,
} from "~/lib/wiki-os/templates/template-resolver";
import { ixstatsTemplateProvider } from "~/server/shared/ixstats-template-provider";
import { computeWikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";
import {
  getArticleWikitextShadow,
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
  saveArticleHtmlShadow,
  getArticleHtmlShadow,
  getArticleAuthors,
  type ArticleAuthorInfo,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { resolveWikiPlaceholdersInternal } from "~/server/shared/wiki-placeholders";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";

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
        const [article, authorInfo] = await Promise.all([
          getArticleWikitext(input.title, wikiSource),
          getArticleAuthors(input.title, wikiSource),
        ]);
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
          authorInfo,
        };
      }

      // Default ixwiki flow — direct Parsoid/MySQL/PostgreSQL
      const rawTitle = decodeURIComponent(input.title).replace(/_/g, " ").trim();
      const resolvedTitle = await resolveRedirect(rawTitle);

      // Fast-path: Check PostgreSQL Native Article Repository (<2ms)
      // Only serve if pre-compiled full HTML is present; otherwise fall through to MediaWiki parse to preserve infoboxes & templates.
      const nativeArticle = await ArticleRepository.findBySlug(resolvedTitle, "ixwiki").catch(() => null);
      if (nativeArticle && nativeArticle.contentHtml && nativeArticle.contentHtml.trim() !== "") {
        const transformed = transformArticleHtml(stripConflictingStyles(nativeArticle.contentHtml), "", "ixwiki");

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

        return {
          contentHtml,
          infoboxHtml,
          noticesHtml,
          toc: transformed.toc,
          title: nativeArticle.title,
          categories: [] as string[],
          lastModified: nativeArticle.updatedAt.toISOString(),
          isRedirect: false,
          redirectTarget: null,
          resolvedFrom: resolvedTitle !== rawTitle ? rawTitle : null,
          wikiSource: "ixwiki" as const,
          authorInfo: {
            creator: nativeArticle.authorId ? "Registered User" : null,
            createdAt: nativeArticle.createdAt.toISOString(),
            lastEditor: nativeArticle.lastEditorId ? "Registered User" : null,
            lastEditedAt: nativeArticle.updatedAt.toISOString(),
          } as ArticleAuthorInfo,
        };
      }

      // Fast-path: Check Postgres shadow HTML cache (<3ms)
      const [shadowHtml, authorInfo] = await Promise.all([
        getArticleHtmlShadow(resolvedTitle, "ixwiki"),
        getArticleAuthors(resolvedTitle, "ixwiki"),
      ]);
      if (shadowHtml) {
        const transformed = transformArticleHtml(stripConflictingStyles(shadowHtml.html), "", "ixwiki");

        // Pre-resolve custom templates (CountryData, BusinessData) server-side
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

        return {
          contentHtml,
          infoboxHtml,
          noticesHtml,
          toc: transformed.toc,
          title: resolvedTitle.replace(/_/g, " "),
          categories: [] as string[],
          lastModified: shadowHtml.timestamp,
          isRedirect: false,
          redirectTarget: null,
          resolvedFrom: resolvedTitle !== rawTitle ? rawTitle : null,
          wikiSource: "ixwiki" as const,
          authorInfo,
        };
      }

      let article: any;
      try {
        article = await getArticleHtml(resolvedTitle);
      } catch (err) {
        // Direct shadow and bridge fallback
        const shadowRes = await getArticleWikitextShadow(resolvedTitle, "ixwiki");
        if (shadowRes?.wikitext) {
          const { parseWikitextToHtml } = await import("~/lib/wiki-os/transformers/wikitext-parser");
          article = {
            html: parseWikitextToHtml(shadowRes.wikitext, "ixwiki"),
            title: resolvedTitle,
            categories: [],
            lastModified: shadowRes.timestamp || null,
            isRedirect: false,
            redirectTarget: null,
          };
        } else {
          const wikiRes = await getArticleWikitext(resolvedTitle, "ixwiki");
          if (wikiRes?.wikitext) {
            const { parseWikitextToHtml } = await import("~/lib/wiki-os/transformers/wikitext-parser");
            article = {
              html: parseWikitextToHtml(wikiRes.wikitext, "ixwiki"),
              title: wikiRes.title || resolvedTitle,
              categories: [],
              lastModified: null,
              isRedirect: false,
              redirectTarget: null,
            };
          } else {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `The page "${input.title}" does not exist on IxWiki.`,
            });
          }
        }
      }

      const transformed = transformArticleHtml(stripConflictingStyles(article.html), "", "ixwiki");

      // Pre-resolve custom templates (CountryData, BusinessData) server-side
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

      // Phase 8: Backfill HTML shadow cache with complete raw Parsoid HTML so subsequent reads preserve infoboxes
      if (article.html) {
        void saveArticleHtmlShadow(resolvedTitle, article.html, "ixwiki");
      }

      return {
        contentHtml,
        infoboxHtml,
        noticesHtml,
        toc: transformed.toc,
        title: article.title,
        categories: article.categories || [],
        lastModified: article.lastModified || null,
        isRedirect: false,
        redirectTarget: null,
        resolvedFrom: resolvedTitle !== rawTitle ? rawTitle : null,
        wikiSource: "ixwiki" as const,
        authorInfo,
      };
    }),

  /**
   * Get article author and latest editor.
   */
  getArticleAuthors: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wikiSource: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      const resolvedTitle = await resolveRedirect(input.title);
      return getArticleAuthors(resolvedTitle, input.wikiSource);
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
      return resolveWikiPlaceholdersInternal(input.placeholders ?? [], ctx, input.countryId);
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
      return resolveWikiPlaceholdersInternal(input.placeholders ?? [], ctx, input.countryId);
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
      const cleanTitle = decodeURIComponent(input.title).replace(/_/g, " ").trim();
      const resolvedTitle = await resolveRedirect(cleanTitle);

      const summary = await getArticleSummaryFromShadow(resolvedTitle, input.wiki);
      if (summary.intro) {
        return {
          title: summary.title,
          intro: summary.intro,
          text: summary.intro,
          source: input.wiki,
        };
      }

      const shadowArticle = await getArticleWikitextShadow(resolvedTitle, input.wiki);
      if (shadowArticle?.wikitext) {
        const { extractIntroFromWikitext } = await import(
          "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers"
        );
        const intro = extractIntroFromWikitext(shadowArticle.wikitext);
        return {
          title: resolvedTitle,
          intro,
          text: intro,
          source: input.wiki,
        };
      }

      return {
        title: summary.title || resolvedTitle,
        intro: "",
        text: "",
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
      const { getPageImages } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
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

  /**
   * Get parsed infobox for a wiki page.
   */
  getInfobox: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      return getInfobox(input.title, input.wiki);
    }),

  /**
   * Download a media file from the wiki as base64.
   */
  downloadFile: publicProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(500),
      })
    )
    .query(async ({ input }) => {
      const cleanFilename = input.filename.replace(/^File:/i, "");
      const meta = await getImageMeta(cleanFilename);
      if (!meta?.url) return null;

      try {
        const res = await fetch(meta.url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return { content: base64, mime: meta.mimeType || "image/png" };
      } catch (err) {
        console.error("[WikiOS] Failed to download media file:", err);
        return null;
      }
    }),

  /**
   * Sync recent changes from MediaWiki into local shadow store.
   */
  syncRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .mutation(async ({ input }) => {
      return syncWikiRecentChanges(input?.limit ?? 50);
    }),
});

