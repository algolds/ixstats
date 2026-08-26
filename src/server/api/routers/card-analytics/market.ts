/**
 * Card Analytics Router
 *
 * tRPC router for IxCards economy analytics for Intelligence dashboard
 * Provides endpoints for:
 * - Card economy overview metrics
 * - Historical card value trends
 * - GDP correlation analysis
 * - Recent market activity
 * - User portfolio performance
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";

/**
 * Card Economy Overview Data
 */
interface CardEconomyData {
  nationCardValue: number;
  change30Days: number;
  changePercent: number;
  gdpCorrelation: number;
  totalCards: number;
  totalValue: number;
  topCard: {
    id: string;
    title: string;
    value: number;
    rarity: string;
  } | null;
}

/**
 * Historical Value Point
 */
interface ValueHistoryPoint {
  date: string;
  cardValue: number;
  gdpValue: number | null;
}

/**
 * GDP Correlation Data Point
 */
interface CorrelationDataPoint {
  gdpPerCapita: number;
  cardValue: number;
  date: string;
}

/**
 * Market Activity Record
 */
interface MarketActivity {
  id: string;
  cardId: string;
  cardTitle: string;
  type: "BID" | "BUYOUT" | "SALE" | "LISTING";
  price: number;
  buyerId: string | null;
  sellerId: string;
  timestamp: Date;
  status: string;
}

/**
 * Portfolio Performance Metrics
 */
interface PortfolioPerformance {
  totalCards: number;
  totalValue: number;
  topPerformer: {
    cardId: string;
    title: string;
    currentValue: number;
    gain: number;
    gainPercent: number;
  } | null;
  recentAcquisitions: Array<{
    cardId: string;
    title: string;
    acquiredAt: Date;
    acquisitionPrice: number;
    currentValue: number;
  }>;
  valueByRarity: Record<string, { count: number; value: number }>;
}

/**
 * Calculate GDP correlation coefficient (Pearson's r)
 */
