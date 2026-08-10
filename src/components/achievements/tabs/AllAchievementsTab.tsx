"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Lock,
  Award,
  LayoutGrid,
  List,
  Eye,
  EyeOff,
  Diamond,
  Search,
  X,
  Gem,
  Zap,
  Target,
  CircleDot,
  Layers,
  Hexagon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { rarities, getTrophyTier, type TrophyTier } from "../constants";
import { createUrl } from "~/lib/url-utils";
import { Input } from "~/components/ui/input";

interface AllAchievementsTabProps {
  achievements: any[] | undefined;
}

const ACHIEVEMENT_TIER_CONFIG: Record<
  TrophyTier,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; border: string; text: string }
> = {
  platinum: {
    label: "Legendary",
    icon: Zap,
    bg: "bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border-cyan-400/50 text-cyan-200 font-extrabold shadow-[0_0_10px_rgba(34,211,238,0.35)]",
    border: "border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.4)]",
    text: "text-cyan-200 font-extrabold",
  },
  gold: {
    label: "Epic",
    icon: Gem,
    bg: "bg-gradient-to-r from-amber-500/25 to-orange-500/25 border-amber-400/50 text-amber-200 font-extrabold shadow-[0_0_10px_rgba(251,191,36,0.35)]",
    border: "border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    text: "text-amber-200 font-extrabold",
  },
  silver: {
    label: "Rare",
    icon: Hexagon,
    bg: "bg-gradient-to-r from-purple-500/25 to-indigo-500/25 border-purple-400/50 text-purple-200 font-extrabold shadow-[0_0_10px_rgba(168,85,247,0.35)]",
    border: "border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.4)]",
    text: "text-purple-200 font-extrabold",
  },
  bronze: {
    label: "Core",
    icon: Target,
    bg: "bg-gradient-to-r from-blue-500/25 to-cyan-500/25 border-blue-400/50 text-blue-200 font-extrabold shadow-[0_0_8px_rgba(59,130,246,0.3)]",
    border: "border-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.35)]",
    text: "text-blue-200 font-bold",
  },
};

const RARITY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    activeBg: string;
    textColor: string;
  }
> = {
  all: {
    label: "All Rarities",
    icon: Layers,
    color: "text-amber-400",
    activeBg: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    textColor: "text-slate-950 font-black",
  },
  Legendary: {
    label: "Legendary",
    icon: Zap,
    color: "text-cyan-300 fill-cyan-300/30 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]",
    activeBg: "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_14px_rgba(34,211,238,0.5)]",
    textColor: "text-white font-extrabold",
  },
  Epic: {
    label: "Epic",
    icon: Gem,
    color: "text-amber-400 fill-amber-400/20 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]",
    activeBg: "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 shadow-[0_0_14px_rgba(251,191,36,0.5)]",
    textColor: "text-slate-950 font-black",
  },
  Rare: {
    label: "Rare",
    icon: Hexagon,
    color: "text-purple-400 fill-purple-400/20",
    activeBg: "bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_14px_rgba(168,85,247,0.5)]",
    textColor: "text-white font-extrabold",
  },
  Uncommon: {
    label: "Uncommon",
    icon: Target,
    color: "text-blue-400",
    activeBg: "bg-gradient-to-r from-blue-600 to-cyan-600 shadow-[0_0_10px_rgba(59,130,246,0.4)]",
    textColor: "text-white font-extrabold",
  },
  Common: {
    label: "Common",
    icon: CircleDot,
    color: "text-slate-300",
    activeBg: "bg-slate-700 shadow-[0_0_8px_rgba(148,163,184,0.3)]",
    textColor: "text-slate-100 font-bold",
  },
};

