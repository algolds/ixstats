/**
 * history-diff.ts — WikiOS History, Diff & Revision Router
 *
 * Dedicated router for revision history, visual diffs, revision content,
 * page protection, logs, and recent changes synchronization.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";
import { getRevisionView } from "~/lib/wiki-os/services/revision-view-service";
import {
  DiffTooLargeError,
  diffWikitext,
  type WikitextDiff,
} from "~/lib/wiki-os/transformers/wikitext-diff";
import { isRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { assertTitleVisible, canSeeTitle } from "~/lib/wiki-os/permissions";
import {
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
  type HistoryRevision,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";

/** The diff of two texts; a text over the 2 MB limit is a 413 with the reason, not a hung request. */
function diffOrRefuse(oldText: string, newText: string): WikitextDiff {
  try {
    return diffWikitext(oldText, newText);
  } catch (error) {
    if (error instanceof DiffTooLargeError) {
      throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: error.message });
    }
    throw error;
  }
}

/** A revision reference as a client sends it: refused at the door when no revision could have it (not a 500 from the database). */
const revisionRef = z.string().refine(isRevisionRef, "Not a revision reference");

/**
 * A history entry as a public reader may see it: what MediaWiki revision deletion hid (the text,
 * hence its hash; the user; the edit summary) is null, never the real value.
 */
function publicRevision({
  textDeleted,
  userDeleted,
  commentDeleted,
  ...revision
}: HistoryRevision) {
  return {
    ...revision,
    user: userDeleted ? null : revision.user,
    comment: commentDeleted ? null : revision.comment,
    sha1: textDeleted ? null : revision.sha1,
  };
}

/** Most revisions one history request returns (the page the UI asks for is far smaller). */
const MAX_HISTORY_PAGE = 500;

export const wikiosHistoryDiffRouter = createTRPCRouter({
  /**
   * Revision history of a page, newest first, without any revision's text. `before` is the
   * reference of the last revision already seen: the answer starts right after it. Parked
   * revisions (MediaWiki edits that conflicted with WikiOS's head and never went live) are listed
   * too, flagged `parked`.
   */
  getHistory: rateLimitedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(MAX_HISTORY_PAGE).default(50),
        before: revisionRef.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      const { revisions, hasMore } = await getArticleHistoryShadow(
        input.title,
        input.limit,
        input.before ? { before: input.before } : undefined,
        "ixwiki",
        { includeParked: true }
      );
      return { revisions: revisions.map(publicRevision), hasMore };
    }),

  /**
   * The difference between two revisions as hunks of ±3 lines of context, computed here once.
   * Revision ids are history `revid`s; without `fromrev` the diff is against the revision before
   * `torev`.
   */
  getDiff: rateLimitedPublicProcedure
    .input(
      z.object({
        fromrev: revisionRef.optional(),
        torev: revisionRef,
      })
    )
    .query(async ({ input, ctx }) => {
      const toData = await getRevisionWikitextShadow(input.torev);
      if (!toData) throw new Error(`Revision r${input.torev} not found`);
      await assertTitleVisible(ctx, toData.title);

      // One history read finds both ends: `torev` itself and, right after it, its neighbour.
      const [toRev, neighbour] = (
        await getArticleHistoryShadow(toData.title, 2, { from: input.torev }, "ixwiki", {
          includeParked: true,
        })
      ).revisions;
      // A live revision follows the live ones: a conflicting edit that was parked in between was never
      // the page's text, so the change this revision made is not measured from it. (A parked revision
      // is compared with its neighbour.)
      const previous = input.fromrev
        ? undefined
        : toRev?.parked
          ? neighbour
          : (await getArticleHistoryShadow(toData.title, 2, { from: input.torev }, "ixwiki"))
              .revisions[1];
      const resolvedFromRevId = input.fromrev || previous?.revid || "";

      const fromData = resolvedFromRevId
        ? await getRevisionWikitextShadow(resolvedFromRevId)
        : null;
      const fromRev = input.fromrev
        ? (
            await getArticleHistoryShadow(toData.title, 1, { from: input.fromrev }, "ixwiki", {
              includeParked: true,
            })
          ).revisions[0]
        : previous;
      // The "from" revision may belong to another page: a deleted one stays hidden too.
      if (fromData) await assertTitleVisible(ctx, fromData.title);

      // A null text is an import placeholder, not an empty page: diffing it would show a lie.
      if (toData.wikitext === null || fromData?.wikitext === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Revision text has not been imported yet.",
        });
      }

      const diff = diffOrRefuse(fromData?.wikitext ?? "", toData.wikitext);
      const from = fromRev && publicRevision(fromRev);
      const to = toRev && publicRevision(toRev);
      return {
        ...diff,
        from: {
          revid: resolvedFromRevId,
          user: from ? from.user : resolvedFromRevId ? "Previous Revision" : "Initial Document",
          timestamp: fromData?.timestamp ?? "",
          comment: from ? from.comment : "",
        },
        to: {
          revid: input.torev,
          user: to ? to.user : "",
          timestamp: toData.timestamp,
          comment: to ? to.comment : "",
        },
      };
    }),

  /**
   * Get the wikitext of a specific revision (for undo preview).
   */
  getRevisionContent: publicProcedure
    .input(z.object({ revid: revisionRef }))
    .query(async ({ input, ctx }) => {
      const result = await getRevisionWikitextShadow(input.revid);
      if (!result) throw new Error("Revision not found");
      await assertTitleVisible(ctx, result.title);
      return result;
    }),

  /**
   * One old revision rendered for the reader (`?oldid=`). Nothing is stored; see
   * revision-view-service. The revision's page is the `title` in the answer: the caller compares it
   * with the page the URL named.
   */
  getRevisionHtml: rateLimitedPublicProcedure
    .input(z.object({ ref: revisionRef }))
    .query(async ({ input, ctx }) => {
      const result = await getRevisionView(input.ref, (title) => canSeeTitle(ctx, title)).catch(
        (error: Error) => {
          if (error instanceof ThrottledError) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
          }
          throw error;
        }
      );
      if (result.status === "missing") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Revision not found" });
      }
      if (result.status === "text-unavailable") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Revision text has not been imported yet.",
        });
      }
      return result.view;
    }),
});
