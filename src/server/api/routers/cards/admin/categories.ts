/**
 * The category review queue (Curation): the classifier's low-confidence guesses and players' suggestions. Approve
 * sends the row's own category, change a new one, reject Uncategorised; all are the admin's (`setCardCategory`).
 */
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { CategoryChoiceSchema } from "~/lib/cards/category-taxonomy";
import { setCardCategory } from "~/server/modules/cards/cards.categories";
import {
  answerCategorySuggestion,
  listCategoryClassifications,
  listCategorySuggestions,
} from "~/server/modules/cards/cards.category-review";
import { adminActor } from "~/server/shared/admin-actor";
import { staffNames } from "./_staff-names";

const page = z.object({
  offset: z.number().int().min(0).default(0),
  // The queue shows more by asking for a longer first page
  limit: z.number().int().min(1).max(1000).default(50),
});

export const cardsAdminCategoriesRouter = createTRPCRouter({
  classifications: adminProcedure
    .input(page)
    .query(({ ctx, input }) => listCategoryClassifications(ctx.db, input)),

  /** Each suggestion names its player for staff; the raw user id never leaves the server. */
  suggestions: adminProcedure.input(page).query(async ({ ctx, input }) => {
    const { rows, total } = await listCategorySuggestions(ctx.db, input);
    const names = await staffNames(rows.map((row) => row.userId));
    return {
      rows: rows.map(({ userId, ...row }) => ({ ...row, player: names.get(userId) ?? null })),
      total,
    };
  }),

  set: adminProcedure
    .input(z.object({ cardId: z.string().min(1), choice: CategoryChoiceSchema }))
    .mutation(({ ctx, input }) =>
      setCardCategory(ctx.db, {
        cardId: input.cardId,
        choice: input.choice,
        source: "ADMIN",
        editor: adminActor(ctx),
      })
    ),

  answerSuggestion: adminProcedure
    .input(
      z.object({
        suggestionId: z.string().min(1),
        decision: z.enum(["ACCEPT", "CHANGE", "REJECT"]),
        choice: CategoryChoiceSchema.optional(),
      })
    )
    .mutation(({ ctx, input }) => answerCategorySuggestion(ctx.db, adminActor(ctx), input)),
});
