// src/components/cards/marketplace/MarketAnalytics.tsx
// Market intelligence and analytics panel

"use client";

import React, { memo, useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { MarketAnalytics, TrendingCard } from "~/types/marketplace";
import { CardRarity } from "@prisma/client";

interface MarketAnalyticsProps {
  timeRange?: "24h" | "7d" | "30d";
  className?: string;
}

/**
 * Format IxCredits currency
 */
function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} IxC`;
}

/**
 * Rarity color mapping
 */
const RARITY_COLORS: Record<CardRarity, string> = {
  COMMON: "text-gray-400",
  UNCOMMON: "text-green-400",
  RARE: "text-blue-400",
  ULTRA_RARE: "text-purple-400",
  EPIC: "text-pink-400",
  LEGENDARY: "text-yellow-400",
};

/**
 * MarketAnalytics - Market intelligence panel
 *
 * Features:
 * - Price history chart (glass chart with backdrop)
 * - Trending cards list (top 5 most bid-on)
 * - Market sentiment indicator (bullish/bearish)
 * - Volume statistics (24h volume, total sales)
 *
 * @example
 * <MarketAnalytics timeRange="24h" />
 */
export const MarketAnalytics = memo<MarketAnalyticsProps>(
  ({ timeRange = "24h", className }) => {
    const [selectedRange, setSelectedRange] = useState(timeRange);

    // Mock data (Agent 6 will provide real implementation)
    const mockAnalytics: MarketAnalytics = {
      priceHistory: [
        { timestamp: Date.now() - 86400000, cardId: "1", price: 100, volume: 10 },
        { timestamp: Date.now() - 72000000, cardId: "1", price: 120, volume: 15 },
        { timestamp: Date.now() - 43200000, cardId: "1", price: 110, volume: 12 },
        { timestamp: Date.now() - 21600000, cardId: "1", price: 130, volume: 18 },
        { timestamp: Date.now(), cardId: "1", price: 125, volume: 14 },
      ],
      trendingCards: [
        {
          cardId: "1",
          cardTitle: "Example Nation Card",
          cardRarity: CardRarity.LEGENDARY,
          bidCount24h: 45,
          priceChange24h: 15.5,
          volume24h: 5400,
        },
      ],
      marketSentiment: {
        score: 65,
        trend: "bullish",
        confidence: 0.78,
      },
      volumeStats: {
        volume24h: 15430,
        volumeChange24h: 12.3,
        totalSales24h: 127,
        averagePrice24h: 121.5,
      },
    };

    // Chart data formatted for recharts
    const chartData = useMemo(
      () =>
        mockAnalytics.priceHistory.map((point) => ({
          time: new Date(point.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          price: point.price,
          volume: point.volume,
        })),
      [mockAnalytics.priceHistory]
    );

    // Sentiment color
    const sentimentColor = useMemo(() => {
      if (mockAnalytics.marketSentiment.trend === "bullish")
        return "text-green-400";
      if (mockAnalytics.marketSentiment.trend === "bearish")
        return "text-red-400";
      return "text-gray-400";
    }, [mockAnalytics.marketSentiment.trend]);

    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="text-lg font-bold text-white">Market Analytics</h3>

          {/* Time range selector */}
          <div className="flex gap-2">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={cn(
                  "rounded-lg px-3 py-1 text-sm font-medium transition-all",
                  selectedRange === range
                    ? "bg-blue-500 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Price history chart */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-300">
              Average Price Trend
            </h4>
            <div className="h-48 rounded-lg border border-white/10 bg-black/20 p-4">
              <ChartContainer
                config={{
                  price: {
                    label: "Price",
                    color: "hsl(210 100% 50%)",
                  },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                      tickFormatter={(value) => `${value}`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(210 100% 50%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>

          {/* Market sentiment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="mb-1 text-xs text-gray-400">Market Sentiment</p>
              <p className={cn("text-2xl font-bold capitalize", sentimentColor)}>
                {mockAnalytics.marketSentiment.trend}
              </p>
              <p className="text-xs text-gray-400">
                {(mockAnalytics.marketSentiment.confidence * 100).toFixed(0)}%
                confidence
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="mb-1 text-xs text-gray-400">24h Volume</p>
              <p className="text-2xl font-bold text-white">
                {formatCredits(mockAnalytics.volumeStats.volume24h)}
              </p>
              <p
                className={cn(
                  "text-xs font-medium",
                  mockAnalytics.volumeStats.volumeChange24h >= 0
                    ? "text-green-400"
                    : "text-red-400"
                )}
              >
                {mockAnalytics.volumeStats.volumeChange24h >= 0 ? "+" : ""}
                {mockAnalytics.volumeStats.volumeChange24h.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Volume stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Total Sales</p>
              <p className="text-lg font-bold text-white">
                {mockAnalytics.volumeStats.totalSales24h}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Avg Price</p>
              <p className="text-lg font-bold text-white">
                {formatCredits(mockAnalytics.volumeStats.averagePrice24h)}
              </p>
            </div>
          </div>

          {/* Trending cards */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-300">
              Trending Cards
            </h4>
            <div className="space-y-2">
              {mockAnalytics.trendingCards.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  No trending cards at the moment
                </p>
              ) : (
                mockAnalytics.trendingCards.map((card, index) => (
                  <div
                    key={card.cardId}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
                        {index + 1}
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            RARITY_COLORS[card.cardRarity]
                          )}
                        >
                          {card.cardTitle}
                        </p>
                        <p className="text-xs text-gray-400">
                          {card.bidCount24h} bids • {formatCredits(card.volume24h)}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "text-sm font-bold",
                        card.priceChange24h >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {card.priceChange24h >= 0 ? "+" : ""}
                      {card.priceChange24h.toFixed(1)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MarketAnalytics.displayName = "MarketAnalytics";
