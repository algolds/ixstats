// src/components/cards/marketplace/AuctionCard.tsx
// Individual auction listing card with bid/buyout actions

"use client";

import React, { memo } from "react";
import { CardDisplay } from "../CardDisplay";
import { AuctionCountdown } from "./AuctionCountdown";
import { cn } from "~/lib/utils";
import type { AuctionListing } from "~/types/marketplace";

interface AuctionCardProps {
  auction: AuctionListing;
  onBid: (auctionId: string) => void;
  onBuyout: (auctionId: string) => void;
  currentUserId?: string;
  className?: string;
}

/**
 * Format IxCredits currency
 */
function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} IxC`;
}

/**
 * AuctionCard - Individual auction listing component
 *
 * Features:
 * - Card preview using CardDisplay component
 * - Current bid display with formatting
 * - Live countdown timer
 * - Bid/Buyout action buttons
 * - "Your bid" indicator for current bidder
 * - Snipe warning for auctions <1min remaining
 *
 * @example
 * <AuctionCard
 *   auction={auctionListing}
 *   onBid={(id) => openBidPanel(id)}
 *   onBuyout={(id) => confirmBuyout(id)}
 *   currentUserId="user-123"
 * />
 */
export const AuctionCard = memo<AuctionCardProps>(
  ({ auction, onBid, onBuyout, currentUserId, className }) => {
    const isCurrentBidder = false; // TODO: Track current bidder
    const hasEnded = auction.isExpired;

    return (
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm transition-all duration-300",
          "hover:border-white/20 hover:shadow-xl",
          hasEnded && "opacity-60",
          className
        )}
      >
        {/* Featured badge */}
        {auction.isFeatured && !hasEnded && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
            FEATURED
          </div>
        )}

        {/* Express badge */}
        {auction.isExpress && !hasEnded && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-1 text-xs font-bold text-blue-400 backdrop-blur-sm">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            EXPRESS
          </div>
        )}

        {/* Card preview */}
        <div className="p-4">
          <CardDisplay
            card={auction.cardInstance}
            size="md"
            showStats={true}
            interactive={false}
          />
        </div>

        {/* Auction info */}
        <div className="space-y-3 border-t border-white/10 p-4">
          {/* Seller info */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Seller: {auction.sellerName}</span>
          </div>

          {/* Current bid */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Current Bid</p>
              <p className="text-2xl font-bold text-white">
                {formatCredits(auction.currentBid)}
              </p>
              {auction.bidCount > 0 && (
                <p className="text-xs text-gray-400">
                  {auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Buyout price */}
            {auction.buyoutPrice && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Buyout</p>
                <p className="text-lg font-bold text-green-400">
                  {formatCredits(auction.buyoutPrice)}
                </p>
              </div>
            )}
          </div>

          {/* Countdown timer */}
          <AuctionCountdown
            endTime={auction.endTime}
            className="w-full justify-center"
          />

          {/* Current bidder indicator */}
          {isCurrentBidder && !hasEnded && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              You are the current highest bidder
            </div>
          )}

          {/* Action buttons */}
          {!hasEnded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => onBid(auction.id)}
                className={cn(
                  "rounded-lg px-4 py-2 font-medium transition-all",
                  "bg-white/10 text-white hover:bg-white/20",
                  "border border-white/20 hover:border-white/30"
                )}
              >
                Place Bid
              </button>

              {auction.buyoutPrice && (
                <button
                  onClick={() => onBuyout(auction.id)}
                  className={cn(
                    "rounded-lg px-4 py-2 font-medium transition-all",
                    "bg-green-500/20 text-green-400 hover:bg-green-500/30",
                    "border border-green-500/30 hover:border-green-500/50"
                  )}
                >
                  Buy Now
                </button>
              )}
            </div>
          )}

          {/* Ended state */}
          {hasEnded && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-center text-sm font-medium text-red-400">
              Auction Ended
            </div>
          )}
        </div>
      </div>
    );
  }
);

AuctionCard.displayName = "AuctionCard";
