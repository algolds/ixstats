"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { MapPin } from "iconoir-react";
import { RaceResults } from "~/components/sports/league/RaceResults";
import { Card } from "~/components/ui/card";

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
      <Card className="space-y-3 p-12 text-center">
        <MapPin className="text-label-tertiary mx-auto h-12 w-12" />
        <h4 className="text-headline text-label">No Season Initialized</h4>
        <p className="text-footnote text-label-secondary">
          Start a season in the Command overview to generate the circuit schedule.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="space-y-4 p-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-card h-24 w-full" />
        ))}
      </Card>
    );
  }

  if (!races || races.length === 0) {
    return (
      <Card className="space-y-3 p-12 text-center">
        <MapPin className="text-label-tertiary mx-auto h-12 w-12" />
        <h4 className="text-headline text-label">No Grand Prix Results</h4>
        <p className="text-footnote text-label-secondary">
          Race classifications will appear once events are contested.
        </p>
      </Card>
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
