import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import {
  getArticleHtml,
  renderArticleViaMediaWiki,
} from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import {
  getArticleWikitext,
  resolveRedirect,
  getInfobox,
  getImageMeta,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import {
  transformArticleHtml,
  stripConflictingStyles,
} from "~/lib/wiki-os/transformers/html-transformer";
import { parseWikitextToHtml, cleanExcerpt } from "~/lib/wiki-os/transformers/wikitext-parser";
import {
  extractTemplateKeys,
  resolveTemplates,
  applyResolvedTemplates,
  registerTemplateProvider,
  type ResolvedTemplate,
} from "~/lib/wiki-os/templates/template-resolver";
import { ixstatsTemplateProvider } from "~/server/shared/ixstats-template-provider";
import {
  getArticleWikitextShadow,
  saveArticleHtmlShadow,
  getArticleHtmlShadow,
  getArticleAuthors,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { resolveWikiPlaceholdersInternal } from "~/server/shared/wiki-placeholders";
import { ArticleRepository, MediaAssetService } from "~/lib/wiki-os/core";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { wikiSourceSchema } from "./_shared";

// Register host-app template data provider
registerTemplateProvider(ixstatsTemplateProvider);

/** Pre-resolve custom templates (CountryData, BusinessData); falls back to the untouched HTML. */
async function resolveArticleTemplates(
  ctx: Parameters<typeof resolveActiveCountryId>[0],
  transformed: ReturnType<typeof transformArticleHtml>
) {
  let resolvedMap: Map<string, ResolvedTemplate> | undefined;
  try {
    const myCountryId = await resolveActiveCountryId(ctx);
    resolvedMap = await resolveTemplates(extractTemplateKeys(transformed.contentHtml), {
      activeCountryId: myCountryId,
    });
  } catch {
    resolvedMap = undefined;
  }
  const apply = (html: string) => (resolvedMap ? applyResolvedTemplates(html, resolvedMap) : html);
  return {
    contentHtml: apply(transformed.contentHtml),
    infoboxHtml: transformed.infoboxHtml && apply(transformed.infoboxHtml),
    noticesHtml: transformed.noticesHtml && apply(transformed.noticesHtml),
  };
}

const RESERVED_SYSTEM_ROUTES = new Set([
  "utilities",
  "categories",
  "category-index",
  "recent-changes",
  "recentchanges",
  "templates",
  "sandbox",
  "search",
  "watchlist",
  "repository",
  "history",
  "diff",
  "whatlinkshere",
  "lorewards",
  "specialpages",
]);

type ArticleHtmlParts = Pick<
  ReturnType<typeof transformArticleHtml>,
  "contentHtml" | "infoboxHtml" | "noticesHtml"
>;

/** Reader payload shared by every getArticleHtml branch. */
function articleResponse(
  html: ArticleHtmlParts,
  toc: ReturnType<typeof transformArticleHtml>["toc"],
  meta: {
    title: string;
    categories?: string[];
    lastModified?: string | null;
    resolvedFrom?: string | null;
    wikiSource: "ixwiki" | "iiwiki" | "althistory";
    authorInfo: Awaited<ReturnType<typeof getArticleAuthors>>;
  }
) {
  return {
    contentHtml: html.contentHtml,
    infoboxHtml: html.infoboxHtml,
    noticesHtml: html.noticesHtml,
    toc,
    title: meta.title,
    categories: meta.categories ?? [],
    lastModified: meta.lastModified ?? null,
    isRedirect: false,
    redirectTarget: null,
    resolvedFrom: meta.resolvedFrom ?? null,
    wikiSource: meta.wikiSource,
    authorInfo: meta.authorInfo,
  };
}

/** Render a non-ixwiki article by sending its wikitext through ixwiki's action=parse. */
async function renderCrossWikiArticle(title: string, wikiSource: "iiwiki" | "althistory") {
  const [article, authorInfo] = await Promise.all([
    getArticleWikitext(title, wikiSource),
    getArticleAuthors(title, wikiSource),
  ]);
  if (!article) {
    throw new Error(`Article "${title}" not found on ${wikiSource}`);
  }

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

  const transformed = transformArticleHtml(stripConflictingStyles(data.parse.text), "", wikiSource);
  return articleResponse(transformed, transformed.toc, {
    title: article.title,
    wikiSource,
    authorInfo,
  });
}

/** Cached HTML of a native article, re-rendered from its wikitext when missing or corrupted. */
async function renderNativeArticleHtml(
  nativeArticle: { contentHtml: string; wikitext: string },
  resolvedTitle: string
) {
  let rawHtml = nativeArticle.contentHtml.trim() ? nativeArticle.contentHtml : "";

  // Detect corrupted wikitext remnants in cached HTML (e.g. leaked table pipes or dangling image parameters)
  const hasCorruptedMarkup =
    Boolean(rawHtml) &&
    (/\|\d+px\|/i.test(rawHtml) || /\|\s*(?:center|left|right|thumb)\]\]/i.test(rawHtml));
  const wikitextHasInfobox =
    nativeArticle.wikitext && /\{\{[Ii]nfobox/i.test(nativeArticle.wikitext);
  const htmlHasInfobox =
    rawHtml && !hasCorruptedMarkup && (rawHtml.includes("infobox") || rawHtml.includes("aside"));

  if (!rawHtml || hasCorruptedMarkup || (wikitextHasInfobox && !htmlHasInfobox)) {
    // Render from the Postgres wikitext, not MediaWiki's copy of the page, which is stale
    // right after a WikiOS save (NEW-3).
    const parsed = await renderArticleViaMediaWiki(nativeArticle.wikitext, resolvedTitle);
    if (parsed) {
      rawHtml = parsed;
      void saveArticleHtmlShadow(
        resolvedTitle,
        rawHtml,
        "ixwiki",
        nativeArticle.wikitext || undefined
      ).catch(() => {});
    }
  }

  if ((!rawHtml || hasCorruptedMarkup) && nativeArticle.wikitext) {
    rawHtml = parseWikitextToHtml(nativeArticle.wikitext, "ixwiki");
    void saveArticleHtmlShadow(resolvedTitle, rawHtml, "ixwiki", nativeArticle.wikitext).catch(
      () => {}
    );
  }
  return rawHtml;
}

/** Parsoid first, then Postgres wikitext shadow, then the MediaWiki bridge. */
async function loadLegacyArticle(resolvedTitle: string, requestedTitle: string) {
  try {
    return await getArticleHtml(resolvedTitle);
  } catch {
    // fall through to the shadow and bridge fallbacks
  }
  const shadowRes = await getArticleWikitextShadow(resolvedTitle, "ixwiki");
  if (shadowRes?.wikitext) {
    return {
      html: parseWikitextToHtml(shadowRes.wikitext, "ixwiki"),
      title: resolvedTitle,
      categories: [] as string[],
      lastModified: shadowRes.timestamp || null,
    };
  }
  const wikiRes = await getArticleWikitext(resolvedTitle, "ixwiki");
  if (wikiRes?.wikitext) {
    return {
      html: parseWikitextToHtml(wikiRes.wikitext, "ixwiki"),
      title: wikiRes.title || resolvedTitle,
      categories: [] as string[],
      lastModified: null,
    };
  }
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `The page "${requestedTitle}" does not exist on IxWiki.`,
  });
}

