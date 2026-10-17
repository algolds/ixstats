import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { MAX_CARD_SEASON, setCardSeason } from "~/server/modules/cards/cards.seasons";
import { adminActor } from "./_actor";

export const cardsAdminSeasonsRouter = createTRPCRouter({
  get: adminProcedure.query(({ ctx }) => getCurrentIxCardSeason(ctx.db)),
  set: adminProcedure
    .input(z.object({ season: z.number().int().min(1).max(MAX_CARD_SEASON) }))
    .mutation(({ ctx, input }) => setCardSeason(ctx.db, adminActor(ctx), input.season)),
});
