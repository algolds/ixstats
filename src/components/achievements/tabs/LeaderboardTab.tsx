"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection } from "~/components/ui/facet-list";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { PodiumCard, Row } from "./leaderboard-parts";

const LIMITS = [10, 25, 50, 100].map((l) => ({ value: String(l), label: String(l) }));

const detail = (e: { achievementCount: number; rareAchievements: number }) =>
  `${e.achievementCount} unlocked • ${e.rareAchievements} rare+`;

/** Players ranked by achievement points. The nation boards are `CountryLeaderboards` on /leaderboards. */
export function LeaderboardTab() {
  const [limit, setLimit] = useState(25);
  const { data: board, isLoading } = api.achievements.getPlayerLeaderboard.useQuery(
    { limit },
    { staleTime: 60_000 }
  );
  const podium = board && board.length >= 3 ? board.slice(0, 3) : [];

  return (
    <Card padding="lg" className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-label text-title-2">Achievement leaderboard</h2>
          <p className="text-label-secondary text-footnote">
            Top {limit} players by achievement points
          </p>
        </div>

        <SegmentedControl
          aria-label="Players displayed"
          size="sm"
          value={String(limit)}
          onValueChange={(value) => setLimit(Number(value))}
          options={LIMITS}
        />
      </div>

      {podium.length === 3 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {podium.map((entry, i) => (
            <PodiumCard
              key={`${i}-${entry.name}`}
              rank={(i + 1) as 1 | 2 | 3}
              name={entry.name}
              primary={`${entry.totalPoints} pts`}
              secondary={detail(entry)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <div aria-busy className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-14" />
          ))}
        </div>
      ) : board && board.length > 0 ? (
        <FacetList>
          <FacetListSection aria-label="Player rankings" groupClassName="bg-surface-secondary">
            {board.map((entry, i) => (
              <Row
                key={`${i}-${entry.name}`}
                rank={entry.rank}
                name={entry.name}
                primary={`${entry.totalPoints} pts`}
                secondary={detail(entry)}
                trailingBadge={entry.isViewer ? <Badge variant="default">You</Badge> : undefined}
              />
            ))}
          </FacetListSection>
        </FacetList>
      ) : (
        <EmptyState compact title="No achievements unlocked yet" />
      )}
    </Card>
  );
}
