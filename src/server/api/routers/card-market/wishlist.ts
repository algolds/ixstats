/** The signed-in player's wishlist (spec §2.3 Wishlist). */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
} from "~/server/modules/cards/market/wishlist";

const CardTarget = z.object({ cardId: z.string().min(1).max(64) });

export const cardMarketWishlistRouter = createTRPCRouter({
  getWishlist: protectedProcedure.query(({ ctx }) => listWishlist(ctx.db, ctx.user.id)),

  addToWishlist: rateLimitedMutationProcedure.input(CardTarget).mutation(async ({ ctx, input }) => {
    await addToWishlist(ctx.db, ctx.user.id, input.cardId);
    return { cardId: input.cardId, wished: true };
  }),

  removeFromWishlist: rateLimitedMutationProcedure
    .input(CardTarget)
    .mutation(async ({ ctx, input }) => {
      await removeFromWishlist(ctx.db, ctx.user.id, input.cardId);
      return { cardId: input.cardId, wished: false };
    }),
});
