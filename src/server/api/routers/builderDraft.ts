import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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

  save: protectedProcedure.input(z.object({ data: z.any() })).mutation(async ({ ctx, input }) => {
    if (!ctx.auth?.userId) return { success: false };
    await ctx.db.builderDraft.upsert({
      where: { userId: ctx.auth.userId },
      create: { userId: ctx.auth.userId, data: input.data },
      update: { data: input.data },
    });
    return { success: true };
  }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.auth?.userId) return { success: false };
    await ctx.db.builderDraft.deleteMany({ where: { userId: ctx.auth.userId } });
    return { success: true };
  }),
});
