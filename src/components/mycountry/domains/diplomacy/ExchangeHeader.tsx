"use client";

import { Globe, Plus, StatsReport, Trophy } from "iconoir-react";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
          <h3
            className="text-label text-title-3 flex flex-wrap items-center gap-2"
            aria-busy={isLoading || undefined}
          >
            <Globe className="text-label-secondary h-4 w-4 shrink-0" />
            <span>Cultural Exchange Program</span>
            <span className="text-label-secondary text-footnote font-normal tabular-nums">
              {isLoading ? "Loading…" : `${filteredExchangesCount} exchanges`}
            </span>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-label-secondary text-footnote min-w-0 flex-1">
              Cross-cultural collaboration and diplomatic engagement for {primaryCountry.name}
            </p>
            {achievements.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {achievements.slice(0, 3).map((badge) => (
                  <Badge key={badge.id} variant="outline" title={badge.description}>
                    <Trophy className="text-yellow" />
                    {badge.name}
                  </Badge>
                ))}
                {achievements.length > 3 && (
                  <span className="text-label-secondary text-footnote">
                    +{achievements.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onShowPredictions && (
            <Button
              variant={showPredictionPanel ? "secondary" : "outline"}
              size="sm"
              onClick={onShowPredictions}
              aria-pressed={showPredictionPanel}
            >
              <StatsReport className="h-3.5 w-3.5" />
              Predictions
            </Button>
          )}

          {onShowLeaderboard && (
            <Button variant="outline" size="sm" onClick={onShowLeaderboard}>
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </Button>
          )}

          <Button
            size="sm"
            onClick={onCreateExchange}
            className="bg-yellow text-on-yellow hover:bg-yellow/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Exchange
          </Button>
        </div>
      </div>
    );
  }
);

ExchangeHeader.displayName = "ExchangeHeader";
