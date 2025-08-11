"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  RiStarLine,
  RiLockLine,
  RiCheckLine,
  RiTimeLine,
  RiTrophyLine,
  RiGiftLine,
  RiUserLine,
  RiHeartLine,
  RiShareLine,
  RiEyeLine,
  RiCalendarLine,
  RiArrowRightLine
} from "react-icons/ri";
import type { 
  DiplomaticAchievement, 
  AchievementProgress,
  AchievementRequirement,
  AchievementReward
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
  ACHIEVEMENT_RARITY_CONFIG
} from "~/types/achievement-constellation";

interface AchievementTooltipProps {
  achievement: DiplomaticAchievement;
  visible: boolean;
  position?: { x: number; y: number };
  onClose?: () => void;
  onShare?: (achievementId: string) => void;
  onViewProgress?: (achievementId: string) => void;
  relatedAchievements?: DiplomaticAchievement[];
  className?: string;
}

const AchievementTooltipComponent: React.FC<AchievementTooltipProps> = ({
  achievement,
  visible,
  position,
  onClose,
  onShare,
  onViewProgress,
  relatedAchievements = [],
  className
}) => {
  const isUnlocked = Boolean(achievement.achievedAt);
  const tierConfig = ACHIEVEMENT_TIER_CONFIG[achievement.tier];
  const categoryConfig = ACHIEVEMENT_CATEGORY_CONFIG[achievement.category];
  const rarityConfig = ACHIEVEMENT_RARITY_CONFIG[achievement.rarity];

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!achievement.requirements?.length) return { percentage: 100, completed: isUnlocked };

    const totalRequirements = achievement.requirements.length;
    const completedRequirements = achievement.requirements.filter(req => req.completed).length;
    
    return {
      percentage: (completedRequirements / totalRequirements) * 100,
      completed: completedRequirements === totalRequirements
    };
  }, [achievement.requirements, isUnlocked]);

  // Format achievement date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate prestige value
  const prestigeValue = useMemo(() => {
    const baseScore = 100;
    const tierMultiplier = tierConfig.prestigeMultiplier;
    const rarityMultiplier = 2 - rarityConfig.probability;
    
    return Math.round(baseScore * tierMultiplier * rarityMultiplier);
  }, [tierConfig, rarityConfig]);

  // Render requirement item
  const renderRequirement = (requirement: AchievementRequirement, index: number) => (
    <div
      key={requirement.id}
      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs",
          requirement.completed 
            ? "bg-green-500/20 text-green-400" 
            : "bg-white/10 text-[--intel-silver]"
        )}>
          {requirement.completed ? <RiCheckLine className="h-3 w-3" /> : index + 1}
        </div>
        
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{requirement.description}</p>
          {!requirement.completed && requirement.currentValue !== undefined && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div
                  className="bg-[--intel-gold] h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (requirement.currentValue / requirement.targetValue) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-xs text-[--intel-silver]">
                {requirement.currentValue}/{requirement.targetValue}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render reward item
  const renderReward = (reward: AchievementReward) => (
    <div
      key={reward.id}
      className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-[--intel-gold]/20"
    >
      <div className="w-8 h-8 bg-[--intel-gold]/20 rounded-lg flex items-center justify-center">
        <RiGiftLine className="h-4 w-4 text-[--intel-gold]" />
      </div>
      
      <div className="flex-1">
        <p className="text-white text-sm font-medium">{reward.description}</p>
        <p className="text-[--intel-silver] text-xs">
          {reward.type.replace('_', ' ')} • Value: {reward.value}
        </p>
      </div>
      
      {reward.claimed && (
        <RiCheckLine className="h-4 w-4 text-green-400" />
      )}
    </div>
  );

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "fixed z-[100] w-96 max-w-[90vw] glass-modal rounded-xl border border-[--intel-gold]/30 shadow-2xl",
          className
        )}
        style={{
          left: position?.x ? `${Math.min(position.x, window.innerWidth - 400)}px` : '50%',
          top: position?.y ? `${Math.min(position.y, window.innerHeight - 500)}px` : '50%',
          transform: !position ? 'translate(-50%, -50%)' : undefined
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${categoryConfig.color.replace('text-', '')}20` }}
              >
                {isUnlocked ? (
                  <RiStarLine className="h-6 w-6" style={{ color: tierConfig.color }} />
                ) : (
                  <RiLockLine className="h-6 w-6 text-gray-400" />
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white">{achievement.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      color: categoryConfig.color,
                      backgroundColor: `${categoryConfig.color.replace('text-', '')}20`
                    }}
                  >
                    {achievement.category}
                  </span>
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      color: tierConfig.color,
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }}
                  >
                    {achievement.tier}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-[--intel-silver]">
                    {achievement.rarity}
                  </span>
                </div>
              </div>
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                ×
              </button>
            )}
          </div>

          <p className="text-[--intel-silver] text-sm leading-relaxed">
            {achievement.description}
          </p>
        </div>

        {/* Achievement Stats */}
        <div className="p-6 border-b border-white/10">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-[--intel-gold]">
                {prestigeValue.toLocaleString()}
              </div>
              <div className="text-xs text-[--intel-silver]">Prestige Points</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">
                {achievement.socialReactions || 0}
              </div>
              <div className="text-xs text-[--intel-silver]">Social Reactions</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">
                {Math.round(rarityConfig.probability * 100)}%
              </div>
              <div className="text-xs text-[--intel-silver]">Achievement Rate</div>
            </div>
          </div>

          {/* Achievement Date */}
          {isUnlocked && achievement.achievedAt && (
            <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-green-500/20 rounded-lg">
              <RiCheckLine className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400">
                Unlocked on {formatDate(achievement.achievedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Requirements Section */}
        {achievement.requirements && achievement.requirements.length > 0 && (
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <RiTimeLine className="h-4 w-4" />
                Requirements
              </h4>
              
              <div className="text-sm text-[--intel-silver]">
                {overallProgress.percentage.toFixed(0)}% Complete
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    overallProgress.completed ? "bg-green-500" : "bg-[--intel-gold]"
                  )}
                  style={{ width: `${overallProgress.percentage}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {achievement.requirements.map(renderRequirement)}
            </div>
          </div>
        )}

        {/* Rewards Section */}
        {achievement.rewards && achievement.rewards.length > 0 && (
          <div className="p-6 border-b border-white/10">
            <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
              <RiTrophyLine className="h-4 w-4" />
              Rewards
            </h4>

            <div className="space-y-2">
              {achievement.rewards.map(renderReward)}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {achievement.dependsOn && achievement.dependsOn.length > 0 && (
          <div className="p-6 border-b border-white/10">
            <h4 className="font-semibold text-white flex items-center gap-2 mb-3">
              <RiArrowRightLine className="h-4 w-4" />
              Prerequisites
            </h4>
            
            <div className="flex flex-wrap gap-2">
              {achievement.dependsOn.map(depId => {
                const depAchievement = relatedAchievements.find(a => a.id === depId);
                if (!depAchievement) return null;
                
                const isDepCompleted = Boolean(depAchievement.achievedAt);
                
                return (
                  <div
                    key={depId}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium border",
                      isDepCompleted 
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    )}
                  >
                    {depAchievement.title}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onShare && (
                <button
                  onClick={() => onShare(achievement.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <RiShareLine className="h-4 w-4" />
                  Share
                </button>
              )}
              
              {onViewProgress && !isUnlocked && (
                <button
                  onClick={() => onViewProgress(achievement.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg text-sm font-medium transition-colors"
                >
                  <RiEyeLine className="h-4 w-4" />
                  Track Progress
                </button>
              )}
            </div>

            {achievement.hidden && !isUnlocked && (
              <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                <RiLockLine className="h-3 w-3" />
                Hidden Achievement
              </div>
            )}
          </div>
        </div>

        {/* Special Effects for Legendary Achievements */}
        {achievement.rarity === 'legendary' && (
          <div className="absolute inset-0 rounded-xl pointer-events-none">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-yellow-500/10 animate-pulse" />
            <div className="absolute inset-[1px] rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

AchievementTooltipComponent.displayName = 'AchievementTooltip';

export const AchievementTooltip = React.memo(AchievementTooltipComponent);