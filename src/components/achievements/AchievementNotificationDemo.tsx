"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { RealTimeAchievementNotifications } from "./RealTimeAchievementNotifications";
import {
  RiPlayLine,
  RiStopLine,
  RiSettings3Line,
  RiStarLine,
  RiTrophyLine,
  RiFireLine,
} from "react-icons/ri";

interface AchievementNotificationDemoProps {
  className?: string;
}

const DEMO_ACHIEVEMENTS = [
  {
    id: "first-embassy",
    title: "First Contact",
    description: "Established your first diplomatic embassy with a neighboring nation.",
    tier: "bronze" as const,
    category: "diplomatic" as const,
    rarity: "common" as const,
    points: 100,
  },
  {
    id: "trade-master",
    title: "Master of Commerce",
    description: "Successfully negotiated 10 major trade agreements, boosting national GDP by 15%.",
    tier: "gold" as const,
    category: "economic" as const,
    rarity: "rare" as const,
    points: 500,
  },
  {
    id: "cultural-bridge",
    title: "Cultural Bridge Builder",
    description:
      "Facilitated 25 cultural exchange programs, fostering international understanding.",
    tier: "platinum" as const,
    category: "cultural" as const,
    rarity: "epic" as const,
    points: 1000,
  },
  {
    id: "legendary-diplomat",
    title: "Legendary Diplomat",
    description: "Achieved maximum diplomatic reputation with all nations in your region.",
    tier: "legendary" as const,
    category: "diplomatic" as const,
    rarity: "legendary" as const,
    points: 2500,
  },
];

const AchievementNotificationDemoComponent: React.FC<AchievementNotificationDemoProps> = ({
  className,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [currentDemo, setCurrentDemo] = useState(0);
  const [position, setPosition] = useState<
    "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center"
  >("top-right");
  const [showParticles, setShowParticles] = useState(true);
  const [playSound, setPlaySound] = useState(true);

  // Mock WebSocket events for demo
  const triggerDemoAchievement = () => {
    if (!isActive) return;

    const achievement = DEMO_ACHIEVEMENTS[currentDemo];
    if (!achievement) return;

    // Simulate achievement unlock event
    const event = new CustomEvent("achievement-unlock", {
      detail: {
        type: "achievement_notification",
        event: {
          id: `demo-${Date.now()}`,
          type: "achievement_unlocked",
          countryId: "demo-country",
          countryName: "Demo Nation",
          data: {
            achievementId: achievement.id,
            achievementTier: achievement.tier,
            achievementTitle: achievement.title,
            achievementDescription: achievement.description,
            achievementCategory: achievement.category,
            achievementRarity: achievement.rarity,
            achievementPoints: achievement.points,
          },
          timestamp: new Date().toISOString(),
          ixTimeContext: Date.now(),
          classification: "PUBLIC" as const,
          priority: "NORMAL" as const,
        },
        affectedCountries: ["demo-country"],
        broadcastLevel: "PUBLIC" as const,
      },
    });

    window.dispatchEvent(event);

    // Move to next achievement for demo
    setCurrentDemo((prev) => (prev + 1) % DEMO_ACHIEVEMENTS.length);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Demo Controls */}
      <div className="glass-hierarchy-child rounded-lg p-6">
        <div className="mb-4 flex items-center gap-3">
          <RiStarLine className="h-6 w-6 text-[--intel-gold]" />
          <h3 className="text-xl font-bold text-[--intel-gold]">Achievement Notifications Demo</h3>
        </div>

        <p className="mb-6 text-[--intel-silver]">
          Experience the real-time achievement notification system with simulated diplomatic
          accomplishments. Customize the display settings and trigger sample notifications to see
          how they work in practice.
        </p>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Basic Controls */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-semibold text-white">
              <RiPlayLine className="h-4 w-4" />
              Demo Controls
            </h4>

            <div className="space-y-3">
              <button
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors",
                  isActive
                    ? "border border-green-500/30 bg-green-500/20 text-green-400"
                    : "border border-red-500/30 bg-red-500/20 text-red-400"
                )}
              >
                {isActive ? (
                  <>
                    <RiStopLine className="h-4 w-4" />
                    Stop Demo
                  </>
                ) : (
                  <>
                    <RiPlayLine className="h-4 w-4" />
                    Start Demo
                  </>
                )}
              </button>

              <button
                onClick={triggerDemoAchievement}
                disabled={!isActive}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors",
                  isActive
                    ? "border border-[--intel-gold]/30 bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
                    : "cursor-not-allowed border border-gray-500/30 bg-gray-500/20 text-gray-500"
                )}
              >
                <RiTrophyLine className="h-4 w-4" />
                Trigger Achievement
              </button>
            </div>

            {/* Current Achievement Preview */}
            {isActive && DEMO_ACHIEVEMENTS[currentDemo] && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-xs text-[--intel-silver]">Next Achievement:</div>
                <div className="font-medium text-white">{DEMO_ACHIEVEMENTS[currentDemo].title}</div>
                <div className="text-sm text-[--intel-silver] capitalize">
                  {DEMO_ACHIEVEMENTS[currentDemo].tier} • {DEMO_ACHIEVEMENTS[currentDemo].category}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-semibold text-white">
              <RiSettings3Line className="h-4 w-4" />
              Display Settings
            </h4>

            <div className="space-y-3">
              {/* Position Setting */}
              <div>
                <label className="mb-2 block text-sm text-[--intel-silver]">
                  Notification Position
                </label>
                <select
                  value={position}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setPosition(
                      e.target.value as
                        | "top-right"
                        | "top-left"
                        | "bottom-right"
                        | "bottom-left"
                        | "center"
                    )
                  }
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[--intel-gold]/50 focus:outline-none"
                >
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="center">Center</option>
                </select>
              </div>

              {/* Effects Toggles */}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={showParticles}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setShowParticles(e.target.checked)
                    }
                    className="rounded border-gray-300 text-[--intel-gold] focus:ring-[--intel-gold]/50"
                  />
                  Particle Effects
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={playSound}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPlaySound(e.target.checked)
                    }
                    className="rounded border-gray-300 text-[--intel-gold] focus:ring-[--intel-gold]/50"
                  />
                  Sound Effects
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Queue */}
        <div className="mt-6 border-t border-white/10 pt-6">
          <h4 className="mb-3 font-semibold text-white">Demo Achievement Queue</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {DEMO_ACHIEVEMENTS.map((achievement, index) => (
              <div
                key={achievement.id}
                className={cn(
                  "rounded-lg border p-3 text-sm transition-all",
                  index === currentDemo && isActive
                    ? "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                    : "border-white/20 bg-white/5"
                )}
              >
                <div className="mb-1 font-medium text-white">{achievement.title}</div>
                <div className="text-xs text-[--intel-silver] capitalize">
                  {achievement.tier} • {achievement.category}
                </div>
                <div className="mt-1 text-xs text-[--intel-gold]">+{achievement.points} pts</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Achievement Notifications */}
      {isActive && (
        <RealTimeAchievementNotifications
          countryId="demo-country"
          countryName="Demo Nation"
          position={position}
          maxNotifications={3}
          autoHideDuration={8000}
          showParticleEffects={showParticles}
          playSound={playSound}
        />
      )}
    </div>
  );
};

AchievementNotificationDemoComponent.displayName = "AchievementNotificationDemo";

export const AchievementNotificationDemo = React.memo(AchievementNotificationDemoComponent);
