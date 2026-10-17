import { z } from "zod";
import { CardFinish } from "~/lib/cards/enums";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  adminCancelAuction,
  awardPack,
  grantCard,
  playerCardInventory,
  revokeCopy,
  voidTrade,
} from "~/server/modules/cards/cards.tools";
import { adminActor } from "./_actor";

const reason = z.string().trim().min(3).max(500);

export const cardsAdminToolsRouter = createTRPCRouter({
  playerCards: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(({ ctx, input }) => playerCardInventory(ctx.db, input.userId)),
  grant: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        cardId: z.string().min(1),
        finish: z.enum(CardFinish).default("STANDARD"),
        reason,
      })
    )
    .mutation(({ ctx, input }) => grantCard(ctx.db, adminActor(ctx), input)),
  revoke: adminProcedure
    .input(z.object({ ownershipId: z.string().min(1), reason }))
    .mutation(({ ctx, input }) => revokeCopy(ctx.db, adminActor(ctx), input)),
  cancelAuction: adminProcedure
    .input(z.object({ auctionId: z.string().min(1), reason }))
    .mutation(({ ctx, input }) => adminCancelAuction(ctx.db, adminActor(ctx), input)),
  voidTrade: adminProcedure
    .input(z.object({ tradeId: z.string().min(1), reason }))
    .mutation(({ ctx, input }) => voidTrade(ctx.db, adminActor(ctx), input)),
  awardPack: adminProcedure
    .input(z.object({ userId: z.string().min(1), packId: z.string().min(1) }))
    .mutation(({ ctx, input }) => awardPack(ctx.db, adminActor(ctx), input)),
});
