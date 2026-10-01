/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */ import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
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
import { cleanExcerpt } from "~/lib/wiki-os/transformers/wikitext-parser";
import { registerTemplateProvider } from "~/lib/wiki-os/templates/template-resolver";
import { ixstatsTemplateProvider } from "~/server/shared/ixstats-template-provider";
import {
  getArticleWikitextShadow,
  getArticleAuthors,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getArticleSummaryFromShadow } from "~/lib/wiki-os/core/native-search-service";
import { resolveWikiPlaceholdersInternal } from "~/server/shared/wiki-placeholders";
import { ArticleRepository, MediaAssetService } from "~/lib/wiki-os/core";
import { getArticleView, type ImportSource } from "~/lib/wiki-os/services/article-view-service";
import { ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  assertTitleVisible,
  canSeeDeletedPages,
  canSeeTitle,
  visibleTitles,
} from "~/lib/wiki-os/permissions";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { downloadMedia } from "~/lib/wiki-os/services/media-download";

// Register host-app template data provider
registerTemplateProvider(ixstatsTemplateProvider);

/**
 * Who is asking, for the MediaWiki import of a page WikiOS does not have yet: the server's own
 * caller (`x-trpc-source: rsc`, set in `~/trpc/server`) is a page request, which only a request that
 * asks for HTML may import for; any other caller is the reader's client.
 */
function importSourceOf(headers: Headers | undefined): ImportSource {
  if (headers?.get("x-trpc-source") !== "rsc") return "client";
  return /\btext\/html\b/i.test(headers.get("accept") ?? "") ? "ssr" : "none";
}

/**
 * The reader's view of the IxWiki page `title` (canonical, redirects already followed), or null when
 * there is none. Not asking MediaWiki about a missing page right now is "busy", not "no such page".
 */
async function readIxWikiView(ctx: WikiAuthContext & { headers?: Headers }, title: string) {
  return getArticleView(
    title,
    () => resolveActiveCountryId(ctx),
    () => canSeeDeletedPages(ctx),
    importSourceOf(ctx.headers)
  ).catch((error: Error) => {
    if (error instanceof ThrottledError) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
    }
    throw error;
  });
}

/** The most redirect resolutions (each up to two hops) followed before a chain is called a cycle. */
const MAX_REDIRECT_ROUNDS = 3;

/**
 * Where `rawTitle` really leads: the page after its redirects, with the section the last redirect
 * named. Null when the redirects lead back to a title already seen (A to B to A, A to B to C to A)
 * or never end: a reader sent to either end of a cycle would be sent round it for ever, so the
 * caller shows the page asked for.
 */
