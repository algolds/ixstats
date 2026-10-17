/** Mine: the caller's own copies (spec §2.3). */
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { listMine, MineQuerySchema } from "~/lib/cards/hub/mine";

export const cardsMineRouter = createTRPCRouter({
  listMine: protectedProcedure
    .input(MineQuerySchema)
    .query(({ ctx, input }) => listMine(ctx.db, ctx.user.id, input)),
});
