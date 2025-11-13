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
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TradeStatus, AcquireMethod } from "@prisma/client";

/**
 * Trade offer creation schema
 */
const createtradeOfferSchema = z.object({
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
const respondToTradeSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "COUNTER"]),
  // For counter offers
  newInitiatorCardIds: z.array(z.string()).optional(),
  newRecipientCardIds: z.array(z.string()).optional(),
  newInitiatorCredits: z.number().int().min(0).optional(),
  newRecipientCredits: z.number().int().min(0).optional(),
  counterMessage: z.string().max(500).optional(),
});

export const tradingRouter = createTRPCRouter({
  /**
   * Create a new trade offer
   */
  createtradeOffer: protectedProcedure
    .input(createtradeOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Verify initiator owns the cards they're offering
      const initiatorCards = await ctx.db.cardOwnership.findMany({
        where: {
          id: { in: input.initiatorCardIds },
          ownerId: userId,
          isLocked: false,
        },
        include: {
          cards: true,
        },
      });

      if (initiatorCards.length !== input.initiatorCardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You don't own all the cards you're trying to trade",
        });
      }

      // Verify recipient owns the cards being requested
      const recipientCards = await ctx.db.cardOwnership.findMany({
        where: {
          id: { in: input.recipientCardIds },
          ownerId: input.recipientId,
          isLocked: false,
        },
        include: {
          cards: true,
        },
      });

      if (recipientCards.length !== input.recipientCardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The recipient doesn't own all the requested cards",
        });
      }

      // Verify initiator has enough credits if offering any
      if (input.initiatorCredits > 0) {
        const vault = await ctx.db.myVault.findUnique({
          where: { userId },
        });

        if (!vault || vault.credits < input.initiatorCredits) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient credits",
          });
        }
      }

      // Calculate trade values
      const initiatorValue =
        initiatorCards.reduce((sum, c) => sum + c.cards.marketValue, 0) +
        input.initiatorCredits;
      const recipientValue =
        recipientCards.reduce((sum, c) => sum + c.cards.marketValue, 0) +
        input.recipientCredits;

      // Create trade offer (expires in 24 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const trade = await ctx.db.tradeOffer.create({
        data: {
          initiatorId: userId,
          recipientId: input.recipientId,
          initiatorCardIds: input.initiatorCardIds,
          recipientCardIds: input.recipientCardIds,
          initiatorCredits: input.initiatorCredits,
          recipientCredits: input.recipientCredits,
          message: input.message,
          status: "PENDING",
          expiresAt,
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
      });

      return trade;
    }),

  /**
   * Respond to a trade offer (accept/decline/counter)
   */
  respondToTrade: protectedProcedure
    .input(respondToTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      // Get the trade offer
      const trade = await ctx.db.tradeOffer.findUnique({
        where: { id: input.tradeId },
        include: {
          initiator: true,
          recipient: true,
        },
      });

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade offer not found",
        });
      }

      // Verify user is the recipient
      if (trade.recipientId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to respond to this trade",
        });
      }

      // Check if trade is still valid
      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade is no longer pending",
        });
      }

      if (new Date() > trade.expiresAt) {
        // Auto-expire the trade
        await ctx.db.tradeOffer.update({
          where: { id: input.tradeId },
          data: { status: TradeStatus.EXPIRED },
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade has expired",
        });
      }

      // Handle different actions
      if (input.action === "REJECT") {
        return await ctx.db.tradeOffer.update({
          where: { id: input.tradeId },
          data: { status: TradeStatus.REJECTED },
        });
      }

      if (input.action === "COUNTER") {
        // Create a counter-offer (new trade with roles reversed)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Use new values or fall back to original (swapped)
        const newInitiatorCardIds = (input.newInitiatorCardIds ?? trade.recipientCardIds) as string[];
        const newRecipientCardIds = (input.newRecipientCardIds ?? trade.initiatorCardIds) as string[];
        const newInitiatorCredits = input.newInitiatorCredits ?? trade.recipientCredits;
        const newRecipientCredits = input.newRecipientCredits ?? trade.initiatorCredits;

        // Verify ownership of cards in counter-offer
        const counterInitiatorCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: newInitiatorCardIds },
            ownerId: userId,
            isLocked: false,
          },
        });

        if (counterInitiatorCards.length !== newInitiatorCardIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cards in counter-offer",
          });
        }

        const counterRecipientCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: newRecipientCardIds },
            ownerId: trade.initiatorId,
            isLocked: false,
          },
        });

        if (counterRecipientCards.length !== newRecipientCardIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cards in counter-offer",
          });
        }

        // Mark original trade as rejected
        await ctx.db.tradeOffer.update({
          where: { id: input.tradeId },
          data: { status: TradeStatus.REJECTED },
        });

        // Create counter-offer
        return await ctx.db.tradeOffer.create({
          data: {
            initiatorId: userId,
            recipientId: trade.initiatorId,
            initiatorCardIds: newInitiatorCardIds,
            recipientCardIds: newRecipientCardIds,
            initiatorCredits: newInitiatorCredits,
            recipientCredits: newRecipientCredits,
            message: input.counterMessage,
            status: "PENDING",
            expiresAt,
            counterOfferFromId: input.tradeId,
          },
        });
      }

      // ACCEPT - Execute the trade atomically
      return await ctx.db.$transaction(async (tx) => {
        // Cast Json card IDs to string arrays
        const initiatorCardIds = trade.initiatorCardIds as string[];
        const recipientCardIds = trade.recipientCardIds as string[];

        // Transfer cards from initiator to recipient
        for (const cardId of initiatorCardIds) {
          await tx.cardOwnership.update({
            where: { id: cardId },
            data: {
              ownerId: trade.recipientId,
              userId: trade.recipientId,
              acquiredAt: new Date(),
              lastSaleDate: new Date(),
            },
          });
        }

        // Transfer cards from recipient to initiator
        for (const cardId of recipientCardIds) {
          await tx.cardOwnership.update({
            where: { id: cardId },
            data: {
              ownerId: trade.initiatorId,
              userId: trade.initiatorId,
              acquiredAt: new Date(),
              lastSaleDate: new Date(),
            },
          });
        }

        // Transfer credits if any
        if (trade.initiatorCredits > 0) {
          // Deduct from initiator
          await tx.myVault.update({
            where: { userId: trade.initiatorId },
            data: { credits: { decrement: trade.initiatorCredits } },
          });

          // Add to recipient
          await tx.myVault.update({
            where: { userId: trade.recipientId },
            data: { credits: { increment: trade.initiatorCredits } },
          });

          // Log transactions
          await tx.vaultTransaction.create({
            data: {
              vaultId: (await tx.myVault.findUnique({ where: { userId: trade.initiatorId } }))!.id,
              credits: -trade.initiatorCredits,
              balanceAfter: (await tx.myVault.findUnique({ where: { userId: trade.initiatorId } }))!.credits - trade.initiatorCredits,
              type: "SPEND_MARKET",
              source: "P2P_TRADE",
              metadata: { tradeId: input.tradeId },
            },
          });
        }

        if (trade.recipientCredits > 0) {
          // Deduct from recipient
          await tx.myVault.update({
            where: { userId: trade.recipientId },
            data: { credits: { decrement: trade.recipientCredits } },
          });

          // Add to initiator
          await tx.myVault.update({
            where: { userId: trade.initiatorId },
            data: { credits: { increment: trade.recipientCredits } },
          });
        }

        // Update trade status
        const completedTrade = await tx.tradeOffer.update({
          where: { id: input.tradeId },
          data: {
            status: TradeStatus.ACCEPTED,
            respondedAt: new Date(),
          },
        });

        return completedTrade;
      });
    }),

  /**
   * Get active trades (sent and received)
   */
  getActiveTrades: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

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
      const userId = ctx.auth.userId;

      const trades = await ctx.db.tradeOffer.findMany({
        where: {
          OR: [{ initiatorId: userId }, { recipientId: userId }],
          status: {
            in: [TradeStatus.ACCEPTED, TradeStatus.REJECTED, TradeStatus.CANCELLED, TradeStatus.EXPIRED],
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
            in: [TradeStatus.ACCEPTED, TradeStatus.REJECTED, TradeStatus.CANCELLED, TradeStatus.EXPIRED],
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
   * Cancel a pending trade
   */
  cancelTrade: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      const trade = await ctx.db.tradeOffer.findUnique({
        where: { id: input.tradeId },
      });

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found",
        });
      }

      // Only initiator can cancel
      if (trade.initiatorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the trade initiator can cancel",
        });
      }

      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade is no longer pending",
        });
      }

      return await ctx.db.tradeOffer.update({
        where: { id: input.tradeId },
        data: { status: TradeStatus.CANCELLED },
      });
    }),

  /**
   * Get trade details by ID
   */
  getTradeById: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

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

      return {
        ...trade,
        initiatorCardsData: initiatorCards,
        recipientCardsData: recipientCards,
      };
    }),
});
