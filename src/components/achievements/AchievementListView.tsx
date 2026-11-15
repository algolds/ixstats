"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeClosed as EyeOff } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button, focusRing, hitSlop } from "~/components/ui/button";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  getCategoryTheme,
  type AchievementItem,
  type CategoryTheme,
  type GroupedAchievementItem,
} from "./constants";
import {
  isSecretLockedLevel,
  resolveAchievementCopy,
  toRomanNumeral,
} from "./achievement-catalogue-helpers";

export type AchievementProgressStatus = "earned" | "in-progress" | "not-earned";

type ProgressAwareAchievement = AchievementItem & {
  current?: number;
  target?: number;
};

export interface AchievementRowState {
  status: AchievementProgressStatus;
  current: number;
  target: number;
  earnedPoints: number;
}

export function resolveAchievementRowState(item: GroupedAchievementItem): AchievementRowState {
  if (item.isComplete) {
    return {
      status: "earned",
      current: item.totalLevels,
      target: item.totalLevels,
      earnedPoints: item.earnedPoints || item.activeAchievement.points || 0,
    };
  }

  if (item.unlockedCount > 0) {
    return {
      status: "in-progress",
      current: item.unlockedCount,
      target: item.totalLevels,
      earnedPoints: item.earnedPoints,
    };
  }

  const active = item.activeAchievement as ProgressAwareAchievement;
  if (
    typeof active.current === "number" &&
    typeof active.target === "number" &&
    active.target > 0 &&
    active.current > 0
  ) {
    return {
      status: "in-progress",
      current: Math.min(active.current, active.target),
      target: active.target,
      earnedPoints: 0,
    };
  }

  return {
    status: "not-earned",
    current: 0,
    target: item.totalLevels,
    earnedPoints: 0,
  };
}

function defaultInspectedIndex(item: GroupedAchievementItem, focusIndex: number): number {
  if (focusIndex !== -1) return focusIndex;
  if (item.isSeries && item.unlockedCount > 0 && !item.isComplete) {
    return Math.min(item.unlockedCount, item.levels.length - 1);
  }
  return item.currentTierIndex;
}

interface SeriesTierPipsProps {
  seriesLabel: string;
  levels: AchievementItem[];
  inspectedIndex: number;
  pedestalClass: string;
  onSelectTier: (index: number) => void;
}