function calculateCorrelation(dataPoints: Array<{ x: number; y: number }>): number {
  if (dataPoints.length < 2) return 0;

  const n = dataPoints.length;
  const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0);
  const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0);
  const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = dataPoints.reduce((sum, p) => sum + p.y * p.y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Get card economy overview for a country
 */
async function getCardEconomyOverview(
  db: PrismaClient,
  countryId: string
): Promise<CardEconomyData> {
  // Get country's cards (cards associated with the country)
  const countryCards = await db.card.findMany({
    where: { countryId },
    select: {
      id: true,
      title: true,
      marketValue: true,
      rarity: true,
      createdAt: true,
    },
    orderBy: { marketValue: "desc" },
  });

  const totalCards = countryCards.length;
  const totalValue = countryCards.reduce((sum, c) => sum + c.marketValue, 0);
  const nationCardValue = totalValue / Math.max(totalCards, 1);

  // Calculate 30-day change (mock for now - would use historical data)
  const change30Days = nationCardValue * 0.05; // 5% mock growth
  const changePercent = (change30Days / Math.max(nationCardValue - change30Days, 1)) * 100;

  // Get country GDP for correlation calculation
  const _country = await db.country.findUnique({
    where: { id: countryId },
    select: { currentGdpPerCapita: true },
  });

  // Mock correlation (would calculate from historical data)
  const gdpCorrelation = 0.72;

  const topCard = countryCards[0]
    ? {
        id: countryCards[0].id,
        title: countryCards[0].title,
        value: countryCards[0].marketValue,
        rarity: countryCards[0].rarity,
      }
    : null;

  return {
    nationCardValue,
    change30Days,
    changePercent,
    gdpCorrelation,
    totalCards,
    totalValue,
    topCard,
  };
}

/**
 * Card Analytics Router
 */
export const cardAnalyticsMarketRouter = createTRPCRouter({
  /**
   * Get recent market activity for a card
   */
  getCardMarketActivity: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1, "Card ID is required"),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get recent auctions for this card
        const auctions = await ctx.db.cardAuction.findMany({
          where: {
            CardOwnership: {
              cardId: input.cardId,
            },
          },
          select: {
            id: true,
            sellerId: true,
            currentBid: true,
            finalPrice: true,
            winnerId: true,
            status: true,
            buyoutPrice: true,
            createdAt: true,
            updatedAt: true,
            CardOwnership: {
              select: {
                cards: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        const activities: MarketActivity[] = auctions.map((auction) => {
          const isCompleted = auction.status === "COMPLETED";
          const price = isCompleted ? auction.finalPrice || 0 : auction.currentBid;
          const type = isCompleted
            ? auction.finalPrice === auction.buyoutPrice
              ? ("BUYOUT" as const)
              : ("SALE" as const)
            : ("BID" as const);

          return {
            id: auction.id,
            cardId: auction.CardOwnership.cards.id,
            cardTitle: auction.CardOwnership.cards.title,
            type,
            price,
            buyerId: auction.winnerId,
            sellerId: auction.sellerId,
            timestamp: isCompleted ? auction.updatedAt : auction.createdAt,
            status: auction.status,
          };
        });

        return {
          cardId: input.cardId,
          activities,
          totalActivities: activities.length,
        };
      } catch (error) {
        console.error("[Card Analytics] Error getting market activity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch market activity",
        });
      }
    }),

  /**
   * Get user's card portfolio performance
   */
  getPortfolioPerformance: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get user's card ownership
        const ownedCards = await ctx.db.cardOwnership.findMany({
          where: { ownerId: input.userId },
          select: {
            id: true,
            cardId: true,
            acquiredAt: true,
            lastSalePrice: true,
            quantity: true,
            cards: {
              select: {
                id: true,
                title: true,
                marketValue: true,
                rarity: true,
              },
            },
          },
          orderBy: { acquiredAt: "desc" },
        });

        const totalCards = ownedCards.reduce((sum, o) => sum + o.quantity, 0);
        const totalValue = ownedCards.reduce((sum, o) => sum + o.cards.marketValue * o.quantity, 0);

        // Find top performer
        let topPerformer: PortfolioPerformance["topPerformer"] = null;
        let maxGain = 0;

        for (const owned of ownedCards) {
          const acquisitionPrice = owned.lastSalePrice || 0;
          const currentValue = owned.cards.marketValue;
          const gain = currentValue - acquisitionPrice;
          const gainPercent = acquisitionPrice > 0 ? (gain / acquisitionPrice) * 100 : 0;

          if (gain > maxGain) {
            maxGain = gain;
            topPerformer = {
              cardId: owned.cards.id,
              title: owned.cards.title,
              currentValue,
              gain,
              gainPercent,
            };
          }
        }

        // Recent acquisitions (last 5)
        const recentAcquisitions = ownedCards.slice(0, 5).map((owned) => ({
          cardId: owned.cards.id,
          title: owned.cards.title,
          acquiredAt: owned.acquiredAt,
          acquisitionPrice: owned.lastSalePrice || 0,
          currentValue: owned.cards.marketValue,
        }));

        // Value by rarity
        const valueByRarity: Record<string, { count: number; value: number }> = {};
        for (const owned of ownedCards) {
          const rarity = owned.cards.rarity;
          if (!valueByRarity[rarity]) {
            valueByRarity[rarity] = { count: 0, value: 0 };
          }
          valueByRarity[rarity]!.count += owned.quantity;
          valueByRarity[rarity]!.value += owned.cards.marketValue * owned.quantity;
        }

        return {
          totalCards,
          totalValue: Math.round(totalValue * 100) / 100,
          topPerformer,
          recentAcquisitions,
          valueByRarity,
        };
      } catch (error) {
        console.error("[Card Analytics] Error getting portfolio performance:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch portfolio performance",
        });
      }
    }),
});
