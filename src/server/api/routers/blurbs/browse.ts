/**
 * blurbs.ts — Blurbs (Topic Tuesday) tRPC router.
 * Admin-created prompts with user-submitted cultural dispatches per country.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

export const blurbsBrowseRouter = createTRPCRouter({
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

  // ---------------------------------------------------------------------------
  // Admin endpoints
  // ---------------------------------------------------------------------------

  /** Random active prompt (for WikiOS homepage — cycles on each load). */
  getRandomActivePrompt: publicProcedure.query(async () => {
    const activePrompts = await db.blurbPrompt.findMany({
      where: { status: "ACTIVE" },
      include: { _count: { select: { responses: true } } },
    });
    if (activePrompts.length === 0) return null;

    // Prefer featured prompts (50% chance if any exist), otherwise random
    const featured = activePrompts.filter((p) => p.featured);
    if (featured.length > 0 && Math.random() < 0.5) {
      return featured[Math.floor(Math.random() * featured.length)]!;
    }
    return activePrompts[Math.floor(Math.random() * activePrompts.length)]!;
  }),
});
