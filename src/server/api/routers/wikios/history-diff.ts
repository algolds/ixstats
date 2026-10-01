/**
 * history-diff.ts — WikiOS History, Diff & Revision Router
 *
 * Dedicated router for revision history, visual diffs, revision content,
 * page protection, logs, and recent changes synchronization.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { computeWikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import {
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

export const wikiosHistoryDiffRouter = createTRPCRouter({
  /**
   * Get revision history for a page. Parked revisions (MediaWiki edits that conflicted with WikiOS's
   * head and never went live) are listed too, flagged `parked`.
   */
  getHistory: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      const result = await getArticleHistoryShadow(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined,
        "ixwiki",
        { includeParked: true }
      );
      return {
        revisions: result.revisions,
        continueToken:
          result.hasMore && result.revisions.length > 0
            ? result.revisions[result.revisions.length - 1]!.revid
            : null,
      };
    }),

  /**
   * Get a visual diff between two revisions. Revision ids are history `revid`s; without
   * `fromrev` the diff is against the revision before `torev`.
   */
  getDiff: publicProcedure
    .input(
      z.object({
        fromrev: z.string().max(64).optional(),
        torev: z.string().min(1).max(64),
      })
    )
    .query(async ({ input, ctx }) => {
      const toData = await getRevisionWikitextShadow(input.torev);
      if (!toData) throw new Error(`Revision r${input.torev} not found`);
      await assertTitleVisible(ctx, toData.title);

      const history = await getArticleHistoryShadow(toData.title, 100, undefined, "ixwiki", {
        includeParked: true,
      });
      const toIndex = history.revisions.findIndex((r) => r.revid === input.torev);
      const toRev = toIndex >= 0 ? history.revisions[toIndex] : null;

      // History is newest-first, so the previous revision sits at toIndex + 1.
      const previousRevId = toIndex >= 0 ? history.revisions[toIndex + 1]?.revid : undefined;
      const resolvedFromRevId = input.fromrev || previousRevId || "";

      const fromData = resolvedFromRevId
        ? await getRevisionWikitextShadow(resolvedFromRevId)
        : null;

      const fromRev = history.revisions.find((r) => r.revid === resolvedFromRevId);
      // The "from" revision may belong to another page: a deleted one stays hidden too.
      if (fromData) await assertTitleVisible(ctx, fromData.title);

      // A null text is an import placeholder, not an empty page: diffing it would show a lie.
      if (toData.wikitext === null || fromData?.wikitext === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Revision text has not been imported yet.",
        });
      }
      const fromWikitext = fromData?.wikitext ?? "";
      const toWikitext = toData.wikitext;

      // Compute diff using Node.js engine
      const diffHtml = computeWikitextDiff(fromWikitext, toWikitext);

      return {
        diffHtml,
        oldWikitext: fromWikitext,
        newWikitext: toWikitext,
        from: {
          revid: resolvedFromRevId,
          user: fromRev?.user ?? (resolvedFromRevId ? "Previous Revision" : "Initial Document"),
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
    .input(z.object({ revid: z.string().min(1).max(64) }))
    .query(async ({ input, ctx }) => {
      const result = await getRevisionWikitextShadow(input.revid);
      if (!result) throw new Error("Revision not found");
      await assertTitleVisible(ctx, result.title);
      return result;
    }),
});
