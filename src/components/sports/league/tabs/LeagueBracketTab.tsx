"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Tournament as Swords } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { BracketView } from "~/components/sports/league/BracketView";

export interface LeagueBracketTabProps {
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
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-12 text-center backdrop-blur-xl space-y-3">
        <Swords className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="text-base font-bold text-foreground">No Season Initialized</h4>
        <p className="text-xs text-muted-foreground">Start a season in the Command overview to generate the championship tournament bracket.</p>
      </FacetCard>
    );
  }

  if (isLoading) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-8 backdrop-blur-xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </FacetCard>
    );
  }

  if (!brackets || brackets.length === 0) {
    return (
      <FacetCard depth={2} className="rounded-3xl border border-border/40 bg-card/60 p-12 text-center backdrop-blur-xl space-y-3">
        <Swords className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="text-base font-bold text-foreground">No Bracket Matches Generated</h4>
        <p className="text-xs text-muted-foreground">Tournament brackets will display once qualifying matches are seeded.</p>
      </FacetCard>
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

export default LeagueBracketTab;
