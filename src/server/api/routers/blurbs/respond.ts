/**
 * blurbs.ts — Blurbs (Topic Tuesday) tRPC router.
 * Admin-created prompts with user-submitted cultural dispatches per country.
 */

import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { requireWikiAuthId, requireWikiUserId } from "~/lib/wiki-os/auth";
import { findWikiUserByAuthId } from "~/lib/wiki-os/storage";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import {
  cursorPageInput,
  cursorPageArgs,
  trimCursorPage,
  PROMPT_SUMMARY,
  COUNTRY_BADGE,
} from "./_shared";

export const blurbsRespondRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Protected endpoints (authenticated users)
  // ---------------------------------------------------------------------------

  /** All of the current user's blurb responses. */
  getMyBlurbs: protectedProcedure
    .input(
      z.object({
        ...cursorPageInput,
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await findWikiUserByAuthId(requireWikiAuthId(ctx));
      if (!user) return { responses: [], nextCursor: undefined };

      const responses = await db.blurbResponse.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        ...cursorPageArgs(input),
        include: {
          prompt: PROMPT_SUMMARY,
          country: COUNTRY_BADGE,
        },
      });

      const page = trimCursorPage(responses, input.limit);
      return { responses: page.rows, nextCursor: page.nextCursor };
    }),

  /** Check if current user already responded to a prompt. */
  getMyResponse: protectedProcedure
    .input(z.object({ promptId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await findWikiUserByAuthId(requireWikiAuthId(ctx));
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
  submitResponse: rateLimitedMutationProcedure
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
      // Look up the user and their country by the Clerk id (findWikiUserByAuthId matches
      // User.clerkUserId; requireWikiUserId returns the internal User id).
      const authId = requireWikiAuthId(ctx);
      const user = await findWikiUserByAuthId(authId);
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
          authId,
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

  /** User-submitted prompt (goes to DRAFT for admin review). */
  submitPrompt: rateLimitedMutationProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        question: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireWikiUserId(ctx);
      // Auto-generate slug from title
      const baseSlug = input.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      // Append short random suffix to avoid collisions
      const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

      return db.blurbPrompt.create({
        data: {
          title: input.title,
          question: input.question,
          slug,
          status: "DRAFT",
          createdBy: userId,
        },
      });
    }),
});

// ---------------------------------------------------------------------------
// ThinkPages cross-posting helper
// ---------------------------------------------------------------------------

async function crossPostToThinkPages(
  authId: string,
  countryId: string,
  content: string,
  promptTitle: string,
  promptSlug: string
): Promise<string | null> {
  // Find or skip — if user doesn't have a ThinkPages account, don't create one
  // C3 residual: thinkpagesAccount has its own clerkUserId column (not the User
  // identity seam) — out of scope for the wiki-os storage seam.
  const account = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId: authId, countryId },
    select: { id: true },
  });
  if (!account) return null;

  // Embed structured metadata prefix for ThinkPages to render distinctively
  const prefix = `[blurb:${promptSlug}|${promptTitle}]\n\n`;
  const maxContent = 280 - prefix.length;
  const truncated =
    content.length > maxContent ? content.slice(0, maxContent - 3) + "..." : content;

  const post = await db.thinkpagesPost.create({
    data: {
      accountId: account.id,
      content: (prefix + truncated).slice(0, 280),
      postType: "original",
      hashtags: JSON.stringify(["blurb", "topictuesday"]),
      visibility: "public",
      isAutoGenerated: true,
      ixTimeTimestamp: new Date(),
    },
  });

  return post.id;
}
