"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Tournament as Swords } from "iconoir-react";
import { BracketView } from "~/components/sports/league/BracketView";
import { Card } from "~/components/ui/card";

interface LeagueBracketTabProps {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  onTeamClick?: (teamId: string) => void;
}

export function LeagueBracketTab({
  leagueId: _leagueId,
  activeSeasonId,
  latestSeasonId,
  onTeamClick,
}: LeagueBracketTabProps) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: brackets, isLoading } = api.sports.getBracket.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  if (!seasonId) {
    return (
      <Card className="space-y-3 p-12 text-center">
        <Swords className="text-label-tertiary mx-auto h-12 w-12" />
        <h4 className="text-headline text-label">No season initialized</h4>
        <p className="text-footnote text-label-secondary">
          Start a season in the Command overview to generate the championship tournament bracket.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="space-y-4 p-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-card h-16 w-full" />
        ))}
      </Card>
    );
  }

  if (!brackets || brackets.length === 0) {
    return (
      <Card className="space-y-3 p-12 text-center">
        <Swords className="text-label-tertiary mx-auto h-12 w-12" />
        <h4 className="text-headline text-label">No bracket matches generated</h4>
        <p className="text-footnote text-label-secondary">
          Tournament brackets will display once qualifying matches are seeded.
        </p>
      </Card>
    );
  }

  const mapped = brackets.map((b) => ({
    id: b.id,
    round: b.round,
    weightClass: b.weightClass ?? undefined,
    fighter1Id: b.fighter1Id,
    fighter2Id: b.fighter2Id,
    winnerId: b.winnerId ?? undefined,
    status: b.status,
    result: (b.result as Record<string, unknown>) ?? undefined,
  }));

  return <BracketView brackets={mapped} onTeamClick={onTeamClick} />;
}