export const wikiosPageContentRouter = createTRPCRouter({
  /**
   * Get pre-transformed article data for the reader mode.
   * ALL transformation (images, links, infobox extraction, TOC, notices)
   * happens here server-side. Client renders with zero regex work.
   */
  getArticleHtml: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500), wikiSource: wikiSourceSchema }))
    .query(async ({ input, ctx }) => {
      const { wikiSource } = input;
      if (wikiSource !== "ixwiki") return renderCrossWikiArticle(input.title, wikiSource);

      const rawTitle = decodeURIComponent(input.title).replace(/_/g, " ").trim();
      if (
        RESERVED_SYSTEM_ROUTES.has(rawTitle.toLowerCase().replace(/[\s_]+/g, "-")) ||
        RESERVED_SYSTEM_ROUTES.has(rawTitle.toLowerCase())
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `"${input.title}" is a system tool route.`,
        });
      }

      const resolvedTitle = await resolveRedirect(rawTitle);
      const resolvedFrom = resolvedTitle !== rawTitle ? rawTitle : null;

      // Fast-path: Check PostgreSQL Native Article Repository (<2ms)
      const nativeArticle = await ArticleRepository.findBySlug(resolvedTitle, "ixwiki").catch(
        () => null
      );
      if (nativeArticle && (nativeArticle.contentHtml || nativeArticle.wikitext)) {
        const rawHtml = await renderNativeArticleHtml(nativeArticle, resolvedTitle);
        const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
        const html = await resolveArticleTemplates(ctx, transformed);
        const authorInfo = await getArticleAuthors(resolvedTitle, "ixwiki");

        // Native articles hold user-authored HTML (and compiled wikitext): sanitize on serve.
        return articleResponse(
          {
            contentHtml: sanitizeWikiArticleHtml(html.contentHtml),
            infoboxHtml: html.infoboxHtml
              ? sanitizeWikiArticleHtml(html.infoboxHtml)
              : html.infoboxHtml,
            noticesHtml: html.noticesHtml
              ? sanitizeWikiArticleHtml(html.noticesHtml)
              : html.noticesHtml,
          },
          transformed.toc,
          {
            title: nativeArticle.title,
            lastModified: nativeArticle.updatedAt.toISOString(),
            resolvedFrom,
            wikiSource: "ixwiki",
            authorInfo,
          }
        );
      }

      // Fast-path: Check Postgres shadow HTML cache (<3ms)
      const [shadowHtml, authorInfo] = await Promise.all([
        getArticleHtmlShadow(resolvedTitle, "ixwiki"),
        getArticleAuthors(resolvedTitle, "ixwiki"),
      ]);
      if (shadowHtml) {
        const transformed = transformArticleHtml(
          stripConflictingStyles(shadowHtml.html),
          "",
          "ixwiki"
        );
        return articleResponse(await resolveArticleTemplates(ctx, transformed), transformed.toc, {
          title: resolvedTitle.replace(/_/g, " "),
          lastModified: shadowHtml.timestamp,
          resolvedFrom,
          wikiSource: "ixwiki",
          authorInfo,
        });
      }

      const article = await loadLegacyArticle(resolvedTitle, input.title);
      const transformed = transformArticleHtml(stripConflictingStyles(article.html), "", "ixwiki");
      const html = await resolveArticleTemplates(ctx, transformed);

      // Phase 8: Backfill HTML shadow cache with complete raw Parsoid HTML so subsequent reads preserve infoboxes
      if (article.html) {
        void saveArticleHtmlShadow(resolvedTitle, article.html, "ixwiki");
      }

      return articleResponse(html, transformed.toc, {
        title: article.title,
        categories: article.categories,
        lastModified: article.lastModified,
        resolvedFrom,
        wikiSource: "ixwiki",
        authorInfo,
      });
    }),

  /**
   * Get article author and latest editor.
   */
  getArticleAuthors: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wikiSource: wikiSourceSchema,
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

  /** Batched existence check for rendered wiki links: returns the titles with no article. */
  getMissingPages: publicProcedure
    .input(z.object({ titles: z.array(z.string().min(1).max(255)).max(200) }))
    .query(({ input }) => ArticleRepository.findMissingTitles(input.titles, "ixwiki")),

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
        wiki: wikiSourceSchema,
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

      const nativeArticle = await ArticleRepository.findBySlug(resolvedTitle, input.wiki).catch(
        () => null
      );
      const introText =
        nativeArticle?.summary ||
        (nativeArticle?.wikitext ? cleanExcerpt(nativeArticle.wikitext, 300) : "");

      return {
        title: nativeArticle?.title || summary.title || resolvedTitle,
        intro: introText,
        text: introText,
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
        source: wikiSourceSchema,
        wiki: wikiSourceSchema,
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
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const { getPageImages } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      return getPageImages(input.title);
    }),

  /**
   * Batch get lead thumbnails for article titles.
   */
  getArticleThumbnails: publicProcedure
    .input(z.object({ titles: z.array(z.string().min(1)).max(100) }))
    .query(async ({ input }) => {
      if (input.titles.length === 0) return {};
      const { batchFetchThumbnails } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const map = await batchFetchThumbnails(input.titles);
      const result: Record<string, string> = {};
      for (const [title, url] of map.entries()) {
        result[title] = url;
        result[title.replace(/ /g, "_")] = url;
        result[title.replace(/_/g, " ")] = url;
      }
      return result;
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
   * Get parsed infobox for a wiki page.
   */
  getInfobox: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getInfobox(input.title, input.wiki);
    }),

  /**
   * Download a media file from the wiki as base64.
   */
  downloadFile: publicProcedure
    .input(z.object({ filename: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const cleanFilename = input.filename.replace(/^File:/i, "");
      const asset = await MediaAssetService.findAsset(cleanFilename);
      const url = asset?.url || (await getImageMeta(cleanFilename))?.url;
      if (!url) return null;

      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return { content: base64, mime: asset?.mimeType || "image/png" };
      } catch (err) {
        console.error("[WikiOS] Failed to download media file:", err);
        return null;
      }
    }),
});
