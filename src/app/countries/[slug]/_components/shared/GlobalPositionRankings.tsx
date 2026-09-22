"use client";

import React from "react";
import { motion } from "motion/react";
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
  rankings?: RankingItem[];
  onRankClick?: (item: RankingItem) => void;
  onOpenCompare?: () => void;
  className?: string;
}

const DEFAULT_RANKINGS: RankingItem[] = [
  {
    key: "gdp",
    label: "Gross Domestic Product",
    rank: 3,
    totalCountries: 82,
    valueString: "$40.2 Trillion",
    icon: Coins,
    color: "#38bdf8",
  },
  {
    key: "tech",
    label: "Technology & Innovation",
    rank: 2,
    totalCountries: 82,
    valueString: "Index 88/100",
    icon: Lightbulb,
    color: "#818cf8",
  },
  {
    key: "population",
    label: "Total Population",
    rank: 4,
    totalCountries: 82,
    valueString: "626.2 Million",
    icon: Users,
    color: "#34d399",
  },
  {
    key: "military",
    label: "Military Power",
    rank: 9,
    totalCountries: 82,
    valueString: "Index 72/100",
    icon: Shield,
    color: "#f87171",
  },
  {
    key: "diplomacy",
    label: "Diplomatic Influence",
    rank: 6,
    totalCountries: 82,
    valueString: "Index 68/100",
    icon: Globe,
    color: "#c084fc",
  },
  {
    key: "wellbeing",
    label: "Quality of Life",
    rank: 12,
    totalCountries: 82,
    valueString: "Score 82.4",
    icon: Star,
    color: "#fbbf24",
  },
];

export function GlobalPositionRankings({
  countryName,
  rankings = DEFAULT_RANKINGS,
  onRankClick,
  onOpenCompare,
  className,
}: GlobalPositionRankingsProps) {
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
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Global Benchmarks
            </span>
            <h3 className="text-sm font-bold tracking-tight text-foreground">Global Position</h3>
          </div>
        </div>

        {onOpenCompare && (
          <button
            type="button"
            data-cuelume-press="soft"
            onClick={onOpenCompare}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground transition-all duration-150 active:scale-[0.96] hover:bg-white/10"
          >
            <span>Compare</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

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
                "group relative flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-md transition-all duration-150 active:scale-[0.97] hover:border-white/20 hover:bg-white/[0.06]",
                isTopTier && "border-amber-500/20 bg-amber-500/[0.03]"
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                    isTopTier
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border border-white/10 bg-white/5 text-foreground"
                  )}
                >
                  #{item.rank}
                </span>
              </div>

              <div className="mt-2">
                <p className="truncate text-[11px] font-bold text-foreground">{item.label}</p>
                <p className="truncate text-[10px] text-muted-foreground">{item.valueString}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
