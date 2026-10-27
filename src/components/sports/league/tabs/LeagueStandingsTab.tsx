"use client";

import React from "react";
import { StandingsTable, type StandingsRow } from "~/components/sports/StandingsTable";
import { Skeleton } from "~/components/ui/skeleton";

interface LeagueStandingsTabProps {
  standings?: StandingsRow[];
  isLoading?: boolean;
  promotionCount?: number | null;
  relegationCount?: number | null;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onTeamClick: (teamId: string) => void;
}

export function LeagueStandingsTab({
  standings,
  isLoading,
  promotionCount,
  relegationCount,
  hasParentLeague,
  hasSubLeagues,
  onTeamClick,
}: LeagueStandingsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="rounded-card h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StandingsTable
        standings={standings ?? []}
        promotionCount={promotionCount}
        relegationCount={relegationCount}
        hasParentLeague={hasParentLeague}
        hasSubLeagues={hasSubLeagues}
        onTeamClick={onTeamClick}
      />
    </div>
  );
}
