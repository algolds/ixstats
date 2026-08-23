"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Trophy as Award, ViewGrid as LayoutGrid, List, Eye, EyeClosed as EyeOff, Crown as Diamond, Search, Xmark as X, Crown as Gem, Flash as Zap, Archery as Target, OnePointCircle as CircleDot, Component as Layers, Hexagon, Check } from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import {
  rarities,
  getTrophyTier,
  type TrophyTier,
  groupAchievements,
  getAchievementGameIconPath,
  getCategoryTheme,
  type GroupedAchievementItem,
} from "../constants";
import { JewelAchievementIcon, AchievementCardBackdrop } from "../AchievementDecorations";
import { Input } from "~/components/ui/input";

interface AllAchievementsTabProps {
  achievements: any[] | undefined;
}

const ACHIEVEMENT_TIER_CONFIG: Record<
  TrophyTier,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    border: string;
    text: string;
  }
> = {
  platinum: {
    label: "Legendary",
    icon: Zap,
    bg: "bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-300 font-extrabold shadow-sm",
    border: "border-amber-500/40 shadow-sm",
    text: "text-amber-600 dark:text-amber-300 font-extrabold",
  },
  gold: {
    label: "Epic",
    icon: Gem,
    bg: "bg-purple-500/15 border-purple-500/35 text-purple-600 dark:text-purple-300 font-extrabold shadow-sm",
    border: "border-purple-500/40 shadow-sm",
    text: "text-purple-600 dark:text-purple-300 font-extrabold",
  },
  silver: {
    label: "Rare",
    icon: Hexagon,
    bg: "bg-blue-500/15 border-blue-500/35 text-blue-600 dark:text-blue-300 font-extrabold shadow-sm",
    border: "border-blue-500/40 shadow-sm",
    text: "text-blue-600 dark:text-blue-300 font-extrabold",
  },
  bronze: {
    label: "Core",
    icon: Target,
    bg: "bg-sky-500/15 border-sky-500/35 text-sky-600 dark:text-sky-300 font-extrabold shadow-sm",
    border: "border-sky-500/40 shadow-sm",
    text: "text-sky-600 dark:text-sky-300 font-bold",
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
    ringColor: string;
  }
> = {
  all: {
    label: "All",
    icon: Layers,
    color: "text-amber-500 dark:text-amber-400",
    activeBg: "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 shadow-sm",
    textColor: "text-amber-600 dark:text-amber-300 font-bold",
    ringColor: "ring-amber-500/20",
  },
  Legendary: {
    label: "Legendary",
    icon: Zap,
    color: "text-amber-500 dark:text-amber-400",
    activeBg: "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 shadow-sm",
    textColor: "text-amber-600 dark:text-amber-300 font-bold",
    ringColor: "ring-amber-500/20",
  },
  Epic: {
    label: "Epic",
    icon: Gem,
    color: "text-purple-500 dark:text-purple-400",
    activeBg: "bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold",
    textColor: "text-purple-600 dark:text-purple-300 font-bold",
    ringColor: "ring-purple-500/20",
  },
  Rare: {
    label: "Rare",
    icon: Hexagon,
    color: "text-blue-500 dark:text-blue-400",
    activeBg: "bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 font-bold",
    textColor: "text-blue-600 dark:text-blue-300 font-bold",
    ringColor: "ring-blue-500/20",
  },
  Uncommon: {
    label: "Uncommon",
    icon: Target,
    color: "text-emerald-500 dark:text-emerald-400",
    activeBg: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-bold",
    textColor: "text-emerald-600 dark:text-emerald-300 font-bold",
    ringColor: "ring-emerald-500/20",
  },
  Common: {
    label: "Common",
    icon: CircleDot,
    color: "text-muted-foreground",
    activeBg: "bg-muted/80 border border-border/60 text-foreground shadow-sm",
    textColor: "text-foreground font-bold",
    ringColor: "ring-border/40",
  },
};

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * Grouped Achievement Series Card with Unified Jewel Icon & Aurora-Watermark Backdrop
 */
function GroupedSeriesCard({
  item,
  selectedRarity,
  revealedSecrets,
  toggleSecretReveal,
}: {
  item: GroupedAchievementItem;
  selectedRarity: string;
  revealedSecrets: Set<string>;
  toggleSecretReveal: (k: string) => void;
}) {
  const [inspectedIndex, setInspectedIndex] = useState(item.currentTierIndex);
  const [shakingTierKey, setShakingTierKey] = useState<string | null>(null);
  const [isPedestalShaking, setIsPedestalShaking] = useState(false);

  // When selectedRarity changes, auto-focus matching unlocked tier if available
  useEffect(() => {
    if (selectedRarity !== "all") {
      const matchIdx = item.levels.findIndex((l) => l.rarity === selectedRarity);
      if (matchIdx !== -1 && item.levels[matchIdx].isUnlocked) {
        setInspectedIndex(matchIdx);
        return;
      }
    }
    setInspectedIndex(item.currentTierIndex);
  }, [selectedRarity, item.currentTierIndex, item.levels]);

  const triggerLockedShake = (key?: string) => {
    if (key) {
      setShakingTierKey(key);
      setTimeout(() => setShakingTierKey(null), 400);
    } else {
      setIsPedestalShaking(true);
      setTimeout(() => setIsPedestalShaking(false), 400);
    }
  };

  const activeLevel = item.levels[inspectedIndex] || item.levels[0];
  const isUnlocked = activeLevel?.isUnlocked;
  const isSecret =
    (activeLevel.key.startsWith("vid-") || activeLevel.key.startsWith("meme-")) && !isUnlocked;
  const isRevealed = revealedSecrets.has(activeLevel.key);
  const tier = getTrophyTier(activeLevel.rarity);
  const tierConfig = ACHIEVEMENT_TIER_CONFIG[tier];
  const TierIcon = tierConfig.icon;
  const isUltraRare = (activeLevel.globalUnlockPercent || 100) < 5;
  const categoryTheme = getCategoryTheme(item.category);
  const CategoryIcon = categoryTheme.icon;
  const rawIconPath = item.iconPath || getAchievementGameIconPath(activeLevel.key, activeLevel.category);
  const iconPath = createUrl(rawIconPath);
  const isLegendaryOrEpic = activeLevel.rarity === "Legendary" || activeLevel.rarity === "Epic";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      whileHover={isUnlocked ? { y: -3, scale: 1.008 } : { y: 0 }}
      whileTap={isUnlocked ? { scale: 0.985 } : {}}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/60 border-t-white/20 bg-card/75 p-5 shadow-xl backdrop-blur-2xl transition-all duration-300 dark:border-border/40 dark:border-t-white/10 dark:bg-card/60",
        isUnlocked && categoryTheme.cardBorderHover,
        !isUnlocked
          ? "border-dashed border-border/50 bg-muted/25 opacity-85 shadow-md select-none"
          : "hover:shadow-2xl"
      )}
    >
      {/* Background Texture & Ambient Artwork: 140px Ghost Watermark + Aurora Glass Mesh */}
      <AchievementCardBackdrop
        iconPath={iconPath}
        categoryTheme={categoryTheme}
        isUnlocked={!!isUnlocked}
        isLegendaryOrEpic={isLegendaryOrEpic}
      />

      {/* Top Status & Tier Bar */}
      <div className="relative z-10 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Rarity & Tier Badge */}
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase backdrop-blur-md transition-colors",
                tierConfig.bg
              )}
            >
              <TierIcon className="h-3 w-3" />
              <span>{tierConfig.label}</span>
            </span>

            {/* Ultra-Rare Diamond Pill */}
            {isUltraRare && (
              <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[9px] font-extrabold text-cyan-600 uppercase shadow-sm backdrop-blur-md dark:text-cyan-300">
                <Diamond className="h-3 w-3 animate-pulse text-cyan-500 dark:text-cyan-300" />
                <span>{activeLevel.globalUnlockPercent}% Ultra-Rare</span>
              </span>
            )}
          </div>

          {/* Category Tag with Icon */}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase backdrop-blur-md",
              categoryTheme.badge
            )}
          >
            <CategoryIcon className="h-2.5 w-2.5" />
            <span>{item.category}</span>
          </span>
        </div>

        {/* Main Content Info Block */}
        <div className="flex items-start gap-4 pt-1">
          {/* Game Icons SVG Pedestal with Metallic Jewel Gradient Mask & Rejection Shake if locked */}
          <motion.div
            animate={isPedestalShaking ? { x: [0, -6, 6, -5, 5, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.38, ease: [0.36, 0.07, 0.19, 0.97] }}
            onClick={() => {
              if (!isUnlocked) triggerLockedShake();
            }}
            className={cn(
              "relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border shadow-inner backdrop-blur-md transition-all duration-300 select-none",
              isUnlocked
                ? cn(categoryTheme.pedestal, "shadow-md group-hover:scale-105")
                : "cursor-not-allowed border-dashed border-border/60 bg-muted/30 text-muted-foreground/50 opacity-70 backdrop-blur-md"
            )}
          >
            <JewelAchievementIcon
              iconPath={iconPath}
              categoryTheme={categoryTheme}
              isUnlocked={!!isUnlocked}
              className="h-7.5 w-7.5"
            />
          </motion.div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "truncate text-sm font-extrabold tracking-tight transition-all",
                  isUnlocked ? "text-foreground" : "text-muted-foreground/70 blur-[0.5px]"
                )}
              >
                {isSecret && !isRevealed ? "Secret Milestone" : activeLevel.title}
              </h3>
            </div>

            {/* Blurred Locked Description (non-clickable) */}
            <p
              className={cn(
                "line-clamp-2 text-xs leading-snug font-medium transition-all duration-300 select-none pointer-events-none",
                isUnlocked
                  ? "text-muted-foreground"
                  : isSecret && !isRevealed
                    ? "text-muted-foreground/60 opacity-40 blur-[3px]"
                    : "text-muted-foreground/70 opacity-60 blur-[2px]"
              )}
            >
              {isSecret && !isRevealed
                ? "Hidden challenge. Click the eye icon to preview secret details."
                : activeLevel.description}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Level Stepper & Bottom Action Bar */}
      <div className="relative z-10 mt-4 space-y-3.5 border-t border-border/40 pt-3.5">
        {item.isSeries && item.levels.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Tiers:</span>
              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-0.5 shadow-inner backdrop-blur-md">
                {item.levels.map((lvl: any, idx: number) => {
                  const lvlUnlocked = lvl.isUnlocked;
                  const isCurrent = inspectedIndex === idx;
                  const isShaking = shakingTierKey === lvl.key;

                  return (
                    <motion.button
                      key={lvl.key}
                      animate={isShaking ? { x: [0, -6, 6, -5, 5, -2, 2, 0] } : { x: 0 }}
                      transition={{ duration: 0.38, ease: [0.36, 0.07, 0.19, 0.97] }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!lvlUnlocked) {
                          triggerLockedShake(lvl.key);
                          return;
                        }
                        setInspectedIndex(idx);
                      }}
                      className={cn(
                        "relative flex h-6 min-w-[24px] items-center justify-center rounded-lg px-1.5 font-mono text-[10px] font-bold transition-all select-none",
                        isCurrent
                          ? "bg-foreground text-background shadow-md"
                          : lvlUnlocked
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 active:scale-95 cursor-pointer dark:text-emerald-400"
                            : "cursor-not-allowed border border-border/30 bg-muted/20 text-muted-foreground/40 opacity-50 hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-500/70"
                      )}
                      title={`Level ${idx + 1}: ${lvl.title} (${lvlUnlocked ? "Unlocked - Click to view" : "Locked Tier (Immutable)"})`}
                    >
                      <span>{ROMAN_NUMERALS[idx] || idx + 1}</span>
                      {lvlUnlocked && !isCurrent && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      {!lvlUnlocked && (
                        <Lock className="absolute -top-0.5 -right-0.5 h-2 w-2 text-muted-foreground/50" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
              {item.unlockedCount} / {item.totalLevels} Mastered
            </span>
          </div>
        )}

        {/* Bottom Reward Points, Secret Toggle, & Date details */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {/* Secret Reveal Button */}
            {isSecret && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSecretReveal(activeLevel.key);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground active:scale-95"
                title={isRevealed ? "Hide Secret" : "Reveal Secret"}
              >
                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}

            {/* Clean Points Badge without '+' symbol */}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-600 tabular-nums shadow-sm backdrop-blur-md select-none dark:text-emerald-400">
              <span>{activeLevel.points || 10}</span>
              <span className="text-[9px] font-semibold tracking-wider text-emerald-600/80 uppercase dark:text-emerald-400/80">
                pts
              </span>
            </div>
          </div>

          {/* Date Details */}
          <div className="text-right text-[10px] text-muted-foreground">
            {isUnlocked && activeLevel.unlockedAt ? (
              <span className="font-mono font-bold text-foreground tabular-nums">
                Unlocked{" "}
                {new Date(activeLevel.unlockedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ) : (
              <span className="font-medium tracking-wide text-muted-foreground/60 uppercase">
                Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AllAchievementsTab({ achievements }: AllAchievementsTabProps) {
  const [selectedRarity, setSelectedRarity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const toggleSecretReveal = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Grouped Series representation
  const groupedItems = useMemo(() => {
    return groupAchievements(achievements || []);
  }, [achievements]);

  // Counts per rarity for badges in toggle
  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groupedItems.length };
    for (const r of rarities) {
      if (r === "all") continue;
      counts[r] = groupedItems.filter((item) =>
        item.levels.some((l) => l.rarity === r)
      ).length;
    }
    return counts;
  }, [groupedItems]);

  const filteredGroupedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groupedItems.filter((item) => {
      // Rarity filter: match if any level in series has the selected rarity
      if (selectedRarity !== "all") {
        const matchesRarity = item.levels.some((l) => l.rarity === selectedRarity);
        if (!matchesRarity) return false;
      }

      // Search filter
      if (q) {
        const nameMatch = item.seriesName?.toLowerCase().includes(q);
        const levelMatch = item.levels.some(
          (l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
        );
        return nameMatch || levelMatch;
      }
      return true;
    });
  }, [groupedItems, selectedRarity, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Apple Frosted Glass Filter & Search Control Center */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 border-t-white/15 bg-card/75 p-3.5 shadow-xl backdrop-blur-2xl transition-all dark:border-border/40 dark:border-t-white/10 dark:bg-card/60">
        <TextureOverlay texture="dots" opacity={0.03} />

        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Instant Search Field */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search achievement series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 rounded-full border-border/60 bg-background/60 pr-8 pl-8 text-xs font-medium text-foreground backdrop-blur-md transition-all placeholder:text-muted-foreground focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Enhanced Apple Rarity Segmented Control */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-border/60 bg-muted/40 p-1 shadow-inner backdrop-blur-md">
              {rarities.map((r: string) => {
                const isSelected = selectedRarity === r;
                const config = RARITY_CONFIG[r] || {
                  label: r,
                  icon: CircleDot,
                  color: "text-muted-foreground",
                  activeBg: "bg-muted/80 border border-border/60 text-foreground",
                  textColor: "text-foreground font-bold",
                  ringColor: "ring-border/40",
                };
                const RarityIcon = config.icon;
                const count = rarityCounts[r] ?? 0;

                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRarity(r)}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold capitalize transition-all duration-200 select-none active:scale-95",
                      isSelected ? config.textColor : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="rarity-active-pill"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        className={cn("absolute inset-0 rounded-full", config.activeBg)}
                      />
                    )}
                    <RarityIcon
                      className={cn(
                        "relative z-10 h-3 w-3 transition-colors",
                        isSelected ? config.color : "text-muted-foreground/70"
                      )}
                    />
                    <span className="relative z-10">{config.label}</span>
                    <span
                      className={cn(
                        "relative z-10 rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold tabular-nums transition-colors",
                        isSelected
                          ? "bg-background/80 text-foreground shadow-xs"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher (Grid / List) */}
            <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5 shadow-inner backdrop-blur-md select-none">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-6.5 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold transition-all active:scale-95",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3 w-3" />
                <span>Grid</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-6.5 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold transition-all active:scale-95",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="List View"
              >
                <List className="h-3 w-3" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Render */}
      <AnimatePresence mode="wait">
        {filteredGroupedItems.length > 0 ? (
          <div
            key="series-view"
            className={cn(
              "relative max-h-[620px] scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent overflow-y-auto pr-1.5 hover:scrollbar-thumb-border/70",
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                : "space-y-3"
            )}
          >
            {filteredGroupedItems.map((item) => (
              <GroupedSeriesCard
                key={item.seriesId || item.levels[0].key}
                item={item}
                selectedRarity={selectedRarity}
                revealedSecrets={revealedSecrets}
                toggleSecretReveal={toggleSecretReveal}
              />
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-border/60 border-t-white/15 bg-card/75 p-8 text-center shadow-xl backdrop-blur-2xl dark:border-border/40 dark:bg-card/60">
            <TextureOverlay texture="dots" opacity={0.03} />
            <div className="relative z-10 mx-auto max-w-sm space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 shadow-md backdrop-blur-md dark:text-amber-400">
                <Award className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <h3 className="text-xs font-bold text-foreground">No Matching Series</h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Try adjusting your search query or rarity filter.
              </p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
