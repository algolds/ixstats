"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { MapPin } from "iconoir-react";
import { RaceResults } from "~/components/sports/league/RaceResults";
import { FacetCard } from "~/components/ui/facet-container";

export interface LeagueRacesTabProps {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  onTeamClick?: (teamId: string) => void;
}

export function LeagueRacesTab({
  leagueId: _leagueId,
  activeSeasonId,
  latestSeasonId,
  onTeamClick: _onTeamClick,
}: LeagueRacesTabProps) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: races, isLoading } = api.sports.getRaceResults.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  if (!seasonId) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-12 text-center backdrop-blur-xl space-y-3">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="text-base font-bold text-foreground">No Season Initialized</h4>
        <p className="text-xs text-muted-foreground">Start a season in the Command overview to generate the circuit schedule.</p>
      </FacetCard>
    );
  }

  if (isLoading) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-8 backdrop-blur-xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </FacetCard>
    );
  }

  if (!races || races.length === 0) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-12 text-center backdrop-blur-xl space-y-3">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="text-base font-bold text-foreground">No Grand Prix Results</h4>
        <p className="text-xs text-muted-foreground">Race classifications will appear once events are contested.</p>
      </FacetCard>
    );
  }
  const mappedRaces = races.map((r) => ({
    id: r.id,
    raceNumber: r.raceNumber,
    circuitName: r.circuitName,
    status: r.status,
    weather: r.weather ?? undefined,
    grid: Array.isArray(r.grid)
      ? (r.grid as Array<{ driverId: string; driverName?: string; position: number }>)
      : undefined,
    results: Array.isArray(r.results)
      ? (r.results as Array<{
          driverId: string;
          driverName?: string;
          finishPosition: number;
          points: number;
          fastestLap?: boolean;
        }>)
      : undefined,
  }));

  return <RaceResults races={mappedRaces} />;
}

export default LeagueRacesTab;
