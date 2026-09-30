"use client";

import React from "react";
import {
  Trophy,
  Coins,
  Group as Users,
  Shield,
  LightBulb as Lightbulb,
  Globe,
  Star,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { formatCensusValue } from "~/components/mycountry/shell/WorldCensusCard";
import type { Ranking, RankingCategory } from "~/types/mycountry";

export interface RankingItem {
  key: string;
  label: string;
  rank: number;
  totalCountries: number;
  valueString: string;
  icon: typeof Coins;
  color: string;
}

interface GlobalPositionRankingsProps {
  countryName: string;
  /** Loads this country's World Census (realm-scoped) when `rankings` is not passed. */
  countryId?: string;
  rankings?: RankingItem[];
  onRankClick?: (item: RankingItem) => void;
  onOpenCompare?: () => void;
  className?: string;
}

const CATEGORY_STYLE: Record<RankingCategory, { icon: typeof Coins; color: string }> = {
  "GDP per Capita": { icon: Coins, color: "#38bdf8" },
  "Total GDP": { icon: Coins, color: "#0ea5e9" },
  "GDP Growth": { icon: Star, color: "#22c55e" },
  Population: { icon: Users, color: "#34d399" },
  "Public Approval": { icon: Star, color: "#fbbf24" },
  Stability: { icon: Shield, color: "#f87171" },
  "Diplomatic Standing": { icon: Globe, color: "#c084fc" },
  Infrastructure: { icon: Lightbulb, color: "#818cf8" },
  "Debt to GDP": { icon: Coins, color: "#fb923c" },
  "Income Equality": { icon: Users, color: "#2dd4bf" },
};

/** Map server census rankings (mycountry.getRankings) to display items. */
export function toRankingItems(rankings: Ranking[]): RankingItem[] {
  return rankings.map((r) => ({
    key: r.category,
    label: r.category,
    rank: r.global.position,
    totalCountries: r.global.total,
    valueString: formatCensusValue(r),
    icon: CATEGORY_STYLE[r.category]?.icon ?? Star,
    color: CATEGORY_STYLE[r.category]?.color ?? "#94a3b8",
  }));
}

export function GlobalPositionRankings({
  countryName,
  countryId,
  rankings: rankingsProp,
  onRankClick,
  onOpenCompare,
  className,
}: GlobalPositionRankingsProps) {
  const census = api.mycountry.getRankings.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !rankingsProp && !!countryId, staleTime: 300_000 }
  );
  const rankings = rankingsProp ?? toRankingItems(census.data ?? []);

  return (
    <div
      className={cn(
        "facet-surface facet-refraction space-y-3.5 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              World Census
            </span>
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              {countryName}&apos;s position in its realm
            </h3>
          </div>
        </div>

        {onOpenCompare && (
          <button
            type="button"
            data-cuelume-press="soft"
            onClick={onOpenCompare}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.96] hover:bg-white/10"
          >
            <span>Compare</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {rankings.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {census.isLoading && !!countryId ? "Loading census…" : "No census data yet."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {rankings.map((item) => {
          const Icon = item.icon;
          const isTopTier = item.rank <= 3;

          return (
            <button
              key={item.key}
              type="button"
              data-cuelume-press="soft"
              onClick={() => onRankClick?.(item)}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.97] hover:border-white/20 hover:bg-white/[0.06]",
                isTopTier && "border-amber-500/20 bg-amber-500/[0.03]"
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-extrabold",
                    isTopTier
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border border-white/10 bg-white/5 text-foreground"
                  )}
                >
                  #{item.rank}
                  <span className="font-normal text-muted-foreground">/{item.totalCountries}</span>
                </span>
              </div>

              <div className="mt-2">
                <p className="truncate text-xs font-bold text-foreground">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.valueString}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
