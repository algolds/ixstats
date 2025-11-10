// src/components/cards/marketplace/BidPanel.tsx
// Bidding interface slide-over panel

"use client";

import React, { memo, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogOverlay } from "~/components/ui/dialog";
import { AuctionCountdown } from "./AuctionCountdown";
import { CardDisplay } from "../CardDisplay";
import { cn } from "~/lib/utils";
import type { AuctionListing, Bid } from "~/types/marketplace";

interface BidPanelProps {
  auction: AuctionListing | null;
  open: boolean;
  onClose: () => void;
  onSubmitBid: (auctionId: string, amount: number) => Promise<void>;
  userBalance?: number;
  bidHistory?: Bid[];
}

/**
 * Format IxCredits currency
 */
function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} IxC`;
}

/**
 * Calculate bid increment suggestions
 */
function calculateIncrements(
  currentBid: number
): { label: string; amount: number }[] {
  return [
    { label: "+5%", amount: Math.ceil(currentBid * 1.05) },
    { label: "+10%", amount: Math.ceil(currentBid * 1.1) },
    { label: "+25%", amount: Math.ceil(currentBid * 1.25) },
  ];
}

/**
 * BidPanel - Slide-over bidding interface
 *
 * Features:
 * - Bid amount input with +/- controls
 * - Bid increment suggestions (+5%, +10%, +25%)
 * - Balance validation (shows current balance)
 * - Bid history list (last 10 bids)
 * - Auction timer extension notice
 * - Submit bid button
 *
 * @example
 * <BidPanel
 *   auction={currentAuction}
 *   open={showBidPanel}
 *   onClose={() => setShowBidPanel(false)}
 *   onSubmitBid={async (id, amount) => await placeBid(id, amount)}
 *   userBalance={500}
 * />
 */
export const BidPanel = memo<BidPanelProps>(
  ({
    auction,
    open,
    onClose,
    onSubmitBid,
    userBalance = 0,
    bidHistory = [],
  }) => {
    const [bidAmount, setBidAmount] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate minimum bid (current bid + 1)
    const minBid = auction ? auction.currentBid + 1 : 0;

    // Update bid amount when auction changes
    React.useEffect(() => {
      if (auction) {
        setBidAmount(minBid);
      }
    }, [auction, minBid]);

    // Bid increment suggestions
    const increments = useMemo(
      () => (auction ? calculateIncrements(auction.currentBid) : []),
      [auction]
    );

    // Validate bid
    const validation = useMemo(() => {
      if (!auction) return { valid: false, message: "" };

      if (bidAmount < minBid) {
        return {
          valid: false,
          message: `Bid must be at least ${formatCredits(minBid)}`,
        };
      }

      if (bidAmount > userBalance) {
        return {
          valid: false,
          message: `Insufficient balance (you have ${formatCredits(userBalance)})`,
        };
      }

      return { valid: true, message: "" };
    }, [auction, bidAmount, minBid, userBalance]);

    /**
     * Handle bid submission
     */
    const handleSubmit = async () => {
      if (!auction || !validation.valid) return;

      setIsSubmitting(true);
      setError(null);

      try {
        await onSubmitBid(auction.id, bidAmount);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to place bid"
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!auction) return null;

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogOverlay />
        <DialogContent
          className={cn(
            "fixed right-0 top-0 h-full w-full sm:max-w-md translate-x-0",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
            "border-l border-white/10 bg-black/95 backdrop-blur-xl",
            "overflow-y-auto p-0"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-white/10 p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Place Bid</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white active:text-white transition-colors touch-manipulation"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <AuctionCountdown endTime={auction.endTime} />
            </div>

            {/* Card preview */}
            <div className="border-b border-white/10 p-4 sm:p-6">
              <CardDisplay
                card={auction.cardInstance}
                size="sm"
                interactive={false}
                className="mx-auto"
              />
            </div>

            {/* Bidding form */}
            <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-6">
              {/* Current bid */}
              <div>
                <p className="mb-1 text-xs sm:text-sm text-gray-400">Current Bid</p>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {formatCredits(auction.currentBid)}
                </p>
                <p className="text-xs text-gray-400">
                  {auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Bid amount input */}
              <div>
                <label className="mb-2 block text-xs sm:text-sm font-medium text-gray-300">
                  Your Bid Amount
                </label>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setBidAmount(Math.max(minBid, bidAmount - 10))}
                    className="rounded-lg border border-white/20 bg-white/5 p-2 text-white hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation disabled:opacity-50"
                    disabled={bidAmount <= minBid}
                    aria-label="Decrease bid"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>

                  <input
                    type="number"
                    min={minBid}
                    max={userBalance}
                    value={bidAmount}
                    onChange={(e) =>
                      setBidAmount(parseInt(e.target.value) || minBid)
                    }
                    className="flex-1 rounded-lg border border-white/20 bg-black/40 px-2 sm:px-4 py-2 sm:py-3 text-center text-lg sm:text-xl font-bold text-white focus:border-blue-500 focus:outline-none"
                  />

                  <button
                    onClick={() => setBidAmount(bidAmount + 10)}
                    className="rounded-lg border border-white/20 bg-white/5 p-2 text-white hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation disabled:opacity-50"
                    disabled={bidAmount + 10 > userBalance}
                    aria-label="Increase bid"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>

                {/* Validation message */}
                {!validation.valid && (
                  <p className="mt-2 text-sm text-red-400">
                    {validation.message}
                  </p>
                )}
              </div>

              {/* Increment suggestions */}
              <div>
                <p className="mb-2 text-xs sm:text-sm font-medium text-gray-300">
                  Quick Increments
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {increments.map((inc) => (
                    <button
                      key={inc.label}
                      onClick={() => setBidAmount(inc.amount)}
                      className={cn(
                        "rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all touch-manipulation",
                        inc.amount <= userBalance
                          ? "border-white/20 bg-white/5 text-white hover:bg-white/10 active:bg-white/15"
                          : "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed opacity-50"
                      )}
                      disabled={inc.amount > userBalance}
                    >
                      {inc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance info */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-400">Your Balance</span>
                  <span className="font-bold text-white">
                    {formatCredits(userBalance)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-400">Remaining After Bid</span>
                  <span
                    className={cn(
                      "font-bold",
                      userBalance - bidAmount >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    )}
                  >
                    {formatCredits(userBalance - bidAmount)}
                  </span>
                </div>
              </div>

              {/* Extension notice */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-400">
                <strong>Note:</strong> Bidding in the last minute extends
                the auction by 1 minute.
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Bid history */}
              {bidHistory.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs sm:text-sm font-medium text-gray-300">
                    Recent Bids
                  </h3>
                  <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 sm:p-3 max-h-40 sm:max-h-48 overflow-y-auto">
                    {bidHistory.slice(0, 10).map((bid) => (
                      <div
                        key={bid.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-400">{bid.bidderName}</span>
                        <span className="font-bold text-white">
                          {formatCredits(bid.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 p-4 sm:p-6">
              <button
                onClick={handleSubmit}
                disabled={!validation.valid || isSubmitting}
                className={cn(
                  "w-full rounded-lg px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold transition-all touch-manipulation",
                  validation.valid && !isSubmitting
                    ? "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
                    : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Placing Bid..." : "Place Bid"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

BidPanel.displayName = "BidPanel";
