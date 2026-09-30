"use client";

import React from "react";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";

/** Club legacy: titles, all-time record and season-by-season finishes (plan 321 Step 4). */
export function ClubHistorySection({ teamId }: { teamId: string }) {
  const { data: history, isLoading } = api.sports.getTeamHistory.useQuery({ teamId });

  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-3xl rounded-2xl" />;

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
          <Card key={item.label} className="gap-1 rounded-2xl py-4 text-center">
            <Eyebrow className="block">{item.label}</Eyebrow>
            <p className="text-foreground text-2xl font-black tabular-nums">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-bold">Season by Season</CardTitle>
        </CardHeader>
        <CardContent className="divide-border/20 divide-y">
          {seasons.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs font-semibold">
              No season records yet.
            </p>
          ) : (
            seasons.map((season) => (
              <div
                key={season.seasonId}
                className="flex items-center justify-between py-2.5 text-xs first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-foreground font-bold">Season {season.seasonNumber}</p>
                  <p className="text-muted-foreground font-semibold tabular-nums">
                    {season.wins}W · {season.draws}D · {season.losses}L · {season.points} pts
                  </p>
                </div>
                {season.isChampion && (
                  <Badge variant="outline" className="text-xs font-bold">
                    <Trophy className="mr-1 h-3.5 w-3.5" /> Champion
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
