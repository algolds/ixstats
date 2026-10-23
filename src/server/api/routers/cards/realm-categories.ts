/** A realm's founder (and site admins) set the category of the realm's lore cards, in Manage → Cards. */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { CategoryChoiceSchema } from "~/lib/cards/category-taxonomy";
import {
  listRealmCategoryCards,
  REALM_CATEGORY_SHOWS,
  setRealmCardCategory,
} from "~/server/modules/cards/cards.realm-categories";

const slug = z.string().min(1).max(100);

export const cardsRealmCategoriesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        slug,
        search: z.string().trim().max(200).optional(),
        show: z.enum(REALM_CATEGORY_SHOWS).default("all"),
        offset: z.number().int().min(0).default(0),
        // The section shows more by asking for a longer first page
        limit: z.number().int().min(1).max(1000).default(50),
      })
    )
    .query(({ ctx, input }) => listRealmCategoryCards(ctx.db, ctx.user, input)),

  set: rateLimitedMutationProcedure
    .input(z.object({ slug, cardId: z.string().min(1).max(64), choice: CategoryChoiceSchema }))
    .mutation(({ ctx, input }) => setRealmCardCategory(ctx.db, ctx.user, input)),
});
