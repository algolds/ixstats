import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  SpecialCardSchema,
  listSpecialCards,
  rewardAchievementOptions,
  saveSpecialCard,
} from "~/server/modules/cards/cards.designer";
import { adminActor } from "~/server/shared/admin-actor";

export const cardsAdminDesignerRouter = createTRPCRouter({
  list: adminProcedure.query(({ ctx }) => listSpecialCards(ctx.db)),
  save: adminProcedure
    .input(SpecialCardSchema)
    .mutation(({ ctx, input }) => saveSpecialCard(ctx.db, adminActor(ctx), input)),
  achievements: adminProcedure.query(() => rewardAchievementOptions()),
});
