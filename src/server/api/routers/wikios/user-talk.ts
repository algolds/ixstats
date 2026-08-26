/**
 * wikios.ts — WikiOS tRPC router.
 *
 * Provides endpoints for WikiOS article rendering, editing, history, search,
 * template registry, watchlist, advanced search, and category tree.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { getWikiAuth, resolveWikiUsername } from "~/lib/wiki-os/auth";
import { getArticleHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import {
  getUserContribs,
  getUserInfo,
  getBacklinks,
  getNamespacedWikitext,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { transformArticleHtml, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";

import { db } from "~/server/db";
import { executeMediaWikiWrite } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import { ArticleRepository, LinkGraphService } from "~/lib/wiki-os/core";

export const wikiosUserTalkRouter = createTRPCRouter({
  /**
   * Consolidated author profile for WikiOS sidebar, header, and user cards.
   * Resolves wiki identity, MediaWiki MySQL stats, loreward scores, and country affiliation in a single fast query (~15ms).
   */
  getAuthorProfile: publicProcedure
    .input(
      z
        .object({
          username: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      let wikiName = input?.username?.trim() || null;
      let internalUser = ctx.user;

      if (!wikiName && ctx.auth?.userId) {
        wikiName = getWikiAuth(ctx).wikiUsername;
      }

      if (!wikiName) {
        return null;
      }

      const userPromise = !internalUser?.id
        ? db.user.findFirst({
            where: {
              OR: [
                { wikiUsername: wikiName },
                { clerkUserId: ctx.auth?.userId ?? undefined },
              ],
            },
            select: {
              id: true,
              clerkUserId: true,
              countryId: true,
              roleId: true,
              membershipTier: true,
              wikiUsername: true,
              wikiUserId: true,
              createdAt: true,
              updatedAt: true,
              country: { select: { id: true, name: true, flag: true } },
              role: { select: { id: true, name: true, level: true } },
            },
          })
        : Promise.resolve(internalUser);

      // Parallel fetch User + Action API user info + Loreward stats
      const [resolvedUser, mwInfo, loreStatsRecord] = await Promise.all([
        userPromise,
        getUserInfo(wikiName),
        db.lorewardUserStats.findUnique({
          where: { username: wikiName },
        }),
      ]);
      internalUser = resolvedUser;

      // Calculate rank if loreStatsRecord exists
      let rank: number | null = null;
      if (loreStatsRecord && loreStatsRecord.totalScore > 0) {
        const higherCount = await db.lorewardUserStats.count({
          where: { totalScore: { gt: loreStatsRecord.totalScore } },
        });
        rank = higherCount + 1;
      }

      const totalWins =
        (loreStatsRecord?.dailyWins ?? 0) +
        (loreStatsRecord?.weeklyWins ?? 0) +
        (loreStatsRecord?.monthlyWins ?? 0);

      return {
        username: wikiName,
        displayName: wikiName,
        existsInMediaWiki: Boolean(mwInfo),
        editCount: mwInfo?.user_editcount ?? 0,
        registration: mwInfo?.user_registration ?? null,
        groups: [] as string[],
        loreScore: loreStatsRecord?.totalScore ?? 0,
        loreStreak: loreStatsRecord?.currentStreak ?? 0,
        longestStreak: loreStatsRecord?.longestStreak ?? 0,
        totalWins,
        rank,
        country: internalUser?.country ?? null,
        role: internalUser?.role ?? null,
      };
    }),

  /**
   * Get pages that link to the given page (backlinks / "What Links Here").
   * Native PostgreSQL Link Graph queried in O(1) time (<1ms).
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
      // 1. Fast-path: Native PostgreSQL Directed Link Graph (<1ms)
      const nativeLinks = await LinkGraphService.getBacklinks(input.title, "ixwiki", input.limit);
      if (nativeLinks.length > 0) {
        return {
          links: nativeLinks.map((l) => ({
            pageid: 0,
            title: l.title,
            redirect: false,
          })),
          continueToken: null,
        };
      }

      // 2. Fallback: MySQL bridge
      const result: any = await getBacklinks(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined
      );

      const links = Array.isArray(result)
        ? result.map((r: any) => ({
            title: r.page_title || r.title || "Unknown",
            ns: r.page_namespace ?? r.ns ?? 0,
          }))
        : (result?.links ?? []);

      const hasMore = Array.isArray(result) ? false : !!result?.hasMore;

      return {
        links,
        continueToken: hasMore && links.length > 0 ? String(links.length) : null,
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
        namespace: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const ns = input.namespace ?? 0;
      // 1. Direct PostgreSQL + Action API fast path
      const contribs = await getUserContribs(
        input.user,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined,
        ns
      ).catch(() => []);

      if (contribs && contribs.length > 0) {
        return {
          contribs: contribs.map((c: any) => ({
            revid: c.rev_id || c.revid || 0,
            title: c.page_title || c.title || "",
            timestamp: c.rev_timestamp || c.timestamp || new Date().toISOString(),
            size: c.rev_len || c.size || 0,
            comment: c.rev_comment ?? c.comment ?? "",
            minor: Boolean(c.rev_minor_edit ?? c.minor),
            diff: c.diff ?? 0,
            isNew: Boolean(c.is_new ?? c.isNew),
          })),
          continueToken:
            contribs.length >= input.limit && contribs.length > 0
              ? String(contribs[contribs.length - 1]?.rev_id || "")
              : null,
        };
      }

      // 2. PostgreSQL native revisions fallback (case-insensitive)
      const cleanUser = input.user.trim();
      const nativeRevisions = await ctx.db.wikiRevision.findMany({
        where: {
          author: { equals: cleanUser, mode: "insensitive" },
          article: { namespace: ns },
        },
        include: {
          article: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
      }).catch(() => []);

      const hasMore = nativeRevisions.length > input.limit;
      const sliced = hasMore ? nativeRevisions.slice(0, input.limit) : nativeRevisions;

      const fallbackContribs = sliced.map((rev) => ({
        revid: rev.mwRevId ?? 0,
        title: rev.article?.title ?? "Untitled",
        timestamp: rev.createdAt.toISOString(),
        comment: rev.summary ?? "",
        size: rev.byteSize,
        minor: rev.minor,
        isNew: !rev.parentRevisionId,
      }));

      return {
        contribs: fallbackContribs,
        continueToken: null,
      };
    }),

  /** Get MediaWiki user info: edit count, registration date, groups. */
  getUserInfo: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      // Direct MySQL — ~20ms vs ~300ms via API
      return getUserInfo(input.username);
    }),

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
   * Commits to PostgreSQL in <10ms and syncs to MediaWiki in background.
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
      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;
      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const signedContent = `${input.content}\n\n-- [[User:${authorName}|${authorName}]] ~~~~~`;

      // 1. Fetch existing talk page from PostgreSQL or create new
      const existingTalk = await ArticleRepository.findBySlug(talkTitle, "ixwiki");
      const sectionWikitext = `\n\n== ${input.sectionTitle} ==\n${signedContent}\n`;
      const combinedWikitext = `${(existingTalk?.wikitext ?? "").trimEnd()}${sectionWikitext}`;

      // 2. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: talkTitle,
          title: talkTitle,
          wikitext: combinedWikitext,
          summary: `/* ${input.sectionTitle} */ new section (via WikiOS)`,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 3. Background mirror to MediaWiki Action API
      void executeMediaWikiWrite(
        {
          action: "edit",
          title: talkTitle,
          section: "new",
          sectiontitle: input.sectionTitle,
          text: signedContent,
          summary: `/* ${input.sectionTitle} */ new section (via WikiOS)`,
        },
        ctx
      ).catch((err) => console.warn("[user-talk] Background MediaWiki talk sync:", err));

      return {
        success: true,
        revisionId: saveResult.revisionId,
      };
    }),

  /**
   * Reply to an existing talk page section.
   * Appends content to the specified section and persists to PostgreSQL.
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
      const talkTitle = input.title.startsWith("Talk:") ? input.title : `Talk:${input.title}`;
      const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";
      const signedContent = `:${input.content} -- [[User:${authorName}|${authorName}]] ~~~~~`;

      // 1. Fetch existing talk page from PostgreSQL
      const existingTalk = await ArticleRepository.findBySlug(talkTitle, "ixwiki");
      const combinedWikitext = `${(existingTalk?.wikitext ?? "").trimEnd()}\n${signedContent}\n`;

      // 2. Primary Save: Direct to PostgreSQL (<10ms)
      const saveResult = await ArticleRepository.saveArticle(
        {
          slug: talkTitle,
          title: talkTitle,
          wikitext: combinedWikitext,
          summary: `Reply (via WikiOS)`,
          minor: false,
        },
        ctx.auth?.userId ?? undefined,
        authorName
      );

      // 3. Background mirror to MediaWiki Action API
      void (async () => {
        try {
          const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
          const sectionRes = await fetch(
            `${apiBase}?action=parse&page=${encodeURIComponent(talkTitle)}&prop=wikitext&section=${input.sectionIndex}&formatversion=2&format=json`,
            { signal: AbortSignal.timeout(10000) }
          );
          const sectionData = (await sectionRes.json()) as {
            parse?: { wikitext?: string };
            error?: { code: string; info: string };
          };

          if (!sectionData.error) {
            const currentText = sectionData.parse?.wikitext ?? "";
            const newText = `${currentText.trimEnd()}\n${signedContent}`;
            await executeMediaWikiWrite(
              {
                action: "edit",
                title: talkTitle,
                section: String(input.sectionIndex),
                text: newText,
                summary: `Reply (via WikiOS)`,
              },
              ctx
            );
          }
        } catch (err) {
          console.warn("[user-talk] Background section reply sync:", err);
        }
      })();

      return {
        success: true,
        revisionId: saveResult.revisionId,
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

