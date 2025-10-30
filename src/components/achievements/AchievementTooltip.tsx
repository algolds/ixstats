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
  RiArrowRightLine,
} from "react-icons/ri";
import type {
  DiplomaticAchievement,
  AchievementProgress,
  AchievementRequirement,
  AchievementReward,
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
  ACHIEVEMENT_RARITY_CONFIG,
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
  className,
}) => {
  const isUnlocked = Boolean(achievement.achievedAt);
  const tierConfig = ACHIEVEMENT_TIER_CONFIG[achievement.tier];
  const categoryConfig = ACHIEVEMENT_CATEGORY_CONFIG[achievement.category];
  const rarityConfig = ACHIEVEMENT_RARITY_CONFIG[achievement.rarity];

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!achievement.requirements?.length) return { percentage: 100, completed: isUnlocked };

    const totalRequirements = achievement.requirements.length;
    const completedRequirements = achievement.requirements.filter((req) => req.completed).length;

    return {
      percentage: (completedRequirements / totalRequirements) * 100,
      completed: completedRequirements === totalRequirements,
    };
  }, [achievement.requirements, isUnlocked]);

  // Format achievement date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs",
            requirement.completed
              ? "bg-green-500/20 text-green-400"
              : "bg-white/10 text-[--intel-silver]"
          )}
        >
          {requirement.completed ? <RiCheckLine className="h-3 w-3" /> : index + 1}
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium text-white">{requirement.description}</p>
          {!requirement.completed && requirement.currentValue !== undefined && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-[--intel-gold] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (requirement.currentValue / requirement.targetValue) * 100)}%`,
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
      className="flex items-center gap-3 rounded-lg border border-[--intel-gold]/20 bg-white/5 p-2"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--intel-gold]/20">
        <RiGiftLine className="h-4 w-4 text-[--intel-gold]" />
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium text-white">{reward.description}</p>
        <p className="text-xs text-[--intel-silver]">
          {reward.type.replace("_", " ")} • Value: {reward.value}
        </p>
      </div>

      {reward.claimed && <RiCheckLine className="h-4 w-4 text-green-400" />}
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
          "glass-modal fixed z-[100] w-96 max-w-[90vw] rounded-xl border border-[--intel-gold]/30 shadow-2xl",
          className
        )}
        style={{
          left: position?.x ? `${Math.min(position.x, window.innerWidth - 400)}px` : "50%",
          top: position?.y ? `${Math.min(position.y, window.innerHeight - 500)}px` : "50%",
          transform: !position ? "translate(-50%, -50%)" : undefined,
        }}
      >
        {/* Header */}
        <div className="border-b border-white/10 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${categoryConfig.color.replace("text-", "")}20` }}
              >
                {isUnlocked ? (
                  <RiStarLine className="h-6 w-6" style={{ color: tierConfig.color }} />
                ) : (
                  <RiLockLine className="h-6 w-6 text-gray-400" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{achievement.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{
                      color: categoryConfig.color,
                      backgroundColor: `${categoryConfig.color.replace("text-", "")}20`,
                    }}
                  >
                    {achievement.category}
                  </span>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{
                      color: tierConfig.color,
                      backgroundColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    {achievement.tier}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-[--intel-silver]">
                    {achievement.rarity}
                  </span>
                </div>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          <p className="text-sm leading-relaxed text-[--intel-silver]">{achievement.description}</p>
        </div>

        {/* Achievement Stats */}
        <div className="border-b border-white/10 p-6">
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
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-500/20 p-3">
              <RiCheckLine className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400">
                Unlocked on {formatDate(achievement.achievedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Requirements Section */}
        {achievement.requirements && achievement.requirements.length > 0 && (
          <div className="border-b border-white/10 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-semibold text-white">
                <RiTimeLine className="h-4 w-4" />
                Requirements
              </h4>

              <div className="text-sm text-[--intel-silver]">
                {overallProgress.percentage.toFixed(0)}% Complete
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-2 flex-1 rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    overallProgress.completed ? "bg-green-500" : "bg-[--intel-gold]"
                  )}
                  style={{ width: `${overallProgress.percentage}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">{achievement.requirements.map(renderRequirement)}</div>
          </div>
        )}

        {/* Rewards Section */}
        {achievement.rewards && achievement.rewards.length > 0 && (
          <div className="border-b border-white/10 p-6">
            <h4 className="mb-4 flex items-center gap-2 font-semibold text-white">
              <RiTrophyLine className="h-4 w-4" />
              Rewards
            </h4>

            <div className="space-y-2">{achievement.rewards.map(renderReward)}</div>
          </div>
        )}

        {/* Dependencies */}
        {achievement.dependsOn && achievement.dependsOn.length > 0 && (
          <div className="border-b border-white/10 p-6">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
              <RiArrowRightLine className="h-4 w-4" />
              Prerequisites
            </h4>

            <div className="flex flex-wrap gap-2">
              {achievement.dependsOn.map((depId) => {
                const depAchievement = relatedAchievements.find((a) => a.id === depId);
                if (!depAchievement) return null;

                const isDepCompleted = Boolean(depAchievement.achievedAt);

                return (
                  <div
                    key={depId}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-medium",
                      isDepCompleted
                        ? "border-green-500/30 bg-green-500/20 text-green-400"
                        : "border-red-500/30 bg-red-500/20 text-red-400"
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
                  className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
                >
                  <RiShareLine className="h-4 w-4" />
                  Share
                </button>
              )}

              {onViewProgress && !isUnlocked && (
                <button
                  onClick={() => onViewProgress(achievement.id)}
                  className="flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-3 py-2 text-sm font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
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
        {achievement.rarity === "legendary" && (
          <div className="pointer-events-none absolute inset-0 rounded-xl">
            <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-yellow-500/10" />
            <div className="absolute inset-[1px] rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

AchievementTooltipComponent.displayName = "AchievementTooltip";

export const AchievementTooltip = React.memo(AchievementTooltipComponent);
