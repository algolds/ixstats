/**
 * CraftingAnimation Component
 * Crafting success/failure animation with glass fusion effects
 * Phase 3: Crafting System
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { CometCard } from "~/components/ui/comet-card";
import { CardDisplay } from "../display/CardDisplay";
import type { CardInstance } from "~/types/cards-display";

/**
 * CraftingAnimation props
 */
export interface CraftingAnimationProps {
  /** Whether crafting was successful */
  success: boolean;
  /** Result card (if successful) */
  resultCard?: any | null;
  /** XP gained */
  xpGained: number;
  /** Callback when animation completes */
  onComplete: () => void;
}

/**
 * CraftingAnimation - Crafting success animation
 *
 * Features:
 * - Glass fusion effect (cards merging)
 * - Particle effects
 * - Success/failure reveal
 * - New card showcase
 * - Sound sync points
 *
 * @example
 * ```tsx
 * <CraftingAnimation
 *   success={true}
 *   resultCard={newCard}
 *   xpGained={100}
 *   onComplete={() => console.log('Animation done')}
 * />
 * ```
 */
export const CraftingAnimation: React.FC<CraftingAnimationProps> = ({
  success,
  resultCard,
  xpGained,
  onComplete,
}) => {
  const [stage, setStage] = useState<"fusion" | "reveal" | "result">("fusion");
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Animation sequence
  useEffect(() => {
    // Stage 1: Fusion (2s)
    const fusionTimer = setTimeout(() => {
      setStage("reveal");
    }, 2000);

    // Stage 2: Reveal (1s)
    const revealTimer = setTimeout(() => {
      setStage("result");
      if (success) {
        generateParticles();
      }
    }, 3000);

    // Stage 3: Auto-close (5s total)
    const closeTimer = setTimeout(() => {
      onComplete();
    }, 7000);

    return () => {
      clearTimeout(fusionTimer);
      clearTimeout(revealTimer);
      clearTimeout(closeTimer);
    };
  }, [success, onComplete]);

  /**
   * Generate particle effects for success
   */
  const generateParticles = () => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
    }));
    setParticles(newParticles);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      <div className="relative w-full max-w-2xl p-8">
        <AnimatePresence mode="wait">
          {/* Stage 1: Fusion */}
          {stage === "fusion" && (
            <motion.div
              key="fusion"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="text-center"
            >
              {/* Fusion circles */}
              <div className="relative h-64 flex items-center justify-center">
                {/* Left circle */}
                <motion.div
                  className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 opacity-50"
                  animate={{
                    x: [-100, 0],
                    scale: [1, 1.2, 0.8],
                    opacity: [0.5, 0.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    ease: "easeInOut",
                  }}
                />

                {/* Right circle */}
                <motion.div
                  className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 opacity-50"
                  animate={{
                    x: [100, 0],
                    scale: [1, 1.2, 0.8],
                    opacity: [0.5, 0.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    ease: "easeInOut",
                  }}
                />

                {/* Center fusion point */}
                <motion.div
                  className="absolute w-16 h-16 rounded-full bg-white"
                  animate={{
                    scale: [0, 1.5, 1],
                    opacity: [0, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    ease: "easeInOut",
                  }}
                />
              </div>

              <motion.div
                className="text-2xl font-black text-white"
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              >
                Crafting...
              </motion.div>
            </motion.div>
          )}

          {/* Stage 2: Reveal */}
          {stage === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                className={cn(
                  "text-6xl font-black mb-4",
                  success ? "text-green-400" : "text-red-400"
                )}
                animate={{
                  scale: [0.5, 1.2, 1],
                  rotate: [0, 360, 360],
                }}
                transition={{
                  duration: 0.8,
                }}
              >
                {success ? "SUCCESS!" : "FAILED"}
              </motion.div>
              <div className="text-white/70 text-xl">
                {success
                  ? "Your card has been crafted!"
                  : "Crafting failed. Materials were consumed."}
              </div>
            </motion.div>
          )}

          {/* Stage 3: Result */}
          {stage === "result" && (
            <motion.div
              key="result"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -50 }}
              className="text-center space-y-6"
            >
              {success && resultCard ? (
                <>
                  {/* Particle effects */}
                  {particles.map((particle) => (
                    <motion.div
                      key={particle.id}
                      className="absolute w-2 h-2 rounded-full bg-yellow-400"
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: particle.x * 5,
                        y: particle.y * 5,
                        opacity: 0,
                        scale: 0,
                      }}
                      transition={{
                        duration: 2,
                        ease: "easeOut",
                      }}
                    />
                  ))}

                  {/* Result card */}
                  <motion.div
                    className="flex justify-center"
                    animate={{
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <CardDisplay
                      card={resultCard.card}
                      size="large"
                      enableHolographic={true}
                    />
                  </motion.div>

                  {/* XP badge */}
                  {xpGained > 0 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      <CometCard
                        className="inline-block px-6 py-3"
                        glassDepth="interactive"
                      >
                        <div className="text-sm text-white/60 uppercase">XP Gained</div>
                        <div className="text-3xl font-black text-blue-400">
                          +{xpGained}
                        </div>
                      </CometCard>
                    </motion.div>
                  )}

                  <div className="text-white/60 text-sm">
                    Click anywhere to continue
                  </div>
                </>
              ) : (
                <>
                  {/* Failure message */}
                  <div className="text-8xl">😢</div>
                  <div className="text-white text-xl">
                    Better luck next time!
                  </div>
                  <div className="text-white/60 text-sm">
                    Click anywhere to continue
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
