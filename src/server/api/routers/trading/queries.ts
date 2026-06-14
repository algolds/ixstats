/**
 * P2P Trading Router
 *
 * Provides endpoints for peer-to-peer card trading:
 * - Create trade offers
 * - Accept/decline/counter trades
 * - View active trades
 * - View trade history
 * - Cancel pending trades
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TradeStatus } from "@prisma/client";

/**
 * Trade offer creation schema
 */
const _createtradeOfferSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  initiatorCardIds: z.array(z.string()).min(1, "At least one card must be offered"),
  recipientCardIds: z.array(z.string()).min(1, "At least one card must be requested"),
  initiatorCredits: z.number().int().min(0).default(0),
  recipientCredits: z.number().int().min(0).default(0),
  message: z.string().max(500).optional(),
});

/**
 * Trade response schema
 */
const _respondToTradeSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "COUNTER"]),
  // For counter offers
  newInitiatorCardIds: z.array(z.string()).optional(),
  newRecipientCardIds: z.array(z.string()).optional(),
  newInitiatorCredits: z.number().int().min(0).optional(),
  newRecipientCredits: z.number().int().min(0).optional(),
  counterMessage: z.string().max(500).optional(),
});

type _CreateTradeOfferInput = z.infer<typeof _createtradeOfferSchema>;
type _RespondToTradeInput = z.infer<typeof _respondToTradeSchema>;

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
      include: {
        initiator: {
          select: {
            id: true,
            clerkUserId: true,
            country: {
              select: {
                name: true,
                flag: true,
              },
            },
          },
        },
        recipient: {
          select: {
            id: true,
            clerkUserId: true,
            country: {
              select: {
                name: true,
                flag: true,
              },
            },
          },
        },
      },
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

      const trades = await ctx.db.tradeOffer.findMany({
        where: {
          OR: [{ initiatorId: userId }, { recipientId: userId }],
          status: {
            in: [
              TradeStatus.ACCEPTED,
              TradeStatus.REJECTED,
              TradeStatus.CANCELLED,
              TradeStatus.EXPIRED,
            ],
          },
        },
        include: {
          initiator: {
            select: {
              id: true,
              clerkUserId: true,
              country: {
                select: {
                  name: true,
                  flag: true,
                },
              },
            },
          },
          recipient: {
            select: {
              id: true,
              clerkUserId: true,
              country: {
                select: {
                  name: true,
                  flag: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await ctx.db.tradeOffer.count({
        where: {
          OR: [{ initiatorId: userId }, { recipientId: userId }],
          status: {
            in: [
              TradeStatus.ACCEPTED,
              TradeStatus.REJECTED,
              TradeStatus.CANCELLED,
              TradeStatus.EXPIRED,
            ],
          },
        },
      });

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
        include: {
          initiator: {
            select: {
              id: true,
              clerkUserId: true,
              country: {
                select: {
                  name: true,
                  flag: true,
                },
              },
            },
          },
          recipient: {
            select: {
              id: true,
              clerkUserId: true,
              country: {
                select: {
                  name: true,
                  flag: true,
                },
              },
            },
          },
        },
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
