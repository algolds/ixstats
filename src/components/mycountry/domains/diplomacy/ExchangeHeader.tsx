"use client";

import { Globe, Plus, StatsReport, Trophy } from "iconoir-react";

import React from "react";
import { cn } from "~/lib/utils";
import type { Achievement } from "./cultural-exchange-types";

interface ExchangeHeaderProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
  };
  achievements: Achievement[];
  filteredExchangesCount: number;
  isLoading: boolean;
  onCreateExchange: () => void;
  onShowPredictions?: () => void;
  onShowLeaderboard?: () => void;
  showPredictionPanel?: boolean;
}

export const ExchangeHeader = React.memo<ExchangeHeaderProps>(
  ({
    primaryCountry,
    achievements,
    filteredExchangesCount,
    isLoading,
    onCreateExchange,
    onShowPredictions,
    onShowLeaderboard,
    showPredictionPanel = false,
  }) => {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-amber-600 dark:text-amber-400">
            <Globe className="h-5 w-5 shrink-0" />
            <span>Cultural Exchange Program</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({filteredExchangesCount} exchanges)
            </span>
            {isLoading && (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
            )}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Cross-cultural collaboration and diplomatic engagement for {primaryCountry.name}
            </p>
            {/* Achievement Badges */}
            {achievements.length > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                {achievements.slice(0, 3).map((badge) => (
                  <div
                    key={badge.id}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 text-sm transition-colors hover:bg-amber-500/30"
                    title={`${badge.name}: ${badge.description}`}
                  >
                    <span>{badge.icon}</span>
                  </div>
                ))}
                {achievements.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{achievements.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onShowPredictions && (
            <button
              type="button"
              onClick={onShowPredictions}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]",
                showPredictionPanel
                  ? "border border-cyan-500/50 bg-cyan-500/30 text-cyan-400"
                  : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
              )}
            >
              <StatsReport className="h-3.5 w-3.5" />
              Predictions
            </button>
          )}

          {onShowLeaderboard && (
            <button
              type="button"
              onClick={onShowLeaderboard}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 transition-all hover:bg-amber-500/30 active:scale-[0.98]"
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </button>
          )}

          <button
            type="button"
            onClick={onCreateExchange}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 transition-all hover:bg-amber-500/30 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Exchange
          </button>
        </div>
      </div>
    );
  }
);

ExchangeHeader.displayName = "ExchangeHeader";
