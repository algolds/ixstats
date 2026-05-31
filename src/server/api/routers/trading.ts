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
import { TradeStatus, type Prisma } from "@prisma/client";
import { syncUserToForum } from "~/modules/forum";
import { notificationAPI } from "~/lib/notification-api";
import { getVaultConfig } from "~/lib/vault-service";
import { grantCardXp } from "~/lib/card-xp-utils";

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

type CreateTradeOfferInput = z.infer<typeof createtradeOfferSchema>;
type RespondToTradeInput = z.infer<typeof respondToTradeSchema>;

export const tradingRouter = createTRPCRouter({
  /**
   * Create a new trade offer
   */
  createtradeOffer: protectedProcedure
    .input(createtradeOfferSchema)
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        const initiatorDbId = ctx.user.id;

        const config = await getVaultConfig(ctx.db);
        if (config.isMaintenanceMode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vault economy is currently in maintenance mode.",
          });
        }
        if (!config.isTradingEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "P2P card trading is currently disabled globally.",
          });
        }

        // Resolve recipient's clerkUserId to database CUID
        const recipientUser = await ctx.db.user.findUnique({
          where: { clerkUserId: input.recipientId },
        });
        if (!recipientUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipient user not found",
          });
        }
        const recipientDbId = recipientUser.id;

        // Verify initiator owns the cards they're offering
        const initiatorCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: input.initiatorCardIds },
            ownerId: initiatorDbId,
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

        if (initiatorCards.some((c: any) => c.inscription !== null)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inscribed cards cannot be traded",
          });
        }

        // Verify recipient owns the cards being requested
        const recipientCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: input.recipientCardIds },
            ownerId: recipientDbId,
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

        if (recipientCards.some((c: any) => c.inscription !== null)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inscribed cards cannot be traded",
          });
        }

        // Verify initiator has enough credits if offering any
        if (input.initiatorCredits > 0) {
          const vault = await ctx.db.myVault.findUnique({
            where: { userId: initiatorDbId },
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
          initiatorCards.reduce(
            (sum: number, c: { cards: { marketValue: number } }) => sum + c.cards.marketValue,
            0
          ) + input.initiatorCredits;
        const recipientValue =
          recipientCards.reduce((sum: number, c: any) => sum + c.cards.marketValue, 0) +
          input.recipientCredits;

        // Create trade offer (expires in 24 hours) — atomically lock initiator's cards
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const trade = await ctx.db.$transaction(async (tx: any) => {
          await tx.cardOwnership.updateMany({
            where: { id: { in: input.initiatorCardIds } },
            data: { isLocked: true },
          });

          return await tx.tradeOffer.create({
            data: {
              initiatorId: initiatorDbId,
              recipientId: recipientDbId,
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
        });

        // Notify the recipient about the incoming trade offer
        try {
          const senderName = trade.initiator?.country?.name ?? "A player";
          await notificationAPI.create({
            title: "New Trade Offer",
            message: `${senderName} sent you a trade offer with ${input.initiatorCardIds.length} card(s)`,
            userId: input.recipientId,
            category: "economic",
            priority: "high",
            type: "info",
            source: "trading",
            href: "/vault",
            actionable: true,
            metadata: { tradeId: trade.id, cardCount: input.initiatorCardIds.length },
          });
        } catch (e) {
          console.warn("[Notifications] trading.createtradeOffer:", e);
        }

        return trade;
      }
    ),

  /**
   * Respond to a trade offer (accept/decline/counter)
   */
  respondToTrade: protectedProcedure
    .input(respondToTradeSchema)
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        const userId = ctx.user.id;

        const config = await getVaultConfig(ctx.db);
        if (config.isMaintenanceMode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vault economy is currently in maintenance mode.",
          });
        }
        if (!config.isTradingEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "P2P card trading is currently disabled globally.",
          });
        }

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
          return await ctx.db.$transaction(async (tx: any) => {
            const initiatorCardIds = trade.initiatorCardIds as string[];

            await tx.cardOwnership.updateMany({
              where: { id: { in: initiatorCardIds } },
              data: { isLocked: false },
            });

            return await tx.tradeOffer.update({
              where: { id: input.tradeId },
              data: { status: TradeStatus.REJECTED },
            });
          });
        }

        if (input.action === "COUNTER") {
          // Create a counter-offer (new trade with roles reversed)
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          // Use new values or fall back to original (swapped)
          const newInitiatorCardIds = (input.newInitiatorCardIds ??
            trade.recipientCardIds) as string[];
          const newRecipientCardIds = (input.newRecipientCardIds ??
            trade.initiatorCardIds) as string[];
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

          if (counterInitiatorCards.some((c: any) => c.inscription !== null)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Inscribed cards cannot be traded",
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

          if (counterRecipientCards.some((c: any) => c.inscription !== null)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Inscribed cards cannot be traded",
            });
          }

          // Atomically unlock original offer's cards, lock counter-offer's cards, and create counter
          return await ctx.db.$transaction(async (tx: any) => {
            const originalInitiatorCardIds = trade.initiatorCardIds as string[];

            await tx.cardOwnership.updateMany({
              where: { id: { in: originalInitiatorCardIds } },
              data: { isLocked: false },
            });

            await tx.cardOwnership.updateMany({
              where: { id: { in: newInitiatorCardIds } },
              data: { isLocked: true },
            });

            await tx.tradeOffer.update({
              where: { id: input.tradeId },
              data: { status: TradeStatus.REJECTED },
            });

            return await tx.tradeOffer.create({
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
          });
        }

        // ACCEPT - Execute the trade atomically
        const completedTrade = await ctx.db.$transaction(async (tx: any) => {
          // Cast Json card IDs to string arrays
          const initiatorCardIds = trade.initiatorCardIds as string[];
          const recipientCardIds = trade.recipientCardIds as string[];
          const now = new Date();

          // Unlock and transfer cards from initiator to recipient (batch update)
          await tx.cardOwnership.updateMany({
            where: { id: { in: initiatorCardIds } },
            data: {
              ownerId: trade.recipientId,
              userId: trade.recipientId,
              isLocked: false,
              acquiredAt: now,
              lastSaleDate: now,
            },
          });

          // Grant 25 XP per card traded to recipient and log transfer
          for (const ownershipId of initiatorCardIds) {
            await grantCardXp(tx as any, ownershipId, 25, "TRADE", JSON.stringify({ tradeId: input.tradeId }));
            await (tx as any).cardTransferEvent.create({
              data: {
                ownershipId,
                fromUserId: trade.initiatorId,
                toUserId: trade.recipientId,
                action: "TRADE",
              },
            });
          }

          // Unlock and transfer cards from recipient to initiator (batch update)
          await tx.cardOwnership.updateMany({
            where: { id: { in: recipientCardIds } },
            data: {
              ownerId: trade.initiatorId,
              userId: trade.initiatorId,
              isLocked: false,
              acquiredAt: now,
              lastSaleDate: now,
            },
          });

          // Grant 25 XP per card traded to initiator and log transfer
          for (const ownershipId of recipientCardIds) {
            await grantCardXp(tx as any, ownershipId, 25, "TRADE", JSON.stringify({ tradeId: input.tradeId }));
            await (tx as any).cardTransferEvent.create({
              data: {
                ownershipId,
                fromUserId: trade.recipientId,
                toUserId: trade.initiatorId,
                action: "TRADE",
              },
            });
          }

          // Transfer credits if any
          if (trade.initiatorCredits > 0) {
            // Deduct from initiator and capture result to avoid redundant query
            const initiatorVault = await tx.myVault.update({
              where: { userId: trade.initiatorId },
              data: { credits: { decrement: trade.initiatorCredits } },
            });

            // Add to recipient
            await tx.myVault.update({
              where: { userId: trade.recipientId },
              data: { credits: { increment: trade.initiatorCredits } },
            });

            // Log transactions using cached vault data (fixes redundant queries)
            await tx.vaultTransaction.create({
              data: {
                vaultId: initiatorVault.id,
                credits: -trade.initiatorCredits,
                balanceAfter: initiatorVault.credits, // Already decremented by the update
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
          const updatedTrade = await tx.tradeOffer.update({
            where: { id: input.tradeId },
            data: {
              status: TradeStatus.ACCEPTED,
              respondedAt: new Date(),
            },
          });

          return updatedTrade;
        });

        // Sync both traders to forum profile (fire-and-forget)
        syncUserToForum(trade.initiatorId).catch((err: unknown) => {
          console.error("[Trading] Background op failed:", (err as Error).message);
        });
        syncUserToForum(trade.recipientId).catch((err: unknown) => {
          console.error("[Trading] Background op failed:", (err as Error).message);
        });

        // Notify initiator that their trade was accepted
        try {
          await notificationAPI.create({
            title: "Trade Accepted",
            message: "Your trade offer has been accepted! Cards have been exchanged.",
            userId: trade.initiator.clerkUserId,
            category: "economic",
            priority: "high",
            type: "success",
            source: "trading",
            href: "/vault",
            metadata: { tradeId: input.tradeId },
          });
        } catch (e) {
          console.warn("[Notifications] trading.respondToTrade:", e);
        }

        return completedTrade;
      }
    ),

  /**
   * Get active trades (sent and received)
   */
  getActiveTrades: protectedProcedure.query(
    async ({
      ctx,
    }) => {
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
    }
  ),

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
    .query(
      async ({
        ctx,
        input,
      }) => {
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
      }
    ),

  /**
   * Cancel a pending trade
   */
  cancelTrade: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        const userId = ctx.user.id;

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

        return await ctx.db.$transaction(async (tx: any) => {
          const initiatorCardIds = trade.initiatorCardIds as string[];

          await tx.cardOwnership.updateMany({
            where: { id: { in: initiatorCardIds } },
            data: { isLocked: false },
          });

          return await tx.tradeOffer.update({
            where: { id: input.tradeId },
            data: { status: TradeStatus.CANCELLED },
          });
        });
      }
    ),

  /**
   * Get trade details by ID
   */
  getTradeById: protectedProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .query(
      async ({
        ctx,
        input,
      }) => {
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
      }
    ),

  /**
   * Gift a card to another player
   */
  giftCard: protectedProcedure
    .input(z.object({
      recipientId: z.string().min(1, "Recipient ID is required"),
      cardId: z.string().min(1, "Card ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const initiatorDbId = ctx.user.id;

      const config = await getVaultConfig(ctx.db);
      if (config.isMaintenanceMode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vault economy is currently in maintenance mode.",
        });
      }
      if (!config.isTradingEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gifting/trading is currently disabled globally.",
        });
      }

      // Resolve recipient's clerkUserId to database CUID
      const recipientUser = await ctx.db.user.findUnique({
        where: { clerkUserId: input.recipientId },
      });
      if (!recipientUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient user not found",
        });
      }
      const recipientDbId = recipientUser.id;

      if (recipientDbId === initiatorDbId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot gift a card to yourself",
        });
      }

      // Verify initiator owns the card and it is not locked/inscribed
      const ownership = (await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.cardId,
          ownerId: initiatorDbId,
          isLocked: false,
        },
      })) as any;

      if (!ownership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You do not own this card or it is locked",
        });
      }

      if (ownership.inscription !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inscribed cards cannot be gifted",
        });
      }

      const now = new Date();

      // Execute 1-way trade (gift) atomically
      const trade = await ctx.db.$transaction(async (tx: any) => {
        // Create accepted trade offer record for logging
        const tradeOffer = await tx.tradeOffer.create({
          data: {
            initiatorId: initiatorDbId,
            recipientId: recipientDbId,
            initiatorCardIds: [ownership.id],
            recipientCardIds: [],
            initiatorCredits: 0,
            recipientCredits: 0,
            status: "ACCEPTED",
            respondedAt: now,
            expiresAt: now,
            message: "Gift",
          },
        });

        // Transfer card ownership
        await tx.cardOwnership.update({
          where: { id: ownership.id },
          data: {
            ownerId: recipientDbId,
            userId: recipientDbId,
            isLocked: false,
            acquiredAt: now,
            lastSaleDate: now,
          },
        });

        // Log provenance event
        await tx.cardTransferEvent.create({
          data: {
            ownershipId: ownership.id,
            fromUserId: initiatorDbId,
            toUserId: recipientDbId,
            action: "GIFT",
          },
        });

        // Grant 25 XP
        await grantCardXp(tx, ownership.id, 25, "GIFT", JSON.stringify({ tradeId: tradeOffer.id }));

        return tradeOffer;
      });

      // Notify the recipient
      try {
        const sender = await ctx.db.user.findUnique({
          where: { id: initiatorDbId },
          include: { country: true },
        });
        const senderName = sender?.country?.name ?? "A player";
        await notificationAPI.create({
          title: "Card Gift Received",
          message: `${senderName} gifted you a card!`,
          userId: input.recipientId,
          category: "economic",
          priority: "high",
          type: "success",
          source: "trading",
          href: "/vault",
        });
      } catch (e) {
        console.warn("[Notifications] giftCard:", e);
      }

      return trade;
    }),

  /**
   * Search potential trading partners by country name or username
   */
  searchTradingPartners: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (query.length < 2) return [];

      const currentUserId = ctx.user.id;

      const users = await ctx.db.user.findMany({
        where: {
          id: { not: currentUserId },
          isActive: true,
          OR: [
            {
              country: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { leader: { contains: query, mode: "insensitive" } },
                ],
              },
            },
            {
              forumUsername: { contains: query, mode: "insensitive" },
            },
            {
              wikiUsername: { contains: query, mode: "insensitive" },
            },
            {
              discordUsername: { contains: query, mode: "insensitive" },
            },
          ],
        },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              leader: true,
              economicTier: true,
              flag: true,
            },
          },
        },
        take: 15,
      });

      return users.map((user) => ({
        id: user.clerkUserId,
        dbId: user.id,
        countryName: user.country?.name || "Unknown Country",
        leader: user.country?.leader || "Unknown Leader",
        economicTier: user.country?.economicTier || "Unknown",
        username:
          user.forumUsername || user.wikiUsername || user.discordUsername || "Unnamed Player",
        flag: user.country?.flag || null,
      }));
    }),
});
