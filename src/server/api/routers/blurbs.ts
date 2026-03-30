/**
 * blurbs.ts — Blurbs (Topic Tuesday) tRPC router.
 * Admin-created prompts with user-submitted cultural dispatches per country.
 */

import { z } from "zod/v4";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

export const blurbsRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Public endpoints
  // ---------------------------------------------------------------------------

  /** List active prompts, newest first. */
  getActivePrompts: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const prompts = await db.blurbPrompt.findMany({
        where: { status: "ACTIVE" },
        orderBy: { publishedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: {
          _count: { select: { responses: true } },
        },
      });

      let nextCursor: string | undefined;
      if (prompts.length > input.limit) {
        nextCursor = prompts.pop()!.id;
      }

      return { prompts, nextCursor };
    }),

  /** Get all prompts (admin view includes drafts, closed, archived). */
  getAllPrompts: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      return db.blurbPrompt.findMany({
        where: input.status ? { status: input.status } : undefined,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          _count: { select: { responses: true } },
        },
      });
    }),

  /** Get a single prompt by slug with response count. */
  getPrompt: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const prompt = await db.blurbPrompt.findUnique({
        where: { slug: input.slug },
        include: {
          _count: { select: { responses: true } },
        },
      });
      if (!prompt) throw new TRPCError({ code: "NOT_FOUND" });
      return prompt;
    }),

  /** Paginated responses for a prompt. */
  getResponsesForPrompt: publicProcedure
    .input(
      z.object({
        promptId: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
        featuredFirst: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const responses = await db.blurbResponse.findMany({
        where: { promptId: input.promptId },
        orderBy: input.featuredFirst
          ? [{ featured: "desc" }, { createdAt: "desc" }]
          : { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: {
          user: {
            select: {
              id: true,
              clerkUserId: true,
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          country: { select: { id: true, name: true, flag: true } },
        },
      });

      let nextCursor: string | undefined;
      if (responses.length > input.limit) {
        nextCursor = responses.pop()!.id;
      }

      return { responses, nextCursor };
    }),

  /** All blurbs for a given country (gallery view). */
  getResponsesForCountry: publicProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const responses = await db.blurbResponse.findMany({
        where: { countryId: input.countryId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: {
          prompt: { select: { id: true, title: true, question: true, slug: true } },
          user: {
            select: {
              id: true,
              clerkUserId: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (responses.length > input.limit) {
        nextCursor = responses.pop()!.id;
      }

      return { responses, nextCursor };
    }),

  /** Total blurb response count (for WikiOS homepage stat card). */
  getBlurbCount: publicProcedure.query(async () => {
    return db.blurbResponse.count();
  }),

  // ---------------------------------------------------------------------------
  // Protected endpoints (authenticated users)
  // ---------------------------------------------------------------------------

  /** Check if current user already responded to a prompt. */
  getMyResponse: protectedProcedure
    .input(z.object({ promptId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });
      if (!user) return null;

      return db.blurbResponse.findUnique({
        where: {
          promptId_userId: {
            promptId: input.promptId,
            userId: user.id,
          },
        },
        include: {
          prompt: { select: { title: true, question: true, slug: true } },
        },
      });
    }),

  /** Submit a response to a prompt. One per user per prompt. */
  submitResponse: protectedProcedure
    .input(
      z.object({
        promptId: z.string().min(1),
        content: z.string().min(1).max(1000),
        linkedArticles: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
            })
          )
          .max(5)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Look up the user and their country
      const user = await db.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true, countryId: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      if (!user.countryId)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You must have a country to submit a blurb",
        });

      // Verify prompt is active
      const prompt = await db.blurbPrompt.findUnique({
        where: { id: input.promptId },
        select: { id: true, status: true, slug: true, title: true },
      });
      if (!prompt || prompt.status !== "ACTIVE")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Prompt is not active" });

      // Check for existing response
      const existing = await db.blurbResponse.findUnique({
        where: {
          promptId_userId: {
            promptId: input.promptId,
            userId: user.id,
          },
        },
      });
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already responded to this prompt",
        });

      // Create response + auto-cross-post to ThinkPages
      let thinkpagesPostId: string | null = null;
      try {
        thinkpagesPostId = await crossPostToThinkPages(
          ctx.userId,
          user.countryId,
          input.content,
          prompt.title,
          prompt.slug
        );
      } catch {
        // Non-fatal — blurb still saves if cross-post fails
      }

      const response = await db.blurbResponse.create({
        data: {
          promptId: input.promptId,
          userId: user.id,
          countryId: user.countryId,
          content: input.content,
          linkedArticles: input.linkedArticles ?? undefined,
          thinkpagesPostId,
        },
        include: {
          prompt: { select: { title: true, slug: true } },
          country: { select: { name: true } },
        },
      });

      return response;
    }),

  /** Update own response (within 24h). */
  updateResponse: protectedProcedure
    .input(
      z.object({
        responseId: z.string().min(1),
        content: z.string().min(1).max(1000),
        linkedArticles: z
          .array(z.object({ title: z.string(), url: z.string() }))
          .max(5)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const response = await db.blurbResponse.findUnique({
        where: { id: input.responseId },
      });
      if (!response || response.userId !== user.id)
        throw new TRPCError({ code: "NOT_FOUND" });

      // 24h edit window
      const editWindow = 24 * 60 * 60 * 1000;
      if (Date.now() - response.createdAt.getTime() > editWindow)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Edit window (24h) has expired",
        });

      return db.blurbResponse.update({
        where: { id: input.responseId },
        data: {
          content: input.content,
          linkedArticles: input.linkedArticles ?? undefined,
        },
      });
    }),

  // ---------------------------------------------------------------------------
  // Admin endpoints
  // ---------------------------------------------------------------------------

  /** Create a new prompt. */
  createPrompt: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        question: z.string().min(1).max(500),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
        scheduledFor: z.string().datetime().optional(),
        closedAt: z.string().datetime().optional(),
        isRecurring: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.blurbPrompt.create({
        data: {
          title: input.title,
          question: input.question,
          slug: input.slug,
          status: input.status,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          closedAt: input.closedAt ? new Date(input.closedAt) : null,
          isRecurring: input.isRecurring,
          publishedAt: input.status === "ACTIVE" ? new Date() : null,
          createdBy: ctx.userId,
        },
      });
    }),

  /** Update a prompt (status, question, close date, etc.). */
  updatePrompt: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        question: z.string().min(1).max(500).optional(),
        status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
        closedAt: z.string().datetime().nullable().optional(),
        isRecurring: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.question !== undefined) data.question = input.question;
      if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
      if (input.closedAt !== undefined)
        data.closedAt = input.closedAt ? new Date(input.closedAt) : null;

      if (input.status !== undefined) {
        data.status = input.status;
        if (input.status === "ACTIVE") {
          // Set publishedAt if transitioning to active
          const existing = await db.blurbPrompt.findUnique({
            where: { id: input.id },
            select: { publishedAt: true },
          });
          if (!existing?.publishedAt) data.publishedAt = new Date();
        }
      }

      return db.blurbPrompt.update({
        where: { id: input.id },
        data,
      });
    }),

  /** Toggle featured flag on a response. */
  featureResponse: adminProcedure
    .input(
      z.object({
        responseId: z.string().min(1),
        featured: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      return db.blurbResponse.update({
        where: { id: input.responseId },
        data: { featured: input.featured },
      });
    }),
});

// ---------------------------------------------------------------------------
// ThinkPages cross-posting helper
// ---------------------------------------------------------------------------

async function crossPostToThinkPages(
  clerkUserId: string,
  countryId: string,
  content: string,
  promptTitle: string,
  promptSlug: string
): Promise<string | null> {
  // Find or skip — if user doesn't have a ThinkPages account, don't create one
  const account = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId, countryId },
    select: { id: true },
  });
  if (!account) return null;

  // Truncate for ThinkPages (280 char limit)
  const truncated =
    content.length > 220
      ? content.slice(0, 220) + "..."
      : content;

  const postContent = `${truncated}\n\n${promptTitle} — Read full blurb → /blurbs/${promptSlug}`;

  const post = await db.thinkpagesPost.create({
    data: {
      accountId: account.id,
      content: postContent.slice(0, 280),
      postType: "original",
      hashtags: ["blurb", "topictuesday"],
      visibility: "public",
    },
  });

  return post.id;
}
