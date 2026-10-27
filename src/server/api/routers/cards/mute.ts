/** The per-card mute (spec §2.3 Notifications): the signed-in player gets no notices about a card they muted. */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { isCardMuted, setCardMute } from "~/lib/cards/card-notify";
import { isMissingRecord } from "~/lib/prisma-error";

const CardTarget = z.object({ cardId: z.string().min(1).max(64) });

export const cardsMuteRouter = createTRPCRouter({
  getCardMute: protectedProcedure
    .input(CardTarget)
    .query(({ ctx, input }) => isCardMuted(ctx.db, ctx.user.id, input.cardId)),

  setCardMute: rateLimitedMutationProcedure
    .input(CardTarget.extend({ muted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await setCardMute(ctx.db, ctx.user.id, input.cardId, input.muted);
      } catch (error) {
        // The mute's card is a foreign key: an unknown card is the caller's mistake, not a server error.
        if (isMissingRecord(error))
          throw new TRPCError({ code: "NOT_FOUND", message: "No such card" });
        throw error;
      }
      return { muted: input.muted };
    }),
});
