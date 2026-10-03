import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TradeStatus } from "@prisma/client";
import { FINISHED_TRADE_STATUSES, TRADE_PARTIES_INCLUDE } from "./_shared";

export const tradingQueriesRouter = createTRPCRouter({
  /**
   * Get active trades (sent and received)
   */
  getActiveTrades: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const trades = await ctx.db.tradeOffer.findMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
        status: TradeStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: TRADE_PARTIES_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return trades;
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
        trades,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get trade details by ID
   */
  getTradeById: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const trade = await ctx.db.tradeOffer.findUnique({
        where: { id: input.tradeId },
        include: TRADE_PARTIES_INCLUDE,
      });

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found",
        });
      }

      // Verify user is involved in trade
      if (trade.initiatorId !== userId && trade.recipientId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to view this trade",
        });
      }

      // Fetch card details for both sides
      const initiatorCards = await ctx.db.cardOwnership.findMany({
        where: { id: { in: trade.initiatorCardIds as string[] } },
        include: {
          cards: true,
        },
      });

      const recipientCards = await ctx.db.cardOwnership.findMany({
        where: { id: { in: trade.recipientCardIds as string[] } },
        include: {
          cards: true,
        },
      });

      const initiatorValue =
        initiatorCards.reduce((sum: number, c: any) => sum + (c.cards.marketValue || 0), 0) +
        trade.initiatorCredits;

      const recipientValue =
        recipientCards.reduce((sum: number, c: any) => sum + (c.cards.marketValue || 0), 0) +
        trade.recipientCredits;

      return {
        ...trade,
        initiatorCardsData: initiatorCards,
        recipientCardsData: recipientCards,
        initiatorValue,
        recipientValue,
      };
    }),
});
