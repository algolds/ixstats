import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getTradeDetails } from "~/server/modules/cards/trading/trade-queries";
import {
  FINISHED_TRADE_STATUSES,
  TRADE_PARTIES_INCLUDE,
  withPartyName,
  withPartyNames,
} from "./_shared";

export const tradingQueriesRouter = createTRPCRouter({
  /**
   * The open trades, sent and received. Each says whether it waits on the viewer: the other party wrote its current
   * table (a counter-offer turns it around), and only unexpired offers are listed.
   */
  getActiveTrades: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const trades = await ctx.db.tradeOffer.findMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: TRADE_PARTIES_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const named = await withPartyNames(trades);
    return named.map((trade) => ({ ...trade, myTurn: trade.proposerId !== userId }));
  }),

  /**
   * Get trade history (completed/rejected/cancelled)
   */
  getTradeHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const where = {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
        status: { in: FINISHED_TRADE_STATUSES },
      };

      const trades = await ctx.db.tradeOffer.findMany({
        where,
        include: TRADE_PARTIES_INCLUDE,
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await ctx.db.tradeOffer.count({ where });

      return {
        trades: await withPartyNames(trades),
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * One trade for one of its parties: both sides' faces, values and inscriptions, the fee preview, whose turn it is,
   * and both parties named by the identity rule.
   */
  getTradeById: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .query(async ({ ctx, input }) =>
      withPartyName(await getTradeDetails(ctx.db, ctx.user.id, input.tradeId))
    ),
});
