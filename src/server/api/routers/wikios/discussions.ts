/**
 * discussions.ts — WikiOS Margin Discussions & Threaded Discourse Router.
 *
 * Provides high-performance, indexed endpoints for WikiOS Margin:
 * - Thread creation, querying, resolution, and comments
 * - Margin gutter pin anchors & text-anchored commentary
 * - Author & country hydration for discussion threads
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { requireWikiUserId, isWikiAdmin } from "~/lib/wiki-os/auth";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

interface HydratedComment {
  id: string;
  threadId: string;
  userId: string;
  countryId: string | null;
  content: string;
  suggestedEdit: string | null;
  reactions: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface HydratedThread {
  id: string;
  articleTitle: string;
  status: "OPEN" | "RESOLVED" | "ARCHIVED";
  title: string;
  sectionAnchor: string | null;
  selectedText: string | null;
  anchorOffset: number | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdBy: string;
  countryId: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  comments: HydratedComment[];
}

export const wikiosDiscussionsRouter = createTRPCRouter({
  /**
   * Get all active threads, comments, and annotations for an article's Margin inspector.
   */
  getArticleMarginData: publicProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1).max(500),
        status: z.enum(["ALL", "OPEN", "RESOLVED", "ARCHIVED"]).default("OPEN"),
      })
    )
    .query(async ({ input }) => {
      const normalizedTitle = input.articleTitle.trim().replace(/ /g, "_");

      const whereClause: {
        articleTitle: string;
        status?: "OPEN" | "RESOLVED" | "ARCHIVED";
      } = {
        articleTitle: normalizedTitle,
      };

      if (input.status !== "ALL") {
        whereClause.status = input.status;
      }

      // Fetch threads + comments
      const prismaClient = db as any;
      const threads: HydratedThread[] = await prismaClient.wikiDiscussionThread.findMany({
        where: whereClause,
        include: {
          comments: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });

      // Collect all unique user IDs for batch hydration
      const userIds = new Set<string>();
      for (const t of threads) {
        if (t.createdBy) userIds.add(t.createdBy);
        if (t.resolvedBy) userIds.add(t.resolvedBy);
        for (const c of t.comments) {
          if (c.userId) userIds.add(c.userId);
        }
      }

      const users = userIds.size > 0
        ? await db.user.findMany({
            where: {
              OR: [
                { id: { in: Array.from(userIds) } },
                { clerkUserId: { in: Array.from(userIds) } },
                { wikiUsername: { in: Array.from(userIds) } },
                { discordUserId: { in: Array.from(userIds) } },
              ],
            },
            select: {
              id: true,
              clerkUserId: true,
              wikiUsername: true,
              discordUserId: true,
              discordUsername: true,
              role: {
                select: {
                  name: true,
                  displayName: true,
                },
              },
              country: {
                select: {
                  id: true,
                  name: true,
                  flag: true,
                },
              },
            },
          })
        : [];

      const userMap = new Map<string, typeof users[0]>();
      for (const u of users) {
        userMap.set(u.id, u);
        if (u.clerkUserId) userMap.set(u.clerkUserId, u);
        if (u.wikiUsername) userMap.set(u.wikiUsername, u);
        if (u.discordUserId) userMap.set(u.discordUserId, u);
      }

      // Hydrate threads with author data
      const hydratedThreads = threads.map((t: HydratedThread) => {
        const creator = userMap.get(t.createdBy);
        const resolver = t.resolvedBy ? userMap.get(t.resolvedBy) : null;
        const creatorName =
          creator?.wikiUsername ||
          creator?.discordUsername ||
          creator?.country?.name ||
          (t.createdBy.startsWith("user_") ? t.createdBy.slice(0, 12) : t.createdBy) ||
          "User";
        const resolverName =
          resolver?.wikiUsername ||
          resolver?.discordUsername ||
          resolver?.country?.name ||
          (t.resolvedBy && t.resolvedBy.startsWith("user_") ? t.resolvedBy.slice(0, 12) : t.resolvedBy) ||
          "User";

        return {
          id: t.id,
          articleTitle: t.articleTitle,
          status: t.status,
          title: t.title,
          sectionAnchor: t.sectionAnchor,
          selectedText: t.selectedText,
          anchorOffset: t.anchorOffset,
          resolvedAt: t.resolvedAt,
          resolvedBy: resolver
            ? {
                id: resolver.id,
                username: resolverName,
              }
            : null,
          createdBy: {
            id: t.createdBy,
            username: creatorName,
            avatar: null,
            role: creator?.role || null,
            country: creator?.country || null,
          },
          teamId: t.teamId,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          comments: t.comments.map((c: HydratedComment) => {
            const author = userMap.get(c.userId);
            const authorName =
              author?.wikiUsername ||
              author?.discordUsername ||
              author?.country?.name ||
              (c.userId.startsWith("user_") ? c.userId.slice(0, 12) : c.userId) ||
              "User";

            return {
              id: c.id,
              threadId: c.threadId,
              content: c.content,
              suggestedEdit: c.suggestedEdit,
              reactions: (c.reactions as Record<string, number> | null) || {},
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
              author: {
                id: c.userId,
                username: authorName,
                avatar: null,
                role: author?.role || null,
                country: author?.country || null,
              },
            };
          }),
        };
      });

      return {
        threads: hydratedThreads,
        totalOpenCount: threads.filter((t) => t.status === "OPEN").length,
        totalResolvedCount: threads.filter((t) => t.status === "RESOLVED").length,
      };
    }),

  /**
   * Create a new discussion thread anchored to a section or selected text.
   */
  createThread: protectedProcedure
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
      const dbUser = ctx.user as any;
      const effectiveUserId = dbUser?.id || authUserId;
      const effectiveCountryId = input.countryId || dbUser?.countryId || null;
      const normalizedTitle = input.articleTitle.trim().replace(/ /g, "_");

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
  postComment: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        content: z.string().min(1).max(20000),
        suggestedEdit: z.string().max(50000).optional(),
        countryId: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authUserId = requireWikiUserId(ctx);
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
   * Toggle thread resolution status (Hold-to-Resolve).
   */
  resolveThread: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        resolved: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const prismaClient = db as any;

      const thread = await prismaClient.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }

      return prismaClient.wikiDiscussionThread.update({
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
   * Toggle an emoji reaction on a comment.
   */
  toggleCommentReaction: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        emoji: z.string().min(1).max(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const _userId = requireWikiUserId(ctx);
      const prismaClient = db as any;

      const comment = await prismaClient.wikiDiscussionComment.findUnique({
        where: { id: input.commentId },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      const existingReactions = (comment.reactions as Record<string, number> | null) || {};
      const currentCount = existingReactions[input.emoji] || 0;
      const updatedReactions = {
        ...existingReactions,
        [input.emoji]: Math.max(0, currentCount + 1),
      };

      return prismaClient.wikiDiscussionComment.update({
        where: { id: input.commentId },
        data: { reactions: updatedReactions },
      });
    }),

  /**
   * Delete a discussion thread (creator or admin only).
   */
  deleteThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const admin = isWikiAdmin(ctx);
      const prismaClient = db as any;

      const thread = await prismaClient.wikiDiscussionThread.findUnique({
        where: { id: input.threadId },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }

      if (thread.createdBy !== userId && !admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to delete this thread.",
        });
      }

      await prismaClient.wikiDiscussionThread.delete({
        where: { id: input.threadId },
      });

      return { success: true };
    }),

  /**
   * Delete a discussion comment (author or admin only).
   */
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const admin = isWikiAdmin(ctx);
      const prismaClient = db as any;

      const comment = await prismaClient.wikiDiscussionComment.findUnique({
        where: { id: input.commentId },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      if (comment.userId !== userId && !admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to delete this comment.",
        });
      }

      await prismaClient.wikiDiscussionComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),
});
