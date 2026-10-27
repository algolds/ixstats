import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { setCardSeason } from "~/server/modules/cards/cards.seasons";
import { adminActor } from "~/server/shared/admin-actor";

export const cardsAdminSeasonsRouter = createTRPCRouter({
  get: adminProcedure.query(({ ctx }) => getCurrentIxCardSeason(ctx.db)),
  // The range check lives in setCardSeason, so the toast shows its sentence rather than zod's issue list.
  set: adminProcedure
    .input(z.object({ season: z.number() }))
    .mutation(({ ctx, input }) => setCardSeason(ctx.db, adminActor(ctx), input.season)),
});
