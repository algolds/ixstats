/** Signing a copy and reporting an inscription (spec §2.2); the report queue is the admin's Compliance tab. */
import { z } from "zod";
import { INSCRIPTION_MAX } from "~/lib/cards/inscription";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { inscribeCopy, reportInscription } from "~/server/modules/cards/inscriptions";
import { displayNameOf } from "./_passport";

const ownershipId = z.string().min(1).max(64);

export const cardsInscriptionsRouter = createTRPCRouter({
  /**
   * The raw text may run past 60 before it is cleaned (invisible characters, spaces), so the cap here only bounds the
   * payload; the module holds the cleaned text to 60. The name frozen with it is the one other players read.
   */
  inscribe: rateLimitedMutationProcedure
    .input(z.object({ ownershipId, text: z.string().max(INSCRIPTION_MAX * 4) }))
    .mutation(async ({ ctx, input }) =>
      inscribeCopy(ctx.db, {
        userId: ctx.user.id,
        ...input,
        now: new Date(),
        signerName: await displayNameOf(ctx.user.id),
      })
    ),

  /** The module trims the reason and holds it to 500. */
  reportInscription: rateLimitedMutationProcedure
    .input(z.object({ ownershipId, reason: z.string().max(1000) }))
    .mutation(({ ctx, input }) => reportInscription(ctx.db, { reporterId: ctx.user.id, ...input })),
});
