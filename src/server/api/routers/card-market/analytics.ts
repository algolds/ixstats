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

/**
 * Card Market Router
 * Handles all auction and marketplace operations
 */
export const cardMarketAnalyticsRouter = createTRPCRouter({
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
    }),
});
