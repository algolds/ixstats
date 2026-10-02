"use client";

import React from "react";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Stat } from "~/components/ui/stat";
import { Skeleton } from "~/components/ui/skeleton";

/** Club legacy: titles, all-time record and season-by-season finishes (plan 321 Step 4). */
export function ClubHistorySection({ teamId }: { teamId: string }) {
  const { data: history, isLoading } = api.sports.getTeamHistory.useQuery({ teamId });

  if (isLoading) return <Skeleton className="rounded-card mx-auto h-64 max-w-3xl" />;

  const seasons = history ?? [];
  const titles = seasons.filter((s) => s.isChampion).length;
  const record = seasons.reduce(
    (acc, s) => ({
      wins: acc.wins + s.wins,
      draws: acc.draws + s.draws,
      losses: acc.losses + s.losses,
    }),
    { wins: 0, draws: 0, losses: 0 }
  );

  const summary = [
    { label: "Titles", value: String(titles) },
    { label: "Seasons", value: String(seasons.length) },
    { label: "All-time W-D-L", value: `${record.wins}-${record.draws}-${record.losses}` },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {summary.map((item) => (
          <Card key={item.label} padding="md">
            <Stat label={item.label} value={item.value} />
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle>Season by Season</CardTitle>
        </CardHeader>
        <CardContent className="divide-separator divide-y">
          {seasons.length === 0 ? (
            <p className="text-label-secondary text-footnote py-4 text-center">
              No season records yet.
            </p>
          ) : (
            seasons.map((season) => (
              <div
                key={season.seasonId}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-headline text-label">Season {season.seasonNumber}</p>
                  <p className="text-footnote text-label-secondary tabular-nums">
                    {season.wins}W · {season.draws}D · {season.losses}L · {season.points} pts
                  </p>
                </div>
                {season.isChampion && (
                  <Badge variant="caution">
                    <Trophy /> Champion
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
