/** A signed-in player's takedown request for a card that is not from NationStates, filed into Compliance. */
import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { requestTakedown } from "~/server/modules/cards/cards.compliance";

export const cardsTakedownsRouter = createTRPCRouter({
  requestTakedown: rateLimitedMutationProcedure
    .input(
      z.object({
        cardId: z.string().min(1).max(64),
        reason: z.string().trim().min(10).max(1000),
        contact: z.string().trim().max(200).optional(),
      })
    )
    .mutation(({ ctx, input }) => requestTakedown(ctx.db, { ...input, requesterId: ctx.user.id })),
});
