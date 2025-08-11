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
  RiThumbUpLine
} from "react-icons/ri";
import type { 
  DiplomaticAchievement,
  AchievementTier,
  AchievementRarity 
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
  ACHIEVEMENT_RARITY_CONFIG
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
  autoCloseDelay = 8000
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [particles, setParticles] = useState<ParticleProps[]>([]);
  const [animationStage, setAnimationStage] = useState<'entering' | 'celebrating' | 'stable'>('entering');

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
      setAnimationStage('entering');
      return;
    }

    const stageTimer1 = setTimeout(() => {
      setAnimationStage('celebrating');
    }, 500);

    const stageTimer2 = setTimeout(() => {
      setAnimationStage('stable');
    }, 3000);

    return () => {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
    };
  }, [visible]);

  // Particle system for celebration effects
  useEffect(() => {
    if (animationStage !== 'celebrating' || !achievement) return;

    const createParticle = (baseX: number, baseY: number): ParticleProps => ({
      id: Math.random(),
      x: baseX + (Math.random() - 0.5) * 100,
      y: baseY + (Math.random() - 0.5) * 50,
      velocity: {
        x: (Math.random() - 0.5) * 8,
        y: Math.random() * -8 - 2
      },
      size: Math.random() * 8 + 4,
      color: ACHIEVEMENT_TIER_CONFIG[achievement.tier].color,
      opacity: 1,
      life: 0,
      maxLife: Math.random() * 2000 + 1000
    });

    // Create initial burst of particles
    const initialParticles: ParticleProps[] = [];
    for (let i = 0; i < (achievement.rarity === 'legendary' ? 50 : 30); i++) {
      initialParticles.push(createParticle(0, 0));
    }
    setParticles(initialParticles);

    // Animation loop
    const animationLoop = setInterval(() => {
      setParticles(prevParticles => {
        const updatedParticles = prevParticles
          .map(particle => ({
            ...particle,
            x: particle.x + particle.velocity.x,
            y: particle.y + particle.velocity.y,
            velocity: {
              x: particle.velocity.x * 0.99,
              y: particle.velocity.y + 0.3 // Gravity
            },
            opacity: 1 - (particle.life / particle.maxLife),
            life: particle.life + 16
          }))
          .filter(particle => particle.life < particle.maxLife && particle.opacity > 0.1);

        // Add new particles occasionally for legendary achievements
        if (achievement.rarity === 'legendary' && Math.random() < 0.3) {
          updatedParticles.push(createParticle(
            (Math.random() - 0.5) * 200,
            Math.random() * -100 - 50
          ));
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
  const prestigeValue = Math.round(100 * tierConfig.prestigeMultiplier * (2 - rarityConfig.probability));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
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
            rotateY: 45 
          }}
          transition={{ 
            duration: 0.6, 
            ease: "backOut",
            rotateX: { 
              duration: 2, 
              repeat: animationStage === 'celebrating' ? Infinity : 0,
              ease: "easeInOut" 
            }
          }}
          className="relative glass-modal rounded-2xl border-2 max-w-md w-full mx-4 overflow-hidden"
          style={{ 
            borderColor: tierConfig.color,
            boxShadow: `0 0 40px ${tierConfig.color}40, 0 0 80px ${tierConfig.color}20`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Particle System Overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  opacity: particle.opacity,
                  transform: `translate(${particle.x}px, ${particle.y}px)`
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              />
            ))}
          </div>

          {/* Legendary Rarity Border Effect */}
          {achievement.rarity === 'legendary' && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 via-yellow-500/20 to-purple-500/20 animate-pulse" />
              <motion.div 
                className="absolute inset-[2px] rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ 
                  backgroundImage: [
                    'linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)',
                    'linear-gradient(135deg, transparent, rgba(255,255,255,0.1), transparent)',
                    'linear-gradient(225deg, transparent, rgba(255,255,255,0.1), transparent)',
                    'linear-gradient(315deg, transparent, rgba(255,255,255,0.1), transparent)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {/* Header */}
          <div className="relative p-8 text-center border-b border-white/10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ 
                scale: 1, 
                rotate: 0,
                y: animationStage === 'celebrating' ? [0, -10, 0] : 0
              }}
              transition={{ 
                scale: { delay: 0.2, duration: 0.5, ease: "backOut" },
                rotate: { delay: 0.2, duration: 0.5, ease: "backOut" },
                y: { 
                  duration: 1, 
                  repeat: animationStage === 'celebrating' ? Infinity : 0,
                  ease: "easeInOut"
                }
              }}
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center relative"
              style={{ 
                backgroundColor: `${tierConfig.color}20`,
                border: `2px solid ${tierConfig.color}`,
                filter: tierConfig.glow
              }}
            >
              <RiStarFill 
                className="w-10 h-10" 
                style={{ color: tierConfig.color }}
              />
              
              {/* Sparkle effects for rare achievements */}
              {rarityConfig.sparkleEffect && (
                <>
                  <motion.div
                    className="absolute -top-2 -right-2"
                    animate={{ 
                      scale: [0, 1, 0],
                      rotate: [0, 180, 360],
                      opacity: [0, 1, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  >
                    <RiSparklingLine className="w-6 h-6 text-yellow-400" />
                  </motion.div>
                  
                  <motion.div
                    className="absolute -bottom-2 -left-2"
                    animate={{ 
                      scale: [0, 1, 0],
                      rotate: [360, 180, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  >
                    <RiSparklingLine className="w-5 h-5 text-blue-400" />
                  </motion.div>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h2 className="text-2xl font-bold text-white mb-2">Achievement Unlocked!</h2>
              <h3 className="text-xl font-bold mb-3" style={{ color: tierConfig.color }}>
                {achievement.title}
              </h3>
              
              <div className="flex items-center justify-center gap-2 mb-2">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    color: categoryConfig.color,
                    backgroundColor: `${categoryConfig.color.replace('text-', '')}20`
                  }}
                >
                  {achievement.category}
                </span>
                <span 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    color: tierConfig.color,
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }}
                >
                  {achievement.tier}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-[--intel-silver]">
                  {achievement.rarity}
                </span>
              </div>

              {achievement.rarity === 'legendary' && (
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    textShadow: [
                      '0 0 10px rgba(255,255,255,0.5)',
                      '0 0 20px rgba(255,255,255,0.8)',
                      '0 0 10px rgba(255,255,255,0.5)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-yellow-400 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <RiFireLine className="w-4 h-4" />
                  LEGENDARY ACHIEVEMENT
                  <RiFireLine className="w-4 h-4" />
                </motion.div>
              )}
            </motion.div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>

          {/* Achievement Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="p-6 border-b border-white/10"
          >
            <p className="text-[--intel-silver] text-center text-sm leading-relaxed mb-4">
              {achievement.description}
            </p>

            {/* Prestige Value */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div 
                  className="text-2xl font-bold"
                  style={{ color: tierConfig.color }}
                >
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
              className="p-6 border-b border-white/10"
            >
              <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                <RiTrophyLine className="w-4 h-4" />
                Rewards Earned
              </h4>
              
              <div className="space-y-3">
                {achievement.rewards.map((reward) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.3 }}
                    className="flex items-center gap-3 p-3 bg-[--intel-gold]/10 rounded-lg border border-[--intel-gold]/20"
                  >
                    <div className="w-8 h-8 bg-[--intel-gold]/20 rounded-lg flex items-center justify-center">
                      <RiCheckLine className="w-4 h-4 text-[--intel-gold]" />
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{reward.description}</p>
                      <p className="text-[--intel-silver] text-xs">
                        {reward.type.replace('_', ' ')} • Value: {reward.value}
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    <RiShareLine className="w-4 h-4" />
                    Share
                  </motion.button>
                )}
                
                {onViewProgress && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleViewProgress}
                    className="flex items-center gap-2 px-4 py-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg text-sm font-medium transition-colors"
                  >
                    <RiEyeLine className="w-4 h-4" />
                    View Progress
                  </motion.button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
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
                className="h-1 bg-[--intel-gold]/30 rounded-full mx-auto"
                style={{ maxWidth: "200px" }}
              />
              <p className="text-xs text-[--intel-silver] mt-2">
                Auto-closing in {Math.ceil(autoCloseDelay / 1000)} seconds
              </p>
            </div>
          </motion.div>

          {/* Achievement Rarity Glow Effect */}
          {achievement.rarity === 'epic' || achievement.rarity === 'legendary' ? (
            <div 
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${tierConfig.color}10 0%, transparent 70%)`,
                animation: 'pulse 2s infinite'
              }}
            />
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

AchievementUnlockModalComponent.displayName = 'AchievementUnlockModal';

export const AchievementUnlockModal = React.memo(AchievementUnlockModalComponent);