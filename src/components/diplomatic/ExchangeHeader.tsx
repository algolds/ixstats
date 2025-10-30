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

export const ExchangeHeader = React.memo<ExchangeHeaderProps>(({
  primaryCountry,
  achievements,
  filteredExchangesCount,
  isLoading,
  onCreateExchange,
  onShowPredictions,
  onShowLeaderboard,
  showPredictionPanel = false
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
          <RiGlobalLine className="h-6 w-6" />
          Cultural Exchange Program
          <span className="text-sm font-normal text-[--intel-silver] ml-2">
            ({filteredExchangesCount} exchanges)
          </span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
          )}
        </h3>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[--intel-silver] text-sm flex-1">
            Cross-cultural collaboration and diplomatic engagement for {primaryCountry.name}
          </p>
          {/* Achievement Badges */}
          {achievements.length > 0 && (
            <div className="flex items-center gap-1">
              {achievements.slice(0, 3).map(badge => (
                <div
                  key={badge.id}
                  className="w-8 h-8 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 border border-[--intel-gold]/40 rounded-full flex items-center justify-center text-lg cursor-pointer transition-colors"
                  title={`${badge.name}: ${badge.description}`}
                >
                  {badge.icon}
                </div>
              ))}
              {achievements.length > 3 && (
                <div className="text-xs text-[--intel-silver] ml-1">
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
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showPredictionPanel
                ? "bg-cyan-500/30 text-cyan-400 border border-cyan-500/50"
                : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
            )}
          >
            <RiBarChartLine className="h-4 w-4" />
            Predictions
          </button>
        )}

        {onShowLeaderboard && (
          <button
            onClick={onShowLeaderboard}
            className="flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiTrophyLine className="h-4 w-4" />
            Leaderboard
          </button>
        )}

        <button
          onClick={onCreateExchange}
          className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RiAddLine className="h-4 w-4" />
          Create Exchange
        </button>
      </div>
    </div>
  );
});

ExchangeHeader.displayName = "ExchangeHeader";
