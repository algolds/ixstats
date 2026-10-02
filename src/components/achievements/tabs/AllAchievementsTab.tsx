"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import {
  Lock,
  Trophy as Award,
  ViewGrid as LayoutGrid,
  List,
  Eye,
  EyeClosed as EyeOff,
  Crown as Diamond,
  Crown as Gem,
  Flash as Zap,
  Archery as Target,
  OnePointCircle as CircleDot,
  Component as Layers,
  Hexagon,
} from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard, MotionFacetCard } from "~/components/ui/facet-container";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { springSmooth } from "~/lib/design/motion";
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

interface AllAchievementsTabProps {
  achievements: any[] | undefined;
}

/** Trophy tier chip: a Badge variant plus an icon (colour never carries meaning alone). */
const ACHIEVEMENT_TIER_CONFIG: Record<
  TrophyTier,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: BadgeVariant;
  }
> = {
  platinum: { label: "Legendary", icon: Zap, badge: "yellow" },
  gold: { label: "Epic", icon: Gem, badge: "purple" },
  silver: { label: "Rare", icon: Hexagon, badge: "blue" },
  bronze: { label: "Core", icon: Target, badge: "neutral" },
};

/** Rarity filter: label and icon per option. */
const RARITY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  all: { label: "All", icon: Layers },
  Legendary: { label: "Legendary", icon: Zap },
  Epic: { label: "Epic", icon: Gem },
  Rare: { label: "Rare", icon: Hexagon },
  Uncommon: { label: "Uncommon", icon: Target },
  Common: { label: "Common", icon: CircleDot },
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
        // oxlint-disable-next-line
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
  const rawIconPath =
    item.iconPath || getAchievementGameIconPath(activeLevel.key, activeLevel.category);
  const iconPath = createUrl(rawIconPath);
  const isLegendaryOrEpic = activeLevel.rarity === "Legendary" || activeLevel.rarity === "Epic";

  return (
    // v2 (c5c6b382): unlocked achievements are glass cards that lift on hover, decorated with the
    // aurora / radiance / foil / ghost-heraldry backdrop; locked ones stay a dashed opaque slot.
    <MotionFacetCard
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
      variant={isUnlocked ? "glass" : undefined}
      accent={categoryTheme.accent}
      interactive={isUnlocked ? "hover" : undefined}
      className={cn(
        "flex flex-col justify-between overflow-hidden p-5",
        isUnlocked
          ? categoryTheme.cardBorderHover
          : "bg-surface-secondary border-dashed shadow-none select-none"
      )}
    >
      <AchievementCardBackdrop
        iconPath={iconPath}
        categoryTheme={categoryTheme}
        isUnlocked={!!isUnlocked}
        isLegendaryOrEpic={isLegendaryOrEpic}
      />

      {/* Status & tier */}
      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tierConfig.badge}>
              <TierIcon aria-hidden />
              <span>{tierConfig.label}</span>
            </Badge>

            {isUltraRare && (
              <Badge variant="teal" className="tabular-nums">
                <Diamond aria-hidden />
                <span>{activeLevel.globalUnlockPercent}% ultra-rare</span>
              </Badge>
            )}
          </div>

          <Badge variant={categoryTheme.badgeVariant}>
            <CategoryIcon aria-hidden />
            <span>{item.category}</span>
          </Badge>
        </div>

        {/* Icon, title and description */}
        <div className="flex items-start gap-4 pt-1">
          <motion.div
            animate={isPedestalShaking ? { x: [0, -6, 6, -5, 5, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.38, ease: [0.36, 0.07, 0.19, 0.97] }}
            onClick={() => {
              if (!isUnlocked) triggerLockedShake();
            }}
            className={cn(
              "rounded-row relative flex size-13 shrink-0 items-center justify-center select-none",
              isUnlocked
                ? categoryTheme.pedestal
                : "border-separator bg-fill-4 text-label-tertiary cursor-not-allowed border border-dashed"
            )}
          >
            <JewelAchievementIcon
              iconPath={iconPath}
              categoryTheme={categoryTheme}
              isUnlocked={!!isUnlocked}
              className="size-7.5"
            />
          </motion.div>

          <div className="min-w-0 flex-1 space-y-1">
            <h3
              className={cn(
                "text-headline truncate",
                isUnlocked ? "text-label" : "text-label-secondary"
              )}
            >
              {isSecret && !isRevealed ? "Secret milestone" : activeLevel.title}
            </h3>

            {/* Locked descriptions stay blurred (non-interactive) */}
            <p
              className={cn(
                "text-footnote pointer-events-none line-clamp-2 select-none",
                isUnlocked
                  ? "text-label-secondary"
                  : isSecret && !isRevealed
                    ? "text-label-tertiary opacity-40 blur-[3px]"
                    : "text-label-secondary opacity-60 blur-[2px]"
              )}
            >
              {isSecret && !isRevealed
                ? "Hidden challenge. Click the eye icon to preview secret details."
                : activeLevel.description}
            </p>
          </div>
        </div>
      </div>

      {/* Tier stepper & footer */}
      <div className="border-separator relative mt-4 space-y-3 border-t pt-3">
        {item.isSeries && item.levels.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-label-secondary text-footnote">Tiers</span>
              <div
                role="group"
                aria-label="Tiers"
                className="bg-fill-3 rounded-control flex items-center gap-1 p-0.5"
              >
                {item.levels.map((lvl: any, idx: number) => {
                  const lvlUnlocked = lvl.isUnlocked;
                  const isCurrent = inspectedIndex === idx;
                  const isShaking = shakingTierKey === lvl.key;

                  return (
                    <motion.button
                      type="button"
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
                      aria-pressed={isCurrent}
                      aria-disabled={!lvlUnlocked}
                      className={cn(
                        "rounded-control-sm text-caption duration-fast ease-out-facet focus-visible:outline-tint relative flex h-6 min-w-6 items-center justify-center px-2 tabular-nums transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2",
                        isCurrent
                          ? "bg-surface text-label shadow-card"
                          : lvlUnlocked
                            ? "text-success-ink hover:bg-fill-4 cursor-pointer"
                            : "text-label-tertiary cursor-not-allowed"
                      )}
                      title={`Level ${idx + 1}: ${lvl.title} (${lvlUnlocked ? "unlocked, select to view" : "locked tier"})`}
                    >
                      <span>{ROMAN_NUMERALS[idx] || idx + 1}</span>
                      {!lvlUnlocked && (
                        <Lock aria-hidden className="absolute -top-1 -right-1 size-3" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <span className="text-label-secondary text-footnote">
              <span className="font-data tabular-nums">
                {item.unlockedCount} / {item.totalLevels}
              </span>{" "}
              mastered
            </span>
          </div>
        )}

        {/* Points, secret toggle and date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSecret && (
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSecretReveal(activeLevel.key);
                }}
                title={isRevealed ? "Hide secret" : "Reveal secret"}
                aria-label={isRevealed ? "Hide secret" : "Reveal secret"}
                aria-pressed={isRevealed}
              >
                {isRevealed ? <EyeOff /> : <Eye />}
              </Button>
            )}

            <Badge variant="success" numeric className="select-none">
              {activeLevel.points || 10} pts
            </Badge>
          </div>

          <div className="text-footnote text-right">
            {isUnlocked && activeLevel.unlockedAt ? (
              <span className="text-label">
                Unlocked{" "}
                <span className="font-data tabular-nums">
                  {new Date(activeLevel.unlockedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            ) : (
              <span className="text-label-secondary inline-flex items-center gap-1">
                <Lock aria-hidden className="size-3.5" />
                Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </MotionFacetCard>
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
      counts[r] = groupedItems.filter((item) => item.levels.some((l) => l.rarity === r)).length;
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
    <section aria-labelledby="achievement-catalogue-title" className="space-y-4">
      {/* The catalogue's cards are h3s: name the section in the outline (after the showcase h2). */}
      <h2 id="achievement-catalogue-title" className="sr-only">
        Achievement catalogue
      </h2>
      {/* Search and filters */}
      <FacetCard
        padding="sm"
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <SearchField
          size="sm"
          placeholder="Search achievement series..."
          aria-label="Search achievement series"
          value={searchQuery}
          onValueChange={setSearchQuery}
          containerClassName="max-w-sm flex-1"
        />

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            aria-label="Rarity"
            size="sm"
            variant="pill"
            value={selectedRarity}
            onValueChange={(value) => setSelectedRarity(value || "all")}
            className="flex-wrap"
          >
            {rarities.map((r: string) => {
              const config = RARITY_CONFIG[r] ?? { label: r, icon: CircleDot };
              const RarityIcon = config.icon;
              const count = rarityCounts[r] ?? 0;
              return (
                <ToggleGroupItem key={r} value={r} className="gap-2">
                  <RarityIcon aria-hidden className="size-3.5" />
                  <span>{config.label}</span>
                  <span className="text-label-secondary font-data tabular-nums">{count}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          <SegmentedControl
            aria-label="Layout"
            size="sm"
            value={viewMode}
            onValueChange={setViewMode}
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid /> },
              { value: "list", label: "List", icon: <List /> },
            ]}
          />
        </div>
      </FacetCard>

      {/* Catalogue */}
      {filteredGroupedItems.length > 0 ? (
        <div
          className={cn(
            "relative max-h-[620px] overflow-y-auto pr-1",
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
        <FacetCard>
          <EmptyState
            icon={<Award />}
            title="No matching series"
            message="Try adjusting your search query or rarity filter."
          />
        </FacetCard>
      )}
    </section>
  );
}
