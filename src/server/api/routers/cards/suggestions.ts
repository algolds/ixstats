/** Players' suggestions: free lore cards, and a lore card's category. */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { cardArticleSourceSchema } from "~/lib/cards/card-sources";
import {
  SuggestCategoryInputSchema,
  suggestCategory,
} from "~/server/modules/cards/cards.category-suggestions";
import { mySuggestions, suggestCard } from "~/server/modules/cards/cards.suggestions";

export const cardsSuggestionsRouter = createTRPCRouter({
  suggestCard: rateLimitedMutationProcedure
    .input(z.object({ source: cardArticleSourceSchema, title: z.string().min(1).max(255) }))
    .mutation(({ ctx, input }) => suggestCard(ctx.db, ctx.user.id, input)),
  suggestCategory: rateLimitedMutationProcedure
    .input(SuggestCategoryInputSchema)
    .mutation(({ ctx, input }) => suggestCategory(ctx.db, ctx.user.id, input)),
  mySuggestions: protectedProcedure.query(({ ctx }) => mySuggestions(ctx.db, ctx.user.id)),
});
