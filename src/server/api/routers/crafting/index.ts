/**
 * The card workshop (the `crafting` name, reused): the numbers card screens preview with, dust balances, breaking
 * copies down and fusing duplicates. Thin: every procedure validates, calls the workshop module and returns.
 */
import { z } from "zod";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import {
  createTRPCRouter,
  protectedProcedure,
  publicReadOnlyProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { breakDownCopies } from "~/server/modules/cards/workshop/breakdown";
import { getDustBalances } from "~/server/modules/cards/workshop/dust-ledger";
import { workshopCall } from "~/server/modules/cards/workshop/errors";
import { fuseCopies } from "~/server/modules/cards/workshop/fusion";
import { getPublicEconomyNumbers } from "~/server/modules/cards/workshop/numbers";

const copies = z.object({ ownershipIds: z.array(z.string().min(1).max(64)).min(1).max(100) });

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
});
