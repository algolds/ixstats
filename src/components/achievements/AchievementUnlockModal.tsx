"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  RiStarFill,
  RiTrophyLine,
  RiCloseLine,
  RiShareLine,
  RiEyeLine,
  RiCheckLine,
  RiSparklingLine,
  RiFireLine,
  RiHeartLine,
  RiThumbUpLine,
} from "react-icons/ri";
import type {
  DiplomaticAchievement,
  AchievementTier,
  AchievementRarity,
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
  ACHIEVEMENT_RARITY_CONFIG,
} from "~/types/achievement-constellation";

interface AchievementUnlockModalProps {
  achievement: DiplomaticAchievement | null;
  visible: boolean;
  onClose: () => void;
  onShare?: (achievementId: string) => void;
  onViewProgress?: (achievementId: string) => void;
  autoCloseDelay?: number; // Auto-close after X milliseconds
}

interface ParticleProps {
  id: number;
  x: number;
  y: number;
  velocity: { x: number; y: number };
  size: number;
  color: string;
  opacity: number;
  life: number;
  maxLife: number;
}

const AchievementUnlockModalComponent: React.FC<AchievementUnlockModalProps> = ({
  achievement,
  visible,
  onClose,
  onShare,
  onViewProgress,
  autoCloseDelay = 8000,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [particles, setParticles] = useState<ParticleProps[]>([]);
  const [animationStage, setAnimationStage] = useState<"entering" | "celebrating" | "stable">(
    "entering"
  );

  // Auto-close timer
  useEffect(() => {
    if (!visible || !achievement) return;

    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [visible, achievement, autoCloseDelay, onClose]);

  // Animation stage progression
  useEffect(() => {
    if (!visible) {
      setAnimationStage("entering");
      return;
    }

    const stageTimer1 = setTimeout(() => {
      setAnimationStage("celebrating");
    }, 500);

    const stageTimer2 = setTimeout(() => {
      setAnimationStage("stable");
    }, 3000);

    return () => {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
    };
  }, [visible]);

  // Particle system for celebration effects
  useEffect(() => {
    if (animationStage !== "celebrating" || !achievement) return;

    const createParticle = (baseX: number, baseY: number): ParticleProps => ({
      id: Math.random(),
      x: baseX + (Math.random() - 0.5) * 100,
      y: baseY + (Math.random() - 0.5) * 50,
      velocity: {
        x: (Math.random() - 0.5) * 8,
        y: Math.random() * -8 - 2,
      },
      size: Math.random() * 8 + 4,
      color: ACHIEVEMENT_TIER_CONFIG[achievement.tier].color,
      opacity: 1,
      life: 0,
      maxLife: Math.random() * 2000 + 1000,
    });

    // Create initial burst of particles
    const initialParticles: ParticleProps[] = [];
    for (let i = 0; i < (achievement.rarity === "legendary" ? 50 : 30); i++) {
      initialParticles.push(createParticle(0, 0));
    }
    setParticles(initialParticles);

    // Animation loop
    const animationLoop = setInterval(() => {
      setParticles((prevParticles) => {
        const updatedParticles = prevParticles
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.velocity.x,
            y: particle.y + particle.velocity.y,
            velocity: {
              x: particle.velocity.x * 0.99,
              y: particle.velocity.y + 0.3, // Gravity
            },
            opacity: 1 - particle.life / particle.maxLife,
            life: particle.life + 16,
          }))
          .filter((particle) => particle.life < particle.maxLife && particle.opacity > 0.1);

        // Add new particles occasionally for legendary achievements
        if (achievement.rarity === "legendary" && Math.random() < 0.3) {
          updatedParticles.push(
            createParticle((Math.random() - 0.5) * 200, Math.random() * -100 - 50)
          );
        }

        return updatedParticles;
      });
    }, 16);

    return () => clearInterval(animationLoop);
  }, [animationStage, achievement]);

  const handleShare = useCallback(() => {
    if (achievement && onShare) {
      onShare(achievement.id);
    }
  }, [achievement, onShare]);

  const handleViewProgress = useCallback(() => {
    if (achievement && onViewProgress) {
      onViewProgress(achievement.id);
      onClose();
    }
  }, [achievement, onViewProgress, onClose]);

  if (!visible || !achievement) return null;

  const tierConfig = ACHIEVEMENT_TIER_CONFIG[achievement.tier];
  const categoryConfig = ACHIEVEMENT_CATEGORY_CONFIG[achievement.category];
  const rarityConfig = ACHIEVEMENT_RARITY_CONFIG[achievement.rarity];

  // Calculate prestige value
  const prestigeValue = Math.round(
    100 * tierConfig.prestigeMultiplier * (2 - rarityConfig.probability)
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotateY: -45 }}
          animate={{
            scale: 1,
            opacity: 1,
            rotateY: 0,
            rotateX: [0, -5, 5, 0],
          }}
          exit={{
            scale: 0.8,
            opacity: 0,
            rotateY: 45,
          }}
          transition={{
            duration: 0.6,
            ease: "backOut",
            rotateX: {
              duration: 2,
              repeat: animationStage === "celebrating" ? Infinity : 0,
              ease: "easeInOut",
            },
          }}
          className="glass-modal relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border-2"
          style={{
            borderColor: tierConfig.color,
            boxShadow: `0 0 40px ${tierConfig.color}40, 0 0 80px ${tierConfig.color}20`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Particle System Overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: "50%",
                  top: "50%",
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  opacity: particle.opacity,
                  transform: `translate(${particle.x}px, ${particle.y}px)`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              />
            ))}
          </div>

          {/* Legendary Rarity Border Effect */}
          {achievement.rarity === "legendary" && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl">
              <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 via-yellow-500/20 to-purple-500/20" />
              <motion.div
                className="absolute inset-[2px] rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{
                  backgroundImage: [
                    "linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)",
                    "linear-gradient(135deg, transparent, rgba(255,255,255,0.1), transparent)",
                    "linear-gradient(225deg, transparent, rgba(255,255,255,0.1), transparent)",
                    "linear-gradient(315deg, transparent, rgba(255,255,255,0.1), transparent)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {/* Header */}
          <div className="relative border-b border-white/10 p-8 text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: 1,
                rotate: 0,
                y: animationStage === "celebrating" ? [0, -10, 0] : 0,
              }}
              transition={{
                scale: { delay: 0.2, duration: 0.5, ease: "backOut" },
                rotate: { delay: 0.2, duration: 0.5, ease: "backOut" },
                y: {
                  duration: 1,
                  repeat: animationStage === "celebrating" ? Infinity : 0,
                  ease: "easeInOut",
                },
              }}
              className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${tierConfig.color}20`,
                border: `2px solid ${tierConfig.color}`,
                filter: tierConfig.glow,
              }}
            >
              <RiStarFill className="h-10 w-10" style={{ color: tierConfig.color }} />

              {/* Sparkle effects for rare achievements */}
              {rarityConfig.sparkleEffect && (
                <>
                  <motion.div
                    className="absolute -top-2 -right-2"
                    animate={{
                      scale: [0, 1, 0],
                      rotate: [0, 180, 360],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  >
                    <RiSparklingLine className="h-6 w-6 text-yellow-400" />
                  </motion.div>

                  <motion.div
                    className="absolute -bottom-2 -left-2"
                    animate={{
                      scale: [0, 1, 0],
                      rotate: [360, 180, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  >
                    <RiSparklingLine className="h-5 w-5 text-blue-400" />
                  </motion.div>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h2 className="mb-2 text-2xl font-bold text-white">Achievement Unlocked!</h2>
              <h3 className="mb-3 text-xl font-bold" style={{ color: tierConfig.color }}>
                {achievement.title}
              </h3>

              <div className="mb-2 flex items-center justify-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    color: categoryConfig.color,
                    backgroundColor: `${categoryConfig.color.replace("text-", "")}20`,
                  }}
                >
                  {achievement.category}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    color: tierConfig.color,
                    backgroundColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  {achievement.tier}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[--intel-silver]">
                  {achievement.rarity}
                </span>
              </div>

              {achievement.rarity === "legendary" && (
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    textShadow: [
                      "0 0 10px rgba(255,255,255,0.5)",
                      "0 0 20px rgba(255,255,255,0.8)",
                      "0 0 10px rgba(255,255,255,0.5)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center justify-center gap-2 text-sm font-bold text-yellow-400"
                >
                  <RiFireLine className="h-4 w-4" />
                  LEGENDARY ACHIEVEMENT
                  <RiFireLine className="h-4 w-4" />
                </motion.div>
              )}
            </motion.div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-white"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          {/* Achievement Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="border-b border-white/10 p-6"
          >
            <p className="mb-4 text-center text-sm leading-relaxed text-[--intel-silver]">
              {achievement.description}
            </p>

            {/* Prestige Value */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: tierConfig.color }}>
                  +{prestigeValue.toLocaleString()}
                </div>
                <div className="text-xs text-[--intel-silver]">Prestige Points</div>
              </div>

              {achievement.socialReactions > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {achievement.socialReactions}
                  </div>
                  <div className="text-xs text-[--intel-silver]">Reactions</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Rewards */}
          {achievement.rewards && achievement.rewards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="border-b border-white/10 p-6"
            >
              <h4 className="mb-4 flex items-center gap-2 font-semibold text-white">
                <RiTrophyLine className="h-4 w-4" />
                Rewards Earned
              </h4>

              <div className="space-y-3">
                {achievement.rewards.map((reward) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.3 }}
                    className="flex items-center gap-3 rounded-lg border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--intel-gold]/20">
                      <RiCheckLine className="h-4 w-4 text-[--intel-gold]" />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{reward.description}</p>
                      <p className="text-xs text-[--intel-silver]">
                        {reward.type.replace("_", " ")} • Value: {reward.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onShare && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
                  >
                    <RiShareLine className="h-4 w-4" />
                    Share
                  </motion.button>
                )}

                {onViewProgress && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleViewProgress}
                    className="flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-2 text-sm font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                  >
                    <RiEyeLine className="h-4 w-4" />
                    View Progress
                  </motion.button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="rounded-lg bg-white/10 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Continue
              </motion.button>
            </div>

            {/* Auto-close indicator */}
            <div className="mt-4 text-center">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: autoCloseDelay / 1000, ease: "linear" }}
                className="mx-auto h-1 rounded-full bg-[--intel-gold]/30"
                style={{ maxWidth: "200px" }}
              />
              <p className="mt-2 text-xs text-[--intel-silver]">
                Auto-closing in {Math.ceil(autoCloseDelay / 1000)} seconds
              </p>
            </div>
          </motion.div>

          {/* Achievement Rarity Glow Effect */}
          {achievement.rarity === "epic" || achievement.rarity === "legendary" ? (
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: `radial-gradient(circle at center, ${tierConfig.color}10 0%, transparent 70%)`,
                animation: "pulse 2s infinite",
              }}
            />
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

AchievementUnlockModalComponent.displayName = "AchievementUnlockModal";

export const AchievementUnlockModal = React.memo(AchievementUnlockModalComponent);
