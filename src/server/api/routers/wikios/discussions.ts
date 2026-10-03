import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { requireWikiUserId, isWikiAdmin, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

type PosterContext = Parameters<typeof assertCountryWriteAccess>[0] & WikiAuthContext;

/** Identity a comment/thread is written under; posting "as" a country needs write access to it. */
async function resolvePoster(ctx: PosterContext, countryId: string | undefined) {
  const authUserId = requireWikiUserId(ctx);
  if (countryId) await assertCountryWriteAccess(ctx, countryId);
  return {
    userId: ctx.user?.id || authUserId,
    countryId: countryId || ctx.user?.countryId || null,
  };
}

function commentData(
  threadId: string,
  poster: { userId: string; countryId: string | null },
  input: { content: string; suggestedEdit?: string }
) {
  return {
    threadId,
    userId: poster.userId,
    countryId: poster.countryId,
    content: input.content.trim(),
    suggestedEdit: input.suggestedEdit?.trim() || null,
  };
}

async function requireThread(threadId: string) {
  const thread = await db.wikiDiscussionThread.findUnique({ where: { id: threadId } });
  if (!thread) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
  }
  return thread;
}

type Person =
  | {
      wikiUsername?: string | null;
      discordUsername?: string | null;
      country?: { name: string } | null;
    }
  | null
  | undefined;

function displayName(person: Person, rawId: string | null) {
  const fallback = rawId?.startsWith("user_") ? rawId.slice(0, 12) : rawId;
  return (
    person?.wikiUsername || person?.discordUsername || person?.country?.name || fallback || "User"
  );
}

const normalizeTitle = (title: string) => title.trim().replace(/ /g, "_");

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
      const threads = await db.wikiDiscussionThread.findMany({
        where: {
          articleTitle: normalizeTitle(input.articleTitle),
          ...(input.status !== "ALL" && { status: input.status }),
        },
        include: { comments: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });

      // Collect all unique user IDs for batch hydration
      const ids = [
        ...new Set(
          threads
            .flatMap((t) => [t.createdBy, t.resolvedBy, ...t.comments.map((c) => c.userId)])
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const users =
        ids.length > 0
          ? await db.user.findMany({
              where: {
                OR: [
                  { id: { in: ids } },
                  { clerkUserId: { in: ids } },
                  { wikiUsername: { in: ids } },
                  { discordUserId: { in: ids } },
                ],
              },
              select: {
                id: true,
                clerkUserId: true,
                wikiUsername: true,
                discordUserId: true,
                discordUsername: true,
                role: { select: { name: true, displayName: true } },
                country: { select: { id: true, name: true, flag: true } },
              },
            })
          : [];

      const userMap = new Map<string, (typeof users)[0]>();
      for (const u of users) {
        for (const key of [u.id, u.clerkUserId, u.wikiUsername, u.discordUserId]) {
          if (key) userMap.set(key, u);
        }
      }

      const hydratedThreads = threads.map((t) => {
        const creator = userMap.get(t.createdBy);
        const resolver = t.resolvedBy ? userMap.get(t.resolvedBy) : null;

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
            ? { id: resolver.id, username: displayName(resolver, t.resolvedBy) }
            : null,
          createdBy: {
            id: t.createdBy,
            username: displayName(creator, t.createdBy),
            avatar: null,
            role: creator?.role || null,
            country: creator?.country || null,
          },
          teamId: t.teamId,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          comments: t.comments.map((c) => {
            const author = userMap.get(c.userId);
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
                username: displayName(author, c.userId),
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
      const poster = await resolvePoster(ctx, input.countryId);

      return db.$transaction(async (tx) => {
        const thread = await tx.wikiDiscussionThread.create({
          data: {
            articleTitle: normalizeTitle(input.articleTitle),
            title: input.title.trim(),
            sectionAnchor: input.sectionAnchor || null,
            selectedText: input.selectedText || null,
            anchorOffset: input.anchorOffset || null,
            teamId: input.teamId || null,
            countryId: poster.countryId,
            createdBy: poster.userId,
            status: "OPEN",
          },
        });

        const initialComment = await tx.wikiDiscussionComment.create({
          data: commentData(thread.id, poster, input),
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
      const poster = await resolvePoster(ctx, input.countryId);
      const thread = await requireThread(input.threadId);

      return db.$transaction(async (tx) => {
        const comment = await tx.wikiDiscussionComment.create({
          data: commentData(thread.id, poster, input),
        });

        // Touch parent thread's updatedAt
        await tx.wikiDiscussionThread.update({
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
      await requireThread(input.threadId);

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
   * Delete a discussion thread (creator or admin only).
   */
  deleteThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireWikiUserId(ctx);
      const admin = isWikiAdmin(ctx);
      const thread = await requireThread(input.threadId);

      if (thread.createdBy !== userId && !admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to delete this thread.",
        });
      }

      await db.wikiDiscussionThread.delete({ where: { id: input.threadId } });

      return { success: true };
    }),
});
