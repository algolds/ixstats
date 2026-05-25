// src/components/cards/marketplace/CreateAuctionModal.tsx
// Modal for creating new auction listings

"use client";

import React, { memo, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogOverlay } from "~/components/ui/dialog";
import { CardDisplay } from "../CardDisplay";
import { cn } from "~/lib/utils";
import type { CardInstance, CreateAuctionInput, AuctionFees } from "~/types/marketplace";

interface CreateAuctionModalProps {
  availableCards: CardInstance[];
  open: boolean;
  onClose: () => void;
  onCreateAuction: (input: CreateAuctionInput) => Promise<void>;
  userBalance?: number;
}

/**
 * Format IxCredits currency
 */
function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} IxC`;
}

/**
 * Calculate auction fees
 */
function calculateFees(salePrice: number, isExpress: boolean, isFeatured: boolean): AuctionFees {
  const listingFee = 5; // Flat fee
  const successFee = salePrice > 100 ? salePrice * 0.1 : 0; // 10% on sales >100 IxC
  const expressFee = isExpress ? 10 : 0;
  const featuredFee = isFeatured ? 25 : 0;

  return {
    listingFee,
    successFee,
    expressFee,
    featuredFee,
    totalFee: listingFee + expressFee + featuredFee,
  };
}

/**
 * CreateAuctionModal - Modal for listing cards on auction
 *
 * Features:
 * - Card selection from user's inventory
 * - Starting price input (min 1 IxC)
 * - Buyout price input (optional, must be >starting price)
 * - Duration selector (30min Express or 60min Standard)
 * - Express/Featured options (checkbox with cost)
 * - Fee calculation display
 * - Preview section
 * - Create listing button
 *
 * @example
 * <CreateAuctionModal
 *   availableCards={userInventory}
 *   open={showModal}
 *   onClose={() => setShowModal(false)}
 *   onCreateAuction={async (input) => await createListing(input)}
 *   userBalance={500}
 * />
 */
export const CreateAuctionModal = memo<CreateAuctionModalProps>(
  ({ availableCards, open, onClose, onCreateAuction, userBalance = 0 }) => {
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [startingPrice, setStartingPrice] = useState(10);
    const [buyoutPrice, setBuyoutPrice] = useState<number | null>(null);
    const [duration, setDuration] = useState<30 | 60>(60);
    const [isExpress, setIsExpress] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected card
    const selectedCard = useMemo(
      () => availableCards.find((c) => c.id === selectedCardId) || null,
      [availableCards, selectedCardId]
    );

    // Calculate fees
    const fees = useMemo(
      () => calculateFees(startingPrice, isExpress, isFeatured),
      [startingPrice, isExpress, isFeatured]
    );

    // Validation
    const validation = useMemo(() => {
      if (!selectedCard) {
        return { valid: false, message: "Please select a card" };
      }

      if (startingPrice < 1) {
        return {
          valid: false,
          message: "Starting price must be at least 1 IxC",
        };
      }

      if (buyoutPrice !== null && buyoutPrice <= startingPrice) {
        return {
          valid: false,
          message: "Buyout price must be greater than starting price",
        };
      }

      if (fees.totalFee > userBalance) {
        return {
          valid: false,
          message: `Insufficient balance for listing fee (need ${formatCredits(fees.totalFee)})`,
        };
      }

      return { valid: true, message: "" };
    }, [selectedCard, startingPrice, buyoutPrice, fees.totalFee, userBalance]);

    /**
     * Handle form submission
     */
    const handleSubmit = async () => {
      if (!selectedCard || !validation.valid) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const input: CreateAuctionInput = {
          cardInstanceId: selectedCard.id,
          startingPrice,
          buyoutPrice,
          duration,
          isExpress,
          isFeatured,
        };

        await onCreateAuction(input);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create auction");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogOverlay />
        <DialogContent className="glass-modal max-h-[90vh] w-[98vw] max-w-[95vw] overflow-y-auto sm:w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-2xl">
          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">Create Auction</h2>
              <p className="text-xs text-gray-400 sm:text-sm">
                List your card for auction on the marketplace
              </p>
            </div>

            {/* Card selection */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                Select Card
              </label>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
                {availableCards.length === 0 ? (
                  <p className="col-span-2 py-4 text-center text-xs text-gray-400 sm:py-8 sm:text-sm lg:col-span-3">
                    No cards available to list
                  </p>
                ) : (
                  availableCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      className={cn(
                        "rounded-lg border-2 transition-all",
                        selectedCardId === card.id
                          ? "border-blue-500 shadow-lg shadow-blue-500/20"
                          : "border-white/10 hover:border-white/30"
                      )}
                    >
                      <CardDisplay card={card} size="small" showStatsOnHover={false} />
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                  Starting Price (IxC) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none sm:px-4 sm:text-base"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                  Buyout Price (IxC)
                </label>
                <input
                  type="number"
                  min={startingPrice + 1}
                  value={buyoutPrice || ""}
                  onChange={(e) => setBuyoutPrice(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none sm:px-4 sm:text-base"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-300 sm:text-sm">
                Duration
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setDuration(60);
                    setIsExpress(false);
                  }}
                  className={cn(
                    "rounded-lg border p-2 text-left transition-all sm:p-3",
                    duration === 60
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <p className="text-sm font-bold text-white sm:text-base">Standard (60 min)</p>
                  <p className="text-xs text-gray-400">No extra fee</p>
                </button>

                <button
                  onClick={() => {
                    setDuration(30);
                    setIsExpress(true);
                  }}
                  className={cn(
                    "rounded-lg border p-2 text-left transition-all sm:p-3",
                    duration === 30
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <p className="text-sm font-bold text-white sm:text-base">Express (30 min)</p>
                  <p className="text-xs text-gray-400">+10 IxC fee</p>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-300 sm:text-sm">
                  Featured Listing (+25 IxC) - Highlighted in marketplace
                </span>
              </label>
            </div>

            {/* Fee breakdown */}
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
              <h4 className="text-xs font-medium text-gray-300 sm:text-sm">Fee Breakdown</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Listing Fee</span>
                  <span className="text-white">{formatCredits(fees.listingFee)}</span>
                </div>
                {isExpress && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Express Fee</span>
                    <span className="text-white">{formatCredits(fees.expressFee)}</span>
                  </div>
                )}
                {isFeatured && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Featured Fee</span>
                    <span className="text-white">{formatCredits(fees.featuredFee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                  <span className="text-white">Total Fee</span>
                  <span className="text-white">{formatCredits(fees.totalFee)}</span>
                </div>
                {fees.successFee > 0 && (
                  <p className="text-xs text-gray-400">+ 10% commission on sales over 100 IxC</p>
                )}
              </div>
            </div>

            {/* Preview */}
            {selectedCard && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
                <h4 className="mb-3 text-xs font-medium text-gray-300 sm:text-sm">Preview</h4>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="mx-auto w-24 sm:mx-0 sm:w-auto">
                    <CardDisplay card={selectedCard} size="small" />
                  </div>
                  <div className="w-full flex-1 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Starting Bid</span>
                      <span className="font-bold text-white">{formatCredits(startingPrice)}</span>
                    </div>
                    {buyoutPrice && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Buyout</span>
                        <span className="font-bold text-green-400">
                          {formatCredits(buyoutPrice)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration</span>
                      <span className="text-white">{duration} minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Validation error */}
            {!validation.valid && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400 sm:p-3 sm:text-sm">
                {validation.message}
              </div>
            )}

            {/* Submission error */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400 sm:p-3 sm:text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 sm:px-6 sm:py-3 sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!validation.valid || isSubmitting}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:px-6 sm:py-3 sm:text-base",
                  validation.valid && !isSubmitting
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "cursor-not-allowed bg-gray-500/20 text-gray-500"
                )}
              >
                {isSubmitting ? "Creating..." : "Create Auction"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

CreateAuctionModal.displayName = "CreateAuctionModal";
