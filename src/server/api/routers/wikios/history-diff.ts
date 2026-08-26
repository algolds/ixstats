/**
 * history-diff.ts — WikiOS History, Diff & Revision Router
 *
 * Dedicated router for revision history, visual diffs, revision content,
 * page protection, logs, and recent changes synchronization.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  getArticleWikitext,
  getPageProps,
  getPageProtection,
  getPageLog,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";
import { computeWikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";
import {
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

export const wikiosHistoryDiffRouter = createTRPCRouter({
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
      const result = await getArticleHistoryShadow(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined,
        "ixwiki"
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
        fromrev: z.number().optional().default(0),
        torev: z.number(),
      })
    )
    .query(async ({ input }) => {
      const toData = await getRevisionWikitextShadow(input.torev, undefined, "ixwiki");
      if (!toData) throw new Error(`Revision r${input.torev} not found`);

      const pageTitle = toData.title;
      const history = await getArticleHistoryShadow(pageTitle, 100, undefined, "ixwiki");

      let resolvedFromRevId = input.fromrev;
      const toIndex = history.revisions.findIndex((r) => r.revid === input.torev);
      const toRev = toIndex >= 0 ? history.revisions[toIndex] : null;

      // In history list, revisions are ordered DESC (newest first). So previous rev is at toIndex + 1.
      if (!resolvedFromRevId || resolvedFromRevId === 0) {
        if (toIndex >= 0 && toIndex + 1 < history.revisions.length) {
          resolvedFromRevId = history.revisions[toIndex + 1]!.revid;
        }
      }

      const fromData =
        resolvedFromRevId && resolvedFromRevId > 0
          ? await getRevisionWikitextShadow(resolvedFromRevId, undefined, "ixwiki")
          : null;

      const fromRev = history.revisions.find((r) => r.revid === resolvedFromRevId);

      const fromWikitext = fromData?.wikitext ?? "";
      const toWikitext = toData.wikitext ?? "";

      // Compute diff using Node.js engine
      const diffHtml = computeWikitextDiff(fromWikitext, toWikitext);

      return {
        diffHtml,
        oldWikitext: fromWikitext,
        newWikitext: toWikitext,
        from: {
          revid: resolvedFromRevId || 0,
          user: fromRev?.user ?? (resolvedFromRevId === 0 ? "Initial Document" : "Previous Revision"),
          timestamp: fromData?.timestamp ?? "",
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
   * Get the wikitext of a specific revision (for undo preview).
   */
  getRevisionContent: publicProcedure
    .input(z.object({ revid: z.number() }))
    .query(async ({ input }) => {
      const result = await getRevisionWikitextShadow(input.revid, undefined, "ixwiki");
      if (!result) throw new Error("Revision not found");
      return result;
    }),

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
   * Sync recent changes from MediaWiki into local shadow store.
   */
  syncRecentChanges: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .mutation(async ({ input }) => {
      return syncWikiRecentChanges(input?.limit ?? 50);
    }),
});
