"use client";

import React from "react";
import { Trophy, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";

export interface CollectorStandingRow {
  key: string;
  rank: number;
  name: string;
  achievementCount: number;
  rareAchievements: number;
  totalPoints: number;
  isViewer?: boolean;
}

export interface RealmCollectorFallbackEntry {
  countryId: string;
  countryName: string;
  achievementCount: number;
  rareAchievements: number;
  totalPoints: number;
}

export function LeaderboardRankPill({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className="bg-tint-fill text-tint text-caption inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 font-semibold tabular-nums">
        {rank}
      </span>
    );
  }
  return (
    <span className="text-callout text-label-secondary inline-block min-w-6 px-2 text-center tabular-nums">
      {rank}
    </span>
  );
}

function CollectorStandingsTable({ rows }: { rows: CollectorStandingRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={<Trophy />}
          title="No collector standings yet"
          message="Earn achievements across IxStates to appear on the collector board."
        />
      </Card>
    );
  }

  return (
    <Card content="data" padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-separator text-caption text-label-secondary border-b">
              <th scope="col" className="w-16 px-4 py-2.5 font-medium">
                Rank
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Collector
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                Earned
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                Rare tiers
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr
                key={entry.key}
                className="border-separator duration-fast hover:bg-fill-4 border-b transition-colors last:border-b-0"
              >
                <td className="px-4 py-2.5 align-middle">
                  <LeaderboardRankPill rank={entry.rank} />
                </td>
                <td className="px-4 py-2.5 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="text-callout text-label truncate font-medium">
                      {entry.name}
                    </span>
                    {entry.isViewer && <Badge variant="secondary">You</Badge>}
                  </div>
                </td>
                <td className="text-callout text-label-secondary hidden px-4 py-2.5 text-right align-middle tabular-nums sm:table-cell">
                  {entry.achievementCount.toLocaleString()}
                </td>
                <td className="text-callout text-label-secondary hidden px-4 py-2.5 text-right align-middle tabular-nums md:table-cell">
                  {entry.rareAchievements.toLocaleString()}
                </td>
                <td className="text-callout text-label px-4 py-2.5 text-right align-middle font-semibold tabular-nums">
                  {entry.totalPoints.toLocaleString()} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LivePlayerCollectorsBoard() {
  const {
    data: board,
    isLoading,
    isError,
    refetch,
  } = api.achievements.getPlayerLeaderboard.useQuery({ limit: 50 }, { staleTime: 60_000 });

  if (isError) {
    return (
      <Card>
        <EmptyState
          compact
          icon={<WarningCircle />}
          title="Collector standings didn't load"
          message="Please try again in a moment."
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card content="data" padding="md" aria-busy className="space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="rounded-control-sm h-10" />
        ))}
      </Card>
    );
  }

  const rows: CollectorStandingRow[] = (board ?? []).map((entry, idx) => ({
    key: `${entry.rank}-${entry.name}-${idx}`,
    rank: entry.rank,
    name: entry.name,
    achievementCount: entry.achievementCount,
    rareAchievements: entry.rareAchievements,
    totalPoints: entry.totalPoints,
    isViewer: entry.isViewer,
  }));

  return <CollectorStandingsTable rows={rows} />;
}

export interface LeaderboardTabProps {
  fallbackEntries?: RealmCollectorFallbackEntry[];
}

export function LeaderboardTab({ fallbackEntries = [] }: LeaderboardTabProps) {
  if (api.achievements.getPlayerLeaderboard?.useQuery) {
    return <LivePlayerCollectorsBoard />;
  }

  const rows: CollectorStandingRow[] = fallbackEntries.map((entry, idx) => ({
    key: entry.countryId,
    rank: idx + 1,
    name: entry.countryName,
    achievementCount: entry.achievementCount,
    rareAchievements: entry.rareAchievements,
    totalPoints: entry.totalPoints,
  }));

  return <CollectorStandingsTable rows={rows} />;
}
