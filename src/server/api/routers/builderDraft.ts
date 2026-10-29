import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";

/** A founding draft is a few kilobytes; anything far larger is not a draft. */
const MAX_DRAFT_JSON_LENGTH = 100_000;

/**
 * Per-user server-side autosave for the country builder's create-mode draft.
 *
 * protectedProcedure only — available to every authenticated user with no role
 * or country-ownership gate, so in-progress builds persist across sessions and
 * devices for all users. (Edit mode persists to the Country row separately.)
 */
export const builderDraftRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth?.userId) return null;
    const draft = await ctx.db.builderDraft.findUnique({
      where: { userId: ctx.auth.userId },
    });
    return draft ? { data: draft.data, updatedAt: draft.updatedAt } : null;
  }),

  save: rateLimitedMutationProcedure
    .input(
      z.object({
        data: z.custom<Prisma.InputJsonValue>(
          (val) =>
            typeof val === "object" &&
            val !== null &&
            !Array.isArray(val) &&
            JSON.stringify(val).length <= MAX_DRAFT_JSON_LENGTH
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth?.userId) return { success: false };
      await ctx.db.builderDraft.upsert({
        where: { userId: ctx.auth.userId },
        create: { userId: ctx.auth.userId, data: input.data },
        update: { data: input.data },
      });
      return { success: true };
    }),

  clear: rateLimitedMutationProcedure.mutation(async ({ ctx }) => {
    if (!ctx.auth?.userId) return { success: false };
    await ctx.db.builderDraft.deleteMany({ where: { userId: ctx.auth.userId } });
    return { success: true };
  }),
});
