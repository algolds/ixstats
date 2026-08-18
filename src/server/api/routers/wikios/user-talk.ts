/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { getWikiAuth } from "~/lib/wiki-os/auth";
import { getArticleHtml } from "~/lib/wiki-os/parsoid-client";
import {
  getUserContribs,
  getUserInfo,
  getBacklinks,
  getNamespacedWikitext,
} from "~/lib/wiki/bridge";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/html-transformer";

import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";
import { updateRevisionActor } from "~/lib/wiki-os/wiki-write-service";

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
      let { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;
      // Sign the content with ~~~~ (MediaWiki auto-replaces with username + timestamp)
      const signedContent = `${input.content}\n\n~~~~`;

      let attempt = 0;
      let editData: {
        edit?: { result: string; newrevid?: number };
        error?: { code: string; info: string };
      } | null = null;

      while (attempt < 2) {
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

        editData = (await editRes.json()) as {
          edit?: { result: string; newrevid?: number };
          error?: { code: string; info: string };
        };

        if (editData.error) {
          if (editData.error.code === "badtoken" && attempt === 0) {
            console.warn(
              "[UserTalk Router] Bad token for addTalkSection. Invalidating cache and retrying..."
            );
            invalidateCsrfToken();
            const fresh = await getUserSessionAndToken(ctx);
            cookies = fresh.cookies;
            csrfToken = fresh.csrfToken;
            attempt++;
            continue;
          }
          throw new Error(`Talk page edit failed: ${editData.error.info}`);
        }

        break;
      }

      if (editData?.error) {
        throw new Error(`Talk page edit failed: ${editData.error.info}`);
      }

      const { wikiUsername } = getWikiAuth(ctx);
      const revId = editData?.edit?.newrevid ?? null;
      if (revId && wikiUsername) {
        await updateRevisionActor(revId, wikiUsername);
      }

      return {
        success: editData?.edit?.result === "Success",
        revisionId: revId,
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

      let { cookies, csrfToken } = await getUserSessionAndToken(ctx);

      const signedContent = `${input.content}\n\n~~~~`;
      const newText = `${currentText.trimEnd()}\n\n${signedContent}`;

      let attempt = 0;
      let editData: {
        edit?: { result: string; newrevid?: number };
        error?: { code: string; info: string };
      } | null = null;

      while (attempt < 2) {
        const editParams = new URLSearchParams({
          action: "edit",
          title: talkTitle,
          section: String(input.sectionIndex),
          text: newText,
          summary: `Reply (via WikiOS)`,
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

        editData = (await editRes.json()) as {
          edit?: { result: string; newrevid?: number };
          error?: { code: string; info: string };
        };

        if (editData.error) {
          if (editData.error.code === "badtoken" && attempt === 0) {
            console.warn(
              "[UserTalk Router] Bad token for replyToTalkSection. Invalidating cache and retrying..."
            );
            invalidateCsrfToken();
            const fresh = await getUserSessionAndToken(ctx);
            cookies = fresh.cookies;
            csrfToken = fresh.csrfToken;
            attempt++;
            continue;
          }
          throw new Error(`Reply failed: ${editData.error.info}`);
        }

        break;
      }

      if (editData?.error) {
        throw new Error(`Reply failed: ${editData.error.info}`);
      }

      const { wikiUsername } = getWikiAuth(ctx);
      const revId = editData?.edit?.newrevid ?? null;
      if (revId && wikiUsername) {
        await updateRevisionActor(revId, wikiUsername);
      }

      return {
        success: editData?.edit?.result === "Success",
        revisionId: revId,
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