function SeriesTierPips({
  seriesLabel,
  levels,
  inspectedIndex,
  pedestalClass,
  onSelectTier,
}: SeriesTierPipsProps) {
  return (
    <span
      role="group"
      aria-label={`${seriesLabel} tiers`}
      className="inline-flex flex-wrap items-center gap-1"
    >
      {levels.map((level, idx) => {
        const numeral = toRomanNumeral(idx);
        const earned = Boolean(level.isUnlocked);
        const isCurrent = idx === inspectedIndex;
        const statusText = earned ? "earned" : "not earned";

        return (
          <React.Fragment key={level.key}>
            {idx > 0 && (
              <span aria-hidden className="text-caption text-label-quaternary select-none">
                ·
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelectTier(idx)}
              aria-pressed={isCurrent}
              aria-label={`Tier ${numeral}: ${level.title} (${statusText})`}
              className={cn(
                "rounded-control-sm text-caption duration-fast ease-out-facet relative inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center px-1.5 font-medium tabular-nums transition-colors select-none",
                focusRing,
                hitSlop,
                earned ? pedestalClass : "bg-fill-3 text-label-tertiary",
                isCurrent && "ring-label/30 ring-1"
              )}
            >
              {numeral}
            </button>
          </React.Fragment>
        );
      })}
    </span>
  );
}

interface AchievementCatalogRowProps {
  item: GroupedAchievementItem;
  theme: CategoryTheme;
  revealedSecrets: Set<string>;
  toggleSecretReveal: (key: string) => void;
  focusKey?: string;
}

function AchievementCatalogRow({
  item,
  theme,
  revealedSecrets,
  toggleSecretReveal,
  focusKey,
}: AchievementCatalogRowProps) {
  const rowRef = useRef<HTMLElement>(null);
  const focusTierIndex = focusKey ? item.levels.findIndex((lvl) => lvl.key === focusKey) : -1;
  const isFocused = Boolean(focusKey) && (item.seriesId === focusKey || focusTierIndex !== -1);

  const [manualTier, setManualTier] = useState<{
    index: number;
    focusKey?: string;
  } | null>(null);

  const inspectedIndex =
    manualTier && manualTier.focusKey === focusKey
      ? manualTier.index
      : defaultInspectedIndex(item, focusTierIndex);

  useEffect(() => {
    if (!isFocused) return;
    rowRef.current?.scrollIntoView?.({ block: "center" });
  }, [isFocused]);

  const activeLevel = item.levels[inspectedIndex] ?? item.levels[0]!;
  const isSecret = isSecretLockedLevel(activeLevel);
  const isRevealed = revealedSecrets.has(activeLevel.key);
  const copy = resolveAchievementCopy(activeLevel, isSecret, isRevealed);
  const rowState = resolveAchievementRowState(item);
  const Icon = item.icon;
  const isActiveOrEarned = item.isUnlocked || rowState.status === "in-progress";
  const progressPct =
    rowState.target > 0 ? Math.min(100, Math.round((rowState.current / rowState.target) * 100)) : 0;

  const titleNode = (
    <span className="flex flex-wrap items-center gap-2">
      <span>{item.isSeries ? (item.seriesName ?? copy.title) : copy.title}</span>
      {item.isLegacy && <Badge variant="default">Legacy</Badge>}
      {item.isSeries && item.levels.length > 1 && (
        <SeriesTierPips
          seriesLabel={item.seriesName ?? copy.title}
          levels={item.levels}
          inspectedIndex={inspectedIndex}
          pedestalClass={theme.pedestal}
          onSelectTier={(index) => setManualTier({ index, focusKey })}
        />
      )}
    </span>
  );

  const subtitleNode = item.isSeries ? `${copy.title}: ${copy.description}` : copy.description;

  const trailingNode = (
    <span className="flex items-center gap-2.5">
      {isSecret && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => toggleSecretReveal(activeLevel.key)}
          title={isRevealed ? "Hide secret" : "Reveal secret"}
          aria-label={isRevealed ? "Hide secret" : "Reveal secret"}
          aria-pressed={isRevealed}
        >
          {isRevealed ? <EyeOff /> : <Eye />}
        </Button>
      )}

      {rowState.status === "earned" ? (
        <span className="flex items-center gap-2">
          <span className="text-footnote text-label font-medium tabular-nums">
            +{rowState.earnedPoints.toLocaleString()} pts
          </span>
          <Badge variant="success">Earned</Badge>
        </span>
      ) : rowState.status === "in-progress" ? (
        <span className="flex flex-col items-end gap-1">
          <span className="text-footnote text-label font-medium tabular-nums">
            {rowState.current.toLocaleString()} / {rowState.target.toLocaleString()}
          </span>
          <span
            role="progressbar"
            aria-label={`${item.seriesName ?? copy.title} progress`}
            aria-valuenow={rowState.current}
            aria-valuemin={0}
            aria-valuemax={rowState.target}
            className="bg-fill-3 block h-1.5 w-16 overflow-hidden rounded-full"
          >
            <span
              className={cn(
                "duration-fast ease-out-facet block h-full rounded-full transition-[width] motion-reduce:transition-none",
                theme.bar
              )}
              style={{ width: `${progressPct}%` }}
            />
          </span>
        </span>
      ) : (
        <span className="flex flex-col items-end">
          <span className="text-footnote text-label-tertiary tabular-nums">
            {(activeLevel.points ?? 0).toLocaleString()} pts
          </span>
          <span className="text-caption text-label-tertiary">Not earned</span>
        </span>
      )}
    </span>
  );

  return (
    <FacetRow
      ref={rowRef}
      selected={isFocused}
      selectionStyle="tint"
      itemClassName={cn(item.isLegacy && "opacity-70 grayscale")}
      leading={
        <span
          className={cn(
            "facet-recess rounded-control flex size-9 shrink-0 items-center justify-center",
            isActiveOrEarned ? theme.pedestal : "text-label-tertiary"
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
      }
      title={titleNode}
      subtitle={subtitleNode}
      trailing={trailingNode}
    />
  );
}

export interface AchievementListViewProps {
  items: GroupedAchievementItem[];
  activeCategory: string;
  revealedSecrets: Set<string>;
  toggleSecretReveal: (key: string) => void;
  focusKey?: string;
}

export function AchievementListView({
  items,
  activeCategory,
  revealedSecrets,
  toggleSecretReveal,
  focusKey,
}: AchievementListViewProps) {
  const sections = useMemo(() => {
    if (activeCategory !== "all") {
      return [{ category: items[0]?.category ?? activeCategory, items }];
    }

    const byCategory = new Map<string, GroupedAchievementItem[]>();
    for (const item of items) {
      const cat = item.category || "General";
      const group = byCategory.get(cat) ?? [];
      group.push(item);
      byCategory.set(cat, group);
    }

    return Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, groupItems]) => ({ category, items: groupItems }));
  }, [items, activeCategory]);

  return (
    <FacetList>
      {sections.map((section) => {
        const sectionTheme = getCategoryTheme(section.category);
        const SectionIcon = sectionTheme.icon;
        const earnedInSection = section.items.filter((i) => i.isComplete).length;

        return (
          <FacetListSection
            key={section.category}
            header={
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "rounded-control-sm inline-flex size-5 items-center justify-center",
                    sectionTheme.pedestal
                  )}
                >
                  <SectionIcon className="size-3.5" />
                </span>
                <span className="text-label font-medium">{section.category}</span>
                <span className="text-caption text-label-secondary tabular-nums">
                  {earnedInSection}/{section.items.length}
                </span>
              </span>
            }
          >
            {section.items.map((item) => (
              <AchievementCatalogRow
                key={item.seriesId ?? item.levels[0]!.key}
                item={item}
                theme={getCategoryTheme(item.category)}
                revealedSecrets={revealedSecrets}
                toggleSecretReveal={toggleSecretReveal}
                focusKey={focusKey}
              />
            ))}
          </FacetListSection>
        );
      })}
    </FacetList>
  );
}
