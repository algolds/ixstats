/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { getArticleHtml, invalidateCache } from "~/lib/wiki-os/parsoid-client";
import {
  getArticleWikitext,
  getUserContribs,
  getUserInfo,
  getBacklinks,
  resolveRedirect as resolveRedirectMySQL,
  getRevisionWikitext as getRevisionWikitextMySQL,
  getCurrentRevMeta,
  getNamespacedWikitext,
} from "~/lib/wiki-bridge";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/html-transformer";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";

import { db } from "~/server/db";
import { resolveWikiPlaceholdersInternal } from "../wiki";

export const wikiosUserTalkRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Reader endpoints
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // History & Diff endpoints (Phase 3)
  // ---------------------------------------------------------------------------

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
