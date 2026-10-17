import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  cardsActivity,
  cardsOverview,
  findCards,
  realmOptions,
} from "~/server/modules/cards/cards.overview";

export const cardsAdminOverviewRouter = createTRPCRouter({
  summary: adminProcedure.query(({ ctx }) => cardsOverview(ctx.db)),
  activity: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(({ ctx, input }) => cardsActivity(ctx.db, input.limit)),
  realms: adminProcedure.query(({ ctx }) => realmOptions(ctx.db)),
  findCards: adminProcedure
    .input(z.object({ query: z.string().min(2).max(100) }))
    .query(({ ctx, input }) => findCards(ctx.db, input.query)),
});
