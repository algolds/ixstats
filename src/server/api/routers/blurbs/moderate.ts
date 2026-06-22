/**
 * blurbs.ts — Blurbs (Topic Tuesday) tRPC router.
 * Admin-created prompts with user-submitted cultural dispatches per country.
 */

import { z } from "zod/v4";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { requireWikiUserId } from "~/lib/wiki-os/auth";
import { db } from "~/server/db";

export const blurbsModerateRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Public endpoints
  // ---------------------------------------------------------------------------

  /** Get all prompts (admin view includes drafts, closed, archived). */
  getAllPrompts: adminProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
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

  // ---------------------------------------------------------------------------
  // Protected endpoints (authenticated users)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Admin endpoints
  // ---------------------------------------------------------------------------

  /** Create a new prompt. */
  createPrompt: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        question: z.string().min(1).max(500),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/),
        status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
        scheduledFor: z.string().datetime().optional(),
        closedAt: z.string().datetime().optional(),
        isRecurring: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
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
          createdBy: userId,
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

  /** Toggle featured flag on a prompt. */
  featurePrompt: adminProcedure
    .input(
      z.object({
        promptId: z.string().min(1),
        featured: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      return db.blurbPrompt.update({
        where: { id: input.promptId },
        data: { featured: input.featured },
      });
    }),
});
