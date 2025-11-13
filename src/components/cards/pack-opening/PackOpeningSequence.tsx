// src/components/cards/pack-opening/PackOpeningSequence.tsx
// Main orchestrator for 4-stage pack opening animation sequence

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PackType, CardRarity, CardType } from "@prisma/client";
import type {
  PackOpeningStage,
  CardInstance,
  QuickActionEvent,
} from "~/types/pack-opening";
import { api } from "~/trpc/react";
import { Stage1_PackReveal } from "./Stage1_PackReveal";
import { Stage2_PackExplosion } from "./Stage2_PackExplosion";
import { Stage3_CardReveal } from "./Stage3_CardReveal";
import { Stage4_QuickActions } from "./Stage4_QuickActions";
import { getPackOpeningService } from "~/lib/pack-opening-service";

interface PackOpeningSequenceProps {
  userPackId: string;
  packType: PackType;
  packArtwork?: string;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * PackOpeningSequence - Main orchestrator component
 *
 * Manages 4-stage animation pipeline:
 * 1. reveal - Pack appearance with 3D rotation
 * 2. explosion - Particle burst and cards flying out
 * 3. cardReveal - Sequential card flips with rarity effects
 * 4. actions - Quick action interface
 *
 * Features:
 * - State machine for stage progression
 * - tRPC integration for pack opening
 * - Sound effects and haptic feedback
 * - Error handling and loading states
 */
export const PackOpeningSequence = React.memo<PackOpeningSequenceProps>(
  ({ userPackId, packType, packArtwork, onComplete, onCancel }) => {
    const [stage, setStage] = useState<PackOpeningStage>("reveal");
    const [cards, setCards] = useState<CardInstance[]>([]);
    const [error, setError] = useState<string | null>(null);
    const service = getPackOpeningService();

    // Open pack mutation
    const openPackMutation = api.cardPacks.openPack.useMutation({
      onSuccess: (data) => {
        if (data.success && data.cards) {
          // Map API response to CardInstance format
          const cardInstances: CardInstance[] = data.cards.map((card) => ({
            id: card.id,
            name: card.name,
            title: card.name,
            rarity: card.rarity as CardRarity,
            cardType: card.cardType as CardType,
            artwork: card.artwork ?? '/default-card-artwork.png',
            season: card.season,
          }));

          setCards(cardInstances);
          setStage("explosion");
        } else {
          setError("Failed to open pack - no cards received");
        }
      },
      onError: (err) => {
        setError(err.message || "Failed to open pack");
        console.error("[PackOpening] Error opening pack:", err);
      },
    });

    // Handle pack tap (Stage 1 -> API call -> Stage 2)
    const handlePackTap = useCallback(() => {
      service.triggerHaptic("medium");
      openPackMutation.mutate({ userPackId });
    }, [userPackId, openPackMutation, service]);

    // Stage progression handlers
    const handleExplosionComplete = useCallback(() => {
      setStage("cardReveal");
    }, []);

    const handleRevealComplete = useCallback(() => {
      setStage("actions");
    }, []);

    const handleActionsComplete = useCallback(() => {
      onComplete();
    }, [onComplete]);

    // Handle quick actions
    const handleQuickAction = useCallback((event: QuickActionEvent) => {
      // TODO: Integrate with card action APIs
      // For now, just log the action
      console.log("[PackOpening] Quick action:", event);

      // Future integration:
      // - api.cards.markAsJunk.mutate({ cardId: event.cardId })
      // - api.cards.addToCollection.mutate({ cardId: event.cardId })
      // - api.marketplace.createListing.mutate({ cardId: event.cardId })
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        service.cleanup();
      };
    }, [service]);

    // Error display
    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md rounded-2xl bg-red-500/10 p-8 text-center backdrop-blur-sm"
          >
            <div className="mb-4 text-6xl">⚠️</div>
            <h3 className="text-2xl font-bold text-red-400">
              Error Opening Pack
            </h3>
            <p className="mt-2 text-white/70">{error}</p>
            <button
              onClick={onCancel}
              className="mt-6 rounded-lg bg-white/10 px-6 py-3 font-medium text-white hover:bg-white/20"
            >
              Close
            </button>
          </motion.div>
        </div>
      );
    }

    // Loading state (during API call)
    if (openPackMutation.isPending) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-center"
          >
            <div className="text-6xl">✨</div>
            <div className="mt-4 text-xl font-semibold text-white/80">
              Opening pack...
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-gray-900 via-black to-gray-900">
        {/* Close/Cancel button (only in reveal and actions stages) */}
        {(stage === "reveal" || stage === "actions") && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute right-4 top-4 z-50 rounded-lg bg-black/40 p-3 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
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
          </motion.button>
        )}

        {/* Stage transition wrapper */}
        <AnimatePresence mode="wait">
          {stage === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Stage1_PackReveal
                packType={packType}
                packArtwork={packArtwork}
                onTap={handlePackTap}
              />
            </motion.div>
          )}

          {stage === "explosion" && cards.length > 0 && (
            <motion.div
              key="explosion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <Stage2_PackExplosion
                cards={cards}
                onComplete={handleExplosionComplete}
              />
            </motion.div>
          )}

          {stage === "cardReveal" && cards.length > 0 && (
            <motion.div
              key="cardReveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Stage3_CardReveal
                cards={cards}
                onRevealComplete={handleRevealComplete}
              />
            </motion.div>
          )}

          {stage === "actions" && cards.length > 0 && (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Stage4_QuickActions
                cards={cards}
                onAction={handleQuickAction}
                onComplete={handleActionsComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage indicator (dev/debug) */}
        {process.env.NODE_ENV === "development" && (
          <div className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-2 text-xs font-mono text-white/60 backdrop-blur-sm">
            Stage: {stage} | Cards: {cards.length}
          </div>
        )}
      </div>
    );
  }
);

PackOpeningSequence.displayName = "PackOpeningSequence";
