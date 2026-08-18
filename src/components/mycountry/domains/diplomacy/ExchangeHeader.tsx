"use client";

import React from "react";
import { RiGlobalLine, RiAddLine, RiBarChartLine, RiTrophyLine } from "react-icons/ri";
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-bold text-[--intel-gold]">
            <RiGlobalLine className="h-6 w-6" />
            Cultural Exchange Program
            <span className="ml-2 text-sm font-normal text-[--intel-silver]">
              ({filteredExchangesCount} exchanges)
            </span>
            {isLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[--intel-gold]/20 border-t-[--intel-gold]" />
            )}
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-sm text-[--intel-silver]">
              Cross-cultural collaboration and diplomatic engagement for {primaryCountry.name}
            </p>
            {/* Achievement Badges */}
            {achievements.length > 0 && (
              <div className="flex items-center gap-1">
                {achievements.slice(0, 3).map((badge) => (
                  <div
                    key={badge.id}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[--intel-gold]/40 bg-[--intel-gold]/20 text-lg transition-colors hover:bg-[--intel-gold]/30"
                    title={`${badge.name}: ${badge.description}`}
                  >
                    {badge.icon}
                  </div>
                ))}
                {achievements.length > 3 && (
                  <div className="ml-1 text-xs text-[--intel-silver]">
                    +{achievements.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onShowPredictions && (
            <button
              onClick={onShowPredictions}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                showPredictionPanel
                  ? "border border-cyan-500/50 bg-cyan-500/30 text-cyan-400"
                  : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
              )}
            >
              <RiBarChartLine className="h-4 w-4" />
              Predictions
            </button>
          )}

          {onShowLeaderboard && (
            <button
              onClick={onShowLeaderboard}
              className="flex items-center gap-2 rounded-lg bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400 transition-colors hover:bg-purple-500/30"
            >
              <RiTrophyLine className="h-4 w-4" />
              Leaderboard
            </button>
          )}

          <button
            onClick={onCreateExchange}
            className="flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-2 text-sm font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
          >
            <RiAddLine className="h-4 w-4" />
            Create Exchange
          </button>
        </div>
      </div>
    );
  }
);

ExchangeHeader.displayName = "ExchangeHeader";