export function AllAchievementsTab({ achievements }: AllAchievementsTabProps) {
  const [selectedRarity, setSelectedRarity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const toggleSecretReveal = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredAchievements = achievements
    ?.filter((a) => selectedRarity === "all" || a.rarity === selectedRarity)
    ?.filter((a) =>
      searchQuery.trim() === ""
        ? true
        : a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-4">
      {/* Apple Frosted Glass Filter & Search Control Center */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-xl backdrop-blur-2xl transition-all border-t-white/20 dark:bg-black/70 dark:border-white/12 dark:border-t-white/25">
        <TextureOverlay texture="dots" opacity={0.03} />

        <div className="relative z-10 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Instant Search Field */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-full border-white/10 bg-slate-900/80 pl-8 pr-8 text-xs font-medium text-slate-200 placeholder:text-slate-400 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 backdrop-blur-md transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Rarity Segmented Control */}
            <div className="flex items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-slate-900/80 p-0.5 shadow-inner backdrop-blur-md">
              {rarities.map((r) => {
                const isSelected = selectedRarity === r;
                const config = RARITY_CONFIG[r] || {
                  label: r,
                  icon: CircleDot,
                  color: "text-slate-400",
                };
                const RarityIcon = config.icon;

                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRarity(r)}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold capitalize transition-all duration-200 active:scale-95 select-none",
                      isSelected ? config.textColor : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="rarity-segmented-indicator"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className={cn("absolute inset-0 rounded-full", config.activeBg)}
                      />
                    )}
                    <RarityIcon
                      className={cn(
                        "relative z-10 h-3 w-3 transition-colors",
                        isSelected ? (config.textColor.includes("slate-950") ? "text-slate-950" : "text-white") : config.color
                      )}
                    />
                    <span className="relative z-10">{config.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Apple View Mode Switcher */}
            <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-slate-900/80 p-0.5 shadow-inner backdrop-blur-md select-none">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-6 px-2.5 items-center gap-1 rounded-full text-[10px] font-bold transition-all active:scale-95",
                  viewMode === "list"
                    ? "bg-slate-100 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                )}
                title="List View"
              >
                <List className="h-3 w-3" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-6 px-2.5 items-center gap-1 rounded-full text-[10px] font-bold transition-all active:scale-95",
                  viewMode === "grid"
                    ? "bg-slate-100 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3 w-3" />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Catalog Layout with Apple Inline Scroll */}
      {filteredAchievements && filteredAchievements.length > 0 ? (
        <div className="relative max-h-[580px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
          {viewMode === "list" ? (
          /* High-Density Apple Sleek List View */
          <div className="space-y-2.5">
            {filteredAchievements.map((achievement, idx) => {
              const isUnlocked = achievement.isUnlocked;
              const isSecret =
                (achievement.key.startsWith("vid-") || achievement.key.startsWith("meme-")) &&
                !isUnlocked;
              const isRevealed = revealedSecrets.has(achievement.key);
              const tier = getTrophyTier(achievement.rarity);
              const tierConfig = ACHIEVEMENT_TIER_CONFIG[tier];
              const TierIcon = tierConfig.icon;
              const isUltraRare = (achievement.globalUnlockPercent || 100) < 5;

              return (
                <motion.div
                  key={achievement.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(idx * 0.015, 0.2),
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  whileHover={{ y: -2, scale: 1.005 }}
                  whileTap={{ scale: 0.985 }}
                  className={cn(
                    "relative flex flex-col items-start justify-between gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 shadow-xl backdrop-blur-2xl transition-all border-t-white/20 sm:flex-row sm:items-center dark:bg-black/60 dark:border-white/12",
                    !isUnlocked
                      ? "bg-slate-950/40 border-dashed border-white/10 backdrop-blur-md select-none opacity-85"
                      : "hover:border-white/25 hover:shadow-2xl"
                  )}
                >
                  <TextureOverlay texture="dots" opacity={0.02} />

                  {/* Status Bar Indicator */}
                  {isUnlocked && (
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-green-400 via-emerald-500 to-teal-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
                  )}

                  <div className="flex min-w-0 flex-1 items-center gap-3.5 pl-2">
                    {/* Icon Pedestal */}
                    <div
                      className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl shadow-inner backdrop-blur-md transition-all duration-300 select-none",
                        isUnlocked
                          ? "border-green-500/35 bg-gradient-to-b from-green-500/20 to-emerald-500/10 text-green-300 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                          : "border-white/10 bg-white/5 text-slate-500 opacity-60"
                      )}
                    >
                      {isUnlocked ? (
                        achievement.iconUrl?.startsWith("http") ||
                        achievement.iconUrl?.startsWith("/") ? (
                          <img
                            src={
                              achievement.iconUrl?.startsWith("/")
                                ? createUrl(achievement.iconUrl)
                                : achievement.iconUrl
                            }
                            alt={achievement.title}
                            className="h-5.5 w-5.5 object-contain drop-shadow-md"
                          />
                        ) : (
                          achievement.iconUrl
                        )
                      ) : (
                        <Lock className="h-4.5 w-4.5 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Achievement Tier Tag */}
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase backdrop-blur-md",
                            tierConfig.bg
                          )}
                        >
                          <TierIcon className="h-3 w-3" />
                          <span>{tierConfig.label}</span>
                        </span>

                        {/* Ultra-Rare Diamond Pill */}
                        {isUltraRare && (
                          <span className="flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 font-mono text-[9px] font-extrabold text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.25)] backdrop-blur-md uppercase">
                            <Diamond className="h-3 w-3 text-cyan-300 animate-pulse" />
                            <span>{achievement.globalUnlockPercent}% Ultra-Rare</span>
                          </span>
                        )}

                        <h4
                          className={cn(
                            "text-xs font-extrabold tracking-tight",
                            isUnlocked ? "text-slate-100" : "text-slate-400/80"
                          )}
                        >
                          {isSecret && !isRevealed ? "Secret Achievement" : achievement.title}
                        </h4>
                      </div>

                      <p
                        className={cn(
                          "max-w-xl truncate text-[11px] font-medium leading-snug select-none",
                          isUnlocked
                            ? "text-slate-300/90"
                            : "text-slate-500/60 blur-[3px] opacity-40 pointer-events-none"
                        )}
                      >
                        {isSecret && !isRevealed
                          ? "Hidden challenge. Click the eye icon to preview secret details."
                          : achievement.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Side Achievement Points & Date */}
                  <div className="mt-1 flex w-full shrink-0 items-center justify-end gap-3 border-t border-white/10 pt-2 sm:mt-0 sm:w-auto sm:border-t-0 sm:pt-0">
                    {/* Secret Reveal Button */}
                    {isSecret && (
                      <button
                        onClick={() => toggleSecretReveal(achievement.key)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all active:scale-95"
                        title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                      >
                        {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {/* Apple Metallic Points Pill */}
                    <div className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/20 px-3 py-1 font-mono text-xs font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] backdrop-blur-md select-none">
                      <span>+{achievement.points || 10}</span>
                      <span className="text-[9px] font-bold tracking-wide text-emerald-400/80 uppercase">
                        pts
                      </span>
                    </div>

                    {/* Date Details */}
                    <div className="w-20 text-right text-[10px] text-slate-400">
                      {isUnlocked && achievement.unlockedAt ? (
                        <>
                          <span className="block text-[8px] font-extrabold tracking-wider text-slate-400 uppercase">
                            Unlocked
                          </span>
                          <span className="mt-0.5 block font-mono font-bold text-slate-200">
                            {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </span>
                        </>
                      ) : (
                        <span className="italic opacity-40">Locked</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* High-Density Compact Grid View */
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAchievements.map((achievement, idx) => {
              const isUnlocked = achievement.isUnlocked;
              const tier = getTrophyTier(achievement.rarity);
              const tierConfig = ACHIEVEMENT_TIER_CONFIG[tier];
              const TierIcon = tierConfig.icon;
              const isUltraRare = (achievement.globalUnlockPercent || 100) < 5;

              return (
                <motion.div
                  key={achievement.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(idx * 0.02, 0.25),
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 shadow-xl backdrop-blur-2xl transition-all border-t-white/20 dark:bg-black/60 dark:border-white/12",
                    !isUnlocked
                      ? "bg-slate-950/40 border-dashed border-white/10 backdrop-blur-md select-none opacity-85"
                      : "hover:border-amber-500/30"
                  )}
                >
                  <TextureOverlay texture="dots" opacity={0.03} />

                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.2 font-mono text-[8px] uppercase backdrop-blur-md", tierConfig.bg)}>
                        <TierIcon className="h-2.5 w-2.5" />
                        <span>{tierConfig.label}</span>
                      </span>

                      {isUltraRare && (
                        <span className="flex items-center gap-1 font-mono text-[8px] font-bold text-cyan-300">
                          <Diamond className="h-2.5 w-2.5 text-cyan-300 animate-pulse" />
                          <span>{achievement.globalUnlockPercent}%</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div
                        className={cn(
                          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg shadow-inner backdrop-blur-md transition-all duration-300",
                          isUnlocked
                            ? "border-white/15 bg-white/5"
                            : "border-white/10 bg-white/5 opacity-60"
                        )}
                      >
                        {isUnlocked ? (
                          achievement.iconUrl?.startsWith("http") ||
                          achievement.iconUrl?.startsWith("/") ? (
                            <img
                              src={
                                achievement.iconUrl?.startsWith("/")
                                  ? createUrl(achievement.iconUrl)
                                  : achievement.iconUrl
                              }
                              alt={achievement.title}
                              className="h-5 w-5 object-contain drop-shadow-md"
                            />
                          ) : (
                            achievement.iconUrl
                          )
                        ) : (
                          <Lock className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className={cn(
                            "truncate text-xs font-bold tracking-tight",
                            isUnlocked ? "text-slate-100" : "text-slate-400/80"
                          )}
                        >
                          {achievement.title}
                        </h3>
                        <p
                          className={cn(
                            "line-clamp-2 text-[11px] leading-snug select-none",
                            isUnlocked
                              ? "text-slate-300/80"
                              : "text-slate-500/60 blur-[3px] opacity-40 pointer-events-none"
                          )}
                        >
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[9px]">
                    <div className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono font-bold text-emerald-400">
                      <span>+{achievement.points || 10} pts</span>
                    </div>
                    {achievement.unlockedAt && (
                      <span className="font-mono text-slate-400">
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    ) : (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-xl backdrop-blur-2xl border-t-white/20 dark:bg-black/60 dark:border-white/12">
          <TextureOverlay texture="dots" opacity={0.03} />
          <div className="relative z-10 max-w-sm mx-auto space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-md backdrop-blur-md">
              <Award className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">No Matching Achievements</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Try adjusting your search query or rarity filter.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
