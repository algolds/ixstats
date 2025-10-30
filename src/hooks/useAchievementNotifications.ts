"use client";

import { useEffect, useCallback } from "react";
import { useAchievementUpdates } from "~/hooks/useDiplomaticUpdates";
import { globalNotificationBridge } from "~/services/GlobalNotificationBridge";
import { api } from "~/trpc/react";
import type { LiveIntelligenceUpdate } from "~/lib/diplomatic-websocket";
import { toast } from "sonner";

export interface AchievementNotificationConfig {
  countryId: string;
  countryName: string;
  enableRealTime?: boolean;
  enableToast?: boolean;
  enableDynamicIsland?: boolean;
  enableNotificationCenter?: boolean;
}

export interface AchievementNotification {
  id: string;
  title: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "legendary";
  category: string;
  rarity: string;
  points: number;
  unlockedAt: string;
}

/**
 * Hook to integrate achievement notifications with the global notification system
 *
 * Features:
 * - WebSocket real-time achievement updates
 * - Integration with Global Notification Center
 * - Dynamic Island notifications
 * - Toast notifications
 * - Sound effects
 */
export function useAchievementNotifications(config: AchievementNotificationConfig) {
  const {
    countryId,
    countryName,
    enableRealTime = false,
    enableToast = true,
    enableDynamicIsland = true,
    enableNotificationCenter = true,
  } = config;

  // Connect to WebSocket for real-time achievement updates
  const { isConnected, recentEvents, actions } = useAchievementUpdates(countryId, enableRealTime);

  // tRPC mutation for creating notifications
  const createNotificationMutation = api.notifications.createNotification.useMutation();

  // Play achievement sound effect
  const playAchievementSound = useCallback((tier: AchievementNotification["tier"]) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      const frequencies = {
        bronze: [440, 550],
        silver: [523, 659],
        gold: [659, 784],
        platinum: [784, 932],
        legendary: [932, 1109],
      };

      const [freq1, freq2] = frequencies[tier];

      [freq1, freq2].forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq!;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + 0.5 + index * 0.1);
      });
    } catch (error) {
      console.warn("[Achievement] Sound playback failed:", error);
    }
  }, []);

  // Process achievement events and dispatch to notification systems
  useEffect(() => {
    recentEvents.forEach((update: LiveIntelligenceUpdate) => {
      if (
        update.type === "achievement_notification" &&
        update.event.type === "achievement_unlocked"
      ) {
        const achievementData = update.event.data as {
          achievementId: string;
          achievementTier: string;
          achievementTitle?: string;
          achievementDescription?: string;
          achievementCategory?: string;
          achievementRarity?: string;
          achievementPoints?: number;
        };

        const achievement: AchievementNotification = {
          id: achievementData.achievementId,
          title: achievementData.achievementTitle || "New Achievement Unlocked",
          description:
            achievementData.achievementDescription || "You have unlocked a new achievement!",
          tier: (achievementData.achievementTier as AchievementNotification["tier"]) || "bronze",
          category: achievementData.achievementCategory || "general",
          rarity: achievementData.achievementRarity || "common",
          points: achievementData.achievementPoints || 100,
          unlockedAt: update.event.timestamp,
        };

        // Dispatch to global notification center
        if (enableNotificationCenter) {
          void globalNotificationBridge.notify({
            type: "achievement",
            title: achievement.title,
            message: achievement.description,
            priority:
              achievement.tier === "legendary"
                ? "high"
                : achievement.tier === "platinum"
                  ? "medium"
                  : "low",
            category: "achievement",
            deliveryMethod: enableDynamicIsland ? "dynamic-island" : "toast",
            metadata: {
              achievementId: achievement.id,
              tier: achievement.tier,
              category: achievement.category,
              rarity: achievement.rarity,
              points: achievement.points,
            },
          });

          // 🔔 Also create database notification for persistence
          void createNotificationMutation
            .mutateAsync({
              title: `🏆 ${achievement.title}`,
              message: achievement.description,
              category: "achievement",
              type: "success",
              level:
                achievement.tier === "legendary"
                  ? "high"
                  : achievement.tier === "platinum"
                    ? "medium"
                    : "low",
              adminUserId: "system", // System-generated achievement
            })
            .catch((err: Error) =>
              console.error("[Achievement] Failed to create notification:", err)
            );
        }

        // Show toast notification if enabled
        if (enableToast && !enableDynamicIsland) {
          const tierEmojis = {
            bronze: "🥉",
            silver: "🥈",
            gold: "🥇",
            platinum: "💎",
            legendary: "👑",
          };

          toast.success(`${tierEmojis[achievement.tier]} ${achievement.title}`, {
            description: `${achievement.description} (+${achievement.points} points)`,
            duration: 5000,
          });
        }

        // Play sound effect based on tier
        playAchievementSound(achievement.tier);

        // Mark event as processed
        actions.markEventsAsRead();
      }
    });
  }, [
    recentEvents,
    enableNotificationCenter,
    enableDynamicIsland,
    enableToast,
    actions,
    createNotificationMutation,
    playAchievementSound,
  ]);

  // Manual trigger for unlocking achievements
  const unlockAchievement = useCallback(
    (achievement: Omit<AchievementNotification, "id" | "unlockedAt">) => {
      const fullAchievement: AchievementNotification = {
        ...achievement,
        id: `manual-${Date.now()}`,
        unlockedAt: new Date().toISOString(),
      };

      // Dispatch to notification systems
      if (enableNotificationCenter) {
        void globalNotificationBridge.notify({
          type: "achievement",
          title: fullAchievement.title,
          message: fullAchievement.description,
          priority:
            fullAchievement.tier === "legendary"
              ? "high"
              : fullAchievement.tier === "platinum"
                ? "medium"
                : "low",
          category: "achievement",
          deliveryMethod: enableDynamicIsland ? "dynamic-island" : "toast",
          metadata: {
            achievementId: fullAchievement.id,
            tier: fullAchievement.tier,
            category: fullAchievement.category,
            rarity: fullAchievement.rarity,
            points: fullAchievement.points,
          },
        });
      }

      if (enableToast && !enableDynamicIsland) {
        toast.success(`🏆 ${fullAchievement.title}`, {
          description: `${fullAchievement.description} (+${fullAchievement.points} points)`,
          duration: 5000,
        });
      }

      playAchievementSound(fullAchievement.tier);
    },
    [enableNotificationCenter, enableDynamicIsland, enableToast, playAchievementSound]
  );

  return {
    // WebSocket state
    isConnected,
    recentEvents,

    // Actions
    connect: actions.connect,
    disconnect: actions.disconnect,
    unlockAchievement,

    // Utility
    clearEvents: actions.clearEvents,
  };
}
