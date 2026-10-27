/**
 * discussions.ts — WikiOS Margin Discussions & Threaded Discourse Router.
 *
 * Provides high-performance, indexed endpoints for WikiOS Margin:
 * - Thread creation, querying, resolution, and comments
 * - Margin gutter pin anchors & text-anchored commentary
 * - Author & country hydration for discussion threads
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, lightMutationProcedure } from "~/server/api/trpc";
import { requireWikiUserId } from "~/lib/wiki-os/auth";
import { assertTitleVisible, requireNotBlocked } from "~/lib/wiki-os/permissions";
import {
  loadMarginPage,
  loadThreadComments,
  normalizeMarginTitle,
  requireOwnerOrSysop,
} from "~/lib/wiki-os/services/margin-service";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

export const wikiosDiscussionsRouter = createTRPCRouter({
  /**
   * One page (50) of an article's threads for the Margin inspector, each with its first 100 comments.
   * Public: authors come back as a display name, avatar and `isAuthor` only.
   */
  getArticleMarginData: publicProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1).max(500),
        status: z.enum(["ALL", "OPEN", "RESOLVED", "ARCHIVED"]).default("OPEN"),
        cursor: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.articleTitle);
      return loadMarginPage(ctx, input);
    }),

  /** The next page (100) of one thread's comments, after the last comment the reader already has. */
  getThreadComments: publicProcedure
    .input(z.object({ threadId: z.string().max(64), cursor: z.string().max(64).optional() }))
    .query(async ({ input, ctx }) => {
      const thread = await db.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
        select: { articleTitle: true },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      await assertTitleVisible(ctx, thread.articleTitle);
      return loadThreadComments(ctx, input);
    }),

  /**
   * Create a new discussion thread anchored to a section or selected text.
   */
  createThread: lightMutationProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1).max(500),
        title: z.string().min(2).max(300),
        content: z.string().min(1).max(20000),
        sectionAnchor: z.string().max(200).optional(),
        selectedText: z.string().max(2000).optional(),
        anchorOffset: z.number().optional(),
        suggestedEdit: z.string().max(50000).optional(),
        teamId: z.string().max(100).optional(),
        countryId: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authUserId = requireWikiUserId(ctx);
      await requireNotBlocked(ctx);
      // The reads hide a deleted page's Margin: the writes must not reveal or extend it either.
      await assertTitleVisible(ctx, input.articleTitle);
      // Posting "as" a country is only allowed for a country the caller may write to.
      if (input.countryId) await assertCountryWriteAccess(ctx, input.countryId);
      const dbUser = ctx.user as any;
      const effectiveUserId = dbUser?.id || authUserId;
      const effectiveCountryId = input.countryId || dbUser?.countryId || null;
      const normalizedTitle = normalizeMarginTitle(input.articleTitle);

      return db.$transaction(async (tx) => {
        const client = tx as any;
        const thread = await client.wikiDiscussionThread.create({
          data: {
            articleTitle: normalizedTitle,
            title: input.title.trim(),
            sectionAnchor: input.sectionAnchor || null,
            selectedText: input.selectedText || null,
            anchorOffset: input.anchorOffset || null,
            teamId: input.teamId || null,
            countryId: effectiveCountryId,
            createdBy: effectiveUserId,
            status: "OPEN",
          },
        });

        const initialComment = await client.wikiDiscussionComment.create({
          data: {
            threadId: thread.id,
            userId: effectiveUserId,
            countryId: effectiveCountryId,
            content: input.content.trim(),
            suggestedEdit: input.suggestedEdit?.trim() || null,
          },
        });

        return {
          threadId: thread.id,
          commentId: initialComment.id,
          articleTitle: thread.articleTitle,
        };
      });
    }),

  /**
   * Post a reply to an existing discussion thread.
   */
  postComment: lightMutationProcedure
    .input(
      z.object({
        threadId: z.string().max(64),
        content: z.string().min(1).max(20000),
        suggestedEdit: z.string().max(50000).optional(),
        countryId: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authUserId = requireWikiUserId(ctx);
      await requireNotBlocked(ctx);
      // Posting "as" a country is only allowed for a country the caller may write to.
      if (input.countryId) await assertCountryWriteAccess(ctx, input.countryId);
      const dbUser = ctx.user as any;
      const effectiveUserId = dbUser?.id || authUserId;
      const effectiveCountryId = input.countryId || dbUser?.countryId || null;
      const prismaClient = db as any;

      const thread = await prismaClient.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }
      await assertTitleVisible(ctx, thread.articleTitle);

      return db.$transaction(async (tx) => {
        const client = tx as any;
        const comment = await client.wikiDiscussionComment.create({
          data: {
            threadId: thread.id,
            userId: effectiveUserId,
            countryId: effectiveCountryId,
            content: input.content.trim(),
            suggestedEdit: input.suggestedEdit?.trim() || null,
          },
        });

        // Touch parent thread's updatedAt
        await client.wikiDiscussionThread.update({
          where: { id: thread.id },
          data: { updatedAt: new Date() },
        });

        return comment;
      });
    }),

  /**
   * Toggle thread resolution status (Hold-to-Resolve). Only the thread's creator or a sysop.
   */
  resolveThread: lightMutationProcedure
    .input(
      z.object({
        threadId: z.string().max(64),
        resolved: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      await requireNotBlocked(ctx);

      const thread = await db.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }
      await requireOwnerOrSysop(ctx, thread.createdBy, "resolve or reopen this thread");

      return db.wikiDiscussionThread.update({
        where: { id: input.threadId },
        data: {
          status: input.resolved ? "RESOLVED" : "OPEN",
          resolvedAt: input.resolved ? new Date() : null,
          resolvedBy: input.resolved ? userId : null,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Delete a discussion thread (creator or sysop only).
   */
  deleteThread: lightMutationProcedure
    .input(z.object({ threadId: z.string().max(64) }))
    .mutation(async ({ input, ctx }) => {
      requireWikiUserId(ctx);
      await requireNotBlocked(ctx);

      const thread = await db.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }
      await requireOwnerOrSysop(ctx, thread.createdBy, "delete this thread");

      await db.wikiDiscussionThread.delete({
        where: { id: input.threadId },
      });

      return { success: true };
    }),

  /**
   * Delete one comment (its author or a sysop only). A thread left without comments goes with it.
   */
  deleteComment: lightMutationProcedure
    .input(z.object({ commentId: z.string().max(64) }))
    .mutation(async ({ input, ctx }) => {
      requireWikiUserId(ctx);
      await requireNotBlocked(ctx);

      const comment = await db.wikiDiscussionComment.findUnique({
        where: { id: input.commentId },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      await requireOwnerOrSysop(ctx, comment.userId, "delete this comment");

      return db.$transaction(async (tx) => {
        await tx.wikiDiscussionComment.delete({ where: { id: comment.id } });
        const remaining = await tx.wikiDiscussionComment.count({
          where: { threadId: comment.threadId },
        });
        if (remaining === 0) {
          await tx.wikiDiscussionThread.delete({ where: { id: comment.threadId } });
        }
        return { success: true, threadDeleted: remaining === 0 };
      });
    }),
});