async function followRedirects(
  rawTitle: string
): Promise<{ title: string; fragment: string | null } | null> {
  const seen = new Set([rawTitle]);
  let current = { title: rawTitle, fragment: null as string | null };
  for (let round = 0; round < MAX_REDIRECT_ROUNDS; round++) {
    const next = await resolveRedirect(current.title);
    if (next.title === current.title) return current; // not a redirect: this is the page
    if (seen.has(next.title)) return null;
    seen.add(next.title);
    current = { title: next.title, fragment: next.fragment ?? current.fragment };
  }
  return null;
}

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
        /** "no" shows a redirect page itself instead of following it (`?redirect=no`). */
        redirect: z.literal("no").optional(),
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

        // Another wiki's HTML is as untrusted as a user's: sanitized before it is served.
        return {
          contentHtml: sanitizeWikiArticleHtml(transformed.contentHtml),
          infoboxHtml: transformed.infoboxHtml
            ? sanitizeWikiArticleHtml(transformed.infoboxHtml)
            : null,
          noticesHtml: transformed.noticesHtml
            ? sanitizeWikiArticleHtml(transformed.noticesHtml)
            : null,
          toc: transformed.toc,
          title: article.title,
          categories: [] as string[],
          lastModified: null,
          isRedirect: false,
          redirectTarget: null,
          redirectFragment: null,
          resolvedFrom: null,
          wikiSource,
          authorInfo,
          renderQuality: "rendered" as const,
          stale: false,
        };
      }

      // Default ixwiki flow — direct PostgreSQL / in-process wikitext compiler
      // The client sends the title already URL-decoded; canonicalize it (never decode again).
      const canon = canonicalizeTitle(input.title);
      if (!canon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `"${input.title}" is not a valid page title.`,
        });
      }
      const rawTitle = canon.title;

      // A title is always a page here: a WikiOS tool slug ("search") is an article title like any
      // other, and the old slugs redirect to their tool in the route, not in this query.
      const self = { title: rawTitle, fragment: null };
      const followed = input.redirect === "no" ? self : ((await followRedirects(rawTitle)) ?? self);

      let shown = followed;
      let view = await readIxWikiView(ctx, followed.title);
      if (!view && followed.title !== rawTitle) {
        // The redirect's target does not exist: show the redirect page itself, as MediaWiki does
        // (its "Redirect to: Target" with a red link), not "no such page" for a page that exists.
        shown = { title: rawTitle, fragment: null };
        view = await readIxWikiView(ctx, rawTitle);
      }
      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `The page "${input.title}" does not exist on IxWiki.`,
        });
      }

      return {
        ...view,
        isRedirect: false,
        redirectTarget: null,
        /** The section the redirect points to, or null. */
        redirectFragment: shown.fragment,
        resolvedFrom: shown.title !== rawTitle ? rawTitle : null,
        wikiSource: "ixwiki" as const,
        // The reader fetches authorship lazily (getArticleAuthors) so it never holds the article back.
        authorInfo: null,
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
    .query(async ({ input, ctx }) => {
      const { title: resolvedTitle } = await resolveRedirect(input.title);
      await assertTitleVisible(ctx, resolvedTitle, input.wikiSource);
      return getArticleAuthors(resolvedTitle, input.wikiSource);
    }),

  /**
   * Get raw wikitext for the source editor.
   */
  getWikitext: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      // The head revision is read BEFORE the text: a save in between can then only make the text newer
      // than its ref (a harmless extra conflict), never older (which would let a stale edit overwrite it).
      // Without the shadow store the editor still loads; it then saves without a base revision.
      const head = await getHeadRevisionRefs(input.title).catch(() => null);
      // Read-through the Postgres shadow store (resilient to MediaWiki downtime).
      const result = await getArticleWikitextShadow(input.title, "ixwiki", {
        includeArchived: true, // visibility was asserted above
      });
      return {
        wikitext: result?.wikitext ?? "",
        revid: result?.revid ?? null,
        timestamp: result?.timestamp ?? null,
        /** The latest revision the editor is based on; send it back as `baseRevisionRef` when saving. */
        revisionRef: head?.revisionRef ?? null,
        /** Every reference that names that revision (its row id and its MediaWiki rev_id once stamped). */
        revisionRefs: head?.revisionRefs ?? [],
      };
    }),

  /**
   * Check if a page exists in local DB or MediaWiki.
   */
  checkPageExists: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      const { title: resolvedTitle } = await resolveRedirect(input.title);
      // A deleted page does not exist for a reader who may not see it.
      if (!(await canSeeTitle(ctx, resolvedTitle))) return { exists: false, resolvedTitle };
      const article = await getArticleWikitextShadow(resolvedTitle, "ixwiki", {
        includeArchived: true, // canSeeTitle above
      });
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
        placeholders: z.array(z.string().max(512)).max(200).optional(),
        text: z.string().max(200_000).optional(),
        countryId: z.string().max(64).optional(),
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
    .query(async ({ input, ctx }) => {
      const cleanTitle = input.title.replace(/_/g, " ").trim();
      const { title: resolvedTitle } = await resolveRedirect(cleanTitle);
      await assertTitleVisible(ctx, resolvedTitle, input.wiki);

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
        title: z.string().min(1).max(512),
        section: z.string().min(1).max(512),
        source: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input, ctx }) => {
      const src = input.source ?? input.wiki ?? "ixwiki";
      await assertTitleVisible(ctx, input.title, src);
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
        title: z.string().min(1).max(512),
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).optional().default("ixwiki"),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title, input.wiki);
      const { getPageImages } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      return getPageImages(input.title, { wiki: input.wiki });
    }),

  /**
   * Batch get lead thumbnails for article titles.
   */
  getArticleThumbnails: publicProcedure
    .input(z.object({ titles: z.array(z.string().min(1).max(512)).max(100) }))
    .query(async ({ input, ctx }) => {
      if (input.titles.length === 0) return {};
      const { batchFetchThumbnails } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const map = await batchFetchThumbnails(await visibleTitles(ctx, input.titles));
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
   *
   * Public on purpose: forum-link tooltips render for anonymous wiki readers, so it cannot require
   * sign-in. Three things keep it from becoming a window onto the private forum (plan 416 item 6):
   * it is rate-limited like the other public reads; a thread whose `discussion_state` is not exactly
   * "visible" (moderated, deleted, or missing from the answer) yields nothing; and XenForo itself
   * decides which forums this key may see. OPERATOR CHECK: the XenForo API key must be a
   * non-super-user key scoped to a guest-like user, or a super-user key used without `XF-Api-User`
   * (as here), so XenForo enforces forum visibility. The response carries no per-forum "public" flag
   * to check from this side.
   */
  getForumThreadPreview: rateLimitedPublicProcedure
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
            discussion_state?: string;
            Forum?: { title: string };
            first_post?: { message: string };
          };
        };

        const t = data.thread;
        if (t?.discussion_state !== "visible") return null;

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
        wiki: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title, input.wiki);
      return getInfobox(input.title, input.wiki);
    }),

  /**
   * Download a media file from the wiki as base64 (allowlisted hosts only, at most 10 MB). Public, so
   * rate-limited: every call fetches and buffers a file.
   */
  downloadFile: rateLimitedPublicProcedure
    .input(z.object({ filename: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const cleanFilename = input.filename.replace(/^File:/i, "");
      const asset = await MediaAssetService.findAsset(cleanFilename);
      const url = asset?.url || (await getImageMeta(cleanFilename))?.url;
      if (!url) return null;

      try {
        // Allowlisted hosts only, at most 10 MB: this endpoint is public (plan 416).
        const bytes = await downloadMedia(url);
        if (!bytes) return null;
        return { content: bytes.toString("base64"), mime: asset?.mimeType || "image/png" };
      } catch (err) {
        console.error("[WikiOS] Failed to download media file:", err);
        return null;
      }
    }),
});
