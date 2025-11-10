// src/components/cards/pack-opening/PackPurchaseModal.tsx
// Purchase confirmation modal for card packs

"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PackType } from "@prisma/client";
import { api } from "~/trpc/react";

interface PackPurchaseModalProps {
  packId: string;
  packType: PackType;
  packName: string;
  packDescription?: string;
  packArtwork?: string;
  priceCredits: number;
  cardCount: number;
  isOpen: boolean;
  onPurchase: (userPackId: string) => void;
  onCancel: () => void;
}

/**
 * PackPurchaseModal - Purchase confirmation interface
 *
 * Features:
 * - Pack details display
 * - IxCredits balance check
 * - Insufficient funds warning
 * - Purchase confirmation
 * - Loading states
 */
export const PackPurchaseModal = React.memo<PackPurchaseModalProps>(
  ({
    packId,
    packType,
    packName,
    packDescription,
    packArtwork,
    priceCredits,
    cardCount,
    isOpen,
    onPurchase,
    onCancel,
  }) => {
    // Fetch user's vault balance
    const { data: vaultData } = api.vault.getVaultBalance.useQuery(undefined, {
      enabled: isOpen,
    });

    // Purchase mutation
    const purchaseMutation = api.cardPacks.purchasePack.useMutation({
      onSuccess: (data) => {
        if (data.success && data.userPack) {
          onPurchase(data.userPack.id);
        }
      },
      onError: (error) => {
        console.error("[PackPurchase] Error:", error);
      },
    });

    // Calculate if user can afford
    const balance = vaultData?.balance ?? 0;
    const canAfford = balance >= priceCredits;
    const remainingBalance = balance - priceCredits;

    // Handle purchase
    const handlePurchase = () => {
      if (!canAfford) return;
      purchaseMutation.mutate({ packId });
    };

    // Pack type colors
    const packTypeColors: Record<PackType, string> = {
      BASIC: "from-blue-500/20 to-blue-600/20",
      PREMIUM: "from-violet-500/20 to-violet-600/20",
      ELITE: "from-pink-500/20 to-pink-600/20",
      THEMED: "from-sky-500/20 to-sky-600/20",
      SEASONAL: "from-green-500/20 to-green-600/20",
      EVENT: "from-yellow-500/20 to-yellow-600/20",
    };

    const gradientClass = packTypeColors[packType] ?? packTypeColors.BASIC;

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCancel}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative w-full max-w-[95vw] sm:max-w-md md:max-w-lg overflow-hidden rounded-2xl bg-gray-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={onCancel}
                  className="absolute right-2 sm:right-4 top-2 sm:top-4 z-10 rounded-lg bg-black/40 p-1.5 sm:p-2 text-white/60 transition-colors hover:bg-black/60 hover:text-white"
                  aria-label="Close"
                >
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5"
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

                {/* Header with pack artwork */}
                <div className={`relative bg-gradient-to-br ${gradientClass} p-4 sm:p-6 md:p-8`}>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                    {/* Pack image */}
                    <div className="relative h-32 w-24 sm:h-40 sm:w-32 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white/10 to-white/5">
                      {packArtwork ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${packArtwork})` }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-white/60">
                              {packType}
                            </div>
                            <div className="mt-1 text-xs text-white/40">
                              Pack
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Shine effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 1,
                        }}
                        style={{ transform: "skewX(-20deg)" }}
                      />
                    </div>

                    {/* Pack details */}
                    <div className="flex-1 text-center sm:text-left w-full">
                      <div className="inline-block rounded-full bg-white/10 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-white/80 backdrop-blur-sm">
                        {packType} Pack
                      </div>
                      <h2 className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-white">
                        {packName}
                      </h2>
                      {packDescription && (
                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/70">
                          {packDescription}
                        </p>
                      )}
                      <div className="mt-2 sm:mt-3 flex items-center justify-center sm:justify-start gap-4 text-xs sm:text-sm">
                        <div className="text-white/60">
                          Contains: <span className="font-semibold text-white">{cardCount} cards</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6">
                  {/* Balance info */}
                  <div className="rounded-lg bg-white/5 p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs sm:text-sm text-white/60">
                        Your Balance
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-yellow-400">
                        {balance.toLocaleString()} IC
                      </div>
                    </div>

                    <div className="mt-2 sm:mt-3 flex items-center justify-between border-t border-white/10 pt-2 sm:pt-3">
                      <div className="text-xs sm:text-sm text-white/60">Pack Price</div>
                      <div className="text-base sm:text-lg font-semibold text-white">
                        {priceCredits.toLocaleString()} IC
                      </div>
                    </div>

                    <div className="mt-2 sm:mt-3 flex items-center justify-between border-t border-white/10 pt-2 sm:pt-3">
                      <div className="text-xs sm:text-sm font-medium text-white/80">
                        After Purchase
                      </div>
                      <div
                        className={`text-base sm:text-lg font-bold ${
                          canAfford ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {canAfford
                          ? `${remainingBalance.toLocaleString()} IC`
                          : "Insufficient Funds"}
                      </div>
                    </div>
                  </div>

                  {/* Insufficient funds warning */}
                  {!canAfford && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 sm:mt-4 rounded-lg bg-red-500/10 p-3 sm:p-4 text-center"
                    >
                      <div className="text-xs sm:text-sm font-medium text-red-400">
                        You need {(priceCredits - balance).toLocaleString()} more IxCredits
                      </div>
                      <div className="mt-1 text-[10px] sm:text-xs text-red-400/70">
                        Earn credits through achievements, events, or trading
                      </div>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={onCancel}
                      className="flex-1 rounded-lg bg-white/5 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white/80 transition-colors hover:bg-white/10"
                      disabled={purchaseMutation.isPending}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePurchase}
                      disabled={!canAfford || purchaseMutation.isPending}
                      className={`flex-1 rounded-lg py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-colors ${
                        canAfford && !purchaseMutation.isPending
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "cursor-not-allowed bg-gray-700 text-gray-500"
                      }`}
                    >
                      {purchaseMutation.isPending
                        ? "Purchasing..."
                        : `Purchase for ${priceCredits.toLocaleString()} IC`}
                    </button>
                  </div>

                  {/* Error message */}
                  {purchaseMutation.isError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 sm:mt-4 rounded-lg bg-red-500/10 p-2 sm:p-3 text-center text-xs sm:text-sm text-red-400"
                    >
                      {purchaseMutation.error.message || "Purchase failed"}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

PackPurchaseModal.displayName = "PackPurchaseModal";
