"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { focusRing, hitSlop } from "~/components/ui/button";
import { CutoutCard, CutoutCardContent, CutoutCardHeader } from "~/components/ui/cutout-card";
import { LensCard } from "~/components/ui/lens-card";
import { facetAccentStyle } from "~/lib/design/identity";
import { cn } from "~/lib/utils/cn";
import { getAchievementIcon, getCategoryTheme, type AchievementItem } from "./constants";

function formatEarnedDate(dateIso: string | null | undefined): string | null {
  if (!dateIso) return null;
  return new Date(dateIso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AchievementsSummaryCardProps {
  achievements: AchievementItem[] | undefined;
}

export function AchievementsSummaryCard({ achievements }: AchievementsSummaryCardProps) {
  const { earnedCount, totalCount, totalPoints, completionPct, categoryRatios } = useMemo(() => {
    const list = achievements ?? [];
    const active = list.filter((item) => !item.isLegacy);
    const earned = active.filter((item) => item.isUnlocked).length;
    const total = active.length;
    const points = list
      .filter((item) => item.isUnlocked)
      .reduce((sum, item) => sum + (item.points ?? 0), 0);
    const pct = total > 0 ? Math.round((earned / total) * 100) : 0;

    const byCategory = new Map<string, { earned: number; total: number }>();
    for (const item of active) {
      const cat = item.category || "General";
      const entry = byCategory.get(cat) ?? { earned: 0, total: 0 };
      entry.total += 1;
      if (item.isUnlocked) entry.earned += 1;
      byCategory.set(cat, entry);
    }

    const ratios = Array.from(byCategory.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => a.category.localeCompare(b.category));

    return {
      earnedCount: earned,
      totalCount: total,
      totalPoints: points,
      completionPct: pct,
      categoryRatios: ratios,
    };
  }, [achievements]);

  if (totalCount === 0) return null;

  return (
    <LensCard app="vault" content="data" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-headline text-label tabular-nums">
            {earnedCount.toLocaleString()} of {totalCount.toLocaleString()} earned
          </h2>
          <p className="text-footnote text-label-secondary tabular-nums">
            {completionPct}% catalogue mastery
          </p>
        </div>

        <div className="text-right">
          <div className="text-title-2 text-tint font-bold tabular-nums">
            {totalPoints.toLocaleString()} pts
          </div>
          <div className="text-caption text-label-secondary">Achievement score</div>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Catalogue mastery"
        aria-valuenow={earnedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        className="bg-fill-3 h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-tint duration-fast ease-out-facet h-full rounded-full transition-[width] motion-reduce:transition-none"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {categoryRatios.length > 0 && (
        <div className="border-separator flex flex-wrap gap-2 border-t pt-3">
          {categoryRatios.map(({ category, earned, total }) => {
            const theme = getCategoryTheme(category);
            const CatIcon = theme.icon;
            const catPct = total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0;

            return (
              <Link
                key={category}
                href={`/vault/achievements?category=${encodeURIComponent(category)}`}
                className={cn(
                  focusRing,
                  hitSlop,
                  "rounded-control-sm text-caption duration-fast inline-flex items-center gap-1.5 px-2.5 py-1 font-medium transition-opacity hover:opacity-85",
                  earned > 0 ? theme.pedestal : "bg-fill-3 text-label-secondary"
                )}
              >
                <CatIcon aria-hidden className="size-3.5 shrink-0" />
                <span>{theme.name}</span>
                <span className="tabular-nums">
                  {earned}/{total}
                </span>
                <span
                  aria-hidden
                  className="bg-fill-2 hidden h-1 w-6 overflow-hidden rounded-full sm:inline-block"
                >
                  <span
                    className={cn("block h-full rounded-full", theme.bar)}
                    style={{ width: `${catPct}%` }}
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </LensCard>
  );
}

interface RarestEarnedMedalsShelfProps {
  achievements: AchievementItem[] | undefined;
}

export function RarestEarnedMedalsShelf({ achievements }: RarestEarnedMedalsShelfProps) {
  const rarestMedals = useMemo(
    () =>
      (achievements ?? [])
        .filter((item) => item.isUnlocked)
        .sort((a, b) => (a.globalUnlockPercent ?? 100) - (b.globalUnlockPercent ?? 100))
        .slice(0, 3),
    [achievements]
  );

  if (rarestMedals.length === 0) return null;

  return (
    <section aria-labelledby="rarest-medals-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="rarest-medals-heading" className="text-headline text-label">
          Rarest earned medals
        </h2>
        <span className="text-caption text-label-secondary tabular-nums">
          Top {rarestMedals.length} by global rarity
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rarestMedals.map((medal) => {
          const theme = getCategoryTheme(medal.category);
          const CategoryIcon = theme.icon;
          const MedalIcon = getAchievementIcon(medal.iconUrl, medal.category);
          const rarityPct = Number((medal.globalUnlockPercent ?? 0).toFixed(1));
          const earnedDate = formatEarnedDate(medal.unlockedAt);

          return (
            <CutoutCard key={medal.key} style={facetAccentStyle(theme.accent)}>
              <CutoutCardHeader
                as="h3"
                icon={
                  <span className="text-facet-accent-ink inline-flex">
                    <MedalIcon />
                  </span>
                }
                className="bg-facet-accent-fill"
                trailing={
                  <Badge variant="default" className="tabular-nums">
                    {rarityPct}% of players
                  </Badge>
                }
              >
                {medal.title}
              </CutoutCardHeader>

              <CutoutCardContent className="space-y-4 pt-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "facet-recess rounded-row flex size-12 shrink-0 items-center justify-center",
                      theme.pedestal
                    )}
                  >
                    <MedalIcon aria-hidden className="size-6" />
                  </div>
                  <p className="text-footnote text-label-secondary line-clamp-2 min-w-0 flex-1">
                    {medal.description}
                  </p>
                </div>

                <div className="border-separator flex items-center justify-between gap-2 border-t pt-3">
                  <span
                    className={cn(
                      "text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                      theme.pedestal
                    )}
                  >
                    <CategoryIcon aria-hidden className="size-3.5" />
                    <span>{theme.name}</span>
                  </span>

                  <span className="text-footnote text-label-secondary tabular-nums">
                    +{medal.points ?? 0} pts{earnedDate ? ` · ${earnedDate}` : ""}
                  </span>
                </div>
              </CutoutCardContent>
            </CutoutCard>
          );
        })}
      </div>
    </section>
  );
}
