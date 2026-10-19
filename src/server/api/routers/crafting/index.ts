/**
 * The card workshop (the `crafting` name, reused): the numbers card screens preview with, dust balances, breaking
 * copies down, fusing duplicates and crafting cards. Thin: every procedure validates, calls the workshop module and
 * returns.
 */
import { z } from "zod";
import { MAX_WORKSHOP_COPIES } from "~/lib/cards/dust";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import {
  createTRPCRouter,
  protectedProcedure,
  publicReadOnlyProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { breakDownCopies } from "~/server/modules/cards/workshop/breakdown";
import { craftCard } from "~/server/modules/cards/workshop/craft";
import { getDustBalances } from "~/server/modules/cards/workshop/dust-ledger";
import { workshopCall } from "~/server/modules/cards/workshop/errors";
import { fuseCopies } from "~/server/modules/cards/workshop/fusion";
import { getPublicEconomyNumbers } from "~/server/modules/cards/workshop/numbers";

const copies = z.object({
  ownershipIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_WORKSHOP_COPIES),
});

export const craftingRouter = createTRPCRouter({
  getNumbers: publicReadOnlyProcedure.query(({ ctx }) => getPublicEconomyNumbers(ctx.db)),

  getDust: protectedProcedure.query(({ ctx }) => getDustBalances(ctx.db, ctx.user.id)),

  breakDown: rateLimitedMutationProcedure.input(copies).mutation(async ({ ctx, input }) => {
    const result = await workshopCall(() =>
      breakDownCopies(ctx.db, { userId: ctx.user.id, ownershipIds: input.ownershipIds })
    );
    await clearVaultCachesFor(ctx.db, [ctx.user.id]);
    return result;
  }),

  fuse: rateLimitedMutationProcedure.input(copies).mutation(async ({ ctx, input }) => {
    const result = await workshopCall(() =>
      fuseCopies(ctx.db, { userId: ctx.user.id, ownershipIds: input.ownershipIds })
    );
    await clearVaultCachesFor(ctx.db, [ctx.user.id]);
    return result;
  }),

  craft: rateLimitedMutationProcedure
    .input(z.object({ cardId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const result = await craftCard(ctx.db, { userId: ctx.user.id, cardId: input.cardId });
      await clearVaultCachesFor(ctx.db, [ctx.user.id]);
      return result;
    }),
});
