// src/components/cards/pack-opening/Stage3_CardReveal.tsx
// Stage 3: Sequential card flip reveals with rarity effects

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardInstance } from "~/types/pack-opening";
import { getPackOpeningService } from "~/lib/pack-opening-service";

interface Stage3_CardRevealProps {
  cards: CardInstance[];
  onRevealComplete: () => void;
}

/**
 * Stage3_CardReveal - Sequential card flip animation
 *
 * Features:
 * - Sequential reveals with 800ms stagger
 * - 3D flip animation (600ms per card)
 * - Rarity-based sound effects
 * - Color flash on reveal (rarity glow)
 * - Automatic progression when complete
 */
export const Stage3_CardReveal = React.memo<Stage3_CardRevealProps>(
  ({ cards, onRevealComplete }) => {
    const [revealedIndex, setRevealedIndex] = useState(-1);
    const service = getPackOpeningService();

    // Sequential reveal logic
    useEffect(() => {
      if (revealedIndex >= cards.length - 1) {
        // All cards revealed, wait 1s then complete
        const timer = setTimeout(() => {
          onRevealComplete();
        }, 1000);
        return () => clearTimeout(timer);
      }

      // Reveal next card after stagger delay
      const timer = setTimeout(
        () => {
          setRevealedIndex((prev) => prev + 1);
        },
        revealedIndex === -1 ? 500 : 800 // First card starts after 500ms
      );

      return () => clearTimeout(timer);
    }, [revealedIndex, cards.length, onRevealComplete]);

    // Play sound when card is revealed
    useEffect(() => {
      if (revealedIndex >= 0 && revealedIndex < cards.length) {
        const card = cards[revealedIndex];
        if (card) {
          service.playRaritySound(card.rarity);

          // Haptic feedback based on rarity
          if (["LEGENDARY", "EPIC"].includes(card.rarity)) {
            service.triggerHaptic("heavy");
          } else if (["ULTRA_RARE", "RARE"].includes(card.rarity)) {
            service.triggerHaptic("medium");
          } else {
            service.triggerHaptic("light");
          }
        }
      }
    }, [revealedIndex, cards, service]);

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4">
        {/* Card grid layout */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <AnimatePresence mode="sync">
            {cards.map((card, index) => (
              <CardRevealItem
                key={card.id}
                card={card}
                index={index}
                isRevealed={index <= revealedIndex}
                service={service}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Progress indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2">
            {cards.map((_, index) => (
              <motion.div
                key={index}
                className="h-2 w-2 rounded-full"
                initial={{ backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                animate={{
                  backgroundColor:
                    index <= revealedIndex
                      ? "rgba(255, 255, 255, 1)"
                      : "rgba(255, 255, 255, 0.3)",
                  scale: index === revealedIndex ? 1.5 : 1,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

Stage3_CardReveal.displayName = "Stage3_CardReveal";

/**
 * Individual card reveal item with flip animation
 */
interface CardRevealItemProps {
  card: CardInstance;
  index: number;
  isRevealed: boolean;
  service: ReturnType<typeof getPackOpeningService>;
}

const CardRevealItem = React.memo<CardRevealItemProps>(
  ({ card, index, isRevealed, service }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
      if (isRevealed && !isFlipped) {
        // Small delay before flip starts
        const timer = setTimeout(() => {
          setIsFlipped(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [isRevealed, isFlipped]);

    const rarityColor = service.getRarityColor(card.rarity);

    return (
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 50 }}
        animate={{
          scale: isRevealed ? 1 : 0,
          opacity: isRevealed ? 1 : 0,
          y: isRevealed ? 0 : 50,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        style={{
          perspective: "1000px",
        }}
      >
        {/* 3D flip container */}
        <motion.div
          className="relative h-96 w-72"
          animate={{
            rotateY: isFlipped ? 180 : 0,
          }}
          transition={{
            duration: 0.6,
            ease: "easeInOut",
          }}
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {/* Card back */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 backdrop-blur-sm"
            style={{
              backfaceVisibility: "hidden",
            }}
          >
            <div className="flex h-full items-center justify-center">
              <div className="text-6xl font-bold text-white/40">?</div>
            </div>
          </div>

          {/* Card front */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Rarity glow */}
            <motion.div
              className="absolute -inset-2 rounded-2xl blur-xl"
              style={{
                backgroundColor: rarityColor,
              }}
              animate={{
                opacity: isFlipped ? [0, 0.8, 0.5] : 0,
              }}
              transition={{
                duration: 1,
                times: [0, 0.3, 1],
              }}
            />

            {/* Card content */}
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-1">
              {/* Card image */}
              <div
                className="h-full w-full rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `url(${card.artwork})`,
                }}
              >
                {/* Gradient overlay */}
                <div className="h-full w-full bg-gradient-to-t from-black/80 via-transparent to-transparent p-4">
                  {/* Card info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="text-sm font-medium uppercase tracking-wide text-white/60">
                      {card.rarity.replace("_", " ")}
                    </div>
                    <div className="mt-1 text-xl font-bold text-white">
                      {card.name || card.title || "Unknown Card"}
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Season {card.season}
                    </div>
                  </div>

                  {/* Rarity badge */}
                  <div
                    className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${rarityColor}80`,
                      color: "white",
                      boxShadow: `0 0 20px ${rarityColor}`,
                    }}
                  >
                    {card.rarity.replace("_", " ")}
                  </div>
                </div>
              </div>
            </div>

            {/* Shine effect on reveal */}
            {isFlipped && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 1,
                  delay: 0.3,
                  ease: "linear",
                }}
                style={{
                  transform: "skewX(-20deg)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

CardRevealItem.displayName = "CardRevealItem";
