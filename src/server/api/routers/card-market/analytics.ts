/**
 * Card Market Router
 *
 * tRPC router for IxCards marketplace and auction system
 * Provides endpoints for:
 * - Auction creation and management
 * - Bidding and buyouts
 * - Market analytics and trends
 * - Auction history and active listings
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auctionService } from "~/lib/auction-service";

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAnalyticsRouter = createTRPCRouter({
  /**
   * Get market trends and analytics
   * Admin-only endpoint
   */
  getMarketTrends: protectedProcedure
    .input(
      z.object({
        cardId: z.string().optional(),
        timeRange: z.enum(["24h", "7d", "30d"]).optional().default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const trends = await auctionService.getMarketTrends(
          {
            cardId: input.cardId,
            timeRange: input.timeRange,
          },
          ctx.db
        );

        return trends;
      } catch (error) {
        console.error("[Card Market Router] Error getting market trends:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch market trends",
        });
      }
    }),

  /**
   * Get card value history for market chart
   * Returns CardValueHistory records if available, or computes from completed auctions
   */
  getCardValueHistory: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await ctx.db.cardValueHistory.findMany({
          where: { cardId: input.cardId },
          orderBy: { recordedAt: "asc" },
          take: 100,
        });

        if (history.length > 0) return history;

        // Fallback: compute from completed auctions for this card
        const ownerships = await ctx.db.cardOwnership.findMany({
          where: { cardId: input.cardId },
          select: { id: true },
        });

        if (ownerships.length === 0) return [];

        const auctions = await ctx.db.cardAuction.findMany({
          where: {
            cardInstanceId: { in: ownerships.map((o) => o.id) },
            status: "COMPLETED",
            finalPrice: { not: null },
          },
          orderBy: { endTime: "asc" },
          select: { finalPrice: true, endTime: true },
          take: 100,
        });

        return auctions.map((a) => ({
          cardId: input.cardId,
          value: a.finalPrice!,
          recordedAt: a.endTime,
        }));
      } catch (error) {
        console.error("[Card Market Router] Error getting card value history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch value history",
        });
      }
    }),

  /**
   * Dust a card for credits (30% of its market value)
   */
  dustCard: protectedProcedure
    .input(z.object({ cardId: z.string().min(1, "Card ID is required") }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Find the ownership record
      const ownership = await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.cardId,
          ownerId: userId,
          isLocked: false,
        },
        include: {
          cards: true,
        },
      });

      if (!ownership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found or is locked",
        });
      }

      // Calculate dusted credits amount: 30% of card's market value
      const marketValue = ownership.cards.marketValue || 0;
      const creditsAmount = Math.max(1, Math.round(marketValue * 0.3));

      // Retrieve user's vault
      const vault = await ctx.db.myVault.findUnique({
        where: { userId },
      });
      if (!vault) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vault not found for user",
        });
      }

      // Atomically delete ownership and award credits
      await ctx.db.$transaction(async (tx) => {
        // Delete ownership record
        await tx.cardOwnership.delete({
          where: { id: ownership.id },
        });

        // Award credits to the user's vault
        const updatedVault = await tx.myVault.update({
          where: { userId },
          data: { credits: { increment: creditsAmount } },
        });

        // Log the vault transaction
        await tx.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            credits: creditsAmount,
            balanceAfter: updatedVault.credits,
            type: "REFUND",
            source: "CARD_DUST",
            metadata: {
              cardId: ownership.cardId,
              serialNumber: ownership.serialNumber,
              marketValue,
            },
          },
        });
      });

      return {
        success: true,
        creditsAwarded: creditsAmount,
        message: `Successfully dusted card for ${creditsAmount} IxC.`,
      };
    }),

  /**
   * Permanent inscription on a card ownership record
   */
  inscribeCard: protectedProcedure
    .input(
      z.object({
        ownershipId: z.string().min(1, "Ownership ID is required"),
        inscription: z
          .string()
          .min(1, "Inscription cannot be empty")
          .max(60, "Inscription must be 60 characters or less"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const ownership = await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.ownershipId,
          ownerId: userId,
          isLocked: false,
        },
      });

      if (!ownership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not owned or is locked",
        });
      }

      if (ownership.inscription !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This card is already inscribed",
        });
      }

      const updated = await ctx.db.cardOwnership.update({
        where: { id: ownership.id },
        data: {
          inscription: input.inscription,
          inscribedById: userId,
          inscribedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Card successfully inscribed!",
        card: updated,
      };
    }),

  getCardTransferHistory: protectedProcedure
    .input(z.object({ ownershipId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const dbAny = ctx.db as any;
      const events = await dbAny.cardTransferEvent.findMany({
        where: { ownershipId: input.ownershipId },
        orderBy: { createdAt: "desc" },
      });

      // Fetch user names for all unique user IDs involved
      const userIds = Array.from(
        new Set(events.flatMap((e: any) => [e.fromUserId, e.toUserId]).filter(Boolean))
      ) as string[];

      const users = await ctx.db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          country: {
            select: { name: true, flag: true },
          },
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u.country?.name || "System/Unknown"]));

      return events.map((event: any) => ({
        ...event,
        fromUserName: event.fromUserId ? userMap.get(event.fromUserId) || "Unknown" : null,
        toUserName: userMap.get(event.toUserId) || "Unknown",
      }));
    })
});
