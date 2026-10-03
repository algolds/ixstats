"use client";
// src/components/cards/pack-opening/PackOpeningSequence.tsx
// Main orchestrator for 4-stage pack opening animation sequence

import { Button } from "~/components/ui/button";
import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PackType, CardRarity, CardType } from "@prisma/client";
import type { PackOpeningStage, CardInstance, QuickActionEvent } from "~/types/pack-opening";
import { api } from "~/trpc/react";
import { Stage1_PackReveal } from "./Stage1_PackReveal";
import { Stage2_PackExplosion } from "./Stage2_PackExplosion";
import { Stage3_CardReveal } from "./Stage3_CardReveal";
import { Stage4_QuickActions } from "./Stage4_QuickActions";
import { getPackOpeningService } from "~/lib/cards/pack-opening-service";

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

    const utils = api.useUtils();

    // Junk cards mutation
    const junkCardsMutation = api.cards.junkCards.useMutation({
      onSuccess: () => {
        utils.vault.getBalance.invalidate();
        utils.cards.getMyCards.invalidate();
      },
      onError: (err) => {
        console.error("[PackOpening] Failed to junk cards:", err);
      },
    });

    // Open pack mutation
    const openPackMutation = api.cardPacks.openPack.useMutation({
      onSuccess: (data) => {
        if (data.success && data.cards) {
          // Map API response to CardInstance format
          const cardInstances: CardInstance[] = data.cards.map((card) => ({
            id: card.ownershipId || card.id, // unique identifier for the grid selection/key
            ownershipId: card.ownershipId,
            name: card.name,
            title: card.name,
            rarity: card.rarity as CardRarity,
            cardType: card.cardType as CardType,
            artwork: card.artwork ?? "/default-card-artwork.png",
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
    const handleQuickAction = useCallback(
      (event: QuickActionEvent) => {
        console.log("[PackOpening] Quick action:", event);

        if (event.action === "junk") {
          const ids = event.cardIds || (event.cardId ? [event.cardId] : []);
          if (ids.length > 0) {
            junkCardsMutation.mutate({ ownershipIds: ids });
          }
        }

        // Future integration:
        // - api.cards.addToCollection.mutate({ cardId: event.cardId })
        // - api.marketplace.createListing.mutate({ cardId: event.cardId })
      },
      [junkCardsMutation]
    );

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
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-card bg-surface-elevated shadow-sheet max-w-md p-8 text-center"
          >
            <div className="text-large-title mb-4" aria-hidden>
              ⚠️
            </div>
            <h3 className="text-title-2 text-destructive">Error opening pack</h3>
            <p className="text-body text-label-secondary mt-2">{error}</p>
            <Button variant="secondary" className="mt-6" onClick={onCancel}>
              Close
            </Button>
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
            <div className="text-title-3 mt-4 text-white/80">Opening pack...</div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        {/* Close/Cancel button (only in reveal and actions stages) */}
        {(stage === "reveal" || stage === "actions") && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="z-raised duration-fast absolute top-4 right-4 cursor-pointer rounded-full bg-white/10 p-3 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <Stage2_PackExplosion cards={cards} onComplete={handleExplosionComplete} />
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
              <Stage3_CardReveal cards={cards} onRevealComplete={handleRevealComplete} />
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
          <div className="rounded-control text-footnote absolute top-4 left-4 bg-black/60 px-3 py-2 font-mono text-white/60">
            Stage: {stage} | Cards: {cards.length}
          </div>
        )}
      </div>
    );
  }
);

PackOpeningSequence.displayName = "PackOpeningSequence";
