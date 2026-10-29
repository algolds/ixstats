/**
 * Account deletion (Privacy 5.2): the pending request, asking for it and cancelling it during the 14-day grace.
 * The erasure itself runs from the account-erasure cron.
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  cancelAccountDeletion,
  getAccountDeletion,
  requestAccountDeletion,
} from "~/server/modules/identity/identity.account-deletion";

export const usersAccountDeletionRouter = createTRPCRouter({
  getAccountDeletion: protectedProcedure.query(({ ctx }) =>
    getAccountDeletion(ctx.db, ctx.user.id)
  ),

  requestAccountDeletion: rateLimitedMutationProcedure
    .input(z.object({ confirmHandle: z.string().max(320) }))
    .mutation(({ ctx, input }) =>
      requestAccountDeletion(ctx.db, {
        user: ctx.user,
        confirmHandle: input.confirmHandle,
        impersonating: Boolean(ctx.impersonatorId),
      })
    ),

  cancelAccountDeletion: rateLimitedMutationProcedure.mutation(({ ctx }) =>
    cancelAccountDeletion(ctx.db, {
      userId: ctx.user.id,
      impersonating: Boolean(ctx.impersonatorId),
    })
  ),
});
