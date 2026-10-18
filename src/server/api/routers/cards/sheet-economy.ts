/** The card sheet's economy half: the viewer's copies' values and actions, fusion, crafting and the wishlist state. */
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getSheetEconomy } from "~/server/modules/cards/sheet-economy";
import { displayNameOf } from "./_passport";

export const cardsSheetEconomyRouter = createTRPCRouter({
  /** Signed in only (the sheet asks only then, M10). The signer's name is the one `inscribe` freezes. */
  getSheetEconomy: protectedProcedure
    .input(z.object({ cardId: z.string().min(1).max(64) }))
    .query(({ ctx, input }) => getSheetEconomy(ctx.db, ctx.user.id, input.cardId, displayNameOf)),
});
